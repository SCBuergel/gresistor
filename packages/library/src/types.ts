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

export interface KeyShardStorageBackend {
  type: 'swarm' | 'ipfs' | 'local-browser' | 'memory';
  endpoint?: string;
  apiKey?: string;
}

export interface EncryptedDataStorage {
  type: 'swarm' | 'ipfs' | 'local-browser' | 'memory';
  endpoint?: string;
  apiKey?: string;
}

export interface KeyShareStorage {
  type: 'swarm' | 'ipfs' | 'local-browser' | 'memory';
  endpoint?: string;
  apiKey?: string;
  selectedServices?: string[]; // For local-browser, list of active service IDs
}

export interface TransportConfig {
  method: 'plain-http' | 'ipfs-gateway' | 'swarm-gateway';
  timeout?: number;
  retries?: number;
}

export interface SafeConfig {
  safeAddress: string;
  chainId: number;
  owners: string[];
}

export interface BackupResult {
  encryptedBlobHash: string;
  encryptedBlob?: Uint8Array;     // Add for direct usage without storage
  shardIds: string[];
  keyShards?: KeyShard[];         // Add for direct shard data usage without storage
  metadata: {
    timestamp: Date;
    config: ShamirConfig;
  };
  cryptoDetails?: {
    encryptedDataHex: string;
    encryptionKeyHex: string;
    shardsHex: string[];
    serviceNames: string[];
  };
}

export interface KeyShard {
  id: string;
  data: Uint8Array;
  threshold: number;
  totalShares: number;
  authorizationAddress?: string;
}

export interface AuthData {
  ownerAddress: string;
  signature?: string;
}

export type AuthorizationType = 'no-auth' | 'mock-signature-2x';

export interface ServiceAuthConfig {
  authType: AuthorizationType;
  description: string;
}

export interface RestoreRequest {
  encryptedBlobHash?: string;     // Make optional for direct blob usage
  encryptedBlob?: Uint8Array;     // Add for direct usage without storage
  shardIds: string[];
  keyShards?: KeyShard[];         // Add for direct shard data usage without storage
  requiredShards: number;
  safeSignature?: string;
  authorizationSignatures?: { [serviceName: string]: string }; // Signatures for each service to authorize shard retrieval
  authData?: AuthData; // Authorization data for shard retrieval
}

export interface EIP712Message {
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  message: Record<string, any>;
} 