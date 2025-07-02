import { EncryptionConfig } from './types';

export class EncryptionService {
  private config: EncryptionConfig;

  constructor(config: EncryptionConfig = { algorithm: 'AES-256-GCM', nonceStrategy: 'random-96-bit' }) {
    this.config = config;
  }

  /**
   * Encrypts data using AES-256-GCM
   */
  async encrypt(data: Uint8Array, key: Uint8Array): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array; tag: Uint8Array }> {
    // Generate a random 96-bit nonce
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    
    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      cryptoKey,
      data
    );
    
    // Split the result into ciphertext and tag
    const ciphertext = new Uint8Array(encrypted.slice(0, -16));
    const tag = new Uint8Array(encrypted.slice(-16));
    
    return { ciphertext, nonce, tag };
  }

  /**
   * Decrypts data using AES-256-GCM
   */
  async decrypt(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array, tag: Uint8Array): Promise<Uint8Array> {
    console.log('🔧 [ENCRYPTION] decrypt() called')
    console.log('   📊 Input sizes:', {
      ciphertext: ciphertext.length,
      key: key.length,
      nonce: nonce.length,
      tag: tag.length
    })
    
    try {
      // Import the key
      console.log('   🔑 [ENCRYPTION] Importing crypto key...')
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      console.log('   ✅ [ENCRYPTION] Crypto key imported successfully')
      
      // Combine ciphertext and tag
      console.log('   🔗 [ENCRYPTION] Combining ciphertext and tag...')
      const encrypted = new Uint8Array(ciphertext.length + tag.length);
      encrypted.set(ciphertext);
      encrypted.set(tag, ciphertext.length);
      console.log('   ✅ [ENCRYPTION] Combined encrypted data size:', encrypted.length)
      
      // Decrypt the data
      console.log('   🔓 [ENCRYPTION] Decrypting data with AES-256-GCM...')
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce },
        cryptoKey,
        encrypted
      );
      console.log('   ✅ [ENCRYPTION] Decryption successful')
      console.log('   📏 Decrypted data size:', decrypted.byteLength)
      
      return new Uint8Array(decrypted);
    } catch (error) {
      console.error('   ❌ [ENCRYPTION] Decryption failed:', error)
      console.error('   🔍 Error details:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        type: error instanceof Error ? error.constructor.name : typeof error
      })
      throw error;
    }
  }

  /**
   * Generates a random encryption key
   */
  async generateKey(): Promise<Uint8Array> {
    return crypto.getRandomValues(new Uint8Array(32)); // 256-bit key
  }

  /**
   * Generates a random 96-bit nonce
   */
  generateNonce(): Uint8Array {
    // Stub implementation
    throw new Error('generateNonce() not implemented');
  }
} 