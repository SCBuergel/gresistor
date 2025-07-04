import { KeyShardStorageBackend, TransportConfig, AuthorizationType, AuthData, ServiceAuthConfig } from './types';

// TypeScript declarations for IndexedDB
declare global {
  interface Window {
    indexedDB: IDBFactory;
  }
}

export type KeyShareService = {
  name: string;
  description?: string;
  authType: AuthorizationType;
  createdAt: Date;
  isActive: boolean;
};

export class KeyShareRegistryService {
  private dbName = 'KeyShareRegistryDB';
  private dbVersion = 3; // Increment version for authType field
  private storeName = 'services';

  private async getDB(): Promise<IDBDatabase> {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB is not available. This service requires a browser environment.');
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'name' }); // Use name as key instead of id
        }
      };
    });
  }

  /**
   * Lists all registered key share services
   */
  async listServices(): Promise<KeyShareService[]> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const services = request.result.map((service: any) => ({
          ...service,
          createdAt: new Date(service.createdAt)
        }));
        resolve(services);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Registers a new key share service
   */
  async registerService(service: Omit<KeyShareService, 'createdAt'>): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // First check if service name already exists
      const checkRequest = store.get(service.name);
      
      checkRequest.onsuccess = () => {
        if (checkRequest.result) {
          reject(new Error(`Service name "${service.name}" already exists. Please choose a different name.`));
          return;
        }
        
        // Name is unique, proceed with creation
        const serviceData = {
          ...service,
          createdAt: new Date().toISOString()
        };
        
        const request = store.put(serviceData);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      };
      
      checkRequest.onerror = () => reject(checkRequest.error);
    });
  }

  /**
   * Updates a key share service
   */
  async updateService(service: KeyShareService): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const serviceData = {
        ...service,
        createdAt: service.createdAt.toISOString()
      };
      
      const request = store.put(serviceData);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Deletes a key share service from registry
   */
  async deleteService(name: string): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(name);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Gets the authorization type for a specific service
   */
  async getServiceAuthType(serviceName: string): Promise<AuthorizationType> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(serviceName);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.authType || 'no-auth');
        } else {
          // Service not found, return default
          resolve('no-auth');
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Updates the authorization type for a specific service
   */
  async updateServiceAuthType(serviceName: string, authType: AuthorizationType): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Get the existing service first
      const getRequest = store.get(serviceName);
      
      getRequest.onsuccess = () => {
        if (getRequest.result) {
          // Update existing service
          const serviceData = {
            ...getRequest.result,
            authType: authType
          };
          
          const putRequest = store.put(serviceData);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error(`Service "${serviceName}" not found in registry`));
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }
}

export class KeyShareStorageService {
  private dbName: string;
  private dbVersion = 5; // Increment version for removing authType from shards
  private storeName = 'keyShards';
  private serviceName: string;
  private registry: KeyShareRegistryService;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private authConfig: ServiceAuthConfig;

  constructor(serviceName: string, authConfig: ServiceAuthConfig = { authType: 'no-auth', description: 'No authentication required' }) {
    this.dbName = `KeyShardService_${serviceName}`;
    this.serviceName = serviceName;
    this.authConfig = authConfig;
    this.registry = new KeyShareRegistryService();
    
    // Register this service with the provided auth config
    this.initializeService();
  }

  /**
   * Initialize the service in the registry
   */
  private async initializeService(): Promise<void> {
    try {
      await this.registry.registerService({
        name: this.serviceName,
        description: this.authConfig.description,
        authType: this.authConfig.authType,
        isActive: true
      });
    } catch (error) {
      // Service may already exist, ignore the error
      console.log(`Service "${this.serviceName}" already exists or couldn't be created:`, error);
    }
  }

  private async getDB(): Promise<IDBDatabase> {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB is not available. This service requires a browser environment.');
    }

