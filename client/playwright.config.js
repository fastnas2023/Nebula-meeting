// client/playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'https://localhost:5173',
    trace: 'on-first-retry',
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
        },
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command:
      'bash -lc "SERVER_PORT=${SERVER_PORT:-5002}; ' +
      'cd ../server && PORT=$SERVER_PORT node index.js & ' +
      'cd ../client && VITE_SERVER_PORT=$SERVER_PORT npm run dev -- --host 0.0.0.0 --port 5173"',
    url: 'https://localhost:5173',
    reuseExistingServer: !process.env.CI,
    ignoreHTTPSErrors: true,
  },
});
