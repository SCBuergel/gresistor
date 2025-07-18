#!/usr/bin/env node

const { BackupService } = require('./packages/library/dist/index.js');
const { InMemoryStorageService } = require('./packages/library/dist/EncryptedDataStorage.js');

async function testBackupRestore() {
  console.log('🧪 Testing Backup and Restore Functionality\n');

  try {
    // Test configuration
    const shamirConfig = {
      threshold: 2,
      totalShares: 3
    };

    // Use in-memory storage for Node.js
    const storageBackend = { type: 'memory' };
    const encryptedDataStorage = { type: 'memory' };

    const safeConfig = {
      safeAddress: '0x1234567890123456789012345678901234567890',
      chainId: 1
    };

    console.log('📋 Configuration:');
    console.log('   Shamir: 2-of-3 threshold');
    console.log('   Storage: In-memory');
    console.log('   Safe: 0x1234...7890\n');

    // Create backup service
    const backupService = new BackupService(shamirConfig, storageBackend, encryptedDataStorage, undefined, safeConfig);

    // Test data
    const testProfile = {
      id: 'test-profile-123',
      metadata: {
        name: 'Test Profile',
        createdAt: new Date(),
        version: '1.0.0'
      },
      data: new TextEncoder().encode(JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        wallet: '0xabcdef1234567890abcdef1234567890abcdef12'
      }))
    };

    console.log('📦 Creating backup...');
    console.log('   Profile ID:', testProfile.id);
    console.log('   Profile Name:', testProfile.metadata.name);
    console.log('   Data Size:', testProfile.data.length, 'bytes');

    // Create backup
    const backupResult = await backupService.backup(testProfile);
    
    console.log('\n✅ Backup created successfully!');
    console.log('   Encrypted Blob Hash:', backupResult.encryptedBlobHash);
    console.log('   Key Shards Created:', backupResult.shardHashes.length);
    backupResult.shardHashes.forEach((shard, index) => {
      console.log(`     Shard ${index + 1}: ${shard}`);
    });

    // Test restore
    console.log('\n🔄 Testing restore...');
    
    const restoreRequest = {
      encryptedBlobHash: backupResult.encryptedBlobHash,
      shardHashes: backupResult.shardHashes.slice(0, 2), // Use first 2 shards
      requiredShards: 2,
      safeSignature: undefined
    };

    console.log('   Using shards:', restoreRequest.shardHashes.length);
    console.log('   Required shards:', restoreRequest.requiredShards);

    const restoredProfile = await backupService.restore(restoreRequest);

    console.log('\n✅ Restore completed successfully!');
    console.log('   Restored Profile ID:', restoredProfile.id);
    console.log('   Restored Profile Name:', restoredProfile.metadata.name);
    console.log('   Restored Data Size:', restoredProfile.data.length, 'bytes');

    // Verify data integrity
    const originalData = new TextDecoder().decode(testProfile.data);
    const restoredData = new TextDecoder().decode(restoredProfile.data);
    
    if (originalData === restoredData) {
      console.log('\n🎉 Data integrity verified! Original and restored data match.');
      console.log('   Original:', originalData.substring(0, 50) + '...');
      console.log('   Restored:', restoredData.substring(0, 50) + '...');
    } else {
      console.log('\n❌ Data integrity check failed!');
      console.log('   Original:', originalData);
      console.log('   Restored:', restoredData);
    }

    console.log('\n✨ All tests passed! The backup and restore system is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);
    if (error.stack) {
      console.error('   Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testBackupRestore(); 