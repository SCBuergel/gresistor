import { BackupProfile, BackupResult, RestoreRequest, ShamirConfig, KeyShardStorageBackend, EncryptedDataStorage, TransportConfig, SafeConfig, KeyShard, KeyShareStorage } from './types';
import { EncryptionService } from './encryption';
import { ShamirSecretSharing } from './shamir';
import { KeyShareRegistryService, KeyShareStorageService } from './KeySharing';
import { BrowserStorageService, InMemoryStorageService } from './EncryptedDataStorage';
import { SafeAuthService } from './safe-auth';

export class BackupService {
  private encryption: EncryptionService;
  private shamir: ShamirSecretSharing;
  private encryptedDataStorage: BrowserStorageService | InMemoryStorageService;
  private keyShareStorage: KeyShareRegistryService | InMemoryStorageService;
  private keyShareStorages: Map<string, KeyShareStorageService> = new Map();
  private safeAuth?: SafeAuthService;

  constructor(
    shamirConfig: ShamirConfig,
    keyShardStorageBackend?: KeyShardStorageBackend,
    encryptedDataStorage?: EncryptedDataStorage,
    transportConfig?: TransportConfig,
    safeConfig?: SafeConfig
  ) {
    this.keyShareStorages = new Map();
    this.encryption = new EncryptionService();
    this.shamir = new ShamirSecretSharing(shamirConfig);
    
    // Create appropriate storage service for encrypted data
    if (encryptedDataStorage?.type === 'local-browser') {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && window.indexedDB) {
        this.encryptedDataStorage = new BrowserStorageService();
      } else {
        // Use in-memory storage for Node.js testing
        this.encryptedDataStorage = new InMemoryStorageService();
      }
    } else if (encryptedDataStorage?.type === 'memory') {
      this.encryptedDataStorage = new InMemoryStorageService();
    } else {
      // For other storage types, default to in-memory storage
      // (distributed storage backends like Swarm/IPFS are not implemented)
      this.encryptedDataStorage = new InMemoryStorageService();
    }
    
    // Create appropriate storage service for key shards
    if (keyShardStorageBackend?.type === 'local-browser') {
      this.keyShareStorage = new KeyShareRegistryService();
    } else if (keyShardStorageBackend?.type === 'memory') {
      this.keyShareStorage = new InMemoryStorageService();
    } else {
      // For other storage types, default to in-memory storage
      // (distributed storage backends like Swarm/IPFS are not implemented)
      this.keyShareStorage = new InMemoryStorageService();
    }
    
