import { StorageBackend, TransportConfig } from './types';

// TypeScript declarations for IndexedDB
declare global {
  interface Window {
    indexedDB: IDBFactory;
  }
}

export type KeyShareService = {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  isActive: boolean;
};

export class KeyShareRegistryService {
  private dbName = 'KeyShareRegistryDB';
  private dbVersion = 1;
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
          db.createObjectStore(this.storeName, { keyPath: 'id' });
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
      
      const serviceData = {
        ...service,
        createdAt: new Date().toISOString()
      };
      
      const request = store.put(serviceData);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
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
  async deleteService(id: string): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export class KeyShareStorageService {
  private dbName: string;
  private dbVersion = 1;
  private storeName = 'keyShards';

  constructor(serviceId: string) {
    this.dbName = `KeyShareDB_${serviceId}`;
  }

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
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Stores a key shard
   */
  async storeShard(shardId: string, shardData: Uint8Array): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const item = {
        id: shardId,
        data: Array.from(shardData),
        timestamp: new Date().toISOString()
      };
      
      const request = store.put(item);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieves a key shard
   */
  async getShard(shardId: string): Promise<{ data: Uint8Array }> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(shardId);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve({
            data: new Uint8Array(request.result.data)
          });
        } else {
          reject(new Error(`Shard not found: ${shardId}`));
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Lists all stored shard IDs
   */
  async listShardIds(): Promise<string[]> {
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
   * Deletes a key shard
   */
  async deleteShard(shardId: string): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(shardId);
      
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
  private backend: StorageBackend;
  private transport: TransportConfig;

  constructor(
    backend: StorageBackend = { type: 'swarm', endpoint: 'http://localhost:8080' },
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