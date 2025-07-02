import { StorageBackend, TransportConfig } from './types';
declare global {
    interface Window {
        indexedDB: IDBFactory;
    }
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