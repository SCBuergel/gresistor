import { KeyShardStorageBackend, TransportConfig, AuthorizationType, AuthData, ServiceAuthConfig } from './types';
import { SafeAuthService } from './safe-auth';

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
    // Check if service already exists before attempting to create
    const existingServices = await this.registry.listServices();
    const serviceExists = existingServices.some(service => service.name === this.serviceName);
    
    if (!serviceExists) {
      await this.registry.registerService({
        name: this.serviceName,
        description: this.authConfig.description,
        authType: this.authConfig.authType,
        isActive: true
      });
    }
  } catch (error) {
    // Silently ignore service creation errors (likely already exists)
    // Only log if it's not a "already exists" error
    if (error instanceof Error && !error.message.includes('already exists')) {
      console.error(`Failed to initialize service "${this.serviceName}":`, error);
    }
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
      case 'safe-signature':
        return 'Safe signature validation using EIP-712';
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
   * Retrieves shard metadata only (for discovery purposes - no sensitive data exposed)
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
   * Retrieves authorized key shards for a specific timestamp with full authorization validation
   */
  async getAuthorizedShard(targetTimestamp: number, authData?: AuthData): Promise<{ data: Uint8Array; timestamp: Date; authorizationAddress?: string } | null> {
    const authConfig = await this.getAuthConfig();
    
    // Validate authorization based on service auth type
    if (!(await BaseKeyShareStorage.validateAuthDataStatic(this.serviceName, authConfig.authType, authData))) {
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
   * Validates shard-specific authorization (for backwards compatibility)
   */
  private validateShardAuth(authorizationAddress: string, authData: AuthData, authType: AuthorizationType): boolean {
    // For Safe authentication, use safeAddress for shard access control
    if (authType === 'safe-signature') {
      if (authData.safeAddress !== authorizationAddress) {
        console.warn(`Auth data Safe address (${authData.safeAddress}) doesn't match shard address (${authorizationAddress})`);
        return false;
      }
      return true;
    }
    
    // For other auth types, check if the provided auth data matches the shard's authorization address
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









/**
 * Abstract base class for key shard storage services
 */
export abstract class BaseKeyShareStorage {
  protected serviceName: string;
  protected authConfig: ServiceAuthConfig;

  constructor(serviceName: string, authConfig: ServiceAuthConfig = { authType: 'no-auth', description: 'No authentication required' }) {
    this.serviceName = serviceName;
    this.authConfig = authConfig;
  }

  /**
   * Store a key shard with optional authorization address
   */
  abstract storeShard(data: Uint8Array, authorizationAddress?: string): Promise<string | void>;

  /**
   * Get shard metadata only (for discovery purposes)
   */
  abstract getShardMetadata(): Promise<Array<{ timestamp: Date; authorizationAddress?: string; dataSize: number }>>;

  /**
   * Clear all shards
   */
  abstract clear(): Promise<void>;



  /**
   * Validate authorization data based on auth type
   */
  protected async validateAuthData(authType: AuthorizationType, authData?: AuthData): Promise<boolean> {
    return BaseKeyShareStorage.validateAuthDataStatic(this.serviceName, authType, authData);
  }

  /**
   * Static utility method for validating authorization data
   * Can be used by any class that needs to validate auth data
   */
  static async validateAuthDataStatic(serviceName: string, authType: AuthorizationType, authData?: AuthData): Promise<boolean> {
    console.log(`🔍 validateAuthData called for service "${serviceName}":`)
    console.log(`   authType: ${authType}`)
    console.log(`   authData:`, authData)
    
    switch (authType) {
      case 'no-auth':
        // For no-auth, we just need an owner address (or no auth data at all)
        const noAuthValid = !authData || !!authData.ownerAddress;
        console.log(`✅ No-auth validation for "${serviceName}": ${noAuthValid}`)
        return noAuthValid;
      
      case 'mock-signature-2x':
        // For mock signature, we need both address and signature
        if (!authData || !authData.ownerAddress || !authData.signature) {
          console.error(`❌ Mock signature auth requires both ownerAddress and signature for service "${serviceName}"`);
          console.error(`   authData provided: ${!!authData}`)
          console.error(`   ownerAddress: ${authData?.ownerAddress}`)
          console.error(`   signature: ${authData?.signature}`)
          return false;
        }
        
        try {
          const addressNum = parseInt(authData.ownerAddress);
          const signatureNum = parseInt(authData.signature);
          const expectedSignature = addressNum * 2;
          
          console.log(`🔧 Service auth validation for "${serviceName}": address=${addressNum}, signature=${signatureNum}, expected=${expectedSignature}`);
          const isValid = signatureNum === expectedSignature;
          console.log(`${isValid ? '✅' : '❌'} Mock signature validation result: ${isValid}`)
          return isValid;
        } catch (error) {
          console.error(`❌ Failed to validate mock signature for service "${serviceName}":`, error);
          return false;
        }
      
      case 'safe-signature':
        if (!authData || !authData.safeAddress || !authData.chainId) {
          console.error('Safe signature validation failed: missing Safe address or chain ID');
          return false;
        }

        try {
          // Create SafeAuthService to validate the signature
          const safeAuthService = new SafeAuthService({
            safeAddress: authData.safeAddress,
            chainId: authData.chainId
            // owners will be fetched dynamically
          });

          const isValid = await safeAuthService.verifySignature(authData);
          
          if (isValid) {
            console.log(`✅ Safe signature validation passed for "${serviceName}": owner=${authData.ownerAddress}, safe=${authData.safeAddress}, chain=${authData.chainId}`)
            return true
          } else {
            console.error(`❌ Safe signature validation failed for "${serviceName}"`)
            return false
          }
        } catch (error) {
          console.error(`❌ Failed to validate Safe signature for service "${serviceName}":`, error);
          return false;
        }
      
      default:
        console.error(`❌ Unknown auth type for service "${serviceName}": ${authType}`);
        return false;
    }
  }
}

/**
 * Node.js-compatible key shard storage service
 * In-memory storage implementation for server environments
 */
export class NodeKeyShareStorage extends BaseKeyShareStorage {
  private shards: Map<string, { data: Uint8Array; timestamp: Date; authorizationAddress?: string }>;

  constructor(serviceName: string, authConfig: ServiceAuthConfig = { authType: 'no-auth', description: 'No authentication required' }) {
    super(serviceName, authConfig);
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
   * Clear all shards
   */
  async clear(): Promise<void> {
    this.shards.clear();
  }
}

/**
 * Browser-compatible key shard storage service
 * IndexedDB-based storage implementation for browser environments
 */
export class BrowserKeyShareStorage extends BaseKeyShareStorage {
  private keyShareStorageService: KeyShareStorageService;

  constructor(serviceName: string, authConfig: ServiceAuthConfig = { authType: 'no-auth', description: 'No authentication required' }) {
    super(serviceName, authConfig);
    this.keyShareStorageService = new KeyShareStorageService(serviceName, authConfig);
  }

  /**
   * Store a key shard with optional authorization address
   */
  async storeShard(data: Uint8Array, authorizationAddress?: string): Promise<void> {
    await this.keyShareStorageService.storeShard(data, authorizationAddress);
  }



  /**
   * Get shard metadata only (for discovery purposes)
   */
  async getShardMetadata(): Promise<Array<{ timestamp: Date; authorizationAddress?: string; dataSize: number }>> {
    return await this.keyShareStorageService.getShardMetadata();
  }

  /**
   * Clear all shards
   */
  async clear(): Promise<void> {
    await this.keyShareStorageService.clear();
  }

  /**
   * Delete the entire database
   */
  async deleteDatabase(): Promise<void> {
    await this.keyShareStorageService.deleteDatabase();
  }
}

// Keep SimpleKeyShardStorage as an alias for backwards compatibility
export const SimpleKeyShardStorage = NodeKeyShareStorage; 