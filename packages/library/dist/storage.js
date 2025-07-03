"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserStorageService = exports.InMemoryStorageService = exports.StorageService = exports.KeyShareStorageService = exports.KeyShareRegistryService = void 0;
class KeyShareRegistryService {
    constructor() {
        this.dbName = 'KeyShareRegistryDB';
        this.dbVersion = 3; // Increment version for authType field
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
                    db.createObjectStore(this.storeName, { keyPath: 'name' }); // Use name as key instead of id
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
    async deleteService(name) {
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
    async getServiceAuthType(serviceName) {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(serviceName);
            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result.authType || 'no-auth');
                }
                else {
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
    async updateServiceAuthType(serviceName, authType) {
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
                }
                else {
                    reject(new Error(`Service "${serviceName}" not found in registry`));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }
}
exports.KeyShareRegistryService = KeyShareRegistryService;
class KeyShareStorageService {
    constructor(serviceName) {
        this.dbVersion = 5; // Increment version for removing authType from shards
        this.storeName = 'keyShards';
        this.dbPromise = null;
        this.dbName = `KeyShardService_${serviceName}`;
        this.serviceName = serviceName;
        this.registry = new KeyShareRegistryService();
    }
    async getDB() {
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
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const transaction = event.target.transaction;
                console.log(`Upgrading database ${this.dbName} from version ${event.oldVersion} to ${event.newVersion}`);
                // Create shards store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('authorizationAddress', 'authorizationAddress', { unique: false });
                    console.log(`Created store: ${this.storeName}`);
                }
                else {
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
    getAuthTypeDescription(authType) {
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
    async getAuthConfig() {
        try {
            const authType = await this.registry.getServiceAuthType(this.serviceName);
            return {
                authType: authType,
                description: this.getAuthTypeDescription(authType)
            };
        }
        catch (error) {
            // Fallback to default if registry lookup fails
            const defaultAuthType = 'no-auth';
            return {
                authType: defaultAuthType,
                description: this.getAuthTypeDescription(defaultAuthType)
            };
        }
    }
    /**
     * Updates the authorization configuration for this service in the registry
     */
    async updateAuthConfig(authType) {
        return this.registry.updateServiceAuthType(this.serviceName, authType);
    }
    /**
     * Stores a key shard with authorization configuration
     */
    async storeShard(data, authorizationAddress) {
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
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Retrieves all key shards with authorization validation
     */
    async getAllShardsWithAuth(authData) {
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
                    const results = request.result.map(item => ({
                        data: new Uint8Array(item.data),
                        timestamp: new Date(item.timestamp),
                        authorizationAddress: item.authorizationAddress
                    }));
                    resolve(results);
                };
                request.onerror = () => reject(request.error);
                transaction.onerror = () => reject(transaction.error);
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Retrieves shard metadata only (for discovery purposes - no sensitive data exposed)
     * Use getAllShardsWithAuth() to access actual shard data after proper authorization
     */
    async getShardMetadata() {
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
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * @deprecated Use getShardMetadata() for discovery and getAllShardsWithAuth() for accessing data
     * This method is kept for backwards compatibility but should not be used
     */
    async getAllShards() {
        throw new Error('getAllShards() is deprecated for security reasons. Use getShardMetadata() for discovery or getAllShardsWithAuth() for authorized access.');
    }
    /**
     * Retrieves authorized key shards for a specific timestamp with full authorization validation
     */
    async getAuthorizedShard(targetTimestamp, authData) {
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
                    const matchingShard = request.result.find(item => new Date(item.timestamp).getTime() === targetTimestamp);
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
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Validates authorization data based on service auth type
     */
    validateAuthData(authType, authData) {
        console.log(`🔍 validateAuthData called for service "${this.serviceName}":`);
        console.log(`   authType: ${authType}`);
        console.log(`   authData:`, authData);
        switch (authType) {
            case 'no-auth':
                // For no-auth, we just need an owner address (or no auth data at all)
                const noAuthValid = !authData || !!authData.ownerAddress;
                console.log(`✅ No-auth validation for "${this.serviceName}": ${noAuthValid}`);
                return noAuthValid;
            case 'mock-signature-2x':
                // For mock signature, we need both address and signature
                if (!authData || !authData.ownerAddress || !authData.signature) {
                    console.error(`❌ Mock signature auth requires both ownerAddress and signature for service "${this.serviceName}"`);
                    console.error(`   authData provided: ${!!authData}`);
                    console.error(`   ownerAddress: ${authData?.ownerAddress}`);
                    console.error(`   signature: ${authData?.signature}`);
                    return false;
                }
                try {
                    const addressNum = parseInt(authData.ownerAddress);
                    const signatureNum = parseInt(authData.signature);
                    const expectedSignature = addressNum * 2;
                    console.log(`🔧 Service auth validation for "${this.serviceName}": address=${addressNum}, signature=${signatureNum}, expected=${expectedSignature}`);
                    const isValid = signatureNum === expectedSignature;
                    console.log(`${isValid ? '✅' : '❌'} Mock signature validation result: ${isValid}`);
                    return isValid;
                }
                catch (error) {
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
    validateShardAuth(authorizationAddress, authData, authType) {
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
    validateMockSignature(address, signature) {
        try {
            const addressNum = parseInt(address);
            const signatureNum = parseInt(signature);
            const expectedSignature = addressNum * 2;
            console.log(`🔧 Mock signature validation: address=${addressNum}, signature=${signatureNum}, expected=${expectedSignature}`);
            return signatureNum === expectedSignature;
        }
        catch (error) {
            console.error('Failed to validate mock signature:', error);
            return false;
        }
    }
    /**
     * Deletes a key shard by internal key
     */
    async deleteShard(key) {
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