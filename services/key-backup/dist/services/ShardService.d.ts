import { EIP712Message } from '@gresistor/library';
export interface ShardRequestData {
    shardId: string;
    requesterAddress: string;
    signature: string;
    message: EIP712Message;
    publicKey: string;
}
export interface ShardStorageData {
    shardId: string;
    encryptedShard: string;
}
export declare class ShardService {
    private shards;
    private safeAuth?;
    constructor();
    /**
     * Process a shard request with EIP-712 signature validation
     */
    requestShard(data: ShardRequestData): Promise<string>;
    /**
     * Store a key shard
     */
    storeShard(data: ShardStorageData): Promise<void>;
    /**
     * Check if a shard exists
     */
    shardExists(shardId: string): Promise<boolean>;
    /**
     * Validate EIP-712 signature with Safe
     */
    private validateSignature;
    /**
     * Encrypt shard for requester's public key
     */
    private encryptShardForRequester;
}
//# sourceMappingURL=ShardService.d.ts.map