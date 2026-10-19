import { test, expect } from './fixtures.mjs';

test('per-origin selection updates KeyboardLayoutMap and emits layoutchange', async ({ page, context, extension }) => {
  let initial = null;
  // Retry cold-start policy denials with a fresh response; this route allows keyboard-map.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await page.goto(`/?policy-attempt=${attempt}`);
    initial = await page.evaluate(async () => {
      const keyboard = navigator.keyboard;
      if (typeof keyboard?.getLayoutMap !== 'function') {
        return {
          ok: false,
          error: { name: 'UnavailableError', message: 'navigator.keyboard.getLayoutMap is unavailable' },
          secure: isSecureContext,
          keyboard: typeof keyboard,
          method: typeof keyboard?.getLayoutMap,
        };
      }
      try {
        const map = await keyboard.getLayoutMap();
        return { ok: true, keyA: map.get('KeyA'), size: map.size };
      } catch (error) {
        return {
          ok: false,
          error: { name: error.name, message: error.message },
          secure: isSecureContext,
          keyboard: typeof keyboard,
          method: typeof keyboard.getLayoutMap,
        };
      }
    });
    if (initial?.ok && initial.keyA) break;
    if (!['SecurityError', 'UnavailableError'].includes(initial?.error?.name)) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(initial, JSON.stringify(initial)).toMatchObject({ ok: true, keyA: 'a' });
  expect(initial.size).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.layoutChangeCount = 0;
    navigator.keyboard.addEventListener('layoutchange', () => {
      window.layoutChangeCount += 1;
    });
  });

  const popup = await extension.activateAction(page, 'browserAction');
  await popup.waitForSelector('#editor');
  expect(await popup.evaluate(() => Boolean(document.querySelector('#editor')))).toBe(true);
  expect(await popup.evaluate(() =>
    [...document.querySelectorAll('#options button')]
      .find((button) => button.getAttribute('aria-selected') === 'true')?.textContent,
  )).toBe('System (currently US)');
  await popup.evaluate(() => {
    const button = [...document.querySelectorAll('#options button')]
      .find((candidate) => candidate.textContent === 'German');
    if (!button) throw new Error('German XKB preset is missing');
    button.click();
  });
  await page.waitForFunction(() => window.layoutChangeCount === 1);

  let german = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    german = await page.evaluate(async () => {
      try {
        const map = await navigator.keyboard.getLayoutMap();
        return { keyY: map.get('KeyY'), keyZ: map.get('KeyZ') };
      } catch {
        return null;
      }
    });
    if (german?.keyY === 'z' && german.keyZ === 'y') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(german).toEqual({ keyY: 'z', keyZ: 'y' });

  await page.reload();
  let persistedLayout = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    persistedLayout = await page.evaluate(async () => {
      try {
        return (await navigator.keyboard.getLayoutMap()).get('KeyY');
      } catch {
        return null;
      }
    });
    if (persistedLayout) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(persistedLayout).toBe('z');

  const otherOrigin = await context.newPage();
  let otherOriginState = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await otherOrigin.goto(`http://localhost:4173/?origin-attempt=${attempt}`);
    otherOriginState = await otherOrigin.evaluate(async () => {
      const keyboard = navigator.keyboard;
      if (typeof keyboard?.getLayoutMap !== 'function') {
        return {
          keyY: null,
          error: { name: 'UnavailableError', message: 'navigator.keyboard.getLayoutMap is unavailable' },
        };
      }
      try {
        const map = await keyboard.getLayoutMap();
        return { keyY: map.get('KeyY') ?? null, error: null };
      } catch (error) {
        return { keyY: null, error: { name: error.name, message: error.message } };
      }
    });
    if (otherOriginState.error === null && otherOriginState.keyY === 'y') break;
    if (!['SecurityError', 'UnavailableError'].includes(otherOriginState.error?.name)) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(otherOriginState, JSON.stringify(otherOriginState)).toMatchObject({
    keyY: 'y',
    error: null,
  });
  await otherOrigin.close();
});

test('Permissions Policy denial is enforced after an allowed decision', async ({ page }) => {
  let allowed = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await page.goto(`/?policy-prime=${attempt}`);
    allowed = await page.evaluate(async () => {
      try {
        const status = await navigator.permissions.query({ name: 'keyboard-map' });
        const map = await navigator.keyboard.getLayoutMap();
        return { permission: status.state, keyA: map.get('KeyA') };
      } catch (error) {
        return { permission: 'denied', errorName: error.name };
      }
    });
    if (allowed.permission === 'granted' && allowed.keyA === 'a') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect(allowed, JSON.stringify(allowed)).toEqual({ permission: 'granted', keyA: 'a' });

  await page.goto('/deny');
  await page.waitForFunction(() => typeof navigator.keyboard?.getLayoutMap === 'function');
  const policy = await page.evaluate(async () => {
    const permission = await navigator.permissions.query({ name: 'keyboard-map' });
    let errorName = '';
    try {
      await navigator.keyboard.getLayoutMap();
    } catch (error) {
      errorName = error.name;
    }
    return { permission: permission.state, errorName };
  });
  expect(policy).toEqual({ permission: 'denied', errorName: 'SecurityError' });
});


test('Keyboard Lock routes browser shortcuts in fullscreen and replaces pending requests', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof navigator.keyboard?.lock === 'function');
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page.evaluate(() => {
    window.lockedShortcut = null;
    document.addEventListener('keydown', (event) => {
      if (event.code === 'KeyW' && event.ctrlKey) {
        window.lockedShortcut = { code: event.code, ctrlKey: event.ctrlKey };
      }
    });
  });

  const shortcutLock = await page.evaluate(async () => {
    await navigator.keyboard.lock();
    return 'resolved';
  });
  expect(shortcutLock).toBe('resolved');
  await page.keyboard.press('Control+w');
  await expect.poll(() => page.evaluate(() => window.lockedShortcut)).toEqual({
    code: 'KeyW',
    ctrlKey: true,
  });
  expect(page.isClosed()).toBe(false);

  const replacement = await page.evaluate(async () => {
    const superseded = navigator.keyboard.lock(['KeyA']);
    const supersededResult = superseded.then(
      () => 'resolved',
      (error) => error.name,
    );
    await navigator.keyboard.lock(['KeyW']);
    return { superseded: await supersededResult };
  });
  expect(replacement).toEqual({ superseded: 'AbortError' });
  await page.evaluate(() => navigator.keyboard.unlock());
});

