import { EncryptionConfig } from './types';
export declare class EncryptionService {
    private config;
    constructor(config?: EncryptionConfig);
    /**
     * Encrypts data using AES-256-GCM
     */
    encrypt(data: Uint8Array, key: Uint8Array): Promise<{
        ciphertext: Uint8Array;
        nonce: Uint8Array;
        tag: Uint8Array;
    }>;
    /**
     * Decrypts data using AES-256-GCM
     */
    decrypt(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array, tag: Uint8Array): Promise<Uint8Array>;
    /**
     * Generates a random encryption key
     */
    generateKey(): Promise<Uint8Array>;
}
//# sourceMappingURL=encryption.d.ts.map