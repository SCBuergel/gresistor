import { test, expect } from './fixtures';

// Debug mode - set to true to enable page.pause() at the end of each test
const DEBUG = process.env.DEBUG === 'true' || process.env.PWDEBUG === '1';
const WAIT_TIME = DEBUG ? 1000 : 500;

test.describe.serial('Complete Gresistor Workflow', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();     // one tab for all tests
    await page.goto('http://localhost:3000');
  });

  test('01 - App Navigation: Verify page loads and navigation buttons work', async () => {
    console.log('🔵 Test 01: App Navigation...');
    
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

    console.log('✅ Test 01: App navigation working correctly');
    if (DEBUG) await page.pause();
  });

  test('02 - Key Share Services: Create three services with different auth types', async () => {
    console.log('🟢 Test 02: Creating key share services...');
    
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

    console.log('✅ Test 02: Created 3 key share services');
    if (DEBUG) await page.pause();
  });

  test('03 - Shamir Configuration: Set up 2-of-3 threshold', async () => {
    console.log('🟡 Test 03: Configuring Shamir Secret Sharing...');
    
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
    
    console.log('✅ Test 03: Shamir config set to 2-of-3');
    if (DEBUG) await page.pause();
  });

  test('03b - Shamir Configuration: Change to 2-of-2 for backup test', async () => {
    console.log('🟡 Test 03b: Changing Shamir config to 2-of-2 for backup...');
    
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
    
    console.log('✅ Test 03b: Shamir config changed to 2-of-2');
    if (DEBUG) await page.pause();
  });

  test('04 - Backup Creation: Create backup with profile data', async () => {
    console.log('🟣 Test 04: Creating backup...');
    
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
    
    console.log('✅ Test 04: Backup created successfully');
    if (DEBUG) await page.pause();
  });

  test('05 - Backup Restore: Restore from backup using 2 services', async () => {
    console.log('🔴 Test 05: Restoring from backup...');
    
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
    
    console.log('✅ Test 05: Backup restored successfully');
    if (DEBUG) await page.pause();
  });

  test('06 - State Persistence Verification: Verify all data persists', async () => {
    console.log('🎯 Test 06: Verifying state persistence...');
    
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
    
    console.log('✅ Test 06: All state persistence verified - complete workflow successful!');
    console.log('🎉 COMPLETE WORKFLOW PASSED: Services, Shamir config, backup, and restore all working with state persistence!');
    
    if (DEBUG) await page.pause();
  });
});
