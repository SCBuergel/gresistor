import { test, expect } from '@playwright/test';

test.describe('Gresistor App', () => {
  test('should load the page and display backup, restore, and config buttons', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Check that the page loads with the correct title
    await expect(page).toHaveTitle('gresistor - Gnosis Resilient Storage');

    // Check that the main heading is visible
    await expect(page.locator('h1').first()).toContainText('gresistor - Gnosis Resilient Storage');

    // Check that the description is visible
    await expect(page.locator('p').first()).toContainText('Secure wallet profile backup with Shamir Secret Sharing and Safe authentication');

    // Check that all three navigation buttons are visible
    // Target navigation buttons specifically by looking within the nav element
    const backupButton = page.locator('nav button', { hasText: 'Backup' });
    const restoreButton = page.locator('nav button', { hasText: 'Restore' });
    const configButton = page.locator('nav button', { hasText: 'Config' });

    await expect(backupButton).toBeVisible();
    await expect(restoreButton).toBeVisible();
    await expect(configButton).toBeVisible();

    // Check that the backup button is initially active (bold)
    await expect(backupButton.locator('b')).toContainText('Backup');
    
    // Check that inactive buttons are NOT in bold (negative test)
    await expect(restoreButton.locator('b')).not.toBeVisible();
    await expect(configButton.locator('b')).not.toBeVisible();

    // Test clicking on different tabs
    await restoreButton.click();
    await expect(restoreButton.locator('b')).toContainText('Restore');
    
    // Check that other buttons are now inactive (not bold)
    await expect(backupButton.locator('b')).not.toBeVisible();
    await expect(configButton.locator('b')).not.toBeVisible();

    await configButton.click();
    await expect(configButton.locator('b')).toContainText('Config');
    
    // Check that other buttons are now inactive (not bold)
    await expect(backupButton.locator('b')).not.toBeVisible();
    await expect(restoreButton.locator('b')).not.toBeVisible();

    // Go back to backup tab
    await backupButton.click();
    await expect(backupButton.locator('b')).toContainText('Backup');
    
    // Final check that other buttons are inactive
    await expect(restoreButton.locator('b')).not.toBeVisible();
    await expect(configButton.locator('b')).not.toBeVisible();
  });
});
