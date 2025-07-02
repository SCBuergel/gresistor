export interface BackupProfile {
    id: string;
    data: Uint8Array;
    metadata: {
        name: string;
        createdAt: Date;
        version: string;
    };
}
export interface EncryptionConfig {
    algorithm: 'AES-256-GCM';
    nonceStrategy: 'random-96-bit';
}
export interface ShamirConfig {
    threshold: number;
    totalShares: number;
}
export interface StorageBackend {
    type: 'swarm' | 'ipfs' | 'local';
    endpoint: string;
    apiKey?: string;
}
export interface TransportConfig {
    method: 'plain-http' | 'tor-proxy' | 'hopr-mixnet';
    proxyUrl?: string;
}
export interface SafeConfig {
    safeAddress: string;
    chainId: number;
    owners: string[];
}
export interface BackupResult {
    encryptedBlobHash: string;
    shardHashes: string[];
    metadata: {
        timestamp: Date;
        config: ShamirConfig;
    };
}
export interface RestoreRequest {
    encryptedBlobHash: string;
    shardHashes: string[];
    requiredShards: number;
    safeSignature?: string;
}
export interface KeyShard {
    id: string;
    data: Uint8Array;
    threshold: number;
    totalShares: number;
}
export interface EIP712Message {
    types: Record<string, Array<{
        name: string;
        type: string;
    }>>;
    primaryType: string;
    domain: {
        name: string;
        version: string;
        chainId: number;
        verifyingContract: string;
    };
    message: Record<string, any>;
}
//# sourceMappingURL=types.d.ts.map