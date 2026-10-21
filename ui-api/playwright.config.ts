import { defineConfig, devices } from '@playwright/test';

import { loadEnvironmentConfig } from './src/config/env';

const environment = loadEnvironmentConfig();

export default defineConfig({
  testDir: './tests',
  timeout: environment.requestTimeout,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: environment.fullyParallel,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? environment.retries + 1 : environment.retries,
  workers: process.env.CI ? environment.workers : Math.max(1, environment.workers),
  metadata: {
    environment: environment.name,
    baseURL: environment.baseURL,
  },
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['allure-playwright', { outputFolder: 'allure-results' }],
    ['list'],
  ],
  use: {
    baseURL: environment.baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: environment.requestTimeout,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: {
          width: 1600,
          height: 1200,
        },
      },
    },
  ],
});
