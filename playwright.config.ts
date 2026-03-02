import { defineConfig } from '@playwright/test';

const E2E_CLIENT_PORT = 5199;
const E2E_SERVER_PORT = 3001;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${E2E_CLIENT_PORT}`,
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -w server',
      port: E2E_SERVER_PORT,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx -w client vite --port ${E2E_CLIENT_PORT} --strictPort`,
      port: E2E_CLIENT_PORT,
      reuseExistingServer: false,
    },
  ],
});
