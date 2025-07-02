"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const encryption_1 = require("./encryption");
const shamir_1 = require("./shamir");
const storage_1 = require("./storage");
const safe_auth_1 = require("./safe-auth");
class BackupService {
    constructor(shamirConfig, storageBackend, transportConfig, safeConfig) {
        this.encryption = new encryption_1.EncryptionService();
        this.shamir = new shamir_1.ShamirSecretSharing(shamirConfig);
        this.storage = new storage_1.StorageService(storageBackend, transportConfig);
        if (safeConfig) {
            this.safeAuth = new safe_auth_1.SafeAuthService(safeConfig);
        }
    }
    /**
     * Backs up a profile with encryption and key splitting
     */
    async backup(profile) {
        // Stub implementation
        throw new Error('backup() not implemented');
    }
    /**
     * Restores a profile from encrypted blob and key shards
     */
    async restore(request) {
        // Stub implementation
        throw new Error('restore() not implemented');
    }
    /**
     * Lists available backups
     */
    async listBackups() {
        // Stub implementation
        throw new Error('listBackups() not implemented');
    }
    /**
     * Validates backup integrity
     */
    async validateBackup(backupResult) {
        // Stub implementation
        throw new Error('validateBackup() not implemented');
    }
}
exports.BackupService = BackupService;
//# sourceMappingURL=backup.js.map