    if (safeConfig) {
      this.safeAuth = new SafeAuthService(safeConfig);
    }
  }

  /**
   * Backs up a profile with encryption and key splitting
   */
  async backup(profile: BackupProfile, authorizationAddress?: string, user?: string): Promise<BackupResult> {
    console.log(`🔧 Starting backup for profile: ${profile.metadata.name}`);
    if (authorizationAddress) {
      console.log(`🔐 Using authorization address: ${authorizationAddress}`);
    }
    if (user) {
      console.log(`👤 Using user address: ${user}`);
    }
    
    try {
      // Generate encryption key and encrypt data
      const encryptionKey = await this.encryption.generateKey();
      const encryptionKeyHex = Array.from(encryptionKey).map(b => b.toString(16).padStart(2, '0')).join('');
      console.log(`🔑 Generated encryption key (hex): ${encryptionKeyHex}`);
      
      // Package the full profile (data + metadata) for encryption
      const profileJson = JSON.stringify({
        id: profile.id,
        data: Array.from(profile.data), // Convert Uint8Array to regular array for JSON
        metadata: profile.metadata
      });
      const profileBytes = new TextEncoder().encode(profileJson);
      
      const { ciphertext, nonce, tag } = await this.encryption.encrypt(profileBytes, encryptionKey);
      
      // Split the encryption key using Shamir Secret Sharing
      console.log(`🔧 Splitting encryption key into ${this.shamir['config'].totalShares} shares (threshold: ${this.shamir['config'].threshold})`);
      const keyShards = await this.shamir.splitSecret(encryptionKey);
      
      console.log(`🔧 Generated ${keyShards.length} key shards:`);
      keyShards.forEach((shard, index) => {
        const shardHex = Array.from(shard.data).map(b => b.toString(16).padStart(2, '0')).join('');
        console.log(`🔑 Shard ${index + 1} (${shard.id}): ${shardHex}`);
      });
      
      // Create encrypted blob (ciphertext + nonce + tag)
      const encryptedBlob = new Uint8Array(ciphertext.length + nonce.length + tag.length + 4);
      const view = new DataView(encryptedBlob.buffer);
      
      // Store lengths as metadata
      view.setUint16(0, ciphertext.length, false);
      view.setUint16(2, nonce.length, false);
      
      // Store the data
      encryptedBlob.set(ciphertext, 4);
      encryptedBlob.set(nonce, 4 + ciphertext.length);
      encryptedBlob.set(tag, 4 + ciphertext.length + nonce.length);
      
      // Upload encrypted blob to storage
      const encryptedBlobHash = await this.encryptedDataStorage.upload(encryptedBlob, user);
      console.log(`📦 Uploaded encrypted blob with hash: ${encryptedBlobHash}`);
      
      // Store key shards and collect service names
      const shardIds: string[] = [];
      const serviceNames: string[] = [];
      
      if (this.keyShareStorage instanceof KeyShareRegistryService) {
        // Store shards in local browser storage services
        const services = await this.keyShareStorage.listServices();
        const activeServices = services.filter(s => s.isActive);
        
        console.log(`🔧 Found ${activeServices.length} active key share services:`, activeServices.map(s => s.name));
        
        if (activeServices.length === 0) {
          throw new Error('No active key share storage services found');
        }
        
        // Validate that we have enough services for proper distribution
        if (activeServices.length < keyShards.length) {
          throw new Error(`Insufficient key services for secure distribution. Need exactly ${keyShards.length} active services (one per shard) but only ${activeServices.length} available.`);
        }
        
        // Distribute shards across active services (one shard per service)
        for (let i = 0; i < keyShards.length; i++) {
          const shard = keyShards[i];
          const service = activeServices[i];
          
          console.log(`🔧 Storing shard ${i + 1} in service "${service.name}" with authorization address: ${authorizationAddress || 'none'}`);
          
          // Get or create storage service for this service
          let storageService = this.keyShareStorages.get(service.name);
          if (!storageService) {
            storageService = new KeyShareStorageService(service.name);
            this.keyShareStorages.set(service.name, storageService);
          }
          
          // Store the shard data directly with authorization address
          const timestamp = new Date();
          await storageService.storeShard(shard.data, authorizationAddress);
          
          const shardHex = Array.from(shard.data).map(b => b.toString(16).padStart(2, '0')).join('');
          console.log(`✅ Stored shard ${i + 1} in "${service.name}" at ${timestamp.toISOString()}`);
          console.log(`🔑 Stored shard data (hex): ${shardHex}`);
          console.log(`🔐 Authorization address: ${authorizationAddress || 'none'}`);
          
          // Track that we stored a shard in this service
          shardIds.push(`stored_in_${service.name}`);
          serviceNames.push(service.name);
        }
      } else {
        // Store shards in remote storage
        for (const shard of keyShards) {
          const shardHash = await this.generateHash(shard.data);
          shardIds.push(shardHash);
        }
      }
      
      console.log(`✅ Backup completed: ${encryptedBlobHash}, ${keyShards.length} shards stored`);
      
      // Convert arrays to hex strings for display
      const encryptedDataHex = Array.from(encryptedBlob).map(b => b.toString(16).padStart(2, '0')).join('');
      const shardsHex = keyShards.map(shard => Array.from(shard.data).map(b => b.toString(16).padStart(2, '0')).join(''));
      
      return {
        encryptedBlobHash,
        encryptedBlob, // Include the actual encrypted blob data
        shardIds,
        keyShards, // Include the actual key shard data for minimal usage
        metadata: {
          timestamp: new Date(),
          config: this.shamir['config']
        },
        // Add crypto details for display
        cryptoDetails: {
          encryptedDataHex,
          encryptionKeyHex,
          shardsHex,
          serviceNames
        }
      };
    } catch (error) {
      console.error(`❌ Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Restores a profile from encrypted blob and key shards
   */
  async restore(request: RestoreRequest): Promise<BackupProfile> {
    console.log(`🔧 Starting restore...`);
    console.log(`🔧 Requested shard IDs:`, request.shardIds);
    console.log(`🔧 Required shards: ${request.requiredShards}`);
    console.log(`🔧 Authorization signatures:`, request.authorizationSignatures);
    
    try {
      // Get encrypted blob - either directly provided or download from storage
      let encryptedBlob: Uint8Array;
      if (request.encryptedBlob) {
        console.log(`🔧 Using directly provided encrypted blob (${request.encryptedBlob.length} bytes)`);
        encryptedBlob = request.encryptedBlob;
      } else if (request.encryptedBlobHash) {
        console.log(`🔧 Downloading encrypted blob with hash: ${request.encryptedBlobHash.substring(0, 16)}...`);
        encryptedBlob = await this.encryptedDataStorage.download(request.encryptedBlobHash);
      } else {
        throw new Error('Either encryptedBlob or encryptedBlobHash must be provided');
      }
      
      // Parse encrypted blob structure
      const view = new DataView(encryptedBlob.buffer);
      const ciphertextLength = view.getUint16(0, false);
      const nonceLength = view.getUint16(2, false);
      
      const ciphertext = encryptedBlob.slice(4, 4 + ciphertextLength);
      const nonce = encryptedBlob.slice(4 + ciphertextLength, 4 + ciphertextLength + nonceLength);
      const tag = encryptedBlob.slice(4 + ciphertextLength + nonceLength);
      
      // Retrieve and reconstruct key shards
      let keyShards: KeyShard[] = [];
      
      // Use directly provided key shards if available (for minimal usage)
      if (request.keyShards) {
        console.log(`🔧 Using directly provided key shards (${request.keyShards.length} shards)`);
        keyShards = request.keyShards;
      } else if (this.keyShareStorage instanceof KeyShareRegistryService) {
        console.log(`🔧 Using local browser storage for key shares`);
        
        // Get shards from local storage services with specific timestamps and authorization
        for (const shardId of request.shardIds) {
          if (shardId.includes('@')) {
            // Format: "serviceName@timestamp"
            const [serviceName, timestampStr] = shardId.split('@');
            const targetTimestamp = parseInt(timestampStr);
            
            console.log(`🔧 Looking for shard in service "${serviceName}" with timestamp ${targetTimestamp} (${new Date(targetTimestamp).toISOString()})`);
            
            let storageService = this.keyShareStorages.get(serviceName);
            if (!storageService) {
              storageService = new KeyShareStorageService(serviceName);
              this.keyShareStorages.set(serviceName, storageService);
            }
            
            // Get authorization data for this service
            const authSignature = request.authorizationSignatures?.[serviceName];
            let authData = request.authData;
            
            // Backwards compatibility: if no authData but we have a signature, create authData
            if (!authData && authSignature) {
              authData = {
                ownerAddress: authSignature, // For backwards compatibility, use signature as address
                signature: authSignature
              };
            }
            console.log(`🔐 Using authorization data for "${serviceName}":`, authData);
            
            try {
              const matchingShard = await storageService.getAuthorizedShard(targetTimestamp, authData);
              
              if (matchingShard) {
                const shardHex = Array.from(matchingShard.data).map(b => b.toString(16).padStart(2, '0')).join('');
                console.log(`✅ Found matching shard in "${serviceName}" at ${matchingShard.timestamp.toISOString()}`);
                console.log(`🔑 Shard data (hex): ${shardHex}`);
                console.log(`🔐 Authorization address: ${matchingShard.authorizationAddress || 'none'}`);
                
                keyShards.push({
                  id: `${serviceName}_${targetTimestamp}`,
                  data: matchingShard.data,
                  threshold: this.shamir['config'].threshold,
                  totalShares: this.shamir['config'].totalShares,
                  authorizationAddress: matchingShard.authorizationAddress,
                  timestamp: matchingShard.timestamp || new Date()
                });
              } else {
                console.warn(`❌ No shard found in "${serviceName}" with timestamp ${targetTimestamp}`);
              }
            } catch (error) {
              console.error(`❌ Failed to retrieve authorized shard from "${serviceName}":`, error);
              throw error;
            }
          } else {
            // Legacy format: just service name (use latest)
            const serviceName = shardId;
            console.log(`🔧 Using legacy format for service "${serviceName}" - getting latest shard`);
            
            let storageService = this.keyShareStorages.get(serviceName);
            if (!storageService) {
              storageService = new KeyShareStorageService(serviceName);
              this.keyShareStorages.set(serviceName, storageService);
            }
            
            // For legacy format, we need authentication to access shard data
            if (!request.authData) {
              throw new Error(`Legacy shard ID format "${serviceName}" requires authData for security`);
            }
            
            const shardsMetadata = await storageService.getShardMetadata();
            if (shardsMetadata.length > 0) {
              // Get the most recent shard timestamp
              const latestMetadata = shardsMetadata.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
              
              // Now get the actual shard data with proper authorization
              const latestShard = await storageService.getAuthorizedShard(latestMetadata.timestamp.getTime(), request.authData);
              
              if (latestShard) {
                const shardHex = Array.from(latestShard.data).map(b => b.toString(16).padStart(2, '0')).join('');
                console.log(`✅ Using latest shard from "${serviceName}" at ${latestShard.timestamp.toISOString()}`);
                console.log(`🔑 Shard data (hex): ${shardHex}`);
                
                keyShards.push({
                  id: `${serviceName}_latest`,
                  data: latestShard.data,
                  threshold: this.shamir['config'].threshold,
                  totalShares: this.shamir['config'].totalShares,
                  authorizationAddress: latestShard.authorizationAddress,
                  timestamp: latestShard.timestamp || new Date()
                });
              } else {
                console.warn(`❌ Authorization failed for latest shard in "${serviceName}"`);
              }
            }
          }
        }
      } else {
        // Get shards from remote storage (stub implementation)
        for (let i = 0; i < request.shardIds.length; i++) {
          const shardHash = request.shardIds[i];
          const shardData = await this.keyShareStorage.download(shardHash);
          keyShards.push({
            id: `remote_shard_${i}`,
            data: shardData,
            threshold: request.requiredShards,
            totalShares: request.shardIds.length,
            timestamp: new Date()
          });
        }
      }
      
      console.log(`🔧 Successfully retrieved ${keyShards.length} key shards`);
      console.log(`🔧 Shard summary:`, keyShards.map(shard => ({
        id: shard.id,
        dataLength: shard.data.length,
        dataHex: Array.from(shard.data).map(b => b.toString(16).padStart(2, '0')).join(''),
        authorizationAddress: shard.authorizationAddress
      })));
      
      if (keyShards.length < request.requiredShards) {
        throw new Error(`Insufficient key shards for restoration. Need ${request.requiredShards}, got ${keyShards.length}`);
      }
      
      // Reconstruct encryption key
      console.log(`🔧 Reconstructing encryption key from ${keyShards.length} shards (using first ${request.requiredShards})`);
      const encryptionKey = await this.shamir.reconstructSecret(keyShards.slice(0, request.requiredShards));
      
      const encryptionKeyHex = Array.from(encryptionKey).map(b => b.toString(16).padStart(2, '0')).join('');
      console.log(`🔑 Reconstructed encryption key (hex): ${encryptionKeyHex}`);
      
      // Decrypt profile data
      console.log(`🔧 Decrypting profile data...`);
      const decryptedBytes = await this.encryption.decrypt(ciphertext, encryptionKey, nonce, tag);
      
      // Parse the decrypted JSON to reconstruct the original profile
      const profileJson = new TextDecoder().decode(decryptedBytes);
      const restoredProfile = JSON.parse(profileJson);
      
      console.log(`✅ Restore completed successfully for profile: ${restoredProfile.metadata.name}`);
      
      // Return the original profile with its original metadata
      return {
        id: restoredProfile.id,
        data: new Uint8Array(restoredProfile.data), // Convert back from array to Uint8Array
        metadata: {
          name: restoredProfile.metadata.name,
          createdAt: new Date(restoredProfile.metadata.createdAt),
          version: restoredProfile.metadata.version
        }
      };
    } catch (error) {
      console.error(`❌ Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Lists available backups, optionally filtered by user
   */
  async listBackups(user?: string): Promise<Array<{ hash: string; metadata: any }>> {
    if (this.encryptedDataStorage instanceof BrowserStorageService || 
        this.encryptedDataStorage instanceof InMemoryStorageService) {
      const hashes = await this.encryptedDataStorage.listHashes(user);
      return hashes.map(hash => ({ hash, metadata: {} }));
    }
    throw new Error('listBackups() not supported for this storage type');
  }

  /**
   * Generates a hash for data using Web Crypto API
   */
  private async generateHash(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generates a UUID v4 string (browser-compatible)
   */
  private generateUUIDv4(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback implementation
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    
    return Array.from(bytes).map((b, i) => 
      [4, 6, 8, 10].includes(i) ? '-' + b.toString(16).padStart(2, '0') : b.toString(16).padStart(2, '0')
    ).join('');
  }

  /**
   * Gets the key share registry service (for UI access)
   */
  getKeyShareRegistry(): KeyShareRegistryService | null {
    return this.keyShareStorage instanceof KeyShareRegistryService ? this.keyShareStorage : null;
  }
} 