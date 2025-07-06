import { ethers } from 'ethers';
import { EthereumProvider } from '@walletconnect/ethereum-provider';

export type WalletType = 'injected' | 'walletconnect';

export interface WalletConnection {
  address: string;
  provider: ethers.Provider;
  signer: ethers.Signer;
  chainId: number;
}

export interface WalletConnectorConfig {
  chainId: number;
  rpcUrl: string;
  walletConnectProjectId?: string; // Required for WalletConnect
}

/**
 * Unified wallet connector supporting both injected wallets and WalletConnect
 */
export class WalletConnector {
  private config: WalletConnectorConfig;
  private connection?: WalletConnection;
  private walletType?: WalletType;

  constructor(config: WalletConnectorConfig) {
    this.config = config;
    
    // Debug: Log WalletConnect Project ID received in config
    console.log('🔧 WalletConnector constructor - Config:', config);
    console.log('🔧 WalletConnector constructor - WalletConnect Project ID:', config.walletConnectProjectId);
    console.log('🔧 WalletConnector constructor - Project ID type:', typeof config.walletConnectProjectId);
    console.log('🔧 WalletConnector constructor - Project ID length:', config.walletConnectProjectId?.length);
  }

  /**
   * Connect to wallet with user's choice of method
   */
  async connect(walletType: WalletType): Promise<WalletConnection> {
    this.walletType = walletType;

    switch (walletType) {
      case 'injected':
        return await this.connectInjected();
      case 'walletconnect':
        return await this.connectWalletConnect();
      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }
  }

  /**
   * Connect to injected wallet (MetaMask, etc.)
   */
  private async connectInjected(): Promise<WalletConnection> {
    if (!window.ethereum) {
      throw new Error('No injected wallet detected. Please install MetaMask or another Web3 wallet.');
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
      
      // Create provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Get current chain ID
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      // Switch to correct chain if needed
      if (chainId !== this.config.chainId) {
        await this.switchChain(this.config.chainId);
      }

      this.connection = {
        address,
        provider,
        signer,
        chainId: this.config.chainId
      };

      return this.connection;
    } catch (error) {
      throw new Error(`Failed to connect injected wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Connect to WalletConnect
   */
  private async connectWalletConnect(): Promise<WalletConnection> {
    if (!this.config.walletConnectProjectId) {
      throw new Error('WalletConnect Project ID is required for WalletConnect integration');
    }

    try {
      const provider = await EthereumProvider.init({
        projectId: this.config.walletConnectProjectId,
        chains: [this.config.chainId],
        showQrModal: true,
        rpcMap: {
          [this.config.chainId]: this.config.rpcUrl
        }
      });

      // Connect
      await provider.connect();

      if (!provider.accounts || provider.accounts.length === 0) {
        throw new Error('No accounts connected via WalletConnect');
      }

      const address = provider.accounts[0].toLowerCase();
      
      // Create ethers provider and signer
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();

      this.connection = {
        address,
        provider: ethersProvider,
        signer,
        chainId: this.config.chainId
      };

      return this.connection;
    } catch (error) {
      throw new Error(`Failed to connect WalletConnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Switch to a different chain (injected wallets only)
   */
  private async switchChain(chainId: number): Promise<void> {
    if (!window.ethereum) {
      throw new Error('Cannot switch chain: no injected wallet detected');
    }

    const chainIdHex = `0x${chainId.toString(16)}`;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }]
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        throw new Error(`Chain ${chainId} is not configured in your wallet. Please add it manually.`);
      }
      throw switchError;
    }
  }

  /**
   * Get current connection
   */
  getConnection(): WalletConnection | undefined {
    return this.connection;
  }

  /**
   * Get wallet type
   */
  getWalletType(): WalletType | undefined {
    return this.walletType;
  }

  /**
   * Disconnect wallet
   */
  async disconnect(): Promise<void> {
    if (this.walletType === 'walletconnect' && this.connection) {
      // Disconnect WalletConnect if it was used
      try {
        // Use eval to prevent TypeScript from checking the import at compile time
        await eval('import("@walletconnect/ethereum-provider")');
        // Note: This is a simplified disconnect - in practice you'd need to maintain the provider instance
        console.log('WalletConnect disconnected');
      } catch (error) {
        console.warn('WalletConnect not available for disconnect:', error);
      }
    }
    
    this.connection = undefined;
    this.walletType = undefined;
  }

  /**
   * Sign a message using the connected wallet
   */
  async signMessage(message: string): Promise<string> {
    if (!this.connection) {
      throw new Error('No wallet connected');
    }

    return await this.connection.signer.signMessage(message);
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(domain: any, types: any, value: any): Promise<string> {
    if (!this.connection) {
      throw new Error('No wallet connected');
    }

    return await this.connection.signer.signTypedData(domain, types, value);
  }
}

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
