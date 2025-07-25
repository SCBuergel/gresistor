/**
 * Abstract base class for encrypted data storage services
 */
export abstract class BaseStorageService {
  /**
   * Uploads data to storage and returns the hash
   */
  abstract upload(data: Uint8Array, user?: string): Promise<string>;

  /**
   * Downloads data from storage by hash
   */
  abstract download(hash: string): Promise<Uint8Array>;

  /**
   * Gets metadata about stored data
   */
  abstract getMetadata(hash: string): Promise<{ size: number; timestamp: Date; user?: string }>;

  /**
   * Lists all stored data hashes, optionally filtered by user
   */
  abstract listHashes(user?: string): Promise<string[]>;

  /**
   * Clears all stored data
   */
  abstract clear(): Promise<void>;

  /**
   * Generates a hash for the data using SHA-256
   */
  protected async generateHash(data: Uint8Array): Promise<string> {
    // Use Web Crypto API for hash generation
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * In-memory storage service for Node.js testing
 */
export class InMemoryStorageService extends BaseStorageService {
  private storage = new Map<string, { data: Uint8Array; timestamp: Date; size: number; user?: string }>();

  /**
   * Uploads data to in-memory storage and returns the hash
   */
  async upload(data: Uint8Array, user?: string): Promise<string> {
    const hash = await this.generateHash(data);
    
    this.storage.set(hash, {
      data: new Uint8Array(data),
      timestamp: new Date(),
      size: data.length,
      user
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
   * Gets metadata about stored data
   */
  async getMetadata(hash: string): Promise<{ size: number; timestamp: Date; user?: string }> {
    const item = this.storage.get(hash);
    if (!item) {
      throw new Error(`Data not found for hash: ${hash}`);
    }
    return {
      size: item.size,
      timestamp: item.timestamp,
      user: item.user
    };
  }

  /**
   * Lists all stored data hashes, optionally filtered by user
   */
  async listHashes(user?: string): Promise<string[]> {
    const hashes = Array.from(this.storage.keys());
    if (!user) {
      return hashes;
    }
    
    // Filter by user
    const filteredHashes = [];
    for (const hash of hashes) {
      const item = this.storage.get(hash);
      if (item && item.user === user) {
        filteredHashes.push(hash);
      }
    }
    return filteredHashes;
  }

  /**
   * Clears all stored data
   */
  async clear(): Promise<void> {
    this.storage.clear();
  }
}

export class BrowserStorageService extends BaseStorageService {
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
   * Uploads data to IndexedDB and returns the hash
   */
  async upload(data: Uint8Array, user?: string): Promise<string> {
    const db = await this.getDB();
    const hash = await this.generateHash(data);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const item = {
        hash,
        data,
        size: data.length,
        timestamp: new Date(),
        user
      };
      
      const request = store.put(item);
      
      request.onsuccess = () => resolve(hash);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Downloads data from IndexedDB by hash
   */
  async download(hash: string): Promise<Uint8Array> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(hash);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.data);
        } else {
          reject(new Error(`Data not found for hash: ${hash}`));
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Gets metadata about stored data
   */
  async getMetadata(hash: string): Promise<{ size: number; timestamp: Date; user?: string }> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(hash);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve({
            size: request.result.size,
            timestamp: new Date(request.result.timestamp),
            user: request.result.user
          });
        } else {
          reject(new Error(`Data not found for hash: ${hash}`));
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Lists all stored data hashes, optionally filtered by user
   */
  async listHashes(user?: string): Promise<string[]> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        let results = request.result;
        
        // Filter by user if specified
        if (user) {
          results = results.filter((item: any) => item.user === user);
        }
        
        resolve(results.map((item: any) => item.hash));
      };
      
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
  private storage: BaseStorageService;

  constructor(config: { type: 'memory' | 'local-browser' } = { type: 'memory' }) {
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
      // Fallback to memory storage for any other type
      this.storage = new InMemoryStorageService();
    }
  }

  /**
   * Store encrypted data and return content hash
   */
  async store(data: Uint8Array, user?: string): Promise<string> {
    return await this.storage.upload(data, user);
  }

  /**
   * Retrieve encrypted data by hash
   */
  async retrieve(hash: string): Promise<Uint8Array> {
    return await this.storage.download(hash);
  }

  /**
   * Get metadata about stored data
   */
  async getMetadata(hash: string): Promise<{ size: number; timestamp: Date; user?: string }> {
    return await this.storage.getMetadata(hash);
  }

  /**
   * List all stored data hashes (if supported), optionally filtered by user
   */
  async listHashes(user?: string): Promise<string[]> {
    return await this.storage.listHashes(user);
  }

  /**
   * Clear all stored data (if supported)
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }
} 