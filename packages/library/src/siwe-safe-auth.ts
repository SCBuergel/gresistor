import { ethers } from 'ethers';
import { WalletConnector, WalletType, WalletConnection } from './wallet-connector';
import { SafeConfig, AuthData } from './types';

// Safe contract ABI - minimal interface for getOwners method
const SAFE_ABI = [
  'function getOwners() external view returns (address[])'
];

/**
 * SIWE-compliant Safe authentication service with wallet choice
 */
export class SIWESafeAuthService {
  private config: SafeConfig;
  private walletConnector: WalletConnector;
  private connection?: WalletConnection;
  private cachedOwners?: string[];

  constructor(config: SafeConfig, walletConnectProjectId?: string) {
    this.config = config;
    
    // Debug: Log WalletConnect Project ID received
    console.log('🔧 SIWESafeAuthService constructor - WalletConnect Project ID:', walletConnectProjectId);
    console.log('🔧 SIWESafeAuthService constructor - Project ID type:', typeof walletConnectProjectId);
    console.log('🔧 SIWESafeAuthService constructor - Project ID length:', walletConnectProjectId?.length);
    
    // Initialize wallet connector with proper RPC configuration
    this.walletConnector = new WalletConnector({
      chainId: config.chainId,
      rpcUrl: this.getRpcUrl(config.chainId),
      walletConnectProjectId
    });
  }

