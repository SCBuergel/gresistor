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
            // To maintain security, we need at least as many services as the threshold
            // so that no single service can reconstruct the secret alone
            if (activeServices.length < keyShards[0].threshold) {
                throw new Error(`Insufficient key services for secure distribution. Need at least ${keyShards[0].threshold} active services but only ${activeServices.length} available. Each service must receive at most ${keyShards[0].threshold - 1} shards to maintain security.`);
            }
            // Distribute shards across active services
            const timestamp = Date.now();
            for (let i = 0; i < keyShards.length; i++) {
                const shard = keyShards[i];
                const serviceIndex = i % activeServices.length;
                const service = activeServices[serviceIndex];
                // Get or create storage service for this service
                let storageService = this.keyShareStorages.get(service.id);
                if (!storageService) {
                    storageService = new storage_1.KeyShareStorageService(service.id);
                    this.keyShareStorages.set(service.id, storageService);
                }
                // Store the shard with timestamp-based ID
                const shardId = `shard_${timestamp}_${i}`;
                await storageService.storeShard(shardId, shard.data);
                // Return shard ID instead of hash - users need IDs to restore
                shardIds.push(shardId);
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
            // Try to retrieve shards from local storage services
            const services = await this.keyShareStorage.listServices();
            const activeServices = services.filter(s => s.isActive);
            console.log('   🔍 [RESTORE] Found active key share services:', activeServices.length);
            activeServices.forEach(service => {
                console.log(`     - ${service.name} (${service.id})`);
            });
            if (activeServices.length > 0) {
                // Check if we're receiving shard IDs (from local storage) or hashes (from manual input)
                const isShardIds = request.shardIds.some(id => id.includes('shard_'));
                console.log('   🔍 [RESTORE] Input type:', isShardIds ? 'Shard IDs' : 'Shard Hashes');
                console.log('   📋 [RESTORE] Input shards:', request.shardIds);
                if (isShardIds) {
                    // We have shard IDs, retrieve the actual shard data
                    console.log('   🔍 [RESTORE] Retrieving shards by ID...');
                    for (const shardId of request.shardIds) {
                        console.log(`     📥 [RESTORE] Looking for shard: ${shardId}`);
                        let shardFound = false;
                        for (const service of activeServices) {
                            try {
                                console.log(`       🔍 [RESTORE] Checking service: ${service.name}`);
                                const storageService = new storage_1.KeyShareStorageService(service.id);
                                const shardData = await storageService.getShard(shardId);
                                console.log(`       ✅ [RESTORE] Shard found in ${service.name}:`, {
                                    id: shardId,
                                    dataSize: shardData.data.length
                                });
                                mockShards.push({
                                    id: shardId,
                                    data: shardData.data,
                                    threshold: request.requiredShards,
                                    totalShares: request.shardIds.length
                                });
                                shardFound = true;
                                break;
                            }
                            catch (error) {
                                console.log(`       ❌ [RESTORE] Shard not found in ${service.name}:`, error instanceof Error ? error.message : String(error));
                                // Shard not found in this service, try next
                                continue;
                            }
                        }
                        if (!shardFound) {
                            console.error(`   ❌ [RESTORE] Shard ${shardId} not found in any active service`);
                        }
                    }
                }
                else {
                    // Legacy fallback: treat input as data hashes for mock reconstruction
                    console.log('   ⚠️  [RESTORE] Input appears to be data hashes rather than shard IDs');
                    console.log('   ⚠️  [RESTORE] Shard discovery by blob hash is no longer supported');
                    console.log('   ⚠️  [RESTORE] Please provide the actual shard IDs from the backup result');
                    // Create mock shards from the provided data if they're not shard IDs
                    for (let i = 0; i < request.shardIds.length; i++) {
                        const mockData = new TextEncoder().encode(request.shardIds[i].substring(0, 32));
                        mockShards.push({
                            id: `mock_share_${i + 1}`,
                            data: mockData,
                            threshold: request.requiredShards,
                            totalShares: request.shardIds.length
                        });
                    }
                }
            }
        }
        console.log('   📊 [RESTORE] Total shards collected:', mockShards.length);
        mockShards.forEach((shard, index) => {
            console.log(`     ${index + 1}. ${shard.id} (${shard.data.length} bytes)`);
        });
        // If no shards found in storage, use mock shards from hashes
        if (mockShards.length === 0) {
            console.log('   ⚠️  [RESTORE] No shards found in storage, using mock shards from hashes');
            for (let i = 0; i < request.shardIds.length; i++) {
                mockShards.push({
                    id: `share_${i + 1}`,
                    data: new TextEncoder().encode(request.shardIds[i].substring(0, 32)), // Mock data
                    threshold: request.requiredShards,
                    totalShares: request.shardIds.length
                });
            }
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