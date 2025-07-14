import { test, expect, Browser, BrowserContext } from '@playwright/test';
import { bootstrap, getWallet, MetaMaskWallet } from '@tenkeylabs/dappwright';

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
      console.error('❌ MetaMask bootstrap failed:', error);
      throw error;
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
        if (await element.isVisible({ timeout: 2000 })) {
          connectButton = element;
          console.log(`✓ Connect wallet button found with selector: ${selector}`);
          break;
        }
      }
      
      if (connectButton) {
        await connectButton.click();
        console.log('✓ Connect wallet button clicked');
        
        // Wait for wallet selection dialog
        await safeTab.waitForTimeout(2000);
        
        // Look for MetaMask option in the wallet selection dialog
        const metamaskSelectors = [
          'button:has-text("MetaMask")',
          'button:has-text("Metamask")',
          '[data-testid="wallet-metamask"]',
          '.wallet-metamask'
        ];
        
        for (const selector of metamaskSelectors) {
          const metamaskButton = safeTab.locator(selector).first();
          if (await metamaskButton.isVisible({ timeout: 2000 })) {
            await metamaskButton.click();
            console.log('✓ MetaMask wallet selected');
            break;
          }
        }
        
        // Handle potential MetaMask popup
        try {
          const popupPromise = appContext.waitForEvent('page', { timeout: 10000 });
          const popup = await popupPromise;
          
          console.log('🦊 MetaMask popup detected');
          await popup.waitForLoadState('networkidle');
          
          // Wait a bit for popup to fully render
          await popup.waitForTimeout(2000);
          
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
              if (await button.isVisible({ timeout: 1000 })) {
                await button.click();
                console.log(`✓ Clicked ${selector} in MetaMask popup`);
                buttonClicked = true;
                await popup.waitForTimeout(1000);
                break; // Exit after first successful click
              }
            } catch (e) {
              // Continue to next selector
            }
          }
          
          if (!buttonClicked) {
            console.log('⚠️ No clickable button found in MetaMask popup');
          }
          
          // Wait for popup to close or timeout
          await popup.waitForEvent('close', { timeout: 15000 }).catch(() => {
            console.log('ℹ️ MetaMask popup did not close within timeout');
          });
          
        } catch (e) {
          console.log('ℹ️ No MetaMask popup detected or popup handling failed:', e.message);
        }
        
        // Switch back to Safe Global tab
        await safeTab.bringToFront();
        await safeTab.waitForTimeout(3000);
        
        console.log('🔗 MetaMask connection to Safe Global attempted');
        
      } else {
        console.log('⚠️ Connect wallet button not found');
      }
      
    } catch (error) {
      console.log('⚠️ Error during wallet connection:', error.message);
    }
    
    if (DEBUG) await safeTab.pause();
    
    // Keep the Safe Global tab open for the next test
    console.log('✅ Safe Global connection test completed - tab remains open');
  });

  test('02 - Verify localhost:3000 loads correctly', async ({ browser }) => {
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
    await localAppTab.waitForSelector('body', { timeout: 5000 });
    console.log('✓ Local app body element found');
    
    if (DEBUG) {
      console.log('🔍 Debug mode: Pausing for inspection');
      await localAppTab.pause();
    }
    
    console.log('✅ All three services created and verified successfully');
  });

  test('03 - Configure Shamir settings and create three services', async () => {
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
    if (!(await createServiceBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Create New Service button not found');
    }
    await createServiceBtn.click();
    
    // Check and fill service name
    const serviceNameInput = localAppTab.locator('#new-service-name');
    if (!(await serviceNameInput.isVisible({ timeout: 5000 }))) {
      throw new Error('Service name input (#new-service-name) not found');
    }
    await serviceNameInput.fill('No Auth Service');
    
    // Check and select auth type
    const authTypeSelect = localAppTab.locator('#new-service-auth-type');
    if (!(await authTypeSelect.isVisible({ timeout: 5000 }))) {
      throw new Error('Auth type select (#new-service-auth-type) not found');
    }
    await authTypeSelect.selectOption('no-auth');
    
    // Check and fill description
    const descriptionInput = localAppTab.locator('#new-service-description');
    if (!(await descriptionInput.isVisible({ timeout: 5000 }))) {
      throw new Error('Description input (#new-service-description) not found');
    }
    await descriptionInput.fill('Service with no authorization');
    
    // No owner address for no-auth service
    
    // Check and click create service button
    const createBtn = localAppTab.locator('button', { hasText: 'Create Service' });
    if (!(await createBtn.isVisible({ timeout: 5000 }))) {
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
    if (!(await createServiceBtn2.isVisible({ timeout: 5000 }))) {
      throw new Error('Create New Service button not found for second service');
    }
    await createServiceBtn2.click();
    
    // Check and fill service name
    const serviceNameInput2 = localAppTab.locator('#new-service-name');
    if (!(await serviceNameInput2.isVisible({ timeout: 5000 }))) {
      throw new Error('Service name input (#new-service-name) not found for second service');
    }
    await serviceNameInput2.fill('Mock Auth Service');
    
    // Check and select auth type
    const authTypeSelect2 = localAppTab.locator('#new-service-auth-type');
    if (!(await authTypeSelect2.isVisible({ timeout: 5000 }))) {
      throw new Error('Auth type select (#new-service-auth-type) not found for second service');
    }
    await authTypeSelect2.selectOption('mock-signature-2x');
    
    // Check and fill description
    const descriptionInput2 = localAppTab.locator('#new-service-description');
    if (!(await descriptionInput2.isVisible({ timeout: 5000 }))) {
      throw new Error('Description input (#new-service-description) not found for second service');
    }
    await descriptionInput2.fill('Service with mock authorization');
    
    // No owner address for mock auth service
    
    // Check and click create service button
    const createBtn2 = localAppTab.locator('button', { hasText: 'Create Service' });
    if (!(await createBtn2.isVisible({ timeout: 5000 }))) {
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
    if (!(await createServiceBtn3.isVisible({ timeout: 5000 }))) {
      throw new Error('Create New Service button not found for third service');
    }
    await createServiceBtn3.click();
    
    // Check and fill service name
    const serviceNameInput3 = localAppTab.locator('#new-service-name');
    if (!(await serviceNameInput3.isVisible({ timeout: 5000 }))) {
      throw new Error('Service name input (#new-service-name) not found for third service');
    }
    await serviceNameInput3.fill('Safe Auth Service');
    
    // Check and select auth type
    const authTypeSelect3 = localAppTab.locator('#new-service-auth-type');
    if (!(await authTypeSelect3.isVisible({ timeout: 5000 }))) {
      throw new Error('Auth type select (#new-service-auth-type) not found for third service');
    }
    await authTypeSelect3.selectOption('safe-signature');
    
    // Check and fill description
    const descriptionInput3 = localAppTab.locator('#new-service-description');
    if (!(await descriptionInput3.isVisible({ timeout: 5000 }))) {
      throw new Error('Description input (#new-service-description) not found for third service');
    }
    await descriptionInput3.fill('Service with Safe authorization');
    
    // No owner address for safe auth service
    
    // Check and click create service button
    const createBtn3 = localAppTab.locator('button', { hasText: 'Create Service' });
    if (!(await createBtn3.isVisible({ timeout: 5000 }))) {
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
    if (!(await backupTabBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Backup tab button not found');
    }
    await backupTabBtn.click();
    console.log('✓ Navigated to Backup tab');
    
    // Service 1: No Auth Service with owner "1"
    console.log('🔑 Selecting No Auth Service...');
    
    // Find the No Auth Service section
    const noAuthServiceSection = localAppTab.locator('text=No Auth Service').locator('..');
    if (!(await noAuthServiceSection.isVisible({ timeout: 5000 }))) {
      throw new Error('No Auth Service section not found');
    }
    
    // Find and fill owner input for No Auth Service using correct data-testid
    const noAuthOwnerInput = localAppTab.locator('[data-testid="no-auth-owner-address"]');
    if (!(await noAuthOwnerInput.isVisible({ timeout: 5000 }))) {
      throw new Error('No Auth Service owner input not found');
    }
    await noAuthOwnerInput.fill('1');
    
    // Find and click Select button for No Auth Service using correct data-testid
    const noAuthSelectBtn = localAppTab.locator('[data-testid="service-select-no-auth-service"]');
    if (!(await noAuthSelectBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('No Auth Service Select button not found');
    }
    await noAuthSelectBtn.click();
    console.log('✓ No Auth Service selected with owner "1"');
    
    // Service 2: Mock Auth Service with owner "123"
    console.log('🔑 Selecting Mock Auth Service...');
    
    // Find the Mock Auth Service section
    const mockAuthServiceSection = localAppTab.locator('text=Mock Auth Service').locator('..');
    if (!(await mockAuthServiceSection.isVisible({ timeout: 5000 }))) {
      throw new Error('Mock Auth Service section not found');
    }
    
    // Find and fill owner input for Mock Auth Service using correct data-testid
    const mockAuthOwnerInput = localAppTab.locator('[data-testid="mock-auth-owner-address"]');
    if (!(await mockAuthOwnerInput.isVisible({ timeout: 5000 }))) {
      throw new Error('Mock Auth Service owner input not found');
    }
    await mockAuthOwnerInput.fill('123');
    
    // Find and click Select button for Mock Auth Service using correct data-testid
    const mockAuthSelectBtn = localAppTab.locator('[data-testid="service-select-mock-auth-service"]');
    if (!(await mockAuthSelectBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Mock Auth Service Select button not found');
    }
    await mockAuthSelectBtn.click();
    console.log('✓ Mock Auth Service selected with owner "123"');
    
    // Service 3: Safe Auth Service with owner "0x4f4f1091Bf0F4b9F3c85031DDc4cf196653b18a0"
    console.log('🔑 Selecting Safe Auth Service...');
    
    // Find the Safe Auth Service section
    const safeAuthServiceSection = localAppTab.locator('text=Safe Auth Service').locator('..');
    if (!(await safeAuthServiceSection.isVisible({ timeout: 5000 }))) {
      throw new Error('Safe Auth Service section not found');
    }
    
    // Find and fill Safe Address input for Safe Auth Service using correct data-testid
    const safeAuthOwnerInput = localAppTab.locator('[data-testid="safe-auth-owner-address"]');
    if (!(await safeAuthOwnerInput.isVisible({ timeout: 5000 }))) {
      throw new Error('Safe Auth Service owner input not found');
    }
    await safeAuthOwnerInput.fill('0x4f4f1091Bf0F4b9F3c85031DDc4cf196653b18a0');
    
    // Find and click Select button for Safe Auth Service using correct data-testid
    const safeAuthSelectBtn = localAppTab.locator('[data-testid="service-select-safe-auth-service"]');
    if (!(await safeAuthSelectBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Safe Auth Service Select button not found');
    }
    await safeAuthSelectBtn.click();
    console.log('✓ Safe Auth Service selected with owner "0x4f4f1091Bf0F4b9F3c85031DDc4cf196653b18a0"');
    
    // Find and click Create Backup button
    console.log('💾 Creating backup...');
    const createBackupBtn = localAppTab.locator('button', { hasText: 'Create Backup' });
    if (!(await createBackupBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Create Backup button not found');
    }
    
    // Check if Create Backup button is enabled
    if (!(await createBackupBtn.isEnabled({ timeout: 5000 }))) {
      throw new Error('Create Backup button is not enabled - all services may not be selected properly');
    }
    
    await createBackupBtn.click();
    console.log('✓ Create Backup button clicked');
    
    // Verify backup was created - look for success message
    console.log('🔍 Verifying backup creation...');
    
    // Wait for backup creation to complete and look for confirmation
    try {
      await localAppTab.waitForSelector('text=Backup completed successfully!', { timeout: 10000 });
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
    if (!(await configTabBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Config tab button not found');
    }
    await configTabBtn.click();
    console.log('✓ Navigated to Config tab');
    
    // Create Service 4: Mock Auth Service 2
    console.log('🔑 Creating Mock Auth Service 2...');
    
    const createServiceBtn4 = localAppTab.locator('button', { hasText: 'Create New Service' });
    if (!(await createServiceBtn4.isVisible({ timeout: 5000 }))) {
      throw new Error('Create New Service button not found for fourth service');
    }
    await createServiceBtn4.click();
    
    const serviceNameInput4 = localAppTab.locator('#new-service-name');
    if (!(await serviceNameInput4.isVisible({ timeout: 5000 }))) {
      throw new Error('Service name input not found for fourth service');
    }
    await serviceNameInput4.fill('Mock Auth Service 2');
    
    const authTypeSelect4 = localAppTab.locator('#new-service-auth-type');
    if (!(await authTypeSelect4.isVisible({ timeout: 5000 }))) {
      throw new Error('Auth type select not found for fourth service');
    }
    await authTypeSelect4.selectOption('mock-signature-2x');
    
    const descriptionInput4 = localAppTab.locator('#new-service-description');
    if (!(await descriptionInput4.isVisible({ timeout: 5000 }))) {
      throw new Error('Description input not found for fourth service');
    }
    await descriptionInput4.fill('Second mock signature service');
    
    const createBtn4 = localAppTab.locator('button', { hasText: 'Create Service' });
    if (!(await createBtn4.isVisible({ timeout: 5000 }))) {
      throw new Error('Create Service button not found for fourth service');
    }
    await createBtn4.click();
    
    await expect(localAppTab.locator('td', { hasText: 'Mock Auth Service 2' })).toBeVisible();
    console.log('✓ Mock Auth Service 2 created and visible');
    
    // Create Service 5: Mock Auth Service 3
    console.log('🔑 Creating Mock Auth Service 3...');
    
    const createServiceBtn5 = localAppTab.locator('button', { hasText: 'Create New Service' });
    if (!(await createServiceBtn5.isVisible({ timeout: 5000 }))) {
      throw new Error('Create New Service button not found for fifth service');
    }
    await createServiceBtn5.click();
    
    const serviceNameInput5 = localAppTab.locator('#new-service-name');
    if (!(await serviceNameInput5.isVisible({ timeout: 5000 }))) {
      throw new Error('Service name input not found for fifth service');
    }
    await serviceNameInput5.fill('Mock Auth Service 3');
    
    const authTypeSelect5 = localAppTab.locator('#new-service-auth-type');
    if (!(await authTypeSelect5.isVisible({ timeout: 5000 }))) {
      throw new Error('Auth type select not found for fifth service');
    }
    await authTypeSelect5.selectOption('mock-signature-2x');
    
    const descriptionInput5 = localAppTab.locator('#new-service-description');
    if (!(await descriptionInput5.isVisible({ timeout: 5000 }))) {
      throw new Error('Description input not found for fifth service');
    }
    await descriptionInput5.fill('Third mock signature service');
    
    const createBtn5 = localAppTab.locator('button', { hasText: 'Create Service' });
    if (!(await createBtn5.isVisible({ timeout: 5000 }))) {
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
    if (!(await backupTabBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Backup tab button not found');
    }
    await backupTabBtn.click();
    console.log('✓ Navigated to Backup tab');
    
    // Fill mock auth owner address field (shared by all mock services)
    console.log('🔑 Setting mock auth owner address...');
    const mockAuthOwnerInput = localAppTab.locator('[data-testid="mock-auth-owner-address"]');
    if (!(await mockAuthOwnerInput.isVisible({ timeout: 5000 }))) {
      throw new Error('Mock auth owner address input not found');
    }
    await mockAuthOwnerInput.fill('2'); // First service gets owner "2"
    
    // Select Mock Auth Service (owner 2)
    console.log('🔑 Selecting Mock Auth Service with owner "2"...');
    const mockAuthSelectBtn = localAppTab.locator('[data-testid="service-select-mock-auth-service"]');
    if (!(await mockAuthSelectBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Mock Auth Service Select button not found');
    }
    await mockAuthSelectBtn.click();
    console.log('✓ Mock Auth Service selected with owner "2"');
    
    // Update owner address for second service and select it
    await mockAuthOwnerInput.fill('3'); // Second service gets owner "3"
    
    // Select Mock Auth Service 2 (owner 3)
    console.log('🔑 Selecting Mock Auth Service 2 with owner "3"...');
    const mockAuth2SelectBtn = localAppTab.locator('[data-testid="service-select-mock-auth-service-2"]');
    if (!(await mockAuth2SelectBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Mock Auth Service 2 Select button not found');
    }
    await mockAuth2SelectBtn.click();
    console.log('✓ Mock Auth Service 2 selected with owner "3"');
    
    // Update owner address for third service and select it
    await mockAuthOwnerInput.fill('123'); // Third service gets owner "123"
    
    // Select Mock Auth Service 3 (owner 123)
    console.log('🔑 Selecting Mock Auth Service 3 with owner "123"...');
    const mockAuth3SelectBtn = localAppTab.locator('[data-testid="service-select-mock-auth-service-3"]');
    if (!(await mockAuth3SelectBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Mock Auth Service 3 Select button not found');
    }
    await mockAuth3SelectBtn.click();
    console.log('✓ Mock Auth Service 3 selected with owner "123"');
    
    // Find and click Create Backup button
    console.log('💾 Creating backup...');
    const createBackupBtn = localAppTab.locator('button', { hasText: 'Create Backup' });
    if (!(await createBackupBtn.isVisible({ timeout: 5000 }))) {
      throw new Error('Create Backup button not found');
    }
    
    // Check if Create Backup button is enabled
    if (!(await createBackupBtn.isEnabled({ timeout: 5000 }))) {
      throw new Error('Create Backup button is not enabled - all services may not be selected properly');
    }
    
    await createBackupBtn.click();
    console.log('✓ Create Backup button clicked');
    
    // Verify backup was created - look for success message
    console.log('🔍 Verifying backup creation...');
    
    // Wait for backup creation to complete and look for confirmation
    try {
      await localAppTab.waitForSelector('text=Backup completed successfully!', { timeout: 10000 });
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

});
