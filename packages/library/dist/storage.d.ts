import { KeyShardStorageBackend, TransportConfig } from './types';
declare global {
    interface Window {
        indexedDB: IDBFactory;
    }
}
export type KeyShareService = {
    name: string;
    description?: string;
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
}
export declare class KeyShareStorageService {
    private dbName;
    private dbVersion;
    private storeName;
    constructor(serviceName: string);
    private getDB;
    /**
     * Stores a key shard
     */
    storeShard(shardData: Uint8Array): Promise<void>;
    /**
     * Retrieves all key shards
     */
    getAllShards(): Promise<Array<{
        data: Uint8Array;
        timestamp: Date;
    }>>;
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