  /**
   * Connect wallet with user's choice of method
   */
  async connectWallet(walletType: WalletType): Promise<string> {
    try {
      console.log(`🔗 Connecting ${walletType} wallet...`);
      
      this.connection = await this.walletConnector.connect(walletType);
      
      // Verify the connected address is either a Safe owner OR the Safe itself
      const isOwner = await this.isOwner(this.connection.address);
      const isSafeItself = this.connection.address.toLowerCase() === this.config.safeAddress.toLowerCase();
      
      console.log(`🔍 Authentication validation:`);
      console.log(`  - Connected address: ${this.connection.address}`);
      console.log(`  - Safe address: ${this.config.safeAddress}`);
      console.log(`  - Is Safe owner: ${isOwner}`);
      console.log(`  - Is Safe itself: ${isSafeItself}`);
      
      if (!isOwner && !isSafeItself) {
        await this.disconnect();
        throw new Error(`Connected address ${this.connection.address} is neither a Safe owner nor the Safe itself`);
      }

      if (isSafeItself) {
        console.log(`✅ ${walletType} wallet connected as the Safe itself: ${this.connection.address}`);
      } else {
        console.log(`✅ ${walletType} wallet connected and verified as Safe owner: ${this.connection.address}`);
      }
      return this.connection.address;
    } catch (error) {
      throw new Error(`Failed to connect ${walletType} wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create SIWE-compliant message for Safe authentication
   */
  createSIWEMessage(purpose: string = 'Authentication'): string {
    if (!this.connection) {
      throw new Error('No wallet connected. Call connectWallet() first.');
    }

    // Use localhost for development/test environment, production domain otherwise
    const domain = window.location.hostname === 'localhost' ? 'localhost:3000' : 'https://scbuergel.github.io/gresistor';
    const uri = window.location.hostname === 'localhost' ? `http://${domain}` : `https://${domain}`;
    const version = '1';
    const chainId = this.config.chainId;
    const nonce = this.generateNonce();
    const issuedAt = new Date().toISOString();

    // SIWE message format (EIP-4361)
    const message = [
      `${domain} wants you to sign in with your Ethereum account:`,
      this.connection.address,
      '',
      `${purpose} for Safe ${this.config.safeAddress}`,
      '',
      `URI: ${uri}`,
      `Version: ${version}`,
      `Chain ID: ${chainId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`
    ].join('\n');

    return message;
  }

  /**
   * Sign SIWE authentication message
   */
  async signAuthMessage(purpose: string = 'Authentication'): Promise<AuthData> {
    if (!this.connection) {
      throw new Error('No wallet connected');
    }

    try {
      const message = this.createSIWEMessage(purpose);
      console.log('📝 SIWE message to sign:', message);
      
      const signature = await this.walletConnector.signMessage(message);

      return {
        ownerAddress: this.connection.address,
        signature,
        safeAddress: this.config.safeAddress,
        chainId: this.config.chainId,
        message // Include the SIWE message for verification
      };
    } catch (error) {
      throw new Error(`Failed to sign SIWE message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify SIWE signature
   */
  async verifySignature(authData: AuthData, purpose: string = 'Authentication'): Promise<boolean> {
    try {
      // Validate required fields
      if (!authData.ownerAddress || !authData.signature || !authData.safeAddress || !authData.chainId) {
        console.error('Missing required fields for SIWE signature verification');
        return false;
      }

      // Validate Safe address and chain ID match
      if (authData.safeAddress !== this.config.safeAddress || authData.chainId !== this.config.chainId) {
        console.error('Safe address or chain ID mismatch');
        return false;
      }

      // Validate owner address is a Safe owner
      if (!await this.isOwner(authData.ownerAddress)) {
        console.error('Signer is not a Safe owner');
        return false;
      }

      // Verify the SIWE signature cryptographically
      if (authData.message) {
        try {
          const recoveredAddress = ethers.verifyMessage(authData.message, authData.signature);
          if (recoveredAddress.toLowerCase() !== authData.ownerAddress.toLowerCase()) {
            console.error('Signature verification failed: recovered address does not match');
            return false;
          }
        } catch (error) {
          console.error('Failed to verify SIWE signature:', error);
          return false;
        }
      }

      console.log('✅ SIWE signature verification passed');
      return true;
    } catch (error) {
      console.error('SIWE signature verification failed:', error);
      return false;
    }
  }

  /**
   * Check if address is a Safe owner
   */
  async isOwner(address: string): Promise<boolean> {
    console.log(`🔍 Checking if ${address} is a Safe owner...`);
    const owners = await this.getOwners();
    const normalizedAddress = address.toLowerCase();
    const isOwner = owners.includes(normalizedAddress);
    console.log(`👤 Address ${normalizedAddress} is ${isOwner ? '✅ a Safe owner' : '❌ NOT a Safe owner'}`);
    console.log(`📋 Safe owners:`, owners);
    return isOwner;
  }

  /**
   * Get Safe owners from blockchain
   */
  async getOwners(): Promise<string[]> {
    // Use pre-configured owners if available
    if (this.config.owners && this.config.owners.length > 0) {
      return this.config.owners.map(owner => owner.toLowerCase());
    }

    // Use cached owners if available
    if (this.cachedOwners) {
      return this.cachedOwners;
    }

    // Fetch from blockchain
    return await this.fetchOwners();
  }

  /**
   * Fetch Safe owners from blockchain
   */
  private async fetchOwners(): Promise<string[]> {
    try {
      console.log(`🔍 Fetching Safe owners for ${this.config.safeAddress} on chain ${this.config.chainId}`);
      
      // Use a read-only provider for fetching owners
      const provider = new ethers.JsonRpcProvider(this.getRpcUrl(this.config.chainId));
      const safeContract = new ethers.Contract(this.config.safeAddress, SAFE_ABI, provider);
      
      console.log(`📡 Calling getOwners() on Safe contract...`);
      const owners = await safeContract.getOwners();
      console.log(`✅ Retrieved ${owners.length} owners:`, owners);
      
      // Normalize addresses to lowercase
      const normalizedOwners = owners.map((owner: string) => owner.toLowerCase());
      console.log(`🔧 Normalized owners:`, normalizedOwners);
      
      // Cache the result
      this.cachedOwners = normalizedOwners;
      
      return normalizedOwners;
    } catch (error) {
      console.error(`❌ Failed to fetch Safe owners for ${this.config.safeAddress} on chain ${this.config.chainId}:`, error);
      throw new Error(`Failed to fetch Safe owners: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get RPC URL for chain
   */
  private getRpcUrl(chainId: number): string {
    const rpcUrls: Record<number, string> = {
      1: 'https://eth.llamarpc.com',
      100: 'https://rpc.gnosischain.com',
      137: 'https://polygon.llamarpc.com',
      42161: 'https://arb1.arbitrum.io/rpc',
      10: 'https://mainnet.optimism.io'
    };

    const url = rpcUrls[chainId];
    if (!url) {
      throw new Error(`No RPC URL configured for chain ID ${chainId}`);
    }
    return url;
  }

  /**
   * Generate a random nonce for SIWE
   */
  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get current connection info
   */
  getConnection(): WalletConnection | undefined {
    return this.connection;
  }

  /**
   * Get connected address
   */
  getConnectedAddress(): string | undefined {
    return this.connection?.address;
  }

  /**
   * Get wallet type
   */
  getWalletType(): WalletType | undefined {
    return this.walletConnector.getWalletType();
  }

  /**
   * Get Safe configuration
   */
  getConfig(): SafeConfig {
    return { ...this.config };
  }

  /**
   * Disconnect wallet
   */
  async disconnect(): Promise<void> {
    await this.walletConnector.disconnect();
    this.connection = undefined;
  }
}
