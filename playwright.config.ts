import { defineConfig, devices } from '@playwright/test';

const deployment = process.env.PAGES_URL ? new URL(process.env.PAGES_URL) : undefined;
const previewBase = deployment?.pathname ?? './';
if (!/^(?:\.\/|\/[a-zA-Z0-9/_-]*)$/.test(previewBase)) throw new Error('Unsupported Pages URL path');
const remoteDeployment = deployment && !['localhost', '127.0.0.1'].includes(deployment.hostname);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14 Pro'], defaultBrowserType: 'webkit' } },
  ],
  webServer: remoteDeployment ? undefined : {
    command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort --base ${previewBase}`,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
