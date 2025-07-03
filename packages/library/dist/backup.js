"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const encryption_1 = require("./encryption");
const shamir_1 = require("./shamir");
const storage_1 = require("./storage");
const safe_auth_1 = require("./safe-auth");
class BackupService {
    constructor(shamirConfig, keyShareStorage, encryptedDataStorage, transportConfig, safeConfig) {
        this.keyShareStorages = new Map();
        this.encryption = new encryption_1.EncryptionService();
        this.shamir = new shamir_1.ShamirSecretSharing(shamirConfig);
        this.storage = new storage_1.StorageService(keyShareStorage, transportConfig);
        // Create appropriate storage service for encrypted data
        if (encryptedDataStorage?.type === 'local-browser') {
            // Check if we're in a browser environment
            if (typeof window !== 'undefined' && window.indexedDB) {
                this.encryptedDataStorage = new storage_1.BrowserStorageService();
            }
            else {
                // Use in-memory storage for Node.js testing
                this.encryptedDataStorage = new storage_1.InMemoryStorageService();
            }
        }
        else if (encryptedDataStorage?.type === 'memory') {
            this.encryptedDataStorage = new storage_1.InMemoryStorageService();
        }
        else {
            const encryptedStorageBackend = encryptedDataStorage ? {
                type: encryptedDataStorage.type,
                endpoint: encryptedDataStorage.endpoint || '',
                apiKey: encryptedDataStorage.apiKey
            } : { type: 'swarm', endpoint: 'http://localhost:8080' };
            this.encryptedDataStorage = new storage_1.StorageService(encryptedStorageBackend, transportConfig);
        }
        // Create appropriate storage service for key shares
        if (keyShareStorage?.type === 'local-browser') {
            this.keyShareStorage = new storage_1.KeyShareRegistryService();
        }
        else if (keyShareStorage?.type === 'memory') {
            this.keyShareStorage = new storage_1.InMemoryStorageService();
        }
        else {
            this.keyShareStorage = new storage_1.StorageService(keyShareStorage, transportConfig);
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
        // Step 6: Store key shards
        console.log('   🔐 Storing key shards...');
        const shardIds = [];
        if (this.keyShareStorage instanceof storage_1.KeyShareRegistryService) {
            // Store shards in local browser storage services
            const services = await this.keyShareStorage.listServices();
            const activeServices = services.filter(s => s.isActive);
            if (activeServices.length === 0) {
                throw new Error('No active key share storage services found');
            }
            // Validate that we have enough services for proper distribution
            // To maintain security, we need exactly as many services as total shares (M)
            // so that each service gets exactly one shard
            if (activeServices.length < keyShards.length) {
                throw new Error(`Insufficient key services for secure distribution. Need exactly ${keyShards.length} active services (one per shard) but only ${activeServices.length} available.`);
            }
            // Distribute shards across active services (one shard per service)
            const timestamp = Date.now();
            for (let i = 0; i < keyShards.length; i++) {
                const shard = keyShards[i];
                const service = activeServices[i]; // Direct 1:1 mapping since we validated we have enough services
                // Get or create storage service for this service
                let storageService = this.keyShareStorages.get(service.name);
                if (!storageService) {
                    storageService = new storage_1.KeyShareStorageService(service.name);
                    this.keyShareStorages.set(service.name, storageService);
                }
                // Store the shard data directly (no ID needed)
                await storageService.storeShard(shard.data);
                // Track that we stored a shard in this service
                shardIds.push(`stored_in_${service.name}`);
            }
        }
        else {
            // Store shards in remote storage (stub implementation)
            for (const shard of keyShards) {
                const shardHash = await this.generateHash(shard.data);
                shardIds.push(shardHash);
            }
        }
        console.log('   ✅ Backup completed successfully!');
        console.log('   📦 Encrypted Blob Hash:', encryptedBlobHash);
        console.log('   🔑 Key Shards Generated:', shardIds.length);
        return {
            encryptedBlobHash,
            shardIds,
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
            shardIds: request.shardIds.length,
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
        // Step 3: Reconstruct key shards
        console.log('   🔐 Reconstructing key shards...');
        let mockShards = [];
        if (this.keyShareStorage instanceof storage_1.KeyShareRegistryService) {
            // Retrieve shards from specified local storage services
            console.log('   📦 [RESTORE] Loading shards from specified services...');
            console.log('   📋 [RESTORE] Requested services:', request.shardIds);
            for (const serviceName of request.shardIds) {
                try {
                    console.log(`       📂 [RESTORE] Loading from service: ${serviceName}`);
                    const storageService = new storage_1.KeyShareStorageService(serviceName);
                    const allShards = await storageService.getAllShards();
                    if (allShards.length > 0) {
                        // Get the most recent shard from this service
                        const latestShard = allShards.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
                        console.log(`       ✅ [RESTORE] Shard loaded from ${serviceName}:`, {
                            timestamp: latestShard.timestamp,
                            dataSize: latestShard.data.length
                        });
                        mockShards.push({
                            id: `shard_${serviceName}`,
                            data: latestShard.data,
                            threshold: request.requiredShards,
                            totalShares: request.shardIds.length
                        });
                    }
                    else {
                        console.log(`       ❌ [RESTORE] No shards found in ${serviceName}`);
                    }
                }
                catch (error) {
                    console.log(`       ❌ [RESTORE] Error accessing ${serviceName}:`, error instanceof Error ? error.message : String(error));
                    continue;
                }
            }
        }
        console.log('   📊 [RESTORE] Total shards collected:', mockShards.length);
        mockShards.forEach((shard, index) => {
            console.log(`     ${index + 1}. ${shard.id} (${shard.data.length} bytes)`);
        });
        // Validate we have enough shards
        if (mockShards.length < request.requiredShards) {
            throw new Error(`Insufficient shards collected: ${mockShards.length} found, ${request.requiredShards} required`);
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
            id: this.generateUUIDv4(), // Generate new ID for restored profile
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
     * Generates a hash for data using Web Crypto API
     */
    async generateHash(data) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    /**
     * Generates a UUID v4 string (browser-compatible)
     */
    generateUUIDv4() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Polyfill for browsers without crypto.randomUUID
        const bytes = new Uint8Array(16);
        (typeof crypto !== 'undefined' && crypto.getRandomValues)
            ? crypto.getRandomValues(bytes)
            : Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
        // Set version and variant bits
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        return Array.from(bytes).map((b, i) => [4, 6, 8, 10].includes(i) ? '-' + b.toString(16).padStart(2, '0') : b.toString(16).padStart(2, '0')).join('');
    }
    /**
     * Gets the key share registry service (for UI access)
     */
    getKeyShareRegistry() {
        return this.keyShareStorage instanceof storage_1.KeyShareRegistryService ? this.keyShareStorage : null;
    }
}
exports.BackupService = BackupService;
//# sourceMappingURL=backup.js.map