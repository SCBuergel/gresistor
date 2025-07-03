#!/usr/bin/env node

import { EncryptionService, ShamirSecretSharing, EncryptedDataStorageService, SimpleKeyShardStorage } from './packages/library/dist/index.js';

async function main() {
  try {
    // 1. Create individual services
    const encryptedDataStorage = new EncryptedDataStorageService({ type: 'memory' });
    const keyShardServices = [
      new SimpleKeyShardStorage('service-1', { authType: 'no-auth', description: 'First key service (no auth)' }),
      new SimpleKeyShardStorage('service-2', { authType: 'mock-signature-2x', description: 'Second key service (mock signature)' }),
      new SimpleKeyShardStorage('service-3', { authType: 'mock-signature-2x', description: 'Third key service (mock signature)' })
    ];
    const encryptionService = new EncryptionService();
    const shamirService = new ShamirSecretSharing({ threshold: 2, totalShares: 3 });

    // 2. Create test profile and authentication data
    const testProfile = {
      name: 'Alice Johnson',
      age: 28
    };
    const ownerAddress = '123';
    const authData = {
      ownerAddress: ownerAddress,
      signature: (parseInt(ownerAddress) * 2).toString() // Mock signature: 123 × 2 = 246
    };

    // 3. Manual backup orchestration
    const encryptionKey = await encryptionService.generateKey();
    const profileJson = JSON.stringify(testProfile);
    const profileBytes = new TextEncoder().encode(profileJson);
    const { ciphertext, nonce, tag } = await encryptionService.encrypt(profileBytes, encryptionKey);
    
    const encryptedBlob = new Uint8Array(ciphertext.length + nonce.length + tag.length + 4);
    const view = new DataView(encryptedBlob.buffer);
    view.setUint16(0, ciphertext.length, false);
    view.setUint16(2, nonce.length, false);
    encryptedBlob.set(ciphertext, 4);
    encryptedBlob.set(nonce, 4 + ciphertext.length);
    encryptedBlob.set(tag, 4 + ciphertext.length + nonce.length);
    
    const blobHash = await encryptedDataStorage.store(encryptedBlob);
    const keyShards = await shamirService.splitSecret(encryptionKey);
    
    // Store shards in services
    await keyShardServices[0].storeShard(keyShards[0].data);
    await keyShardServices[1].storeShard(keyShards[1].data, authData.ownerAddress);
    await keyShardServices[2].storeShard(keyShards[2].data, authData.ownerAddress);

    // 4. Manual restore orchestration
    const retrievedBlob = await encryptedDataStorage.retrieve(blobHash);
    const retrievedShards = [];
    
    // Get shards from services
    const shard1 = await keyShardServices[0].getLatestShard();
    retrievedShards.push({
      id: 'shard_1',
      data: shard1.data,
      threshold: 2,
      totalShards: 3
    });
    
    const shard2 = await keyShardServices[1].getLatestShardWithAuth(authData);
    retrievedShards.push({
      id: 'shard_2',
      data: shard2.data,
      threshold: 2,
      totalShards: 3
    });

    // Reconstruct encryption key
    const reconstructedKey = await shamirService.reconstructSecret(retrievedShards);
    
    // Parse encrypted blob
    const blobView = new DataView(retrievedBlob.buffer);
    const ciphertextLength = blobView.getUint16(0, false);
    const nonceLength = blobView.getUint16(2, false);
    const retrievedCiphertext = retrievedBlob.slice(4, 4 + ciphertextLength);
    const retrievedNonce = retrievedBlob.slice(4 + ciphertextLength, 4 + ciphertextLength + nonceLength);
    const retrievedTag = retrievedBlob.slice(4 + ciphertextLength + nonceLength);
    
    // Decrypt profile data
    const decryptedBytes = await encryptionService.decrypt(retrievedCiphertext, reconstructedKey, retrievedNonce, retrievedTag);
    const decryptedJson = new TextDecoder().decode(decryptedBytes);
    const restoredProfile = JSON.parse(decryptedJson);
    
    // Verify data integrity
    const originalJson = JSON.stringify(testProfile);
    const restoredJson = JSON.stringify(restoredProfile);
    
    if (originalJson === restoredJson) {
      console.log('✅ Backup and restore completed successfully!');
      console.log(`   Profile: ${restoredProfile.name}, age ${restoredProfile.age}`);
      console.log(`   Used 2-of-3 key shards with mixed authentication (no-auth + mock-signature-2x)`);
    } else {
      console.error('❌ Data integrity check failed!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error during backup/restore process:', error.message);
    process.exit(1);
  }
}

// Run the example
main(); 