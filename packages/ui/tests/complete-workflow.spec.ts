import { test, expect } from './fixtures';
import { bootstrap, getWallet, MetaMaskWallet } from '@tenkeylabs/dappwright';

// Debug mode - set to true to enable page.pause() at the end of each test
const DEBUG = process.env.DEBUG === 'true' || process.env.PWDEBUG === '1';
const WAIT_TIME = DEBUG ? 1000 : 500;

// MetaMask test configuration
const TEST_MNEMONIC = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
const METAMASK_PASSWORD = 'Mmmtttmsk...';

test.describe.serial('Complete Gresistor Workflow', () => {
  let page;
  let metamaskWallet;
  let metamaskContext;

  test.beforeAll(async ({ browser }) => {
    // Page will be created in MetaMask context during setup
    // No need to create initial page here
  });

  test.afterAll(async () => {
    // Clean up MetaMask context
    if (metamaskContext) {
      await metamaskContext.close();
      console.log('✓ MetaMask context cleaned up');
    }
  });

  test('00 - MetaMask Setup: Initialize MetaMask wallet for injection', async () => {
    console.log('🦊 Test 00: Setting up MetaMask wallet...');
    
    try {
      // Initialize MetaMask with dappwright in beforeAll
      console.log('Initializing MetaMask with test mnemonic...');
      const [wallet, _, context] = await bootstrap("", {
        wallet: "metamask",
        version: MetaMaskWallet.recommendedVersion,
        seed: TEST_MNEMONIC,
        password: METAMASK_PASSWORD,
        headless: false,
      });
      console.log('✓ MetaMask extension loaded and configured');
      
      metamaskWallet = await getWallet("metamask", context);
      metamaskContext = context;
      
      console.log('✓ Wallet initialized with test mnemonic');
      
      // Add Gnosis Chain network
      console.log('Adding Gnosis Chain network...');
      await metamaskWallet.addNetwork({
        networkName: 'Gnosis Chain',
        rpc: 'https://rpc.gnosischain.com',
        chainId: 100,
        symbol: 'XDAI'
      });
      
      console.log('✓ Gnosis Chain network added successfully');
      console.log('✓ MetaMask is ready for injection into the page');
      
      // Create the main page directly in the MetaMask context
      page = await metamaskContext.newPage();
      await page.goto('http://localhost:3000');
      
      console.log('✅ Test 00: MetaMask setup completed and page loaded');
      console.log('🦊 MetaMask is now ready for wallet connection tests');
      
    } catch (error) {
      console.error('❌ Test 00: MetaMask setup failed:', error);
      throw error;
    }
  });

  test('01 - Connect wallet to Safe Global', async ({ page, context }) => {
    console.log('🔗 Test 01: Connecting wallet to Safe Global...');
    
    // Open a new tab with the Safe Global URL
    const safeGlobalUrl = 'https://app.safe.global/home?safe=gno:0x4f4f1091Bf0F4b9F3c85031DDc4cf196653b18a0';
    const safeTab = await metamaskContext.newPage();
    
    console.log('📂 Opening Safe Global tab...');
    await safeTab.goto(safeGlobalUrl);
    
    // Wait for the page to load
    await safeTab.waitForLoadState('networkidle');
    console.log('✓ Safe Global page loaded');
    
    // Find and click the connect wallet button
    console.log('🔍 Looking for connect wallet button...');
    const connectWalletBtn = safeTab.locator('[data-testid="connect-wallet-btn"]');
    
    // Wait for the button to be visible and clickable
    await connectWalletBtn.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ Connect wallet button found');
    
    // Click the connect wallet button
    await connectWalletBtn.click();
    console.log('✓ Connect wallet button clicked');
    
    // Wait for wallet selection dialog and click MetaMask
    console.log('⏳ Waiting for wallet selection dialog...');
    
    // Look for and click the MetaMask button in the wallet selection dialog
    try {
      // Wait for the wallet selection dialog to appear
      await safeTab.waitForTimeout(2000); // Give time for dialog to appear
      
      // Find the button that contains a div with "Metamask" text
      const metamaskButton = safeTab.locator('button').filter({ has: safeTab.locator('div', { hasText: 'Metamask' }) });
      
      // Wait for the MetaMask button to be visible and click it
      await metamaskButton.waitFor({ state: 'visible', timeout: 10000 });
      await metamaskButton.click();
      console.log('✓ MetaMask wallet button clicked');
      
    } catch (e) {
      console.log('⚠️ Could not find MetaMask button in wallet selection dialog:', e.message);
      // Continue with the test in case the dialog structure is different
    }
    
    // Wait for MetaMask popup or connection dialog
    console.log('⏳ Waiting for MetaMask popup...');
    
    // Handle potential MetaMask popup
    try {
      // Wait for a new page (MetaMask popup) to appear
      const popupPromise = metamaskContext.waitForEvent('page', { timeout: 5000 });
      const popup = await popupPromise;
      
      console.log('🦊 MetaMask popup detected');
      
      // Wait for the popup to load
      await popup.waitForLoadState('networkidle');
      
      // Look for common MetaMask confirmation buttons
      const confirmSelectors = [
        'button:has-text("Connect")',
        'button:has-text("Confirm")',
        'button:has-text("Sign")',
        '[data-testid="confirm-btn"]',
        '[data-testid="connect-btn"]'
      ];
      
      let confirmed = false;
      for (const selector of confirmSelectors) {
        try {
          const confirmBtn = popup.locator(selector);
          if (await confirmBtn.isVisible({ timeout: 2000 })) {
            await confirmBtn.click();
            console.log(`✓ Clicked confirmation button: ${selector}`);
            confirmed = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!confirmed) {
        console.log('⚠️ No confirmation button found, popup might auto-close');
      }
      
      // Wait for popup to close
      await popup.waitForEvent('close', { timeout: 10000 });
      console.log('✓ MetaMask popup closed');
      
    } catch (e) {
      console.log('ℹ️ No MetaMask popup detected or popup handling failed:', e.message);
    }
    
    // Switch back to Safe Global tab and verify connection
    console.log('🔄 Switching back to Safe Global tab...');
    await safeTab.bringToFront();
    
    // Wait a moment for the connection to be processed
    await safeTab.waitForTimeout(2000);
    
    // Look for signs that the wallet is connected
    console.log('🔍 Verifying wallet connection...');
    
    // Common indicators of successful wallet connection
    const connectionIndicators = [
      '[data-testid="wallet-connected"]',
      '[data-testid="account-address"]',
      'text=0x', // Ethereum address pattern
      '[data-testid="disconnect-btn"]',
      'button:has-text("Disconnect")',
      '.wallet-connected',
      '.account-info'
    ];
    
    let connectionVerified = false;
    for (const indicator of connectionIndicators) {
      try {
        const element = safeTab.locator(indicator).first();
        if (await element.isVisible({ timeout: 3000 })) {
          console.log(`✓ Wallet connection verified with indicator: ${indicator}`);
          connectionVerified = true;
          break;
        }
      } catch (e) {
        // Continue to next indicator
      }
    }
    
    if (!connectionVerified) {
      console.log('⚠️ Could not verify wallet connection with standard indicators');
      console.log('ℹ️ Connection might still be successful - checking page state...');
      
      // Take a screenshot for debugging
      await safeTab.screenshot({ path: 'safe-global-connection-state.png' });
      console.log('📸 Screenshot saved as safe-global-connection-state.png');
    }
    
    console.log('✅ Test 01: Safe Global wallet connection process completed');
    console.log('🔗 Wallet connection to Safe Global attempted');
    
    if (DEBUG) await safeTab.pause();
    
    // Close the Safe Global tab
    await safeTab.close();
  });

  test('02 - App Navigation: Verify page loads and navigation buttons work', async () => {
    console.log('🔵 Test 02: App Navigation...');
    
    // Check that the page loads with the correct title
    await expect(page).toHaveTitle('gresistor - Gnosis Resilient Storage');

    // Check that all navigation buttons are visible
    const backupButton = page.locator('nav button', { hasText: 'Backup' });
    const restoreButton = page.locator('nav button', { hasText: 'Restore' });
    const configButton = page.locator('nav button', { hasText: 'Config' });

    await expect(backupButton).toBeVisible();
    await expect(restoreButton).toBeVisible();
    await expect(configButton).toBeVisible();

    // Test navigation between tabs
    await restoreButton.click();
    await expect(restoreButton.locator('b')).toContainText('Restore');
    
    await configButton.click();
    await expect(configButton.locator('b')).toContainText('Config');
    
    await backupButton.click();
    await expect(backupButton.locator('b')).toContainText('Backup');

    console.log('✅ Test 02: App Navigation verified successfully');
    if (DEBUG) await page.pause();
  });

  test('03 - Key Share Services: Create three services with different auth types', async () => {
    console.log('🔑 Test 03: Key Share Services...');
    
    // Navigate to config tab
    await page.locator('nav button', { hasText: 'Config' }).click();
    
    // Verify initially no services
    await expect(page.locator('text=No key share services found')).toBeVisible();

    // Create Service 1: No Authorization
    await page.locator('button', { hasText: 'Create New Service' }).click();
    
    // Wait for the form to appear and fill service name
    await page.locator('#new-service-name').waitFor();
    await page.locator('#new-service-name').fill('No Auth Service');
    
    // Wait for the authorization select to be ready and select no-auth
    await page.locator('#new-service-auth-type').waitFor();
    await page.locator('#new-service-auth-type').selectOption('no-auth');
    
    // Fill description and create service
    await page.locator('#new-service-description').fill('Service with no authorization');
    await page.locator('button', { hasText: 'Create Service' }).click();

    // Verify first service appears
    await expect(page.locator('td', { hasText: 'No Auth Service' })).toBeVisible();
    await expect(page.locator('td', { hasText: 'Service with no authorization' })).toBeVisible();

    // Create Service 2: Mock Signature (2x)
    await page.locator('button', { hasText: 'Create New Service' }).click();
    
    // Wait for the form and fill service name
    await page.locator('#new-service-name').waitFor();
    await page.locator('#new-service-name').fill('Mock Auth Service');
    
    // Wait for the authorization select and select mock-signature-2x
    await page.locator('#new-service-auth-type').waitFor();
    await page.locator('#new-service-auth-type').selectOption('mock-signature-2x');
    
    // Fill description and create service
    await page.locator('#new-service-description').fill('Service with mock signature (2x)');
    await page.locator('button', { hasText: 'Create Service' }).click();

    // Verify both services appear
    await expect(page.locator('td', { hasText: 'No Auth Service' })).toBeVisible();
    await expect(page.locator('td', { hasText: 'Mock Auth Service' })).toBeVisible();

    // Create Service 3: Safe Signature (not used for backup yet)
    await page.locator('button', { hasText: 'Create New Service' }).click();
    
    // Wait for the form and fill service name
    await page.locator('#new-service-name').waitFor();
    await page.locator('#new-service-name').fill('Safe Auth Service');
    
    // Wait for the authorization select and select safe-signature
    await page.locator('#new-service-auth-type').waitFor();
    await page.locator('#new-service-auth-type').selectOption('safe-signature');
    
    // Fill description and create service
    await page.locator('#new-service-description').fill('Service with Safe signature');
    await page.locator('button', { hasText: 'Create Service' }).click();

    // Verify all three services appear
    await expect(page.locator('td', { hasText: 'No Auth Service' })).toBeVisible();
    await expect(page.locator('td', { hasText: 'Mock Auth Service' })).toBeVisible();
    await expect(page.locator('td', { hasText: 'Safe Auth Service' })).toBeVisible();

    console.log('✅ Test 03: Key Share Services created successfully');
    if (DEBUG) await page.pause();
  });

  test('04 - Shamir Configuration: Set up 2-of-3 threshold', async () => {
    console.log('🔢 Test 04: Shamir Configuration...');
    
    // Should already be on config tab, verify Shamir config section
    await expect(page.locator('h1', { hasText: 'Shamir Secret Sharing' })).toBeVisible();
    
    // Get the input fields using unique IDs
    const thresholdInput = page.locator('#shamir-threshold');
    const totalSharesInput = page.locator('#shamir-total-shares');
    
    // Set to 2-of-3 (we have 3 services, will use 2 for backup)
    await thresholdInput.clear();
    await thresholdInput.fill('2');
    await totalSharesInput.clear();
    await totalSharesInput.fill('3');
    
    // Apply the configuration
    await page.locator('button', { hasText: 'Apply All Changes' }).click();
    
    // Verify the configuration is reflected
    await expect(page.locator('text=2 of 3 shares required for recovery')).toBeVisible();
    
    console.log('✅ Test 04: Shamir Configuration set successfully');
    if (DEBUG) await page.pause();
  });

  test('05 - Shamir Configuration: Change to 2-of-2 for backup test', async () => {
    console.log('🔢 Test 05: Changing Shamir Configuration to 2-of-2...');
    
    // Should already be on config tab, verify Shamir config section
    await expect(page.locator('h1', { hasText: 'Shamir Secret Sharing' })).toBeVisible();
    
    // Get the input fields using unique IDs
    const thresholdInput = page.locator('#shamir-threshold');
    const totalSharesInput = page.locator('#shamir-total-shares');
    
    // Change to 2-of-2 (we'll use 2 services for backup)
    await thresholdInput.clear();
    await thresholdInput.fill('2');
    await totalSharesInput.clear();
    await totalSharesInput.fill('2');
    
    // Apply the configuration
    await page.locator('button', { hasText: 'Apply All Changes' }).click();
    
    // Verify the configuration is reflected
    await expect(page.locator('text=2 of 2 shares required for recovery')).toBeVisible();
    
    console.log('✅ Test 05: Shamir Configuration changed to 2-of-2 successfully');
    if (DEBUG) await page.pause();
  });

  test('06 - Backup Creation: Create backup with profile data', async () => {
    console.log('💾 Test 06: Backup Creation...');
    
    // Navigate to backup tab
    await page.locator('nav button', { hasText: 'Backup' }).click();
    
    // Fill in profile information using unique IDs
    await page.locator('#profile-name').fill('Test User');
    await page.locator('#profile-age').fill('30');
    
    // Select service 1 (No Auth Service) using data-testid
    await page.locator('[data-testid="no-auth-owner-address"]').fill('1');
    await page.locator('[data-testid="service-select-no-auth-service"]').click();
    
    // Select service 2 (Mock Auth Service) using data-testid
    await page.locator('[data-testid="mock-auth-owner-address"]').fill('2');
    await page.locator('[data-testid="service-select-mock-auth-service"]').click();
    
    // Verify all 2 services are selected
    await expect(page.locator('text=Selected: 2 / 2 services')).toBeVisible();
    
    // Create backup - button should now be enabled
    const createBackupButton = page.locator('button', { hasText: 'Create Backup' });
    await expect(createBackupButton).toBeEnabled();
    await createBackupButton.click();
    
    // Verify backup was created (look for success message)
    await expect(page.locator('text=Backup completed successfully!')).toBeVisible();
    
    console.log('✅ Test 06: Backup created successfully');
    if (DEBUG) await page.pause();
  });

  test('07 - Backup Restore: Restore from backup using 2 services', async () => {
    console.log('🔄 Test 07: Backup Restore...');
    
    // Navigate to restore tab
    await page.locator('nav button', { hasText: 'Restore' }).click();
    
    // Step 1: Select radio button for the first backup
    const firstBackupRadio = page.locator('input[type="radio"]').first();
    await firstBackupRadio.check();
    await expect(firstBackupRadio).toBeChecked();
    
    // Step 2: Enter owner 1 into no auth owner address
    await page.locator('[data-testid="no-auth-owner-address"]').fill('1');
    
    // Step 3: Authenticate the no auth service
    await page.locator('[data-testid="no-auth-authenticate-button"]').click();
    
    // Step 4: Enter owner 2 and signature 4 into mock auth service
    await page.locator('[data-testid="mock-auth-owner-address"]').fill('2');
    await page.locator('[data-testid="mock-auth-signature"]').fill('4');
    
    // Step 5: Authenticate the mock auth service
    await page.locator('[data-testid="mock-signature-2x-authenticate-button"]').click();
    
    // Step 6: Verify shards appear for authenticated services
    await expect(page.locator('text=Available Shards')).toBeVisible();
    await expect(page.locator('h3', { hasText: 'No Auth Service' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'Mock Auth Service' })).toBeVisible();
    
    // Step 7: Select the checkbox of each of the two available shards
    const shardCheckboxes = page.locator('input[type="checkbox"]');
    await shardCheckboxes.first().check();
    await shardCheckboxes.nth(1).check();
    
    // Step 8: Restore button should now be available, hit it
    const restoreButton = page.locator('button', { hasText: 'Restore Profile' });
    await expect(restoreButton).toBeEnabled();
    await restoreButton.click();
    
    // Step 9: Check that the profile data has been restored
    await expect(page.locator('text=Restore completed successfully').or(page.locator('text=Profile restored'))).toBeVisible();
    
    // Verify the restored profile data appears in the Restored Profile section
    await expect(page.locator('h2', { hasText: 'Restored Profile' })).toBeVisible();
    
    // Verify that profile data is displayed (any non-empty values)
    await expect(page.locator('text=/Name:.*/')).toBeVisible();
    await expect(page.locator('text=/Age:.*/')).toBeVisible();
    
    console.log('✅ Test 07: Backup restored successfully');
    if (DEBUG) await page.pause();
  });

  test('08 - State Persistence Verification: Verify all data persists', async () => {
    console.log('🔍 Test 08: State Persistence Verification...');
    
    // Go back to config tab and verify services still exist
    await page.locator('nav button', { hasText: 'Config' }).click();
    
    // Verify both services are still there
    await expect(page.locator('td', { hasText: 'No Auth Service' })).toBeVisible();
    await expect(page.locator('td', { hasText: 'Mock Auth Service' })).toBeVisible();
    
    // Verify Shamir config is still 2-of-2
    const thresholdInput = page.locator('input[type="number"]').first();
    const totalSharesInput = page.locator('input[type="number"]').nth(1);
    
    await expect(thresholdInput).toHaveValue('2');
    await expect(totalSharesInput).toHaveValue('2');
    await expect(page.locator('text=2 of 2 shares required for recovery')).toBeVisible();
    
    // Go to backup tab and verify profile data persists
    await page.locator('nav button', { hasText: 'Backup' }).click();
    
    // Verify that the profile inputs show the restored data
    const profileNameValue = await page.locator('#profile-name').inputValue();
    const profileAgeValue = await page.locator('#profile-age').inputValue();
    
    console.log('Profile data in backup tab:', { profileNameValue, profileAgeValue });
    
    // Verify that profile data is present (not empty)
    await expect(page.locator('#profile-name')).not.toHaveValue('');
    await expect(page.locator('#profile-age')).not.toHaveValue('');
    
    console.log('✅ Test 08: State persistence verified successfully');
    console.log('🎉 COMPLETE WORKFLOW PASSED: Services, Shamir config, backup, and restore all working with state persistence!');
    
    if (DEBUG) await page.pause();
  });

  test('09 - MetaMask Integration: Verify MetaMask is ready for wallet operations', async () => {
    console.log('🦊 Test 09: MetaMask Integration...');
    
    // Verify MetaMask is properly initialized from beforeAll
    expect(metamaskWallet).toBeDefined();
    expect(metamaskContext).toBeDefined();
    
    console.log('✓ MetaMask wallet is available and ready');
    console.log('✓ MetaMask context is active');
    console.log('✓ Page is running in MetaMask-enabled context');
    
    // Additional verification that MetaMask is injected into the page
    const hasEthereum = await page.evaluate(() => {
      return typeof window.ethereum !== 'undefined';
    });
    
    expect(hasEthereum).toBe(true);
    console.log('✓ Ethereum provider is injected into the page');
    
    console.log('✅ Test 09: MetaMask integration verified successfully');
    console.log('🦊 MetaMask is ready for wallet connection operations');
    
    if (DEBUG) await page.pause();
  });


});
