"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserStorageService = exports.InMemoryStorageService = exports.StorageService = exports.KeyShareStorageService = exports.KeyShareRegistryService = void 0;
class KeyShareRegistryService {
    constructor() {
        this.dbName = 'KeyShareRegistryDB';
        this.dbVersion = 1;
        this.storeName = 'services';
    }
    async getDB() {
        // Check if we're in a browser environment
        if (typeof window === 'undefined' || !window.indexedDB) {
            throw new Error('IndexedDB is not available. This service requires a browser environment.');
        }
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }
    /**
     * Lists all registered key share services
     */
    async listServices() {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            request.onsuccess = () => {
                const services = request.result.map((service) => ({
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
    async registerService(service) {
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
    async updateService(service) {
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
    async deleteService(id) {
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
exports.KeyShareRegistryService = KeyShareRegistryService;
class KeyShareStorageService {
    constructor(serviceId) {
        this.dbVersion = 1;
        this.storeName = 'keyShards';
        this.dbName = `KeyShareDB_${serviceId}`;
    }
    async getDB() {
        // Check if we're in a browser environment
        if (typeof window === 'undefined' || !window.indexedDB) {
            throw new Error('IndexedDB is not available. This service requires a browser environment.');
        }
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }
    /**
     * Stores a key shard
     */
    async storeShard(shardId, shardData) {
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
    async getShard(shardId) {
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
                }
                else {
                    reject(new Error(`Shard not found: ${shardId}`));
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
    /**
     * Lists all stored shard IDs
     */
    async listShardIds() {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    /**
     * Deletes a key shard
     */
    async deleteShard(shardId) {
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
    async clear() {
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
    async deleteDatabase() {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.deleteDatabase(this.dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}
exports.KeyShareStorageService = KeyShareStorageService;
class StorageService {
    constructor(backend = { type: 'swarm', endpoint: 'http://localhost:8080' }, transport = { method: 'plain-http' }) {
        this.backend = backend;
        this.transport = transport;
    }
    /**
     * Uploads data to the configured storage backend
     */
    async upload(data) {
        // Stub implementation
        throw new Error('upload() not implemented');
    }
    /**
     * Downloads data from the storage backend by hash
     */
    async download(hash) {
        // Stub implementation
        throw new Error('download() not implemented');
    }
    /**
     * Checks if data exists at the given hash
     */
    async exists(hash) {
        // Stub implementation
        throw new Error('exists() not implemented');
    }
    /**
     * Gets metadata about stored data
     */
    async getMetadata(hash) {
        // Stub implementation
        throw new Error('getMetadata() not implemented');
    }
}
exports.StorageService = StorageService;
/**
 * In-memory storage service for Node.js testing
 */
class InMemoryStorageService {
    constructor() {
        this.storage = new Map();
    }
    /**
     * Uploads data to in-memory storage and returns the hash
     */
    async upload(data) {
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
    async download(hash) {
        const item = this.storage.get(hash);
        if (!item) {
            throw new Error(`Data not found for hash: ${hash}`);
        }
        return item.data;
    }
    /**
     * Checks if data exists at the given hash
     */
    async exists(hash) {
        return this.storage.has(hash);
    }
    /**
     * Gets metadata about stored data
     */
    async getMetadata(hash) {
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
    async generateHash(data) {
        // Use Web Crypto API for hash generation
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    /**
     * Lists all stored data hashes
     */
    async listHashes() {
        return Array.from(this.storage.keys());
    }
    /**
     * Clears all stored data
     */
    async clear() {
        this.storage.clear();
    }
}
exports.InMemoryStorageService = InMemoryStorageService;
class BrowserStorageService {
    constructor() {
        this.dbName = 'ResilientBackupDB';
        this.dbVersion = 1;
        this.storeName = 'encryptedData';
    }
    async getDB() {
        // Check if we're in a browser environment
        if (typeof window === 'undefined' || !window.indexedDB) {
            throw new Error('IndexedDB is not available. This service requires a browser environment.');
        }
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'hash' });
                }
            };
        });
    }
    /**
     * Uploads data to browser storage and returns the hash
     */
    async upload(data) {
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
    async download(hash) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(hash);
            request.onsuccess = () => {
                if (request.result) {
                    resolve(new Uint8Array(request.result.data));
                }
                else {
                    reject(new Error(`Data not found for hash: ${hash}`));
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
    /**
     * Checks if data exists at the given hash
     */
    async exists(hash) {
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
    async getMetadata(hash) {
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
                }
                else {
                    reject(new Error(`Data not found for hash: ${hash}`));
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
    /**
     * Generates a hash for the data (simplified implementation)
     */
    async generateHash(data) {
        // Use Web Crypto API to generate a SHA-256 hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    /**
     * Lists all stored data hashes
     */
    async listHashes() {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    /**
     * Clears all stored data
     */
    async clear() {
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
exports.BrowserStorageService = BrowserStorageService;
//# sourceMappingURL=storage.js.map