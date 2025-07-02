import { BackupProfile, BackupResult, RestoreRequest, ShamirConfig, StorageBackend, EncryptedDataStorage, TransportConfig, SafeConfig } from './types';
export declare class BackupService {
    private encryption;
    private shamir;
    private storage;
    private encryptedDataStorage;
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
}
//# sourceMappingURL=backup.d.ts.map