import { KeyShardStorageBackend, TransportConfig, AuthorizationType, AuthData, ServiceAuthConfig } from './types';
declare global {
    interface Window {
        indexedDB: IDBFactory;
    }
}
export type KeyShareService = {
    name: string;
    description?: string;
    authType: AuthorizationType;
    createdAt: Date;
    isActive: boolean;
};
export declare class KeyShareRegistryService {
    private dbName;
    private dbVersion;
    private storeName;
    private getDB;
    /**
     * Lists all registered key share services
     */
    listServices(): Promise<KeyShareService[]>;
    /**
     * Registers a new key share service
     */
    registerService(service: Omit<KeyShareService, 'createdAt'>): Promise<void>;
    /**
     * Updates a key share service
     */
    updateService(service: KeyShareService): Promise<void>;
    /**
     * Deletes a key share service from registry
     */
    deleteService(name: string): Promise<void>;
    /**
     * Gets the authorization type for a specific service
     */
    getServiceAuthType(serviceName: string): Promise<AuthorizationType>;
    /**
     * Updates the authorization type for a specific service
     */
    updateServiceAuthType(serviceName: string, authType: AuthorizationType): Promise<void>;
}
export declare class KeyShareStorageService {
    private dbName;
    private dbVersion;
    private storeName;
    private serviceName;
    private registry;
    private dbPromise;
    constructor(serviceName: string);
    private getDB;
    private getAuthTypeDescription;
    /**
     * Gets the authorization configuration for this service from the registry
     */
    getAuthConfig(): Promise<ServiceAuthConfig>;
    /**
     * Updates the authorization configuration for this service in the registry
     */
    updateAuthConfig(authType: AuthorizationType): Promise<void>;
    /**
     * Stores a key shard with authorization configuration
     */
    storeShard(data: Uint8Array, authorizationAddress?: string): Promise<void>;
    /**
     * Retrieves all key shards with authorization validation
     */
    getAllShardsWithAuth(authData?: AuthData): Promise<Array<{
        data: Uint8Array;
        timestamp: Date;
        authorizationAddress?: string;
    }>>;
    /**
     * Retrieves shard metadata only (for discovery purposes - no sensitive data exposed)
     * Use getAllShardsWithAuth() to access actual shard data after proper authorization
     */
    getShardMetadata(): Promise<Array<{
        timestamp: Date;
        authorizationAddress?: string;
        dataSize: number;
    }>>;
    /**
     * @deprecated Use getShardMetadata() for discovery and getAllShardsWithAuth() for accessing data
     * This method is kept for backwards compatibility but should not be used
     */
    getAllShards(): Promise<Array<{
        data: Uint8Array;
        timestamp: Date;
        authorizationAddress?: string;
    }>>;
    /**
     * Retrieves authorized key shards for a specific timestamp with full authorization validation
     */
    getAuthorizedShard(targetTimestamp: number, authData?: AuthData): Promise<{
        data: Uint8Array;
        timestamp: Date;
        authorizationAddress?: string;
    } | null>;
    /**
     * Validates authorization data based on service auth type
     */
    private validateAuthData;
    /**
     * Validates shard-specific authorization (for backwards compatibility)
     */
    private validateShardAuth;
    /**
     * Mock signature validation: signature should be address * 2 (backwards compatibility)
     */
    private validateMockSignature;
    /**
     * Deletes a key shard by internal key
     */
    deleteShard(key: number): Promise<void>;
    /**
     * Clears all shards in this storage
     */
    clear(): Promise<void>;
    /**
     * Deletes the entire database
     */
    deleteDatabase(): Promise<void>;
}
export declare class StorageService {
    private backend;
    private transport;
    constructor(backend?: KeyShardStorageBackend, transport?: TransportConfig);
    /**
     * Uploads data to the configured storage backend
     */
    upload(data: Uint8Array): Promise<string>;
    /**
     * Downloads data from the storage backend by hash
     */
    download(hash: string): Promise<Uint8Array>;
    /**
     * Checks if data exists at the given hash
     */
    exists(hash: string): Promise<boolean>;
    /**
     * Gets metadata about stored data
     */
    getMetadata(hash: string): Promise<{
        size: number;
        timestamp: Date;
    }>;
}
/**
 * In-memory storage service for Node.js testing
 */
export declare class InMemoryStorageService {
    private storage;
    /**
     * Uploads data to in-memory storage and returns the hash
     */
    upload(data: Uint8Array): Promise<string>;
    /**
     * Downloads data from in-memory storage by hash
     */
    download(hash: string): Promise<Uint8Array>;
    /**
     * Checks if data exists at the given hash
     */
    exists(hash: string): Promise<boolean>;
    /**
     * Gets metadata about stored data
     */
    getMetadata(hash: string): Promise<{
        size: number;
        timestamp: Date;
    }>;
    /**
     * Generates a hash for the data
     */
    private generateHash;
    /**
     * Lists all stored data hashes
     */
    listHashes(): Promise<string[]>;
    /**
     * Clears all stored data
     */
    clear(): Promise<void>;
}
export declare class BrowserStorageService {
    private dbName;
    private dbVersion;
    private storeName;
    private getDB;
    /**
     * Uploads data to browser storage and returns the hash
     */
    upload(data: Uint8Array): Promise<string>;
    /**
     * Downloads data from browser storage by hash
     */
    download(hash: string): Promise<Uint8Array>;
    /**
     * Checks if data exists at the given hash
     */
    exists(hash: string): Promise<boolean>;
    /**
     * Gets metadata about stored data
     */
    getMetadata(hash: string): Promise<{
        size: number;
        timestamp: Date;
    }>;
    /**
     * Generates a hash for the data (simplified implementation)
     */
    private generateHash;
    /**
     * Lists all stored data hashes
     */
    listHashes(): Promise<string[]>;
    /**
     * Clears all stored data
     */
    clear(): Promise<void>;
}
//# sourceMappingURL=storage.d.ts.map