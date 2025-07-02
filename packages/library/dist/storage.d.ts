import { StorageBackend, TransportConfig } from './types';
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
//# sourceMappingURL=storage.d.ts.map