import { SafeConfig, EIP712Message } from './types';

export class SafeAuthService {
  private config: SafeConfig;

  constructor(config: SafeConfig) {
    this.config = config;
  }

  /**
   * Creates EIP-712 message for shard request
   */
  createShardRequestMessage(shardId: string, requesterAddress: string): EIP712Message {
    // Stub implementation
    throw new Error('createShardRequestMessage() not implemented');
  }

  /**
   * Signs an EIP-712 message (would typically be done by Safe)
   */
  async signMessage(message: EIP712Message): Promise<string> {
    // Stub implementation
    throw new Error('signMessage() not implemented');
  }

  /**
   * Verifies EIP-712 signature using EIP-1271
   */
  async verifySignature(message: EIP712Message, signature: string): Promise<boolean> {
    // Stub implementation
    throw new Error('verifySignature() not implemented');
  }

  /**
   * Checks if address is a Safe owner
   */
  async isOwner(address: string): Promise<boolean> {
    // Stub implementation
    return this.config.owners.includes(address.toLowerCase());
  }
} 