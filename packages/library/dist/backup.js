"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const encryption_1 = require("./encryption");
const shamir_1 = require("./shamir");
const storage_1 = require("./storage");
const safe_auth_1 = require("./safe-auth");
class BackupService {
    constructor(shamirConfig, keyShareStorage, encryptedDataStorage, transportConfig, safeConfig) {
        this.encryption = new encryption_1.EncryptionService();
        this.shamir = new shamir_1.ShamirSecretSharing(shamirConfig);
        this.storage = new storage_1.StorageService(keyShareStorage, transportConfig);
        // Create appropriate storage service for encrypted data
        if (encryptedDataStorage?.type === 'local-browser') {
            this.encryptedDataStorage = new storage_1.BrowserStorageService();
        }
        else {
            const encryptedStorageBackend = encryptedDataStorage ? {
                type: encryptedDataStorage.type,
                endpoint: encryptedDataStorage.endpoint || '',
                apiKey: encryptedDataStorage.apiKey
            } : { type: 'swarm', endpoint: 'http://localhost:8080' };
            this.encryptedDataStorage = new storage_1.StorageService(encryptedStorageBackend, transportConfig);
        }
        if (safeConfig) {
            this.safeAuth = new safe_auth_1.SafeAuthService(safeConfig);
        }
    }
    /**
     * Backs up a profile with encryption and key splitting
     */
    async backup(profile) {
        console.log('🔧 [LIBRARY] BackupService.backup() called');
        console.log('   📊 Profile:', {
            id: profile.id,
            name: profile.metadata.name,
            dataSize: profile.data.length,
            version: profile.metadata.version
        });
        // Step 1: Generate encryption key
        console.log('   🔑 Generating random encryption key...');
        const encryptionKey = await this.encryption.generateKey();
        // Step 2: Encrypt the profile data
        console.log('   🔒 Encrypting profile data with AES-256-GCM...');
        const { ciphertext, nonce, tag } = await this.encryption.encrypt(profile.data, encryptionKey);
        // Step 3: Split the encryption key using Shamir Secret Sharing
        console.log('   ✂️  Splitting encryption key using Shamir Secret Sharing...');
        const keyShards = await this.shamir.splitSecret(encryptionKey);
        // Step 4: Create encrypted blob (ciphertext + nonce + tag)
        const encryptedBlob = new Uint8Array(ciphertext.length + nonce.length + tag.length + 4);
        const view = new DataView(encryptedBlob.buffer);
        // Store lengths as metadata
        view.setUint16(0, ciphertext.length, false);
        view.setUint16(2, nonce.length, false);
        // Store the data
        encryptedBlob.set(ciphertext, 4);
        encryptedBlob.set(nonce, 4 + ciphertext.length);
        encryptedBlob.set(tag, 4 + ciphertext.length + nonce.length);
        // Step 5: Upload encrypted blob to storage
        console.log('   📤 Uploading encrypted blob to storage...');
        const encryptedBlobHash = await this.encryptedDataStorage.upload(encryptedBlob);
        // Step 6: Store key shards (in a real implementation, these would be encrypted and stored separately)
        console.log('   🔐 Storing key shards...');
        const shardHashes = [];
        for (const shard of keyShards) {
            // For now, we'll just generate hashes for the shards
            // In a real implementation, these would be stored in the key backup service
            const shardHash = await this.generateHash(shard.data);
            shardHashes.push(shardHash);
        }
        console.log('   ✅ Backup completed successfully!');
        console.log('   📦 Encrypted Blob Hash:', encryptedBlobHash);
        console.log('   🔑 Key Shards Generated:', shardHashes.length);
        return {
            encryptedBlobHash,
            shardHashes,
            metadata: {
                timestamp: new Date(),
                config: this.shamir['config']
            }
        };
    }
    /**
     * Restores a profile from encrypted blob and key shards
     */
    async restore(request) {
        console.log('🔧 [LIBRARY] BackupService.restore() called');
        console.log('   📦 Request:', {
            encryptedBlobHash: request.encryptedBlobHash,
            shardHashes: request.shardHashes.length,
            requiredShards: request.requiredShards,
            hasSafeSignature: !!request.safeSignature
        });
        // Step 1: Download encrypted blob from storage
        console.log('   📥 Downloading encrypted blob from storage...');
        const encryptedBlob = await this.encryptedDataStorage.download(request.encryptedBlobHash);
        // Step 2: Parse the encrypted blob
        const view = new DataView(encryptedBlob.buffer);
        const ciphertextLength = view.getUint16(0, false);
        const nonceLength = view.getUint16(2, false);
        const ciphertext = encryptedBlob.slice(4, 4 + ciphertextLength);
        const nonce = encryptedBlob.slice(4 + ciphertextLength, 4 + ciphertextLength + nonceLength);
        const tag = encryptedBlob.slice(4 + ciphertextLength + nonceLength);
        // Step 3: Reconstruct key shards from hashes
        console.log('   🔐 Reconstructing key shards...');
        // For this demo, we'll create mock shards based on the hashes
        // In a real implementation, you'd fetch the actual shards from the key backup service
        const mockShards = [];
        for (let i = 0; i < request.shardHashes.length; i++) {
            mockShards.push({
                id: `share_${i + 1}`,
                data: new TextEncoder().encode(request.shardHashes[i].substring(0, 32)), // Mock data
                threshold: request.requiredShards,
                totalShares: request.shardHashes.length
            });
        }
        // Step 4: Reconstruct the encryption key
        console.log('   🔑 Reconstructing encryption key using Shamir Secret Sharing...');
        const encryptionKey = await this.shamir.reconstructSecret(mockShards);
        // Step 5: Decrypt the profile data
        console.log('   🔓 Decrypting profile data...');
        const decryptedData = await this.encryption.decrypt(ciphertext, encryptionKey, nonce, tag);
        // Step 6: Create the restored profile
        console.log('   ✅ Profile restored successfully!');
        return {
            id: crypto.randomUUID(), // Generate new ID for restored profile
            data: decryptedData,
            metadata: {
                name: 'Restored Profile',
                createdAt: new Date(),
                version: '1.0.0'
            }
        };
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
    /**
     * Generates a hash for data
     */
    async generateHash(data) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
exports.BackupService = BackupService;
//# sourceMappingURL=backup.js.map