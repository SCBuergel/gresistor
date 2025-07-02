import { BackupProfile, BackupResult, RestoreRequest, ShamirConfig, StorageBackend, EncryptedDataStorage, TransportConfig, SafeConfig } from './types';
import { KeyShareRegistryService } from './storage';
export declare class BackupService {
    private encryption;
    private shamir;
    private storage;
    private encryptedDataStorage;
    private keyShareStorage;
    private keyShareStorages;
    private safeAuth?;
    constructor(shamirConfig: ShamirConfig, keyShareStorage?: StorageBackend, encryptedDataStorage?: EncryptedDataStorage, transportConfig?: TransportConfig, safeConfig?: SafeConfig);
    /**
     * Backs up a profile with encryption and key splitting
     */
    backup(profile: BackupProfile): Promise<BackupResult>;
    /**
     * Restores a profile from encrypted blob and key shards
     */
    restore(request: RestoreRequest): Promise<BackupProfile>;
    /**
     * Lists available backups
     */
    listBackups(): Promise<Array<{
        hash: string;
        metadata: any;
    }>>;
    /**
     * Validates backup integrity
     */
    validateBackup(backupResult: BackupResult): Promise<boolean>;
    /**
     * Generates a hash for data using Web Crypto API
     */
    private generateHash;
    /**
     * Generates a UUID v4 string (browser-compatible)
     */
    private generateUUIDv4;
    /**
     * Gets the key share registry service (for UI access)
     */
    getKeyShareRegistry(): KeyShareRegistryService | null;
}
//# sourceMappingURL=backup.d.ts.map