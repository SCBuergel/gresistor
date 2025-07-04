#!/usr/bin/env node

import { EncryptionService, ShamirSecretSharing, EncryptedDataStorageService, SimpleKeyShardStorage } from './packages/library/dist/index.js';

async function main() {
  console.log('🔧 Minimal Backup & Restore Example - Individual Services with Authentication\n');

  // 1. Create individual services
  console.log('🏗️  Creating individual storage services...');
  
  // Encrypted data storage service
  const encryptedDataStorage = new EncryptedDataStorageService({ type: 'memory' });
  console.log('   ✅ EncryptedDataStorageService (memory) created');

  // Multiple key shard storage services with different auth configs
  const keyShardServices = [
    new SimpleKeyShardStorage('service-1', { authType: 'no-auth', description: 'First key service (no auth)' }),
    new SimpleKeyShardStorage('service-2', { authType: 'mock-signature-2x', description: 'Second key service (mock signature)' }),
    new SimpleKeyShardStorage('service-3', { authType: 'mock-signature-2x', description: 'Third key service (mock signature)' })
  ];
  console.log('   ✅ 3 SimpleKeyShardStorage services created:');
  console.log('      - service-1: no-auth');
  console.log('      - service-2: mock-signature-2x');  
  console.log('      - service-3: mock-signature-2x');

  // Core crypto services
  const encryptionService = new EncryptionService();
  const shamirService = new ShamirSecretSharing({ threshold: 2, totalShares: 3 });
  console.log('   ✅ EncryptionService and ShamirSecretSharing (2-of-3) created\n');

  // 2. Create test profile and authentication data
  console.log('📱 Creating test profile and auth data...');
  const testProfile = {
    name: 'Alice Johnson',
    age: 28
  };

  // Authentication data for mock signature services
  const ownerAddress = '123';
  const authData = {
    ownerAddress: ownerAddress,
    signature: (parseInt(ownerAddress) * 2).toString() // Mock signature: 123 × 2 = 246
  };

  console.log(`   Profile: ${testProfile.name}, age ${testProfile.age}`);
  console.log(`   Auth data: owner=${authData.ownerAddress}, signature=${authData.signature} (${authData.ownerAddress} × 2)\n`);

  // 3. Manual backup orchestration
  console.log('🔐 Manual Backup Process...');

  // Step 3.1: Generate encryption key
  console.log('   🔑 Generating encryption key...');
  const encryptionKey = await encryptionService.generateKey();
  const encryptionKeyHex = Array.from(encryptionKey).map(b => b.toString(16).padStart(2, '0')).join('');
  console.log(`   ✅ Generated 256-bit encryption key: ${encryptionKeyHex.substring(0, 20)}...`);

  // Step 3.2: Encrypt the profile data
  console.log('   🔒 Encrypting profile data...');
  const profileJson = JSON.stringify(testProfile);
  const profileBytes = new TextEncoder().encode(profileJson);
  
  const { ciphertext, nonce, tag } = await encryptionService.encrypt(profileBytes, encryptionKey);
  console.log(`   ✅ Profile encrypted (${ciphertext.length} bytes ciphertext)`);

  // Step 3.3: Create encrypted blob
  console.log('   📦 Creating encrypted blob...');
  const encryptedBlob = new Uint8Array(ciphertext.length + nonce.length + tag.length + 4);
  const view = new DataView(encryptedBlob.buffer);
  view.setUint16(0, ciphertext.length, false);
  view.setUint16(2, nonce.length, false);
  encryptedBlob.set(ciphertext, 4);
  encryptedBlob.set(nonce, 4 + ciphertext.length);
  encryptedBlob.set(tag, 4 + ciphertext.length + nonce.length);
  console.log(`   ✅ Created encrypted blob (${encryptedBlob.length} bytes total)`);

  // Step 3.4: Store encrypted blob
  console.log('   🗄️  Storing encrypted blob...');
  const blobHash = await encryptedDataStorage.store(encryptedBlob);
  console.log(`   ✅ Encrypted blob stored with hash: ${blobHash.substring(0, 20)}...`);

  // Step 3.5: Split encryption key using Shamir Secret Sharing
  console.log('   🧩 Splitting encryption key into shards...');
  const keyShards = await shamirService.splitSecret(encryptionKey);
  console.log(`   ✅ Created ${keyShards.length} key shards (2-of-3 threshold)`);
  
  keyShards.forEach((shard, index) => {
    const shardHex = Array.from(shard.data).map(b => b.toString(16).padStart(2, '0')).join('');
    console.log(`   🔑 Shard ${index + 1} (${shard.id}): ${shardHex.substring(0, 20)}...`);
  });

  // Step 3.6: Store key shards in individual services with authorization
  console.log('   💾 Storing key shards in services...');
  
  // Store shard 1 in service-1 (no-auth)
  await keyShardServices[0].storeShard(keyShards[0].data);
  console.log('   ✅ Stored shard 1 in service-1 (no-auth)');
  
  // Store shard 2 in service-2 (mock-signature-2x)
  await keyShardServices[1].storeShard(keyShards[1].data, authData.ownerAddress);
  console.log('   ✅ Stored shard 2 in service-2 (mock-signature-2x)');
  console.log(`      🔐 Authorization address: ${authData.ownerAddress}`);
  
  // Store shard 3 in service-3 (mock-signature-2x)
  await keyShardServices[2].storeShard(keyShards[2].data, authData.ownerAddress);
  console.log('   ✅ Stored shard 3 in service-3 (mock-signature-2x)');
  console.log(`      🔐 Authorization address: ${authData.ownerAddress}`);

  console.log('\n🎯 Backup Summary:');
  console.log(`   📦 Encrypted blob hash: ${blobHash}`);
  console.log(`   🔑 Key shards distributed across ${keyShardServices.length} services`);
  console.log(`   🧩 Threshold: 2 shards required for recovery`);
  console.log(`   🔐 Authentication required for 2/3 services\n`);

  // 4. Manual restore orchestration with authentication
  console.log('🔄 Manual Restore Process with Authentication...');

  // Step 4.1: Retrieve encrypted blob
  console.log('   📥 Retrieving encrypted blob...');
  const retrievedBlob = await encryptedDataStorage.retrieve(blobHash);
  console.log(`   ✅ Retrieved encrypted blob (${retrievedBlob.length} bytes)`);

  // Step 4.2: Retrieve key shards with authentication (using only 2 services to demonstrate threshold)
  console.log('   🔍 Retrieving key shards from services with authentication...');
  const retrievedShards = [];
  
  // Get shard from service-1 (no-auth)
  console.log('   🔍 Getting shards from service-1 (no-auth)...');
  const shard1 = await keyShardServices[0].getLatestShard();
  console.log('   ✅ Retrieved shard 1 without authentication');
  retrievedShards.push({
    id: 'shard_1',
    data: shard1.data,
    threshold: 2,
    totalShards: 3
  });
  const shard1Hex = Array.from(shard1.data).map(b => b.toString(16).padStart(2, '0')).join('');
  console.log(`      🔑 Shard data: ${shard1Hex.substring(0, 20)}...`);
  
  // Get shard from service-2 (mock-signature-2x)
  console.log('   🔍 Getting shards from service-2 (mock-signature-2x)...');
  console.log(`   🔐 Authenticating with owner=${authData.ownerAddress}, signature=${authData.signature}...`);
      const shard2 = await keyShardServices[1].getLatestShardWithAuth({
      ownerAddress: '123',
      signature: '246'
    });
  console.log('   ✅ Retrieved shard 2 with successful authentication');
  retrievedShards.push({
    id: 'shard_2',
    data: shard2.data,
    threshold: 2,
    totalShards: 3
  });
  const shard2Hex = Array.from(shard2.data).map(b => b.toString(16).padStart(2, '0')).join('');
  console.log(`      🔑 Shard data: ${shard2Hex.substring(0, 20)}...`);

  console.log(`   ✅ Retrieved ${retrievedShards.length} shards (meets threshold of 2)`);

  // Step 4.3: Reconstruct encryption key
  console.log('   🔧 Reconstructing encryption key from shards...');
  const reconstructedKey = await shamirService.reconstructSecret(retrievedShards);
  const reconstructedKeyHex = Array.from(reconstructedKey).map(b => b.toString(16).padStart(2, '0')).join('');
  console.log(`   ✅ Reconstructed key: ${reconstructedKeyHex.substring(0, 20)}...`);

  // Verify keys match
  if (encryptionKeyHex === reconstructedKeyHex) {
    console.log('   🎉 Key reconstruction successful - keys match!');
  } else {
    console.log('   ❌ Key reconstruction failed - keys do not match!');
    return;
  }

  // Step 4.4: Parse encrypted blob
  console.log('   📋 Parsing encrypted blob structure...');
  const blobView = new DataView(retrievedBlob.buffer);
  const ciphertextLength = blobView.getUint16(0, false);
  const nonceLength = blobView.getUint16(2, false);
  
  const retrievedCiphertext = retrievedBlob.slice(4, 4 + ciphertextLength);
  const retrievedNonce = retrievedBlob.slice(4 + ciphertextLength, 4 + ciphertextLength + nonceLength);
  const retrievedTag = retrievedBlob.slice(4 + ciphertextLength + nonceLength);
  console.log(`   ✅ Parsed blob: ${retrievedCiphertext.length}B ciphertext, ${retrievedNonce.length}B nonce, ${retrievedTag.length}B tag`);

  // Step 4.5: Decrypt profile data
  console.log('   🔓 Decrypting profile data...');
  const decryptedBytes = await encryptionService.decrypt(retrievedCiphertext, reconstructedKey, retrievedNonce, retrievedTag);
  const decryptedJson = new TextDecoder().decode(decryptedBytes);
  const restoredProfile = JSON.parse(decryptedJson);
  console.log('   ✅ Profile data decrypted successfully');

  // Step 4.6: Verify data integrity
  console.log('   🔍 Verifying data integrity...');
  const originalJson = JSON.stringify(testProfile);
  const restoredJson = JSON.stringify(restoredProfile);
  
  if (originalJson === restoredJson) {
    console.log('   🎉 Data integrity verified! Original and restored data match perfectly.');
  } else {
    console.log('   ❌ Data integrity check failed!');
    return;
  }

  // Display results
  console.log('\n✅ Restore completed successfully!');
  console.log(`   👤 Profile name: ${restoredProfile.name}`);
  console.log(`   🎂 Profile age: ${restoredProfile.age}`);

  console.log('\n🎯 What this manual orchestration demonstrated:');
  console.log('   1. ✅ Individual service instantiation (EncryptedDataStorageService + 3 SimpleKeyShardStorage)');
  console.log('   2. ✅ Mixed authentication configurations (no-auth + mock-signature-2x)');
  console.log('   3. ✅ Manual encryption key generation and data encryption');
  console.log('   4. ✅ Encrypted blob creation and storage');
  console.log('   5. ✅ Shamir Secret Sharing key splitting into 3 shards');
  console.log('   6. ✅ Key shard distribution across separate services with authorization');
  console.log('   7. ✅ Threshold recovery using only 2-of-3 shards with authentication');
  console.log('   8. ✅ Manual decryption and data integrity verification');

  console.log('\n🚀 This lower-level approach shows:');
  console.log('   - 🏗️  Service composition and configuration');
  console.log('   - 🔐 Mixed authentication patterns (no-auth + signature)');
  console.log('   - 🔧 Manual process orchestration');
  console.log('   - 🔍 Step-by-step cryptographic operations');
  console.log('   - 📚 Educational insight into the backup/restore flow');
  console.log('   - 🎯 Clear separation of concerns between services');
  console.log('   - 🚀 Node.js compatibility without browser dependencies');

  console.log('\n✨ Manual backup & restore orchestration with authentication completed successfully!');
}

// Run the example
main().catch(console.error); 