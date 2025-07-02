"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserStorageService = exports.StorageService = void 0;
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
class BrowserStorageService {
    constructor() {
        this.dbName = 'ResilientBackupDB';
        this.dbVersion = 1;
        this.storeName = 'encryptedData';
    }
    async getDB() {
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