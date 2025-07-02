"use strict";
/// <reference path="./declarations.d.ts" />
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const secrets = __importStar(require("secrets.js-grempe"));
const crypto = __importStar(require("crypto"));
// Minimal AES-256-GCM encryption/decryption using Node's crypto
function aesEncrypt(plaintext, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext, iv, tag };
}
function aesDecrypt(ciphertext, key, iv, tag) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
// In-memory storage for CLI testing
class MemoryStorageService {
    constructor() {
        this.storage = new Map();
    }
    async upload(data) {
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        this.storage.set(hash, data);
        return hash;
    }
    async download(hash) {
        const data = this.storage.get(hash);
        if (!data)
            throw new Error(`Data not found for hash: ${hash}`);
        return data;
    }
    async exists(hash) {
        return this.storage.has(hash);
    }
}
async function main() {
    console.log('🔐 Resilient Backup - CLI Test Tool (secrets.js + crypto)\n');
    // Test configuration
    const threshold = 2;
    const totalShares = 3;
    // Test data
    const testMessage = "Hello, this is a secret message! 🔐";
    const testData = Buffer.from(testMessage, 'utf8');
    console.log('📝 Test Data:', testMessage);
    console.log('📏 Data Size:', testData.length, 'bytes\n');
    try {
        // Test 1: Basic Encryption/Decryption
        console.log('🧪 Test 1: Basic Encryption/Decryption');
        console.log('─'.repeat(50));
        const key = crypto.randomBytes(32); // 256-bit key
        console.log('🔑 Generated key:', key.length, 'bytes');
        const { ciphertext, iv, tag } = aesEncrypt(testData, key);
        console.log('🔒 Encrypted data:', ciphertext.length, 'bytes');
        console.log('🎲 IV:', iv.length, 'bytes');
        console.log('🏷️  Tag:', tag.length, 'bytes');
        const decrypted = aesDecrypt(ciphertext, key, iv, tag);
        const decryptedMessage = decrypted.toString('utf8');
        console.log('🔓 Decrypted:', decryptedMessage);
        console.log('✅ Encryption test:', decryptedMessage === testMessage ? 'PASSED' : 'FAILED');
        console.log();
        // Test 2: Shamir Secret Sharing (secrets.js)
        console.log('🧪 Test 2: Shamir Secret Sharing');
        console.log('─'.repeat(50));
        const hexKey = key.toString('hex');
        const shares = secrets.share(hexKey, totalShares, threshold);
        console.log('✂️  Split key into', shares.length, 'shares');
        console.log('📊 Threshold:', threshold, 'of', totalShares);
        // Test reconstruction with threshold shares
        const thresholdShares = shares.slice(0, threshold);
        console.log('🔧 Reconstructing with', thresholdShares.length, 'shares...');
        const reconstructedHex = secrets.combine(thresholdShares);
        const reconstructedKey = Buffer.from(reconstructedHex, 'hex');
        console.log('🔑 Reconstructed key:', reconstructedKey.length, 'bytes');
        console.log('✅ Key reconstruction:', key.equals(reconstructedKey) ? 'PASSED' : 'FAILED');
        console.log();
        // Test 3: End-to-End Backup/Restore
        console.log('🧪 Test 3: End-to-End Backup/Restore');
        console.log('─'.repeat(50));
        // Encrypt
        const { ciphertext: e2eCipher, iv: e2eIv, tag: e2eTag } = aesEncrypt(testData, key);
        // Store as: [iv][tag][ciphertext]
        const encryptedBlob = Buffer.concat([e2eIv, e2eTag, e2eCipher]);
        const storage = new MemoryStorageService();
        const encryptedBlobHash = await storage.upload(encryptedBlob);
        console.log('📦 Encrypted blob hash:', encryptedBlobHash);
        // Shard the key
        const e2eShares = secrets.share(key.toString('hex'), totalShares, threshold);
        // Simulate restoring with threshold shares
        const e2eRestoredKey = Buffer.from(secrets.combine(e2eShares.slice(0, threshold)), 'hex');
        // Download and parse blob
        const downloadedBlob = await storage.download(encryptedBlobHash);
        const iv2 = downloadedBlob.slice(0, 12);
        const tag2 = downloadedBlob.slice(12, 28);
        const cipher2 = downloadedBlob.slice(28);
        // Decrypt
        const restored = aesDecrypt(cipher2, e2eRestoredKey, iv2, tag2);
        const restoredMessage = restored.toString('utf8');
        console.log('🔓 Restored data:', restoredMessage);
        console.log('✅ End-to-end test:', restoredMessage === testMessage ? 'PASSED' : 'FAILED');
        console.log();
        // Test 4: Storage Operations
        console.log('🧪 Test 4: Storage Operations');
        console.log('─'.repeat(50));
        const testStorageData = Buffer.from('Test storage data', 'utf8');
        const uploadHash = await storage.upload(testStorageData);
        console.log('📤 Uploaded data, hash:', uploadHash);
        const exists = await storage.exists(uploadHash);
        console.log('🔍 Data exists:', exists);
        const downloadedData = await storage.download(uploadHash);
        const downloadedText = downloadedData.toString('utf8');
        console.log('📥 Downloaded data:', downloadedText);
        console.log('✅ Storage test:', downloadedText === 'Test storage data' ? 'PASSED' : 'FAILED');
        console.log();
        console.log('🎉 All tests completed successfully!');
    }
    catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}
// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔐 Resilient Backup CLI Test Tool

Usage:
  npm run cli                    # Run all tests
  npm run cli --help            # Show this help

Tests:
  - Basic encryption/decryption (Node crypto)
  - Shamir Secret Sharing (secrets.js)
  - End-to-end backup/restore
  - Storage operations
`);
    process.exit(0);
}
main().catch(console.error);
//# sourceMappingURL=cli.js.map