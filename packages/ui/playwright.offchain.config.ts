import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env file for test runs
dotenv.config();

/**
 * Playwright configuration for offchain testing (no MetaMask/wallet interactions)
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/complete-workflow.spec.ts',
  
  /* Single worker for consistent testing */
  workers: 1,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* No retries for offchain tests */
  retries: 0,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Conditional headless mode - headed when HEADED=true, PAUSE=true, DEBUG, or PWDEBUG */
    headless: !process.env.HEADED && !process.env.PAUSE && !process.env.DEBUG && !process.env.PWDEBUG,
  },

  /* Set test timeout to allow for visual debugging */
  timeout: 600000,

  /* Configure for Chromium */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      REACT_APP_WALLETCONNECT_PROJECT_ID: '62626bd02bc0c91a73103509f9da4896',
      VITE_WALLETCONNECT_PROJECT_ID: '62626bd02bc0c91a73103509f9da4896',
      OFFCHAIN: 'true',
    },
  },
}); 