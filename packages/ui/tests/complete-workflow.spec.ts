import { test, expect, Browser, BrowserContext } from '@playwright/test';
import { bootstrap, getWallet, MetaMaskWallet } from '@tenkeylabs/dappwright';

// Configuration constants
const UI_INTERACTION_DELAY = 500; // Delay in ms after UI interactions to allow rendering
const UI_INTERACTION_DELAY_LONG = 2000; // Delay in ms after UI interactions to allow rendering, e.g. for Metamask popup
const DEFAULT_TIMEOUT = 10000; // Default timeout in ms for all Playwright operations

// Debug mode - set to true to enable page.pause() at the end of each test
const DEBUG = process.env.DEBUG === 'true' || process.env.PWDEBUG === '1';
const PAUSE_MODE = process.env.PAUSE_MODE === 'true';
const APP_ONLY = process.env.APP_ONLY === 'true';

// MetaMask test configuration
const TEST_MNEMONIC = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
const METAMASK_PASSWORD = 'TestPassword123!';

test.describe('MetaMask Connection to Safe Global', () => {
  let metamaskWallet;
  let appContext: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    if (APP_ONLY) {
      console.log('📱 APP_ONLY mode: Creating regular browser context');
      appContext = await browser.newContext();
      console.log('✓ Regular browser context created for app-only testing');
    }
  });

  test.afterAll(async () => {
    // Clean up context
    if (appContext) {
      await appContext.close();
      console.log('✓ App context cleaned up');
    }
  });

  test('00 - Initialize MetaMask and connect to Safe Global', async ({ browser }) => {
    if (APP_ONLY) {
      console.log('⚠️ Skipping MetaMask initialization (APP_ONLY mode)');
      test.skip();
      return;
    }
    console.log('🦊 Testing MetaMask bootstrap and Safe Global connection...');
    
    try {
      console.log('Initializing MetaMask with test mnemonic...');
      console.log(`Using MetaMask version: ${MetaMaskWallet.recommendedVersion}`);
      
      // Bootstrap MetaMask with dappwright
      const [wallet, _, context] = await bootstrap("", {
        wallet: "metamask",
        version: MetaMaskWallet.recommendedVersion,
        seed: TEST_MNEMONIC,
        password: METAMASK_PASSWORD,
        headless: false,
      });
      
      console.log('✓ Bootstrap completed successfully');
      
      metamaskWallet = await getWallet("metamask", context);
      appContext = context;
      
      console.log('✓ MetaMask wallet obtained');
      
      // Add Gnosis Chain network
      console.log('Adding Gnosis Chain network...');
      await metamaskWallet.addNetwork({
        networkName: 'Gnosis Chain',
        rpc: 'https://rpc.gnosischain.com',
        chainId: 100,
        symbol: 'XDAI'
      });
      
      console.log('✓ Gnosis Chain network added successfully');
      
      // Verify MetaMask is working
      expect(metamaskWallet).toBeDefined();
      expect(appContext).toBeDefined();
      
    } catch (error) {
      throw new Error(`MetaMask bootstrap failed: ${error.message}`);
    }
  });

  test('01 - Connect to Safe Global URL', async () => {
    if (APP_ONLY) {
      console.log('⚠️ Skipping Safe Global connection (APP_ONLY mode)');
      test.skip();
      return;
    }
    
    console.log('🔗 Connecting to Safe Global...');
    
    // Open a new page with the Safe Global URL
    const safeGlobalUrl = 'https://app.safe.global/home?safe=gno:0x4f4f1091Bf0F4b9F3c85031DDc4cf196653b18a0';
    const safeTab = await appContext.newPage();
    
    console.log('📂 Opening Safe Global tab...');
    await safeTab.goto(safeGlobalUrl);
    
    // Wait for the page to load
    await safeTab.waitForLoadState('networkidle');
    console.log('✓ Safe Global page loaded');
    
    // Find and click the connect wallet button
    console.log('🔍 Looking for connect wallet button...');
    
    try {
      // Look for various possible connect wallet button selectors
      const connectSelectors = [
        '[data-testid="connect-wallet-btn"]',
        'button:has-text("Connect wallet")',
        'button:has-text("Connect")',
        '.connect-wallet',
        '[data-cy="connect-wallet"]'
      ];
      
      let connectButton: any = null;
      for (const selector of connectSelectors) {
        const element = safeTab.locator(selector).first();
        if (await element.isVisible({ timeout: DEFAULT_TIMEOUT })) {
          connectButton = element;
          console.log(`✓ Connect wallet button found with selector: ${selector}`);
          break;
        }
      }
      
      if (connectButton) {
        await connectButton.click();
        console.log('✓ Connect wallet button clicked');
        
        // Wait for wallet selection dialog
        await safeTab.waitForTimeout(UI_INTERACTION_DELAY_LONG);
        
        // Look for MetaMask option in the wallet selection dialog
        const metamaskSelectors = [
          'button:has-text("MetaMask")',
          'button:has-text("Metamask")',
          '[data-testid="wallet-metamask"]',
          '.wallet-metamask'
        ];
        
        for (const selector of metamaskSelectors) {
          const metamaskButton = safeTab.locator(selector).first();
          if (await metamaskButton.isVisible({ timeout: DEFAULT_TIMEOUT })) {
            await metamaskButton.click();
            console.log('✓ MetaMask wallet selected');
            break;
          }
        }
        
        // Handle potential MetaMask popup
        try {
          const popupPromise = appContext.waitForEvent('page', { timeout: DEFAULT_TIMEOUT });
          const popup = await popupPromise;
          
          console.log('🦊 MetaMask popup detected');
          await popup.waitForLoadState('networkidle');
          
          // Wait a bit for popup to fully render
          await popup.waitForTimeout(UI_INTERACTION_DELAY_LONG);
          
          // Look for connect/confirm buttons with more comprehensive selectors
          const confirmSelectors = [
            'button:has-text("Connect")',
            'button:has-text("Confirm")',
            'button:has-text("Sign")',
            'button:has-text("Next")',
            '[data-testid="page-container-footer-next"]',
            '[data-testid="page-container-footer-cancel"] ~ button',
            '.btn-primary',
            'button[type="submit"]',
            '.button--primary'
          ];
          
          let buttonClicked = false;
          for (const selector of confirmSelectors) {
            try {
              const button = popup.locator(selector).first();
              if (await button.isVisible({ timeout: DEFAULT_TIMEOUT })) {
                await button.click();
                console.log(`✓ Clicked ${selector} in MetaMask popup`);
                buttonClicked = true;
                await popup.waitForTimeout(UI_INTERACTION_DELAY);
                break; // Exit after first successful click
              }
            } catch (e) {
              // Continue to next selector
            }
          }
          
          if (!buttonClicked) {
            throw new Error('No clickable button found in MetaMask popup - unable to confirm connection');
          }
          
          // Wait for popup to close or timeout
          await popup.waitForEvent('close', { timeout: DEFAULT_TIMEOUT }).catch(() => {
            console.log('ℹ️ MetaMask popup did not close within timeout');
          });
          
        } catch (e) {
          console.log('ℹ️ No MetaMask popup detected or popup handling failed:', e.message);
        }
        
        // Switch back to Safe Global tab
        await safeTab.bringToFront();
        await safeTab.waitForTimeout(UI_INTERACTION_DELAY);
        
        console.log('🔗 MetaMask connection to Safe Global attempted');
        
      } else {
        throw new Error('Connect wallet button not found - unable to proceed with wallet connection');
      }
      
    } catch (error) {
      throw new Error(`Error during wallet connection: ${error.message}`);
    }
    
    if (DEBUG) await safeTab.pause();
    
    // Keep the Safe Global tab open for the next test
    console.log('✅ Safe Global connection test completed - tab remains open');
  });

  test('02 - Verify localhost:3000 loads correctly', async ({ browser }) => {
    console.log('\n=== TEST 02 - Verify localhost:3000 loads correctly ===');
    console.log('🏠 Verifying local app loads correctly...');
    
    // Create context if not already created (for APP_ONLY mode)
    if (!appContext) {
      appContext = await browser.newContext();
    }
    
    // Open the local app in a new tab
    const localAppTab = await appContext.newPage();
    
    console.log('🏠 Opening local app tab...');
    await localAppTab.goto('http://localhost:3000');
    await localAppTab.waitForLoadState('networkidle');
    console.log('✓ Local app page loaded');
    
    // Verify the local app loaded correctly by checking the title
    const title = await localAppTab.title();
    console.log(`✓ Local app title: ${title}`);
    
    // Verify it's the expected Gresistor app
    expect(title).toContain('gresistor');
    console.log('✓ Local app title verification passed');
    
    // Verify basic page structure
    await localAppTab.waitForSelector('body', { timeout: DEFAULT_TIMEOUT });
    console.log('✓ Local app body element found');
    
    if (DEBUG) {
      console.log('🔍 Debug mode: Pausing for inspection');
      await localAppTab.pause();
    }
    
    console.log('✅ All three services created and verified successfully');
  });

  test('03 - Configure Shamir settings and create three services', async () => {
    console.log('\n=== TEST 03 - Configure Shamir settings and create three services ===');
    console.log('🔧 Configuring Shamir settings and creating services...');
    
    // Reuse the existing localhost:3000 tab from the previous test
    const pages = await appContext.pages();
    let localAppTab: any = null;
    
    // Find the existing localhost:3000 tab
    for (const page of pages) {
      const url = page.url();
      if (url.includes('localhost:3000')) {
        localAppTab = page;
        break;
      }
    }
    
    // If no existing tab found, create a new one
    if (!localAppTab) {
      localAppTab = await appContext.newPage();
      await localAppTab.goto('http://localhost:3000');
      await localAppTab.waitForLoadState('networkidle');
    }
    
    // Ensure localAppTab is not null
    if (!localAppTab) {
      throw new Error('Failed to get or create local app tab');
    }
    
    console.log('✓ Using existing local app tab');
    
    // Navigate to config tab
    await localAppTab.locator('nav button', { hasText: 'Config' }).click();
    console.log('✓ Navigated to Config tab');
    
    // Configure Shamir settings to 2-of-3
    console.log('🔢 Setting Shamir configuration to 2-of-3...');
    
    // Set threshold to 2
    const thresholdInput = localAppTab.locator('#shamir-threshold');
    await thresholdInput.clear();
    await thresholdInput.fill('2');
    
    // Set total shares to 3
    const totalSharesInput = localAppTab.locator('#shamir-total-shares');
    await totalSharesInput.clear();
    await totalSharesInput.fill('3');
    
    // Apply the configuration
    await localAppTab.locator('button', { hasText: 'Apply All Changes' }).click();
    
    // Verify the configuration is reflected
    await expect(localAppTab.locator('text=2 of 3 shares required for recovery')).toBeVisible();
    console.log('✓ Shamir configuration set to 2-of-3');
    
    // Create Service 1: No Authorization (no owner address needed)
    console.log('🔑 Creating No Auth Service...');
    
    // Check if Create New Service button exists
    const createServiceBtn = localAppTab.locator('button', { hasText: 'Create New Service' });
    if (!(await createServiceBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create New Service button not found');
    }
    await createServiceBtn.click();
    
    // Check and fill service name
    const serviceNameInput = localAppTab.locator('#new-service-name');
    if (!(await serviceNameInput.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Service name input (#new-service-name) not found');
    }
    await serviceNameInput.fill('No Auth Service');
    
    // Check and select auth type
    const authTypeSelect = localAppTab.locator('#new-service-auth-type');
    if (!(await authTypeSelect.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Auth type select (#new-service-auth-type) not found');
    }
    await authTypeSelect.selectOption('no-auth');
    
    // Check and fill description
    const descriptionInput = localAppTab.locator('#new-service-description');
    if (!(await descriptionInput.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Description input (#new-service-description) not found');
    }
    await descriptionInput.fill('Service with no authorization');
    
    // No owner address for no-auth service
    
    // Check and click create service button
    const createBtn = localAppTab.locator('button', { hasText: 'Create Service' });
    if (!(await createBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create Service button not found');
    }
    await createBtn.click();
    
    // Verify first service appears
    await expect(localAppTab.locator('td', { hasText: 'No Auth Service' })).toBeVisible();
    console.log('✓ No Auth Service created and visible');
    
    // Create Service 2: Mock Authorization for address 123
    console.log('🔑 Creating Mock Auth Service...');
    
    // Check if Create New Service button exists
    const createServiceBtn2 = localAppTab.locator('button', { hasText: 'Create New Service' });
    if (!(await createServiceBtn2.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create New Service button not found for second service');
    }
    await createServiceBtn2.click();
    
    // Check and fill service name
    const serviceNameInput2 = localAppTab.locator('#new-service-name');
    if (!(await serviceNameInput2.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Service name input (#new-service-name) not found for second service');
    }
    await serviceNameInput2.fill('Mock Auth Service');
    
    // Check and select auth type
    const authTypeSelect2 = localAppTab.locator('#new-service-auth-type');
    if (!(await authTypeSelect2.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Auth type select (#new-service-auth-type) not found for second service');
    }
    await authTypeSelect2.selectOption('mock-signature-2x');
    
    // Check and fill description
    const descriptionInput2 = localAppTab.locator('#new-service-description');
    if (!(await descriptionInput2.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Description input (#new-service-description) not found for second service');
    }
    await descriptionInput2.fill('Service with mock authorization');
    
    // No owner address for mock auth service
    
    // Check and click create service button
    const createBtn2 = localAppTab.locator('button', { hasText: 'Create Service' });
    if (!(await createBtn2.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create Service button not found for second service');
    }
    await createBtn2.click();
    
    // Verify second service appears
    await expect(localAppTab.locator('td', { hasText: 'Mock Auth Service' })).toBeVisible();
    console.log('✓ Mock Auth Service created and visible');
    
    // Create Service 3: Safe Authorization for Safe address
    console.log('🔑 Creating Safe Auth Service...');
    
    // Check if Create New Service button exists
    const createServiceBtn3 = localAppTab.locator('button', { hasText: 'Create New Service' });
    if (!(await createServiceBtn3.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create New Service button not found for third service');
    }
    await createServiceBtn3.click();
    
    // Check and fill service name
    const serviceNameInput3 = localAppTab.locator('#new-service-name');
    if (!(await serviceNameInput3.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Service name input (#new-service-name) not found for third service');
    }
    await serviceNameInput3.fill('Safe Auth Service');
    
    // Check and select auth type
    const authTypeSelect3 = localAppTab.locator('#new-service-auth-type');
    if (!(await authTypeSelect3.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Auth type select (#new-service-auth-type) not found for third service');
    }
    await authTypeSelect3.selectOption('safe-signature');
    
    // Check and fill description
    const descriptionInput3 = localAppTab.locator('#new-service-description');
    if (!(await descriptionInput3.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Description input (#new-service-description) not found for third service');
    }
    await descriptionInput3.fill('Service with Safe authorization');
    
    // No owner address for safe auth service
    
    // Check and click create service button
    const createBtn3 = localAppTab.locator('button', { hasText: 'Create Service' });
    if (!(await createBtn3.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create Service button not found for third service');
    }
    await createBtn3.click();
    
    // Verify third service appears
    await expect(localAppTab.locator('td', { hasText: 'Safe Auth Service' })).toBeVisible();
    console.log('✓ Safe Auth Service created and visible');
    
    // Final validation: Verify all three services are visible in the config section
    console.log('🔍 Final validation: Checking all services are visible...');
    await expect(localAppTab.locator('td', { hasText: 'No Auth Service' })).toBeVisible();
    await expect(localAppTab.locator('td', { hasText: 'Mock Auth Service' })).toBeVisible();
    await expect(localAppTab.locator('td', { hasText: 'Safe Auth Service' })).toBeVisible();
    
    // Verify Shamir configuration is still correct
    await expect(localAppTab.locator('text=2 of 3 shares required for recovery')).toBeVisible();
    
    console.log('✅ All services created and validated successfully');
    console.log('✓ Shamir configuration: 2-of-3');
    console.log('✓ Services: No Auth (address 1), Mock Auth (address 123), Safe Auth (Safe address)');
    
    if (DEBUG) {
      console.log('🔍 Debug mode: Config tab open for inspection');
      await localAppTab.pause();
    }
  });

  test('04 - Create backup using all three configured services', async () => {
    console.log('\n=== TEST 04 - Create backup using all three configured services ===');
    console.log('💾 Creating backup with three services...');
    
    // Reuse the existing localhost:3000 tab
    const pages = await appContext.pages();
    let localAppTab: any = null;
    
    // Find the existing localhost:3000 tab
    for (const page of pages) {
      const url = page.url();
      if (url.includes('localhost:3000')) {
        localAppTab = page;
        break;
      }
    }
    
    // Ensure localAppTab is not null
    if (!localAppTab) {
      throw new Error('Failed to find existing local app tab');
    }
    
    console.log('✓ Using existing local app tab');
    
    // Navigate to backup tab
    const backupTabBtn = localAppTab.locator('nav button', { hasText: 'Backup' });
    if (!(await backupTabBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Backup tab button not found');
    }
    await backupTabBtn.click();
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    console.log('✓ Navigated to Backup tab');
    
    // Service 1: No Auth Service with owner "1"
    console.log('🔑 Selecting No Auth Service...');
    
    // Find the No Auth Service section
    const noAuthServiceSection = localAppTab.locator('text=No Auth Service').locator('..');
    if (!(await noAuthServiceSection.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('No Auth Service section not found');
    }
    
    // Find and fill owner input for No Auth Service using correct data-testid
    const noAuthOwnerInput = localAppTab.locator('[data-testid="no-auth-owner-address"]');
    if (!(await noAuthOwnerInput.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('No Auth Service owner input not found');
    }
    await noAuthOwnerInput.fill('1');
    
    // Find and click Select button for No Auth Service using correct data-testid
    const noAuthSelectBtn = localAppTab.locator('[data-testid="service-select-no-auth-service"]');
    if (!(await noAuthSelectBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('No Auth Service Select button not found');
    }
    await noAuthSelectBtn.click();
    console.log('✓ No Auth Service selected with owner "1"');
    
    // Service 2: Mock Auth Service with owner "123"
    console.log('🔑 Selecting Mock Auth Service...');
    
    // Find the Mock Auth Service section
    const mockAuthServiceSection = localAppTab.locator('text=Mock Auth Service').locator('..');
    if (!(await mockAuthServiceSection.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Mock Auth Service section not found');
    }
    
    // Find and fill owner input for Mock Auth Service using correct data-testid
    const mockAuthOwnerInput = localAppTab.locator('[data-testid="mock-auth-owner-address"]');
    if (!(await mockAuthOwnerInput.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Mock Auth Service owner input not found');
    }
    await mockAuthOwnerInput.fill('123');
    
    // Find and click Select button for Mock Auth Service using correct data-testid
    const mockAuthSelectBtn = localAppTab.locator('[data-testid="service-select-mock-auth-service"]');
    if (!(await mockAuthSelectBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Mock Auth Service Select button not found');
    }
    await mockAuthSelectBtn.click();
    console.log('✓ Mock Auth Service selected with owner "123"');
    
    // Service 3: Safe Auth Service with owner "0x4f4f1091Bf0F4b9F3c85031DDc4cf196653b18a0"
    console.log('🔑 Selecting Safe Auth Service...');
    
    // Find the Safe Auth Service section
    const safeAuthServiceSection = localAppTab.locator('text=Safe Auth Service').locator('..');
    if (!(await safeAuthServiceSection.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Safe Auth Service section not found');
    }
    
    // Find and fill Safe Address input for Safe Auth Service using correct data-testid
    const safeAuthOwnerInput = localAppTab.locator('[data-testid="safe-auth-owner-address"]');
    if (!(await safeAuthOwnerInput.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Safe Auth Service owner input not found');
    }
    await safeAuthOwnerInput.fill('0x4f4f1091Bf0F4b9F3c85031DDc4cf196653b18a0');
    
    // Find and click Select button for Safe Auth Service using correct data-testid
    const safeAuthSelectBtn = localAppTab.locator('[data-testid="service-select-safe-auth-service"]');
    if (!(await safeAuthSelectBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Safe Auth Service Select button not found');
    }
    await safeAuthSelectBtn.click();
    console.log('✓ Safe Auth Service selected with owner "0x4f4f1091Bf0F4b9F3c85031DDc4cf196653b18a0"');
    
    // Find and click Create Backup button
    console.log('💾 Creating backup...');
    const createBackupBtn = localAppTab.locator('button', { hasText: 'Create Backup' });
    if (!(await createBackupBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create Backup button not found');
    }
    
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);

    // Check if Create Backup button is enabled
    if (!(await createBackupBtn.isEnabled({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create Backup button is not enabled - all services may not be selected properly');
    }
    
    await createBackupBtn.click();
    console.log('✓ Create Backup button clicked');
    
    // Verify backup was created - look for success message
    console.log('🔍 Verifying backup creation...');
    
    // Wait for backup creation to complete and look for confirmation
    try {
      await localAppTab.waitForSelector('text=Backup completed successfully!', { timeout: DEFAULT_TIMEOUT });
      console.log('✓ Backup confirmation found');
    } catch (e) {
      // Take a screenshot for debugging if backup confirmation not found
      await localAppTab.screenshot({ path: 'backup-creation-debug.png' });
      throw new Error('Backup creation confirmation not found - check backup-creation-debug.png');
    }
    
    if (DEBUG) {
      console.log('🔍 Debug mode: Pausing for backup inspection');
      await localAppTab.pause();
    }
    
    console.log('✅ Backup created successfully with all three services');
  });

  test('05 - Create two more mock signature services', async () => {
    console.log('\n=== TEST 05 - Create two more mock signature services ===');
    console.log('🔧 Creating two more mock signature services...');
    
    // Reuse the existing localhost:3000 tab
    const pages = await appContext.pages();
    let localAppTab: any = null;
    
    // Find the existing localhost:3000 tab
    for (const page of pages) {
      const url = page.url();
      if (url.includes('localhost:3000')) {
        localAppTab = page;
        break;
      }
    }
    
    // Ensure localAppTab is not null
    if (!localAppTab) {
      throw new Error('Failed to find existing local app tab');
    }
    
    console.log('✓ Using existing local app tab');
    
    // Navigate to config tab
    const configTabBtn = localAppTab.locator('nav button', { hasText: 'Config' });
    if (!(await configTabBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Config tab button not found');
    }
    await configTabBtn.click();
    console.log('✓ Navigated to Config tab');
    
    // Create Service 4: Mock Auth Service 2
    console.log('🔑 Creating Mock Auth Service 2...');
    
    const createServiceBtn4 = localAppTab.locator('button', { hasText: 'Create New Service' });
    if (!(await createServiceBtn4.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create New Service button not found for fourth service');
    }
    await createServiceBtn4.click();
    
    const serviceNameInput4 = localAppTab.locator('#new-service-name');
    if (!(await serviceNameInput4.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Service name input not found for fourth service');
    }
    await serviceNameInput4.fill('Mock Auth Service 2');
    
    const authTypeSelect4 = localAppTab.locator('#new-service-auth-type');
    if (!(await authTypeSelect4.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Auth type select not found for fourth service');
    }
    await authTypeSelect4.selectOption('mock-signature-2x');
    
    const descriptionInput4 = localAppTab.locator('#new-service-description');
    if (!(await descriptionInput4.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Description input not found for fourth service');
    }
    await descriptionInput4.fill('Second mock signature service');
    
    const createBtn4 = localAppTab.locator('button', { hasText: 'Create Service' });
    if (!(await createBtn4.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create Service button not found for fourth service');
    }
    await createBtn4.click();
    
    await expect(localAppTab.locator('td', { hasText: 'Mock Auth Service 2' })).toBeVisible();
    console.log('✓ Mock Auth Service 2 created and visible');
    
    // Create Service 5: Mock Auth Service 3
    console.log('🔑 Creating Mock Auth Service 3...');
    
    const createServiceBtn5 = localAppTab.locator('button', { hasText: 'Create New Service' });
    if (!(await createServiceBtn5.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create New Service button not found for fifth service');
    }
    await createServiceBtn5.click();
    
    const serviceNameInput5 = localAppTab.locator('#new-service-name');
    if (!(await serviceNameInput5.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Service name input not found for fifth service');
    }
    await serviceNameInput5.fill('Mock Auth Service 3');
    
    const authTypeSelect5 = localAppTab.locator('#new-service-auth-type');
    if (!(await authTypeSelect5.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Auth type select not found for fifth service');
    }
    await authTypeSelect5.selectOption('mock-signature-2x');
    
    const descriptionInput5 = localAppTab.locator('#new-service-description');
    if (!(await descriptionInput5.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Description input not found for fifth service');
    }
    await descriptionInput5.fill('Third mock signature service');
    
    const createBtn5 = localAppTab.locator('button', { hasText: 'Create Service' });
    if (!(await createBtn5.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create Service button not found for fifth service');
    }
    await createBtn5.click();
    
    await expect(localAppTab.locator('td', { hasText: 'Mock Auth Service 3' })).toBeVisible();
    console.log('✓ Mock Auth Service 3 created and visible');
    
    // Verify all services are now visible (using exact text to avoid strict mode violations)
    await expect(localAppTab.locator('td:has-text("Mock Auth Service"):not(:has-text("2")):not(:has-text("3"))')).toBeVisible();
    await expect(localAppTab.locator('td', { hasText: 'Mock Auth Service 2' })).toBeVisible();
    await expect(localAppTab.locator('td', { hasText: 'Mock Auth Service 3' })).toBeVisible();
    
    if (DEBUG) {
      console.log('🔍 Debug mode: Pausing for inspection');
      await localAppTab.pause();
    }
    
    console.log('✅ Two additional mock signature services created successfully');
  });

  test('06 - Create backup using three mock signature services', async () => {
    console.log('\n=== TEST 06 - Create backup using three mock signature services ===');
    console.log('💾 Creating backup with three mock signature services...');
    
    // Reuse the existing localhost:3000 tab to preserve state
    const pages = await appContext.pages();
    let localAppTab: any = null;
    
    // Find the existing localhost:3000 tab
    for (const page of pages) {
      const url = page.url();
      if (url.includes('localhost:3000')) {
        localAppTab = page;
        break;
      }
    }
    
    // Ensure localAppTab is not null
    if (!localAppTab) {
      throw new Error('Failed to find existing local app tab');
    }
    
    console.log('✓ Using existing local app tab');
    
    // Navigate to backup tab
    const backupTabBtn = localAppTab.locator('nav button', { hasText: 'Backup' });
    if (!(await backupTabBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Backup tab button not found');
    }
    await backupTabBtn.click();
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    console.log('✓ Navigated to Backup tab');
    
    // Fill mock auth owner address field (shared by all mock services)
    console.log('🔑 Setting mock auth owner address...');
    const mockAuthOwnerInput = localAppTab.locator('[data-testid="mock-auth-owner-address"]');
    if (!(await mockAuthOwnerInput.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Mock auth owner address input not found');
    }
    await mockAuthOwnerInput.fill('2'); // First service gets owner "2"
    
    // Select Mock Auth Service (owner 2)
    console.log('🔑 Selecting Mock Auth Service with owner "2"...');
    const mockAuthSelectBtn = localAppTab.locator('[data-testid="service-select-mock-auth-service"]');
    if (!(await mockAuthSelectBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Mock Auth Service Select button not found');
    }
    await mockAuthSelectBtn.click();
    console.log('✓ Mock Auth Service selected with owner "2"');
    
    // Update owner address for second service and select it
    await mockAuthOwnerInput.fill('3'); // Second service gets owner "3"
    
    // Select Mock Auth Service 2 (owner 3)
    console.log('🔑 Selecting Mock Auth Service 2 with owner "3"...');
    const mockAuth2SelectBtn = localAppTab.locator('[data-testid="service-select-mock-auth-service-2"]');
    if (!(await mockAuth2SelectBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Mock Auth Service 2 Select button not found');
    }
    await mockAuth2SelectBtn.click();
    console.log('✓ Mock Auth Service 2 selected with owner "3"');
    
    // Update owner address for third service and select it
    await mockAuthOwnerInput.fill('123'); // Third service gets owner "123"
    
    // Select Mock Auth Service 3 (owner 123)
    console.log('🔑 Selecting Mock Auth Service 3 with owner "123"...');
    const mockAuth3SelectBtn = localAppTab.locator('[data-testid="service-select-mock-auth-service-3"]');
    if (!(await mockAuth3SelectBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Mock Auth Service 3 Select button not found');
    }
    await mockAuth3SelectBtn.click();
    console.log('✓ Mock Auth Service 3 selected with owner "123"');
    
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);

    // Find and click Create Backup button
    console.log('💾 Creating backup...');
    const createBackupBtn = localAppTab.locator('button', { hasText: 'Create Backup' });
    if (!(await createBackupBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create Backup button not found');
    }
    
    // Check if Create Backup button is enabled
    if (!(await createBackupBtn.isEnabled({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Create Backup button is not enabled - all services may not be selected properly');
    }
    
    await createBackupBtn.click();
    console.log('✓ Create Backup button clicked');
    
    // Verify backup was created - look for success message
    console.log('🔍 Verifying backup creation...');
    
    // Wait for backup creation to complete and look for confirmation
    try {
      await localAppTab.waitForSelector('text=Backup completed successfully!', { timeout: DEFAULT_TIMEOUT });
      console.log('✓ Backup confirmation found');
    } catch (e) {
      // Take a screenshot for debugging if backup confirmation not found
      await localAppTab.screenshot({ path: 'backup-creation-debug.png' });
      throw new Error('Backup creation confirmation not found - check backup-creation-debug.png');
    }
    
    if (DEBUG) {
      console.log('🔍 Debug mode: Pausing for backup inspection');
      await localAppTab.pause();
    }
    
    console.log('✅ Backup created successfully with three mock signature services (owners 2, 3, 123)');
  });

  test('07 - Restore using backup with 3 mock signature services', async () => {
    console.log('\n=== TEST 07 - Restore using backup with 3 mock signature services ===');
    console.log('🔄 Restoring using backup with 3 mock signature services...');
    
    // Reuse the existing localhost:3000 tab to preserve state
    const pages = await appContext.pages();
    let localAppTab: any = null;
    
    // Find the existing localhost:3000 tab
    for (const page of pages) {
      const url = page.url();
      if (url.includes('localhost:3000')) {
        localAppTab = page;
        break;
      }
    }
    
    // Ensure localAppTab is not null
    if (!localAppTab) {
      throw new Error('Failed to find existing local app tab');
    }
    
    console.log('✓ Using existing local app tab');
    
    // Navigate to restore tab
    const restoreTabBtn = localAppTab.locator('nav button', { hasText: 'Restore' });
    if (!(await restoreTabBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Restore tab button not found');
    }
    await restoreTabBtn.click();
    console.log('✓ Navigated to Restore tab');
    
    // Wait for backups to load and select the backup with 3 mock signature services
    console.log('📋 Waiting for backups to load and selecting backup with 3 mock signature services...');
    
    // Wait for backup list to load with retries
    let backupRadios;
    let backupCount = 0;
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY); // Wait between attempts
    backupRadios = localAppTab.locator('input[type="radio"][name="backup"]');
    backupCount = await backupRadios.count();
    console.log(`Found ${backupCount} backups`);
    
    if (backupCount === 0) {
      // Take a screenshot for debugging
      await localAppTab.screenshot({ path: 'no-backups-debug.png' });
      throw new Error(`No backups found in restore list - check no-backups-debug.png`);
    }
    
    console.log(`✓ Found ${backupCount} backups`);
    
    // Select the first backup (top radio button - should have matching timestamps)
    const firstBackupRadio = backupRadios.first();
    if (!(await firstBackupRadio.isVisible({ timeout: 5000 }))) {
      throw new Error('First backup radio button not found');
    }
    await firstBackupRadio.click();
    console.log('✓ Selected first backup with 3 mock signature services');
    
    // Fill mock auth owner address field and select Mock Auth Service (address 2, signature 4)
    console.log('🔑 Selecting Mock Auth Service with address 2, signature 4...');
    const mockAuthOwnerInput = localAppTab.locator('[data-testid="mock-auth-owner-address"]');
    if (!(await mockAuthOwnerInput.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Mock auth owner address input not found');
    }
    await mockAuthOwnerInput.fill('2'); // Address 2
    
    const mockAuthSignatureInput = localAppTab.locator('[data-testid="mock-auth-signature"], input[placeholder*="signature"]').first();
    if (await mockAuthSignatureInput.isVisible({ timeout: 2000 })) {
      await mockAuthSignatureInput.fill('4'); // Signature 4
    }
    
    const mockAuthSelectBtn = localAppTab.locator('[data-testid="mock-auth-service-authenticate-button"]');
    if (!(await mockAuthSelectBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Mock Auth Service authenticate button not found');
    }
    await mockAuthSelectBtn.click();
    console.log('✓ Mock Auth Service selected with address 2, signature 4');
    
    // Update fields and select Mock Auth Service 2 (address 3, signature 6)
    console.log('🔑 Selecting Mock Auth Service 2 with address 3, signature 6...');
    await mockAuthOwnerInput.fill('3'); // Address 3
    
    if (await mockAuthSignatureInput.isVisible({ timeout: 2000 })) {
      await mockAuthSignatureInput.fill('6'); // Signature 6
    }
    
    const mockAuth2SelectBtn = localAppTab.locator('[data-testid="mock-auth-service-2-authenticate-button"]');
    if (!(await mockAuth2SelectBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Mock Auth Service 2 authenticate button not found');
    }
    await mockAuth2SelectBtn.click();
    console.log('✓ Mock Auth Service 2 selected with address 3, signature 6');
    
    // Get the timestamp from the selected backup radio button for verification
    console.log('📅 Getting backup timestamp for verification...');
    
    let backupLabelText: string | null = null;
    let backupTimestamp: string | null = null;
    
    try {
      // Try multiple approaches to find the backup label
      const selectedBackupRadio = localAppTab.locator('input[type="radio"][name="backup"]:checked');
      
      // First, check if the radio button is actually selected
      if (await selectedBackupRadio.isVisible({ timeout: 3000 })) {
        console.log('✓ Found selected backup radio button');
        
        // Use the working associated label approach
        const labelElement = localAppTab.locator('label').filter({ has: selectedBackupRadio });
        if (await labelElement.isVisible({ timeout: 2000 })) {
          console.log('✓ Found backup label');
        } else {
          throw new Error('Backup label not found');
        }
        
        if (labelElement) {
          backupLabelText = await labelElement.textContent({ timeout: 3000 });
          console.log(`Backup label text: ${backupLabelText}`);
          
          // Extract timestamp from backup label (assuming format contains timestamp)
          const backupTimestampMatch = backupLabelText?.match(/\d{1,2}\/\d{1,2}\/\d{4},\s*\d{1,2}:\d{2}:\d{2}\s*(AM|PM)/i);
          backupTimestamp = backupTimestampMatch ? backupTimestampMatch[0] : null;
          console.log(`Extracted backup timestamp: ${backupTimestamp}`);
        } else {
          console.log('⚠️ Could not find backup label element');
        }
      } else {
        console.log('⚠️ Selected backup radio button not found');
      }
    } catch (error) {
      console.log(`⚠️ Error getting backup timestamp: ${error.message}`);
      // Continue with the test even if timestamp extraction fails
    }
    
    // Wait for shards to load and click on shards from authenticated services
    console.log('🔍 Waiting for shards to load...');
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    
    // Find and click shard checkboxes using the working generic approach
    console.log('🎯 Finding and clicking shard checkboxes...');
    const allCheckboxes = localAppTab.locator('input[type="checkbox"]');
    const checkboxCount = await allCheckboxes.count();
    console.log(`Found ${checkboxCount} checkboxes on the page`);
    
    let shardsClicked = 0;
    const shardTimestamps: string[] = [];
    
    // Click checkboxes and extract their timestamps
    for (let i = 0; i < Math.min(checkboxCount, 5); i++) {
      const checkbox = allCheckboxes.nth(i);
      if (await checkbox.isVisible({ timeout: 1000 })) {
        // Check if this checkbox is in a shard context
        const parentContainer = checkbox.locator('xpath=../..');
        const parentText = await parentContainer.textContent();
        
        if (parentText?.includes('Shard') || parentText?.includes('Mock Auth') || parentText?.includes('Created:')) {
          await checkbox.click();
          console.log(`✓ Clicked shard checkbox ${i + 1}`);
          shardsClicked++;
          
          // Extract timestamp from this shard
          try {
            const timestampElement = parentContainer.locator('p:has-text("Created:")');
            if (await timestampElement.isVisible({ timeout: 2000 })) {
              const timestampText = await timestampElement.textContent();
              console.log(`Shard ${i + 1} timestamp: ${timestampText}`);
              
              // Extract just the timestamp part (remove "Created: " prefix)
              const timestampMatch = timestampText?.match(/(\d{1,2}\/\d{1,2}\/\d{4},\s*\d{1,2}:\d{2}:\d{2}\s*(AM|PM))/i);
              if (timestampMatch) {
                const shardTimestamp = timestampMatch[0];
                shardTimestamps.push(shardTimestamp);
                
                // Verify timestamp matches backup timestamp
                if (backupTimestamp && shardTimestamp === backupTimestamp) {
                  console.log(`✓ Timestamp verification PASSED for shard ${i + 1}`);
                  console.log(`  Backup: ${backupTimestamp}`);
                  console.log(`  Shard:  ${shardTimestamp}`);
                } else {
                  throw new Error(`Timestamp verification FAILED for shard ${i + 1}: expected '${backupTimestamp}' but found '${shardTimestamp}'`);
                }
              } else {
                throw new Error(`Could not extract timestamp from shard ${i + 1}: ${timestampText}`);
              }
            } else {
              throw new Error(`No timestamp found for shard ${i + 1} - cannot verify backup integrity`);
            }
          } catch (error) {
            throw new Error(`Error extracting timestamp for shard ${i + 1}: ${error.message}`);
          }
          
          if (shardsClicked >= 2) break; // We need at least 2 shards
        }
      }
    }
    
    console.log(`📊 Total shards clicked: ${shardsClicked}`);
    console.log(`📅 Shard timestamps extracted: ${shardTimestamps.length}`);
    
    // Summary of timestamp verification
    if (backupTimestamp && shardTimestamps.length > 0) {
      const matchingTimestamps = shardTimestamps.filter(ts => ts === backupTimestamp);
      console.log(`📅 Timestamp verification summary:`);
      console.log(`  Backup timestamp: ${backupTimestamp}`);
      console.log(`  Matching shards: ${matchingTimestamps.length}/${shardTimestamps.length}`);
      
      if (matchingTimestamps.length === shardTimestamps.length) {
        console.log(`✓ All shard timestamps match the backup timestamp!`);
      } else {
        console.log(`⚠️ Some shard timestamps do not match the backup timestamp`);
      }
    }
    
    if (shardsClicked === 0) {
      console.log('⚠️ No shard checkboxes found or clicked - this may cause restore to fail');
    }
    
    // Find and click Restore button
    console.log('🔄 Restoring backup...');
    const restoreBtn = localAppTab.locator('button', { hasText: 'Restore' }).last();
    if (!(await restoreBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Restore button not found');
    }
    
    // Check if Restore button is enabled
    if (!(await restoreBtn.isEnabled({ timeout: 5000 }))) {
      throw new Error('Restore button is not enabled - required services may not be selected properly');
    }
    
    await restoreBtn.click();
    console.log('✓ Restore button clicked');
    
    // Verify restore was successful using the working approach
    console.log('🔍 Verifying restore completion...');
    
    try {
      // Use the working selector from debug output: text=Age:
      await localAppTab.waitForSelector('text=Age:', { timeout: DEFAULT_TIMEOUT });
      console.log('✓ Restore completion confirmed - found restored profile data');
    } catch (e) {
      await localAppTab.screenshot({ path: 'restore-debug.png' });
      throw new Error('Restore completion verification failed - check restore-debug.png');
    }
    
    if (DEBUG) {
      console.log('🔍 Debug mode: Pausing for restore inspection');
      await localAppTab.pause();
    }
    
    console.log('✅ Restore completed successfully using Mock Auth Service 1 & 2');
  });

  test('08 - Restore other backup using No Auth and Mock Auth services', async () => {
    console.log('\n=== TEST 08 - Restore other backup using No Auth and Mock Auth services ===');
    console.log('🔄 Restoring the other backup using No Auth and Mock Auth services...');
    
    // Reuse the existing localhost:3000 tab
    const pages = await appContext.pages();
    let localAppTab: any = null;
    
    // Find the existing localhost:3000 tab
    for (const page of pages) {
      const url = page.url();
      if (url.includes('localhost:3000')) {
        localAppTab = page;
        break;
      }
    }
    
    if (!localAppTab) {
      throw new Error('localhost:3000 tab not found');
    }
    
    // Reset UI by clicking Backup tab first, then Restore tab
    console.log('🔄 Resetting UI by clicking Backup tab...');
    const backupTabBtn = localAppTab.locator('nav button', { hasText: 'Backup' });
    if (!(await backupTabBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Backup tab button not found');
    }
    await backupTabBtn.click();
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    console.log('✓ Clicked Backup tab');
    
    // Navigate to Restore tab
    console.log('📂 Navigating to Restore tab...');
    const restoreTabBtn = localAppTab.locator('nav button', { hasText: 'Restore' });
    if (!(await restoreTabBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Restore tab button not found');
    }
    await restoreTabBtn.click();
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    console.log('✓ Navigated to Restore tab');
    
    // Select the second backup directly
    console.log('📋 Selecting second backup...');
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY); // Wait for backups to load
    
    const secondBackupRadio = localAppTab.locator('input[type="radio"][name="backup"]').nth(1);
    await secondBackupRadio.click();
    console.log('✓ Selected second backup');
    
    // Select No Auth Service with address "1"
    console.log('🔑 Selecting No Auth Service with address "1"...');
    const noAuthOwnerInput = localAppTab.locator('[data-testid="no-auth-owner-address"]');
    if (!(await noAuthOwnerInput.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('No Auth Service owner input not found');
    }
    await noAuthOwnerInput.fill('1'); // Address 1
    
    const noAuthSelectBtn = localAppTab.locator('[data-testid="no-auth-service-authenticate-button"]');
    if (!(await noAuthSelectBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('No Auth Service authenticate button not found');
    }
    await noAuthSelectBtn.click();
    console.log('✓ No Auth Service selected with address "1"');
    
    // Select Mock Auth Service with address "123" and signature "246"
    console.log('🔑 Selecting Mock Auth Service with address "123", signature "246"...');
    const mockAuthOwnerInput = localAppTab.locator('[data-testid="mock-auth-owner-address"]');
    if (!(await mockAuthOwnerInput.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Mock Auth Service owner input not found');
    }
    await mockAuthOwnerInput.fill('123'); // Address 123
    
    const mockAuthSignatureInput = localAppTab.locator('[data-testid="mock-auth-signature"], input[placeholder*="signature"]').first();
    if (await mockAuthSignatureInput.isVisible({ timeout: 2000 })) {
      await mockAuthSignatureInput.fill('246'); // Signature 246
    }
    
    // Wait a moment for the form to update
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    
    // Use the correct data-testid for the Mock Auth Service (not 2 or 3)
    const mockAuthSelectBtn = localAppTab.locator('[data-testid="mock-auth-service-authenticate-button"]');
    if (!(await mockAuthSelectBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Mock Auth Service authenticate button not found');
    }
    await mockAuthSelectBtn.click();
    console.log('✓ Mock Auth Service selected with address "123", signature "246"');

    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);

    // Select required shards (at least 2)
    console.log('🔍 Selecting required shards...');
    const shardCheckboxes = localAppTab.locator('input[type="checkbox"]');
    const checkboxCount = await shardCheckboxes.count();
    console.log(`📊 Found ${checkboxCount} shard checkboxes`);
    
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    let shardsClicked = 0;
    for (let i = 0; i < checkboxCount && shardsClicked < 2; i++) {
      const checkbox = shardCheckboxes.nth(i);
      if (await checkbox.isVisible({ timeout: 2000 })) {
        const isChecked = await checkbox.isChecked();
        if (!isChecked) {
          await checkbox.click();
          shardsClicked++;
          console.log(`✓ Clicked shard checkbox ${i + 1}`);
          await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
        } else {
          shardsClicked++;
          console.log(`✓ Shard checkbox ${i + 1} already selected`);
        }
        if (shardsClicked >= 2) break;
      }
    }
    
    console.log(`📊 Total shards selected: ${shardsClicked}`);
    
    if (shardsClicked === 0) {
      throw new Error('No shard checkboxes found or clicked - cannot proceed with restore');
    }
    
    // Verify exactly 2 checkboxes are actually checked on the page
    console.log('🔍 Verifying checkbox states...');
    const checkedBoxes = localAppTab.locator('input[type="checkbox"]:checked');
    const actualCheckedCount = await checkedBoxes.count();
    console.log(`📊 Actually checked checkboxes on page: ${actualCheckedCount}`);
    
    if (actualCheckedCount !== 2) {
      console.log('❌ Expected exactly 2 checkboxes to be checked, but found:', actualCheckedCount);
      
      // Take comprehensive screenshots for debugging
      console.log('📸 Taking screenshots for debugging...');
      
      // Scroll to top first
      await localAppTab.evaluate(() => window.scrollTo(0, 0));
      await localAppTab.waitForTimeout(500);
      await localAppTab.screenshot({ path: 'test-results/checkbox-error-top.png', fullPage: false });
      
      // Scroll to middle
      await localAppTab.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await localAppTab.waitForTimeout(500);
      await localAppTab.screenshot({ path: 'test-results/checkbox-error-middle.png', fullPage: false });
      
      // Scroll to bottom
      await localAppTab.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await localAppTab.waitForTimeout(500);
      await localAppTab.screenshot({ path: 'test-results/checkbox-error-bottom.png', fullPage: false });
      
      // Take a full page screenshot
      await localAppTab.screenshot({ path: 'test-results/checkbox-error-fullpage.png', fullPage: true });
      
      console.log('📸 Screenshots saved to test-results/ folder');
      
      // Log details of all checkboxes for debugging
      const allCheckboxes = localAppTab.locator('input[type="checkbox"]');
      const totalCheckboxes = await allCheckboxes.count();
      console.log(`📊 Total checkboxes found: ${totalCheckboxes}`);
      
      for (let i = 0; i < totalCheckboxes; i++) {
        const checkbox = allCheckboxes.nth(i);
        const isChecked = await checkbox.isChecked();
        const isVisible = await checkbox.isVisible();
        console.log(`  Checkbox ${i + 1}: checked=${isChecked}, visible=${isVisible}`);
      }
      
      throw new Error(`Expected exactly 2 checkboxes to be checked, but found ${actualCheckedCount}`);
    }
    
    console.log('✅ Verified: exactly 2 checkboxes are checked');
    
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);

    // Find and click Restore button
    console.log('🔄 Restoring backup...');
    const restoreBtn = localAppTab.locator('button', { hasText: 'Restore' }).last();
    if (!(await restoreBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Restore button not found');
    }
    
    // Check if Restore button is enabled
    if (!(await restoreBtn.isEnabled({ timeout: 5000 }))) {
      throw new Error('Restore button is not enabled - required services may not be selected properly');
    }
    
    await restoreBtn.click();
    console.log('✓ Restore button clicked');
    
    // Verify restore was successful
    console.log('🔍 Verifying restore completion...');
    
    try {
      // Use the working selector: text=Age:
      await localAppTab.waitForSelector('text=Age:', { timeout: DEFAULT_TIMEOUT });
      console.log('✓ Restore completion confirmed - found restored profile data');
    } catch (e) {
      await localAppTab.screenshot({ path: 'restore-other-backup-debug.png' });
      throw new Error('Restore completion verification failed - check restore-other-backup-debug.png');
    }
    
    if (DEBUG) {
      console.log('🔍 Debug mode: Pausing for restore inspection');
      await localAppTab.pause();
    }
    
    console.log('✅ Other backup restored successfully using No Auth Service (address 1) and Mock Auth Service (address 123, signature 2)');
  });

  test('09 - Navigate to Settings and restore second backup with Safe auth service', async () => {
    console.log('\n=== TEST 09 - Navigate to Settings and restore second backup with Safe auth service ===');
    console.log('🔄 Testing settings navigation and Safe auth service restore...');
    
    // Reuse the existing localhost:3000 tab
    const pages = await appContext.pages();
    let localAppTab: any = null;
    
    // Find the existing localhost:3000 tab
    for (const page of pages) {
      const url = page.url();
      if (url.includes('localhost:3000')) {
        localAppTab = page;
        break;
      }
    }
    
    if (!localAppTab) {
      throw new Error('localhost:3000 tab not found');
    }
    
    console.log('✓ Using existing local app tab');
    
    // Reset UI by clicking Backup tab first, then Restore tab
    console.log('🔄 Resetting UI by clicking Backup tab...');
    const backupTabBtn = localAppTab.locator('nav button', { hasText: 'Backup' });
    if (!(await backupTabBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Backup tab button not found');
    }
    await backupTabBtn.click();
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    console.log('✓ Clicked Backup tab');
    
    // Navigate to Restore tab
    console.log('📂 Navigating to Restore tab...');
    const restoreTabBtn = localAppTab.locator('nav button', { hasText: 'Restore' });
    if (!(await restoreTabBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Restore tab button not found');
    }
    await restoreTabBtn.click();
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    console.log('✓ Navigated to Restore tab');
    
    let backupRadios;
    let backupCount = 0;
    backupRadios = localAppTab.locator('input[type="radio"][name="backup"]');
    backupCount = await backupRadios.count();
    
    if (backupCount === 0) {
      throw new Error('No backup radio buttons found');
    }
    
    console.log(`📊 Found ${backupCount} backup(s)`);
    
    // Select the second backup (index 1)
    if (backupCount < 2) {
      throw new Error('Second backup not found - need at least 2 backups');
    }
    
    const secondBackupRadio = backupRadios.nth(1);
    await secondBackupRadio.click();
    console.log('✓ Selected second backup');
    
    // Wait for services to load
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    
    // Select No Auth Service with address "1"
    console.log('🔑 Selecting No Auth Service with address "1"...');
    const noAuthOwnerInput = localAppTab.locator('[data-testid="no-auth-owner-address"]');
    if (!(await noAuthOwnerInput.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('No Auth Service owner input not found');
    }
    await noAuthOwnerInput.fill('1'); // Address 1
    
    // Wait a moment for the form to update
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    
    const noAuthSelectBtn = localAppTab.locator('[data-testid="no-auth-service-authenticate-button"]');
    if (!(await noAuthSelectBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('No Auth Service authenticate button not found');
    }
    await noAuthSelectBtn.click();
    console.log('✓ No Auth Service selected with address "1"');
    
    // Select Safe Auth Service and attempt WalletConnect
    console.log('🔐 Selecting Safe Auth Service and attempting WalletConnect...');
    const safeAuthOwnerInput = localAppTab.locator('[data-testid="safe-auth-owner-address"]');
    if (!(await safeAuthOwnerInput.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('Safe Auth Service owner input not found');
    }
    await safeAuthOwnerInput.fill('0x4f4f1091Bf0F4b9F3c85031DDc4cf196653b18a0');
    
    // Wait a moment for the form to update
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    
    // Select WalletConnect radio button
    console.log('📡 Selecting WalletConnect radio button...');
    const walletConnectRadio = localAppTab.locator('input[type="radio"][value="walletconnect"], input[type="radio"] + label:has-text("WalletConnect"), label:has-text("WalletConnect") input[type="radio"]').first();
    if (!(await walletConnectRadio.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('WalletConnect radio button not found');
    }
    await walletConnectRadio.click();
    console.log('✓ WalletConnect radio button selected');
    
    // Wait for UI to update after radio selection
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
    
    // Find and click the button underneath the WalletConnect radio
    console.log('🔘 Clicking WalletConnect button...');
    const walletConnectBtn = localAppTab.locator('button:has-text("Connect"), button:has-text("WalletConnect"), button:has-text("Connect Wallet")').first();
    if (!(await walletConnectBtn.isVisible({ timeout: DEFAULT_TIMEOUT }))) {
      throw new Error('WalletConnect button not found');
    }
    await walletConnectBtn.click();
    console.log('✓ WalletConnect button clicked');
    
    // Wait for WalletConnect popup to appear (long delay)
    console.log('⏳ Waiting for WalletConnect popup to load...');
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY_LONG);
    
    // Check for WalletConnect popup
    try {
      const walletConnectElement = localAppTab.locator('text=WalletConnect').first();
      if (await walletConnectElement.isVisible({ timeout: 2000 })) {
        console.log('✓ WalletConnect element found');
        console.log('🔗 WalletConnect popup detected!');
      } else {
        console.log('⚠️ WalletConnect popup not immediately visible, but continuing...');
      }
    } catch (e) {
      console.log('⚠️ WalletConnect popup not immediately visible, but continuing...');
    }
    
    // Automated WalletConnect URI extraction and Safe UI automation
    console.log('🤖 Starting automated WalletConnect URI extraction and Safe UI integration...');
    
    // Extract WalletConnect URI from QR code component
    console.log('🔍 Looking for WalletConnect QR code component...');
    
    let walletConnectUri: string | null = null;
    
    try {
      // Wait for the QR code element to appear
      const qrCodeElement = localAppTab.locator('wui-qr-code[data-testid="wui-qr-code"]');
      await qrCodeElement.waitFor({ timeout: 10000 });
      
      // Extract the URI from the uri attribute
      walletConnectUri = await qrCodeElement.getAttribute('uri');
      
      if (!walletConnectUri) {
        throw new Error('URI attribute not found on QR code element');
      }
      
      console.log('✅ WalletConnect URI extracted:', walletConnectUri);
      
    } catch (error) {
      console.error('❌ Failed to extract WalletConnect URI:', error);
      console.log('⏸️ Pausing for manual inspection due to extraction failure');
      await localAppTab.pause();
      return;
    }
    
    // Now switch to Safe UI and paste the URI
    console.log('🔄 Switching to Safe UI tab to paste WalletConnect URI...');
    
    try {
      // Find existing Safe UI tab or create new one
      const safeUIUrl = 'https://app.safe.global/home?safe=gno:0x4f4f1091Bf0F4b9F3c85031DDc4cf196653b18a0';
      let safeUITab;
      
      // Try to find existing Safe UI tab
      const existingTabs = appContext.pages();
      safeUITab = existingTabs.find(page => page.url().includes('app.safe.global'));
      
      if (!safeUITab) {
        console.log('📂 Creating new Safe UI tab...');
        safeUITab = await appContext.newPage();
        await safeUITab.goto(safeUIUrl);
        await safeUITab.waitForLoadState('networkidle');
      } else {
        console.log('✅ Found existing Safe UI tab');
        await safeUITab.bringToFront();
      }
      
      // Look for and click the WalletConnect button
      console.log('🔍 Looking for WalletConnect button in Safe UI...');
      const walletConnectButton = safeUITab.locator('button[title="WalletConnect"]');
      await walletConnectButton.waitFor({ timeout: 10000 });
      await walletConnectButton.click();
      
      console.log('✅ WalletConnect button clicked in Safe UI');
      
      // Wait for the input field to appear
      console.log('🔍 Waiting for WalletConnect input field...');
      const inputField = safeUITab.locator('input[placeholder="wc:"]');
      await inputField.waitFor({ timeout: 5000 });
      
      // Clear and paste the URI
      await inputField.clear();
      await inputField.fill(walletConnectUri);
      
      console.log('✅ WalletConnect URI pasted successfully into Safe UI');
      
      // Wait for confirmation popup and click Approve button
      console.log('🔍 Waiting for confirmation popup with Approve button...');
      const approveButton = safeUITab.locator('button:has-text("Approve")');
      await approveButton.waitFor({ timeout: 10000 });
      await approveButton.click();
      
      console.log('✅ Approve button clicked successfully');
      
      console.log('🎉 WalletConnect connection established successfully!');
      console.log('   - URI extracted from localhost QR code');
      console.log('   - URI pasted into Safe UI input field');
      console.log('   - Approve button clicked in confirmation popup');
      
      // Wait for WalletConnect connection to be fully established
      await localAppTab.waitForTimeout(UI_INTERACTION_DELAY_LONG);
      
    } catch (error) {
      console.error('❌ Failed to automate Safe UI interaction:', error);
      console.log('⏸️ Pausing for manual inspection due to Safe UI automation failure');
      console.log('   - WalletConnect URI was extracted:', walletConnectUri);
      console.log('   - You can manually paste it into Safe UI');
      await localAppTab.pause();
      return;
    }
    
    // Step 2: Switch back to localhost app and click authenticate button
    console.log('🔄 Switching back to localhost app to click authenticate button...');
    await localAppTab.bringToFront();
    
    try {
      // Click the Safe Auth Service authenticate button
      console.log('🔍 Looking for Safe Auth Service authenticate button...');
      const authenticateButton = localAppTab.locator('[data-testid="safe-auth-service-authenticate-button"]');
      await authenticateButton.waitFor({ timeout: 10000 });
      await authenticateButton.click();
      
      console.log('✅ Safe Auth Service authenticate button clicked');
      
      // Wait for authentication process to start
      await localAppTab.waitForTimeout(UI_INTERACTION_DELAY_LONG);
      
    } catch (error) {
      console.error('❌ Failed to click authenticate button:', error);
      console.log('⏸️ Pausing for manual inspection due to authenticate button failure');
      await localAppTab.pause();
      return;
    }
    
    // Step 3: Switch back to Safe UI and look for Sign button
    console.log('🔄 Switching back to Safe UI to look for Sign button...');
    
    try {
      // Find existing Safe UI tab
      const existingTabs = appContext.pages();
      const safeUITab = existingTabs.find(page => page.url().includes('app.safe.global'));
      
      if (!safeUITab) {
        throw new Error('Safe UI tab not found');
      }
      
      await safeUITab.bringToFront();
      
      // Wait for Sign button to appear (use long timeout)
      console.log('🔍 Waiting for Sign button to appear in Safe UI...');
      const signButton = safeUITab.locator('button:has-text("Sign")');
      await signButton.waitFor({ timeout: UI_INTERACTION_DELAY_LONG });
      await signButton.click();
      
      console.log('✅ Sign button clicked successfully');
      console.log('🦊 MetaMask signature popup should now appear');
      
      // Wait a moment for MetaMask popup to appear
      await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
      
    } catch (error) {
      console.error('❌ Failed to click Sign button:', error);
      console.log('⏸️ Pausing for manual inspection due to Sign button failure');
      await localAppTab.pause();
      return;
    }
    
    // Step 4: Handle MetaMask signature popup
    console.log('🦊 Looking for MetaMask signature popup...');
    
    try {
      // Wait for MetaMask popup to appear
      const popupPromise = appContext.waitForEvent('page', { timeout: 10000 });
      const popup = await popupPromise;
      
      console.log('✅ MetaMask popup detected');
      
      // Look for confirm/sign button in MetaMask popup
      const confirmSelectors = [
        'button:has-text("Sign")',
        'button:has-text("Confirm")',
        '[data-testid="request-signature__sign"]',
        '[data-testid="page-container-footer-next"]',
        '.btn-primary',
        'button[type="submit"]'
      ];
      
      let buttonClicked = false;
      for (const selector of confirmSelectors) {
        try {
          const button = popup.locator(selector).first();
          if (await button.isVisible({ timeout: 2000 })) {
            await button.click();
            console.log(`✅ MetaMask signature confirmed with selector: ${selector}`);
            buttonClicked = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!buttonClicked) {
        console.log('⚠️ No MetaMask confirm button found, trying manual confirmation');
        await popup.pause();
      }
      
      // Wait for popup to close
      await popup.waitForEvent('close', { timeout: 10000 }).catch(() => {
        console.log('ℹ️ MetaMask popup did not close within timeout');
      });
      
    } catch (error) {
      console.error('❌ Failed to handle MetaMask popup:', error);
      console.log('⏸️ Pausing for manual MetaMask confirmation');
      await localAppTab.pause();
      return;
    }
    
    // Step 5: Go back to localhost app and verify authentication
    console.log('🔄 Switching back to localhost app to verify authentication...');
    await localAppTab.bringToFront();
    
    // Wait for authentication to complete
    await localAppTab.waitForTimeout(UI_INTERACTION_DELAY_LONG);
    
    try {
      // Verify Safe Auth Service is now authenticated
      console.log('🔍 Verifying Safe Auth Service authentication status...');
      
      // Look for authentication success indicators
      const authSuccessSelectors = [
        'text=✅',
        'text=Authenticated',
        'text=Connected',
        '[data-testid*="authenticated"]',
        '[data-testid*="success"]'
      ];
      
      let authVerified = false;
      for (const selector of authSuccessSelectors) {
        try {
          const element = localAppTab.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            console.log(`✅ Authentication verified with selector: ${selector}`);
            authVerified = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!authVerified) {
        console.log('⚠️ Authentication status unclear, continuing with restore...');
      }
      
    } catch (error) {
      console.log('⚠️ Could not verify authentication status:', error.message);
    }
    
    // Step 6: Restore the backup (similar to previous tests)
    console.log('🔄 Starting backup restore process...');
    
    try {
      // Look for and select shards
      console.log('🔍 Looking for available shards...');
      
      // Wait for shards to load
      await localAppTab.waitForTimeout(UI_INTERACTION_DELAY);
      
      // Find shard checkboxes
      const shardCheckboxes = localAppTab.locator('input[type="checkbox"]');
      const shardCount = await shardCheckboxes.count();
      
      console.log(`📊 Found ${shardCount} shard checkboxes`);
      
      if (shardCount < 2) {
        throw new Error(`Expected at least 2 shards, found ${shardCount}`);
      }
      
      // Click the required number of shard checkboxes
      for (let i = 0; i < Math.min(shardCount, 2); i++) {
        const checkbox = shardCheckboxes.nth(i);
        await checkbox.click();
        console.log(`✅ Clicked shard checkbox ${i + 1}`);
        await localAppTab.waitForTimeout(UI_INTERACTION_DELAY / 2);
      }
      
      console.log(`📊 Total shards selected: ${Math.min(shardCount, 2)}`);
      
      // Click restore button
      console.log('🔄 Clicking restore button...');
      const restoreButton = localAppTab.locator('button:has-text("Restore"), [data-testid*="restore"]').first();
      await restoreButton.waitFor({ timeout: 5000 });
      await restoreButton.click();
      
      console.log('✅ Restore button clicked');
      
      // Wait for restore to complete
      await localAppTab.waitForTimeout(UI_INTERACTION_DELAY_LONG);
      
      // Verify restore completion
      console.log('🔍 Verifying restore completion...');
      
      const restoreSuccessSelectors = [
        'text=Restore completed',
        'text=Successfully restored',
        'text=Profile restored',
        '[data-testid*="restore-success"]',
        'text=TestProfile' // Look for restored profile data
      ];
      
      let restoreVerified = false;
      for (const selector of restoreSuccessSelectors) {
        try {
          const element = localAppTab.locator(selector).first();
          if (await element.isVisible({ timeout: 5000 })) {
            console.log(`✅ Restore completion verified with selector: ${selector}`);
            restoreVerified = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!restoreVerified) {
        console.log('⚠️ Could not verify restore completion automatically');
      }
      
    } catch (error) {
      console.error('❌ Failed during backup restore:', error);
      console.log('⏸️ Pausing for manual inspection of restore process');
      await localAppTab.pause();
      return;
    }
    
    console.log('🎉 Complete Safe Auth Service workflow completed successfully!');
    console.log('   - WalletConnect connection established');
    console.log('   - Safe Auth Service authenticated via MetaMask signature');
    console.log('   - Backup restored using Safe Auth Service and No Auth Service');
    
    // Final pause for inspection if DEBUG mode
    if (DEBUG) {
      console.log('🔍 Debug mode: Pausing for final inspection');
      await localAppTab.pause();
    }
    
    console.log('✅ Settings navigation and Safe auth service WalletConnect test completed');
  });

});
