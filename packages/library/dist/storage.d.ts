import { StorageBackend, TransportConfig } from './types';
declare global {
    interface Window {
        indexedDB: IDBFactory;
    }
}
export type KeyShareService = {
    id: string;
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
    deleteService(id: string): Promise<void>;
}
export declare class KeyShareStorageService {
    private dbName;
    private dbVersion;
    private storeName;
    constructor(serviceId: string);
    private getDB;
    /**
     * Stores a key shard
     */
    storeShard(shardId: string, shardData: Uint8Array, metadata?: any): Promise<void>;
    /**
     * Retrieves a key shard
     */
    getShard(shardId: string): Promise<{
        data: Uint8Array;
        metadata?: any;
    }>;
    /**
     * Lists all stored shard IDs
     */
    listShardIds(): Promise<string[]>;
    /**
     * Deletes a key shard
     */
    deleteShard(shardId: string): Promise<void>;
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
    constructor(backend?: StorageBackend, transport?: TransportConfig);
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