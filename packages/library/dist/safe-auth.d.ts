import { SafeConfig, EIP712Message } from './types';
export declare class SafeAuthService {
    private config;
    constructor(config: SafeConfig);
    /**
     * Creates EIP-712 message for shard request
     */
    createShardRequestMessage(shardId: string, requesterAddress: string): EIP712Message;
    /**
     * Signs an EIP-712 message (would typically be done by Safe)
     */
    signMessage(message: EIP712Message): Promise<string>;
    /**
     * Verifies EIP-712 signature using EIP-1271
     */
    verifySignature(message: EIP712Message, signature: string): Promise<boolean>;
    /**
     * Checks if address is a Safe owner
     */
    isOwner(address: string): Promise<boolean>;
}
//# sourceMappingURL=safe-auth.d.ts.map