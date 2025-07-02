"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
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
//# sourceMappingURL=storage.js.map