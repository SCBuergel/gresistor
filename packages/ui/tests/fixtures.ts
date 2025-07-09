import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

/* Persistent browser profile directory */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const userDataDir = path.resolve(__dirname, '..', '.pw-profile');

// Clean up existing profile only at the very start
if (fs.existsSync(userDataDir) && !process.env.PW_PROFILE_INITIALIZED) {
  fs.rmSync(userDataDir, { recursive: true, force: true });
  console.log('🧹 Cleaned up existing browser profile for fresh test session');
  process.env.PW_PROFILE_INITIALIZED = 'true';
}

// Global context to persist between test files
let globalContext: BrowserContext | null = null;

export const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    if (!globalContext) {
      globalContext = await chromium.launchPersistentContext(userDataDir);
    }
    await use(globalContext);
  },
});

export const expect = test.expect;
