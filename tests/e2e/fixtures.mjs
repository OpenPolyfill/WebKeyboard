import path from 'node:path';
import { test as baseTest, expect } from '@playwright/test';
import { createFirefoxFixtures } from '@openpolyfill/firefox-addon-playwright-harness/fixtures';
const privilegedExtension = process.env.WEBKEYBOARD_PRIVILEGED === '1';
const extensionPath = privilegedExtension ? 'dist-privileged/source' : 'src';

export const test = createFirefoxFixtures(baseTest, {
  extensionPath: path.resolve(extensionPath),
  headless: true,
  firefoxUserPrefs: {
    'extensions.experiments.enabled': true,
  },
});

export { expect };
