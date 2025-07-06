import { ShamirConfig, KeyShard } from './types';
// @ts-ignore - shamirs-secret-sharing doesn't have official types
import * as sss from 'shamirs-secret-sharing';

// Browser-compatible Shamir Secret Sharing implementation

export class ShamirSecretSharing {
  private config: ShamirConfig;

  constructor(config: ShamirConfig) {
    this.config = config;
  }

  /**
   * Splits a secret into N shares using Shamir Secret Sharing
   */
  async splitSecret(secret: Uint8Array): Promise<KeyShard[]> {
    const { threshold, totalShares } = this.config;
    
    try {
      // Split the secret using shamirs-secret-sharing
      const shares = sss.split(secret, { shares: totalShares, threshold });
      
      // Convert shares to KeyShard format
      const keyShards: KeyShard[] = [];
      for (let i = 0; i < shares.length; i++) {
        keyShards.push({
          id: `share_${i + 1}`,
          data: shares[i],
          threshold,
          totalShares,
          timestamp: new Date()
        });
      }
      
      return keyShards;
    } catch (error) {
      throw new Error(`Failed to split secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reconstructs the secret from shares
   */
  async reconstructSecret(shares: KeyShard[]): Promise<Uint8Array> {
    if (shares.length < this.config.threshold) {
      throw new Error(`Need at least ${this.config.threshold} shares to reconstruct the secret`);
    }
    
    try {
      // Convert shares to the format expected by shamirs-secret-sharing
      const shareBuffers: Uint8Array[] = shares.map(share => share.data);
      
      const reconstructed = sss.combine(shareBuffers);
      return reconstructed;
    } catch (error) {
      throw new Error(`Failed to reconstruct secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates that the shares are consistent
   */
  validateShards(shards: KeyShard[]): boolean {
    if (shards.length === 0) {
      return false;
    }
    
    const firstShard = shards[0];
    return shards.every(shard => 
      shard.threshold === firstShard.threshold &&
      shard.totalShares === firstShard.totalShares &&
      shard.data.length === firstShard.data.length
    );
  }
} 