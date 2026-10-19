const path = require('node:path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  globalSetup: path.resolve('node_modules/@openpolyfill/firefox-addon-playwright-harness/dist/globalSetup.js'),
  testDir: './tests/e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    browserName: 'firefox',
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
  },
  webServer: {
    command: 'node tests/e2e/server.cjs',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false,
    timeout: 10_000,
  },
  projects: [{ name: 'firefox' }],
});
