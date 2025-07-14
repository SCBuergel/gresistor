import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for MetaMask integration tests using dappwright
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/metamask-integration.spec.ts',
  
  /* Single worker for MetaMask tests to avoid conflicts */
  workers: 1,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* No retries for MetaMask tests to avoid state conflicts */
  retries: 0,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Always run headed for MetaMask tests to see the wallet interaction */
    headless: false,
  },

  /* Extended timeout for MetaMask operations */
  timeout: 120000,

  /* Configure for Chromium only since MetaMask extension works best with Chrome */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Additional Chrome args for extension support
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
          ],
        },
      },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 1000,
    env: {
      REACT_APP_WALLETCONNECT_PROJECT_ID: 'test-project-id-for-playwright',
      VITE_WALLETCONNECT_PROJECT_ID: 'test-project-id-for-playwright',
    },
  },
});
