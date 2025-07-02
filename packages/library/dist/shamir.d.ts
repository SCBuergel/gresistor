import { ShamirConfig, KeyShard } from './types';
export declare class ShamirSecretSharing {
    private config;
    constructor(config: ShamirConfig);
    /**
     * Splits a secret into N shares using Shamir Secret Sharing
     */
    splitSecret(secret: Uint8Array): Promise<KeyShard[]>;
    /**
     * Reconstructs the secret from shares
     */
    reconstructSecret(shares: KeyShard[]): Promise<Uint8Array>;
    /**
     * Validates that the shares are consistent
     */
    validateShards(shards: KeyShard[]): boolean;
}
//# sourceMappingURL=shamir.d.ts.map