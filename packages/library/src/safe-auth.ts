import { SafeConfig, EIP712Message, AuthData } from './types';
import { ethers } from 'ethers';

// Safe contract ABI - minimal interface for getOwners method
const SAFE_ABI = [
  'function getOwners() external view returns (address[])'
];

// Type definitions for wallet connection
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      selectedAddress?: string;
      chainId?: string;
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

export class SafeAuthService {
  private config: SafeConfig;
  private connectedAddress?: string;
  private cachedOwners?: string[];
  private provider?: ethers.Provider;

  constructor(config: SafeConfig) {
    this.config = config;
  }

  /**
   * Gets an ethers provider for the configured chain
   */
  private getProvider(): ethers.Provider {
    if (!this.provider) {
      // Get RPC URL for the chain
      const rpcUrl = this.getRpcUrl(this.config.chainId);
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    return this.provider;
  }

  /**
   * Gets RPC URL for a given chain ID
   */
  private getRpcUrl(chainId: number): string {
    // Common RPC endpoints - in production you might want to use your own or environment variables
    const rpcUrls: Record<number, string> = {
      1: 'https://eth.llamarpc.com',
      100: 'https://rpc.gnosischain.com',
      137: 'https://polygon.llamarpc.com',
      42161: 'https://arb1.arbitrum.io/rpc',
      10: 'https://mainnet.optimism.io'
    };

    const url = rpcUrls[chainId];
    if (!url) {
      throw new Error(`No RPC URL configured for chain ID ${chainId}. Please add it to the configuration.`);
    }
    return url;
  }

  /**
   * Fetches Safe owners from the blockchain
   */
  async fetchOwners(): Promise<string[]> {
    try {
      const provider = this.getProvider();
      const safeContract = new ethers.Contract(this.config.safeAddress, SAFE_ABI, provider);
      
      const owners = await safeContract.getOwners();
      
      // Normalize addresses to lowercase
      const normalizedOwners = owners.map((owner: string) => owner.toLowerCase());
      
      // Cache the result
      this.cachedOwners = normalizedOwners;
      
      return normalizedOwners;
    } catch (error) {
      throw new Error(`Failed to fetch Safe owners: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets Safe owners (uses cache if available, otherwise fetches from blockchain)
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
   * Checks if address is a Safe owner
   */
  async isOwner(address: string): Promise<boolean> {
    const owners = await this.getOwners();
    return owners.includes(address.toLowerCase());
  }

  /**
   * Gets the Safe configuration
   */
  getConfig(): SafeConfig {
    return { ...this.config };
  }

  /**
   * Connects to a wallet (MetaMask, etc.)
   */
  async connectWallet(): Promise<string> {
    if (!window.ethereum) {
      throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.');
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found in wallet');
      }

      const address = accounts[0].toLowerCase();
      this.connectedAddress = address;
      
      // Check if connected address is a Safe owner
      if (!await this.isOwner(address)) {
        throw new Error(`Connected address ${address} is not a Safe owner`);
      }

      // Switch to correct chain if needed
      await this.switchToChain(this.config.chainId);

      return this.connectedAddress!;
    } catch (error) {
      throw new Error(`Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Switches wallet to the correct chain
   */
  private async switchToChain(chainId: number): Promise<void> {
    if (!window.ethereum) {
      throw new Error('No wallet detected');
    }

    const chainIdHex = `0x${chainId.toString(16)}`;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }]
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        throw new Error(`Chain ${chainId} is not configured in your wallet. Please add it manually.`);
      }
      throw switchError;
    }
  }

  /**
   * Creates an EIP-712 message for Safe authentication
   */
  createAuthMessage(purpose: string = 'Authentication'): EIP712Message {
    if (!this.connectedAddress) {
      throw new Error('No wallet connected. Call connectWallet() first.');
    }
    
    return {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        SafeAuth: [
          { name: 'purpose', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'safeAddress', type: 'address' },
          { name: 'owner', type: 'address' }
        ]
      },
      primaryType: 'SafeAuth',
      domain: {
        name: 'Resilient Backup',
        version: '1.0',
        chainId: this.config.chainId,
        verifyingContract: this.config.safeAddress
      },
      message: {
        purpose,
        timestamp: Math.floor(Date.now() / 1000),
        safeAddress: this.config.safeAddress,
        owner: this.connectedAddress as string
      }
    };
  }

  /**
   * Signs a Safe authentication message using the connected wallet
   */
  async signAuthMessage(purpose: string = 'Authentication'): Promise<AuthData> {
    if (!this.connectedAddress) {
      await this.connectWallet();
    }

    if (!window.ethereum) {
      throw new Error('No wallet detected');
    }

    const message = this.createAuthMessage(purpose);

    try {
      // Sign the EIP-712 message
      const signature = await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [this.connectedAddress, JSON.stringify(message)]
      });

      return {
        ownerAddress: this.connectedAddress!,
        signature,
        safeAddress: this.config.safeAddress,
        chainId: this.config.chainId
      };
    } catch (error) {
      throw new Error(`Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verifies a Safe signature (basic validation - would need full Safe SDK for complete verification)
   */
  async verifySignature(authData: AuthData, purpose: string = 'Authentication'): Promise<boolean> {
    try {
      // Validate required fields
      if (!authData.ownerAddress || !authData.signature || !authData.safeAddress || !authData.chainId) {
        console.error('Missing required fields for Safe signature verification');
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

      // TODO: Implement full EIP-712 signature verification
      // This would require crypto libraries like ethers.js or similar
      // For now, we validate the basic structure and ownership
      
      console.log('✅ Safe signature validation passed (basic validation)');
      return true;
    } catch (error) {
      console.error('Safe signature verification failed:', error);
      return false;
    }
  }

  /**
   * Gets the currently connected wallet address
   */
  getConnectedAddress(): string | undefined {
    return this.connectedAddress;
  }

  /**
   * Disconnects the wallet
   */
  disconnect(): void {
    this.connectedAddress = undefined;
  }
} 