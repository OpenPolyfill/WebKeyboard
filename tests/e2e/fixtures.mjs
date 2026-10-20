import path from 'node:path';
import { test as baseTest, expect } from '@playwright/test';
import { createFirefoxFixtures } from '@openpolyfill/firefox-addon-playwright-harness/fixtures';

export const test = createFirefoxFixtures(baseTest, {
  extensionPath: path.resolve('src'),
  headless: true,
});

export { expect };
