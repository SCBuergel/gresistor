import { ShamirConfig, KeyShard } from './types';
export declare class ShamirSecretSharing {
    private config;
    constructor(config: ShamirConfig);
    /**
     * Splits a secret into N shares with M threshold
     */
    splitSecret(secret: Uint8Array): Promise<KeyShard[]>;
    /**
     * Reconstructs secret from threshold number of shares
     */
    reconstructSecret(shards: KeyShard[]): Promise<Uint8Array>;
    /**
     * Validates that shards are compatible for reconstruction
     */
    validateShards(shards: KeyShard[]): boolean;
}
//# sourceMappingURL=shamir.d.ts.map