    // Return existing promise if database is already being opened
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => {
        this.dbPromise = null; // Reset promise on error
        reject(request.error);
      };
      
      request.onsuccess = () => {
        const db = request.result;
        
        // Handle unexpected database closures
        db.onclose = () => {
          console.warn(`Database ${this.dbName} was closed unexpectedly`);
          this.dbPromise = null;
        };
        
        db.onerror = (event) => {
          console.error(`Database error for ${this.dbName}:`, event);
        };
        
        resolve(db);
      };
      
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction!;
        
        console.log(`Upgrading database ${this.dbName} from version ${event.oldVersion} to ${event.newVersion}`);
        
        // Create shards store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('authorizationAddress', 'authorizationAddress', { unique: false });
          console.log(`Created store: ${this.storeName}`);
        } else {
          // Update existing store indexes if needed
          const store = transaction.objectStore(this.storeName);
          
          // Remove authType index if it exists (migration from older versions)
          if (store.indexNames.contains('authType')) {
            store.deleteIndex('authType');
            console.log(`Removed authType index from ${this.storeName} (now stored in Registry)`);
          }
        }
        
        // Remove serviceConfig store if it exists (migration)
        if (db.objectStoreNames.contains('serviceConfig')) {
          db.deleteObjectStore('serviceConfig');
          console.log(`Removed obsolete serviceConfig store from ${this.dbName}`);
        }
        
        transaction.oncomplete = () => {
          console.log(`Database upgrade completed for ${this.dbName}`);
        };
        
        transaction.onerror = () => {
          console.error(`Database upgrade failed for ${this.dbName}:`, transaction.error);
          this.dbPromise = null;
          reject(transaction.error);
        };
      };
    });

    return this.dbPromise;
  }

  private getAuthTypeDescription(authType: AuthorizationType): string {
    switch (authType) {
      case 'no-auth':
        return 'No authorization required - open access';
      case 'mock-signature-2x':
        return 'Mock signature validation (address × 2)';
      default:
        return 'Unknown authorization type';
    }
  }

  /**
   * Gets the authorization configuration for this service from the registry
   */
  async getAuthConfig(): Promise<ServiceAuthConfig> {
    try {
      const authType = await this.registry.getServiceAuthType(this.serviceName);
      return {
        authType: authType,
        description: this.getAuthTypeDescription(authType)
      };
    } catch (error) {
      // Fallback to default if registry lookup fails
      const defaultAuthType: AuthorizationType = 'no-auth';
      return {
        authType: defaultAuthType,
        description: this.getAuthTypeDescription(defaultAuthType)
      };
    }
  }

  /**
   * Updates the authorization configuration for this service in the registry
   */
  async updateAuthConfig(authType: AuthorizationType): Promise<void> {
    return this.registry.updateServiceAuthType(this.serviceName, authType);
  }

  /**
   * Stores a key shard with authorization configuration
   */
  async storeShard(data: Uint8Array, authorizationAddress?: string): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        const item = {
          data: Array.from(data), // Convert Uint8Array to regular array for storage
          timestamp: new Date(),
          authorizationAddress: authorizationAddress || null
        };
        
        const request = store.add(item);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        
        transaction.onerror = () => reject(transaction.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Retrieves all key shards with authorization validation
   * Only returns shards that match the provided authorization address
   */
  async getAllShardsWithAuth(authData?: AuthData): Promise<Array<{ data: Uint8Array; timestamp: Date; authorizationAddress?: string }>> {
    const authConfig = await this.getAuthConfig();
    
    // Validate authorization based on service auth type
    if (!this.validateAuthData(authConfig.authType, authData)) {
      throw new Error(`Invalid authorization data for service auth type: ${authConfig.authType}`);
    }
    
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();
        
        request.onsuccess = () => {
          const allShards = request.result.map(item => ({
            data: new Uint8Array(item.data),
            timestamp: new Date(item.timestamp),
            authorizationAddress: item.authorizationAddress
          }));
          
          // SECURITY FIX: Filter shards to only return those matching the authorization address
          const authorizedShards = allShards.filter(shard => {
            // If no authData provided, only return shards with no authorization address
            if (!authData) {
              return !shard.authorizationAddress;
            }
            
            // If shard has no authorization address, it's accessible to anyone
            if (!shard.authorizationAddress) {
              return true;
            }
            
            // Check if the provided auth data matches the shard's authorization address
            const isValidAuth = this.validateShardAuth(shard.authorizationAddress, authData, authConfig.authType);
            if (isValidAuth) {
              console.log(`✅ Access granted to shard with address ${shard.authorizationAddress}`);
            } else {
              console.log(`🔒 Access denied to shard with address ${shard.authorizationAddress} (provided: ${authData.ownerAddress})`);
            }
            return isValidAuth;
          });
          
          console.log(`🔐 Filtered ${allShards.length} total shards to ${authorizedShards.length} authorized shards for address: ${authData?.ownerAddress || 'none'}`);
          resolve(authorizedShards);
        };
        
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Retrieves shard metadata only (for discovery purposes - no sensitive data exposed)
   * Use getAllShardsWithAuth() to access actual shard data after proper authorization
   */
  async getShardMetadata(): Promise<Array<{ timestamp: Date; authorizationAddress?: string; dataSize: number }>> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();
        
        request.onsuccess = () => {
          const results = request.result.map(item => ({
            timestamp: new Date(item.timestamp),
            authorizationAddress: item.authorizationAddress,
            dataSize: Array.isArray(item.data) ? item.data.length : 0 // Only expose size, not data
          }));
          resolve(results);
        };
        
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * @deprecated Use getShardMetadata() for discovery and getAllShardsWithAuth() for accessing data
   * This method is kept for backwards compatibility but should not be used
   */
  async getAllShards(): Promise<Array<{ data: Uint8Array; timestamp: Date; authorizationAddress?: string }>> {
    throw new Error('getAllShards() is deprecated for security reasons. Use getShardMetadata() for discovery or getAllShardsWithAuth() for authorized access.');
  }

  /**
   * Retrieves authorized key shards for a specific timestamp with full authorization validation
   */
  async getAuthorizedShard(targetTimestamp: number, authData?: AuthData): Promise<{ data: Uint8Array; timestamp: Date; authorizationAddress?: string } | null> {
    const authConfig = await this.getAuthConfig();
    
    // Validate authorization based on service auth type
    if (!this.validateAuthData(authConfig.authType, authData)) {
      throw new Error(`Invalid authorization data for service auth type: ${authConfig.authType}`);
    }
    
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();
        
        request.onsuccess = () => {
          const matchingShard = request.result.find(item => 
            new Date(item.timestamp).getTime() === targetTimestamp
          );
          
          if (!matchingShard) {
            resolve(null);
            return;
          }
          
          // Additional shard-level authorization validation
          if (matchingShard.authorizationAddress && authData) {
            const isValidAuth = this.validateShardAuth(matchingShard.authorizationAddress, authData, authConfig.authType);
            if (!isValidAuth) {
              console.warn(`🔒 Invalid authorization for shard with address ${matchingShard.authorizationAddress}`);
              reject(new Error(`Invalid authorization for shard with address ${matchingShard.authorizationAddress}`));
              return;
            }
            console.log(`✅ Valid authorization for address ${matchingShard.authorizationAddress}`);
          }
          
          const result = {
            data: new Uint8Array(matchingShard.data),
            timestamp: new Date(matchingShard.timestamp),
            authorizationAddress: matchingShard.authorizationAddress
          };
          resolve(result);
        };
        
        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Validates authorization data based on service auth type
   */
  private validateAuthData(authType: AuthorizationType, authData?: AuthData): boolean {
    console.log(`🔍 validateAuthData called for service "${this.serviceName}":`)
    console.log(`   authType: ${authType}`)
    console.log(`   authData:`, authData)
    
    switch (authType) {
      case 'no-auth':
        // For no-auth, we just need an owner address (or no auth data at all)
        const noAuthValid = !authData || !!authData.ownerAddress;
        console.log(`✅ No-auth validation for "${this.serviceName}": ${noAuthValid}`)
        return noAuthValid;
      
      case 'mock-signature-2x':
        // For mock signature, we need both address and signature
        if (!authData || !authData.ownerAddress || !authData.signature) {
          console.error(`❌ Mock signature auth requires both ownerAddress and signature for service "${this.serviceName}"`);
          console.error(`   authData provided: ${!!authData}`)
          console.error(`   ownerAddress: ${authData?.ownerAddress}`)
          console.error(`   signature: ${authData?.signature}`)
          return false;
        }
        
        try {
          const addressNum = parseInt(authData.ownerAddress);
          const signatureNum = parseInt(authData.signature);
          const expectedSignature = addressNum * 2;
          
          console.log(`🔧 Service auth validation for "${this.serviceName}": address=${addressNum}, signature=${signatureNum}, expected=${expectedSignature}`);
          const isValid = signatureNum === expectedSignature;
          console.log(`${isValid ? '✅' : '❌'} Mock signature validation result: ${isValid}`)
          return isValid;
        } catch (error) {
          console.error(`❌ Failed to validate mock signature for service "${this.serviceName}":`, error);
          return false;
        }
      
      default:
        console.error(`❌ Unknown auth type for service "${this.serviceName}": ${authType}`);
        return false;
    }
  }

  /**
   * Validates shard-specific authorization (for backwards compatibility)
   */
  private validateShardAuth(authorizationAddress: string, authData: AuthData, authType: AuthorizationType): boolean {
    // Check if the provided auth data matches the shard's authorization address
    if (authData.ownerAddress !== authorizationAddress) {
      console.warn(`Auth data owner address (${authData.ownerAddress}) doesn't match shard address (${authorizationAddress})`);
      return false;
    }
    
    // For signature-based auth, validate the signature
    if (authType === 'mock-signature-2x' && authData.signature) {
      return this.validateMockSignature(authorizationAddress, authData.signature);
    }
    
    return true;
  }

  /**
   * Mock signature validation: signature should be address * 2 (backwards compatibility)
   */
  private validateMockSignature(address: string, signature: string): boolean {
    try {
      const addressNum = parseInt(address);
      const signatureNum = parseInt(signature);
      const expectedSignature = addressNum * 2;
      
      console.log(`🔧 Mock signature validation: address=${addressNum}, signature=${signatureNum}, expected=${expectedSignature}`);
      return signatureNum === expectedSignature;
    } catch (error) {
      console.error('Failed to validate mock signature:', error);
      return false;
    }
  }

  /**
   * Deletes a key shard by internal key
   */
  async deleteShard(key: number): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clears all shards in this storage
   */
  async clear(): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Deletes the entire database
   */
  async deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(this.dbName);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export class StorageService {
  private backend: KeyShardStorageBackend;
  private transport: TransportConfig;

  constructor(
    backend: KeyShardStorageBackend = { type: 'swarm', endpoint: 'http://localhost:8080' },
    transport: TransportConfig = { method: 'plain-http' }
  ) {
    this.backend = backend;
    this.transport = transport;
  }

  /**
   * Uploads data to the configured storage backend
   */
  async upload(data: Uint8Array): Promise<string> {
    // Stub implementation
    throw new Error('upload() not implemented');
  }

  /**
   * Downloads data from the storage backend by hash
   */
  async download(hash: string): Promise<Uint8Array> {
    // Stub implementation
    throw new Error('download() not implemented');
  }

  /**
   * Checks if data exists at the given hash
   */
  async exists(hash: string): Promise<boolean> {
    // Stub implementation
    throw new Error('exists() not implemented');
  }

  /**
   * Gets metadata about stored data
   */
  async getMetadata(hash: string): Promise<{ size: number; timestamp: Date }> {
    // Stub implementation
    throw new Error('getMetadata() not implemented');
  }
}

/**
 * In-memory storage service for Node.js testing
 */
export class InMemoryStorageService {
  private storage = new Map<string, { data: Uint8Array; timestamp: Date; size: number }>();

  /**
   * Uploads data to in-memory storage and returns the hash
   */
  async upload(data: Uint8Array): Promise<string> {
    const hash = await this.generateHash(data);
    
    this.storage.set(hash, {
      data: new Uint8Array(data),
      timestamp: new Date(),
      size: data.length
    });
    
    return hash;
  }

  /**
   * Downloads data from in-memory storage by hash
   */
  async download(hash: string): Promise<Uint8Array> {
    const item = this.storage.get(hash);
    if (!item) {
      throw new Error(`Data not found for hash: ${hash}`);
    }
    return item.data;
  }

  /**
   * Checks if data exists at the given hash
   */
  async exists(hash: string): Promise<boolean> {
    return this.storage.has(hash);
  }

  /**
   * Gets metadata about stored data
   */
  async getMetadata(hash: string): Promise<{ size: number; timestamp: Date }> {
    const item = this.storage.get(hash);
    if (!item) {
      throw new Error(`Data not found for hash: ${hash}`);
    }
    return {
      size: item.size,
      timestamp: item.timestamp
    };
  }

  /**
   * Generates a hash for the data
   */
  private async generateHash(data: Uint8Array): Promise<string> {
    // Use Web Crypto API for hash generation
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Lists all stored data hashes
   */
  async listHashes(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  /**
   * Clears all stored data
   */
  async clear(): Promise<void> {
    this.storage.clear();
  }
}

export class BrowserStorageService {
  private dbName = 'ResilientBackupDB';
  private dbVersion = 1;
  private storeName = 'encryptedData';

  private async getDB(): Promise<IDBDatabase> {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB is not available. This service requires a browser environment.');
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'hash' });
        }
      };
    });
  }

  /**
   * Uploads data to browser storage and returns the hash
   */
  async upload(data: Uint8Array): Promise<string> {
    const hash = await this.generateHash(data);
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const item = {
        hash,
        data: Array.from(data), // Convert Uint8Array to regular array for storage
        timestamp: new Date().toISOString(),
        size: data.length
      };
      
      const request = store.put(item);
      
      request.onsuccess = () => resolve(hash);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Downloads data from browser storage by hash
   */
  async download(hash: string): Promise<Uint8Array> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(hash);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(new Uint8Array(request.result.data));
        } else {
          reject(new Error(`Data not found for hash: ${hash}`));
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Checks if data exists at the given hash
   */
  async exists(hash: string): Promise<boolean> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(hash);
      
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Gets metadata about stored data
   */
  async getMetadata(hash: string): Promise<{ size: number; timestamp: Date }> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(hash);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve({
            size: request.result.size,
            timestamp: new Date(request.result.timestamp)
          });
        } else {
          reject(new Error(`Data not found for hash: ${hash}`));
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generates a hash for the data (simplified implementation)
   */
  private async generateHash(data: Uint8Array): Promise<string> {
    // Use Web Crypto API to generate a SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Lists all stored data hashes
   */
  async listHashes(): Promise<string[]> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();
      
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clears all stored data
   */
  async clear(): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Simplified service for encrypted data storage
 */
export class EncryptedDataStorageService {
  private storage: InMemoryStorageService | BrowserStorageService | StorageService;

  constructor(config: { type: 'memory' | 'local-browser' | 'swarm' | 'ipfs'; endpoint?: string; apiKey?: string } = { type: 'memory' }) {
    if (config.type === 'memory') {
      this.storage = new InMemoryStorageService();
    } else if (config.type === 'local-browser') {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && window.indexedDB) {
        this.storage = new BrowserStorageService();
      } else {
        // Use in-memory storage for Node.js testing
        this.storage = new InMemoryStorageService();
      }
    } else {
      const backend: KeyShardStorageBackend = {
        type: config.type,
        endpoint: config.endpoint || 'http://localhost:8080',
        apiKey: config.apiKey
      };
      this.storage = new StorageService(backend);
    }
  }

  /**
   * Store encrypted data and return content hash
   */
  async store(data: Uint8Array): Promise<string> {
    return await this.storage.upload(data);
  }

  /**
   * Retrieve encrypted data by hash
   */
  async retrieve(hash: string): Promise<Uint8Array> {
    return await this.storage.download(hash);
  }

  /**
   * Check if data exists for given hash
   */
  async exists(hash: string): Promise<boolean> {
    return await this.storage.exists(hash);
  }

  /**
   * Get metadata about stored data
   */
  async getMetadata(hash: string): Promise<{ size: number; timestamp: Date }> {
    return await this.storage.getMetadata(hash);
  }

  /**
   * List all stored data hashes (if supported)
   */
  async listHashes(): Promise<string[]> {
    if (this.storage instanceof InMemoryStorageService || this.storage instanceof BrowserStorageService) {
      return await this.storage.listHashes();
    }
    throw new Error('listHashes() not supported for this storage type');
  }

  /**
   * Clear all stored data (if supported)
   */
  async clear(): Promise<void> {
    if (this.storage instanceof InMemoryStorageService || this.storage instanceof BrowserStorageService) {
      await this.storage.clear();
    } else {
      throw new Error('clear() not supported for this storage type');
    }
  }
}

/**
 * Simple Node.js-compatible key shard storage service
 * Alternative to KeyShareStorageService for environments without IndexedDB
 */
export class SimpleKeyShardStorage {
  private serviceName: string;
  private authConfig: ServiceAuthConfig;
  private shards: Map<string, { data: Uint8Array; timestamp: Date; authorizationAddress?: string }>;

  constructor(serviceName: string, authConfig: ServiceAuthConfig = { authType: 'no-auth', description: 'No authentication required' }) {
    this.serviceName = serviceName;
    this.authConfig = authConfig;
    this.shards = new Map(); // Store shards in memory
  }

  /**
   * Store a key shard with optional authorization address
   */
  async storeShard(data: Uint8Array, authorizationAddress?: string): Promise<string> {
    const timestamp = Date.now();
    const shardId = `shard_${timestamp}_${Math.random().toString(36).substring(2)}`;
    
    this.shards.set(shardId, {
      data: new Uint8Array(data),
      timestamp: new Date(timestamp),
      authorizationAddress: authorizationAddress || undefined
    });
    
    return shardId;
  }

  /**
   * Get all shards with authorization validation
   * Only returns shards that match the provided authorization address
   */
  async getAllShardsWithAuth(authData?: AuthData): Promise<Array<{ data: Uint8Array; timestamp: Date; authorizationAddress?: string }>> {
    // Validate authorization based on service auth type
    if (!this.validateAuthData(this.authConfig.authType, authData)) {
      throw new Error(`Invalid authorization data for service auth type: ${this.authConfig.authType}`);
    }

    const allShards = Array.from(this.shards.values());
    
    // SECURITY FIX: Filter shards to only return those matching the authorization address
    const authorizedShards = allShards.filter(shard => {
      // If no authData provided, only return shards with no authorization address
      if (!authData) {
        return !shard.authorizationAddress;
      }
      
      // If shard has no authorization address, it's accessible to anyone
      if (!shard.authorizationAddress) {
        return true;
      }
      
      // Check if the provided auth data matches the shard's authorization address
      if (authData.ownerAddress !== shard.authorizationAddress) {
        console.log(`🔒 Access denied to shard with address ${shard.authorizationAddress} (provided: ${authData.ownerAddress})`);
        return false;
      }
      
      // For signature-based auth, validate the signature matches
      if (this.authConfig.authType === 'mock-signature-2x' && authData.signature) {
        const addressNum = parseInt(shard.authorizationAddress);
        const signatureNum = parseInt(authData.signature);
        const expectedSignature = addressNum * 2;
        
        if (signatureNum !== expectedSignature) {
          console.log(`🔒 Signature validation failed for shard with address ${shard.authorizationAddress}`);
          return false;
        }
      }
      
      console.log(`✅ Access granted to shard with address ${shard.authorizationAddress}`);
      return true;
    });
    
    console.log(`🔐 Filtered ${allShards.length} total shards to ${authorizedShards.length} authorized shards for address: ${authData?.ownerAddress || 'none'}`);
    return authorizedShards;
  }

  /**
   * Get all shards (returns only metadata for security)
   */
  async getAllShards(): Promise<Array<{ data: Uint8Array; timestamp: Date; authorizationAddress?: string }>> {
    return Array.from(this.shards.values());
  }

  /**
   * Get latest shard with authorization validation
   */
  async getLatestShardWithAuth(authData?: AuthData): Promise<{ data: Uint8Array; timestamp: Date; authorizationAddress?: string } | null> {
    const shards = await this.getAllShardsWithAuth(authData);
    if (shards.length === 0) return null;
    
    return shards.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }

  /**
   * Get latest shard without auth (for convenience in examples)
   */
  async getLatestShard(): Promise<{ data: Uint8Array; timestamp: Date; authorizationAddress?: string } | null> {
    const shards = Array.from(this.shards.values());
    if (shards.length === 0) return null;
    
    return shards.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }

  /**
   * Get shard metadata only (for discovery purposes - no sensitive data exposed)
   */
  async getShardMetadata(): Promise<Array<{ timestamp: Date; authorizationAddress?: string; dataSize: number }>> {
    return Array.from(this.shards.values()).map(shard => ({
      timestamp: shard.timestamp,
      authorizationAddress: shard.authorizationAddress,
      dataSize: shard.data.length
    }));
  }

  /**
   * Get service name
   */
  getServiceName(): string {
    return this.serviceName;
  }

  /**
   * Get auth configuration
   */
  getAuthConfig(): ServiceAuthConfig {
    return { ...this.authConfig };
  }

  /**
   * Validate authorization data based on auth type
   */
  private validateAuthData(authType: AuthorizationType, authData?: AuthData): boolean {
    console.log(`🔐 Validating auth data for service "${this.serviceName}" (${authType}):`, authData);
    
    switch (authType) {
      case 'no-auth':
        console.log(`✅ No authentication required for service "${this.serviceName}"`);
        return true;
        
      case 'mock-signature-2x':
        if (!authData || !authData.ownerAddress || !authData.signature) {
          console.log(`❌ Mock signature auth requires ownerAddress and signature for service "${this.serviceName}"`);
          return false;
        }
        
        // Mock validation: signature should be ownerAddress × 2
        const expectedSignature = (parseInt(authData.ownerAddress) * 2).toString();
        const isValid = authData.signature === expectedSignature;
        
        if (isValid) {
          console.log(`✅ Mock signature validation passed for service "${this.serviceName}": ${authData.ownerAddress} × 2 = ${expectedSignature}`);
        } else {
          console.log(`❌ Mock signature validation failed for service "${this.serviceName}": expected ${expectedSignature}, got ${authData.signature}`);
        }
        
        return isValid;
        
      default:
        console.log(`❌ Unknown auth type "${authType}" for service "${this.serviceName}"`);
        return false;
    }
  }

  /**
   * Clear all shards
   */
  async clear(): Promise<void> {
    this.shards.clear();
  }
} 