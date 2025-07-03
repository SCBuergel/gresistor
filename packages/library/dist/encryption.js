"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionService = void 0;
class EncryptionService {
    constructor(config = { algorithm: 'AES-256-GCM', nonceStrategy: 'random-96-bit' }) {
        this.config = config;
    }
    /**
     * Encrypts data using AES-256-GCM
     */
    async encrypt(data, key) {
        // Generate a random 96-bit nonce
        const nonce = crypto.getRandomValues(new Uint8Array(12));
        // Import the key
        const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
        // Encrypt the data
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, data);
        // Split the result into ciphertext and tag
        const ciphertext = new Uint8Array(encrypted.slice(0, -16));
        const tag = new Uint8Array(encrypted.slice(-16));
        return { ciphertext, nonce, tag };
    }
    /**
     * Decrypts data using AES-256-GCM
     */
    async decrypt(ciphertext, key, nonce, tag) {
        try {
            // Import the key
            const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
            // Combine ciphertext and tag
            const encrypted = new Uint8Array(ciphertext.length + tag.length);
            encrypted.set(ciphertext);
            encrypted.set(tag, ciphertext.length);
            // Decrypt the data
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, encrypted);
            return new Uint8Array(decrypted);
        }
        catch (error) {
            throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Generates a random encryption key
     */
    async generateKey() {
        return crypto.getRandomValues(new Uint8Array(32)); // 256-bit key
    }
}
exports.EncryptionService = EncryptionService;
//# sourceMappingURL=encryption.js.map