import { test, expect } from '@playwright/test';
import { bootstrap, getWallet, MetaMaskWallet } from '@tenkeylabs/dappwright';

// Debug mode - set to true to enable page.pause() at the end of each test
const DEBUG = process.env.DEBUG === 'true' || process.env.PWDEBUG === '1';

// MetaMask test configuration
const TEST_MNEMONIC = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
const METAMASK_PASSWORD = 'TestPassword123!';

test.describe('MetaMask Connection to Safe Global', () => {
  let metamaskWallet;
  let metamaskContext;

  test.afterAll(async () => {
    // Clean up MetaMask context
    if (metamaskContext) {
      await metamaskContext.close();
      console.log('✓ MetaMask context cleaned up');
    }
  });

  test('Initialize MetaMask and connect to Safe Global', async () => {
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
      metamaskContext = context;
      
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
      expect(metamaskContext).toBeDefined();
      
    } catch (error) {
      console.error('❌ MetaMask bootstrap failed:', error);
      throw error;
    }
  });

  test('Connect to Safe Global URL', async () => {
    console.log('🔗 Connecting to Safe Global...');
    
    // Open a new page with the Safe Global URL
    const safeGlobalUrl = 'https://app.safe.global/home?safe=gno:0x4f4f1091Bf0F4b9F3c85031DDc4cf196653b18a0';
    const safeTab = await metamaskContext.newPage();
    
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
          const popupPromise = metamaskContext.waitForEvent('page', { timeout: 10000 });
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

  test('Verify local app loads correctly', async () => {
    console.log('🏠 Testing local app at localhost:3000...');
    
    // Open the local app in a new tab
    const localAppTab = await metamaskContext.newPage();
    
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
      console.log('🔍 Debug mode: Local app tab open for inspection');
      await localAppTab.pause();
    }
    
    console.log('✅ Local app verification completed');
    console.log('🏠 Local app URL: http://localhost:3000');
  });



});
