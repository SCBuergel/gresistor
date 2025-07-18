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
  private storage: InMemoryStorageService | BrowserStorageService;

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
    return await this.storage.listHashes();
  }

  /**
   * Clear all stored data (if supported)
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }
} 