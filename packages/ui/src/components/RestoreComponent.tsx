import { useState } from 'react'
import { BackupService, RestoreRequest, ShamirConfig, StorageBackend, EncryptedDataStorage, SafeConfig } from '@resilient-backup/library'

interface RestoreComponentProps {
  shamirConfig: ShamirConfig
  storageBackend: StorageBackend
  encryptedDataStorage: EncryptedDataStorage
  safeConfig: SafeConfig
}

export default function RestoreComponent({ shamirConfig, storageBackend, encryptedDataStorage, safeConfig }: RestoreComponentProps) {
  const [encryptedBlobHash, setEncryptedBlobHash] = useState('')
  const [shardHashes, setShardHashes] = useState<string[]>(['', '', ''])
  const [safeSignature, setSafeSignature] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const [restoredProfile, setRestoredProfile] = useState<any>(null)

  const addShardField = () => {
    setShardHashes([...shardHashes, ''])
  }

  const removeShardField = (index: number) => {
    setShardHashes(shardHashes.filter((_, i) => i !== index))
  }

  const updateShardHash = (index: number, value: string) => {
    const newHashes = [...shardHashes]
    newHashes[index] = value
    setShardHashes(newHashes)
  }

  const handleRestore = async () => {
    const validShards = shardHashes.filter(hash => hash.trim())
    
    if (!encryptedBlobHash || validShards.length < shamirConfig.threshold) {
      setStatus({ 
        type: 'error', 
        message: `Please provide encrypted blob hash and at least ${shamirConfig.threshold} shard hashes` 
      })
      return
    }

    setIsLoading(true)
    setStatus({ type: 'info', message: 'Starting restore process...' })

    try {
      // Step 1: Initialize restore service
      console.log('🔧 [RESTORE] Initializing restore service...')
      console.log('   📊 Shamir Config:', {
        threshold: shamirConfig.threshold,
        totalShares: shamirConfig.totalShares,
        providedShards: validShards.length,
        requiredShards: shamirConfig.threshold
      })
      console.log('   💾 Key Share Storage:', {
        type: storageBackend.type,
        endpoint: storageBackend.endpoint
      })
      console.log('   📦 Encrypted Data Storage:', {
        type: encryptedDataStorage.type,
        endpoint: encryptedDataStorage.endpoint
      })
      
      const backupService = new BackupService(shamirConfig, storageBackend, encryptedDataStorage, undefined, safeConfig)
      
      // Step 2: Prepare restore request
      console.log('📝 [RESTORE] Preparing restore request...')
      console.log('   📦 Encrypted Blob Hash:', encryptedBlobHash)
      console.log('   🔑 Provided Shards:', validShards.length)
      validShards.forEach((hash, index) => {
        console.log(`     Shard ${index + 1}: ${hash.substring(0, 20)}...`)
      })
      if (safeSignature) {
        console.log('   🔐 Safe Signature: Provided (EIP-712)')
      } else {
        console.log('   🔐 Safe Signature: Not provided')
      }
      
      const restoreRequest: RestoreRequest = {
        encryptedBlobHash,
        shardHashes: validShards,
        requiredShards: shamirConfig.threshold,
        safeSignature: safeSignature || undefined
      }

      // Step 3: Execute restore process
      console.log('🚀 [RESTORE] Executing restore process...')
      console.log('   📥 Downloading encrypted blob from', encryptedDataStorage.type)
      console.log('   🔐 Requesting key shards from backup service')
      console.log('   🔑 Reconstructing encryption key using Shamir Secret Sharing')
      console.log('   🔓 Decrypting profile data with AES-256-GCM')
      console.log('   ✅ Validating restored profile integrity')
      
      const profile = await backupService.restore(restoreRequest)
      
      // Step 4: Restore completed
      console.log('✅ [RESTORE] Profile restored successfully!')
      console.log('   🆔 Profile ID:', profile.id)
      console.log('   📝 Profile Name:', profile.metadata.name)
      console.log('   📏 Data Size:', `${profile.data.length} bytes`)
      console.log('   📅 Created:', profile.metadata.createdAt.toISOString())
      console.log('   🔢 Version:', profile.metadata.version)
      
      setRestoredProfile(profile)
      setStatus({ type: 'success', message: 'Profile restored successfully!' })
    } catch (error) {
      console.error('❌ [RESTORE] Restore failed:', error)
      console.log('   🔍 Error Type:', error instanceof Error ? error.constructor.name : typeof error)
      console.log('   📋 Error Message:', error instanceof Error ? error.message : String(error))
      setStatus({ type: 'error', message: `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}` })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>Restore Profile</h2>
      <p>Reconstruct your wallet profile from encrypted blob and key shards</p>
      
      <div className="form-group">
        <label htmlFor="blobHash">Encrypted Blob Hash:</label>
        <input
          id="blobHash"
          type="text"
          value={encryptedBlobHash}
          onChange={(e) => setEncryptedBlobHash(e.target.value)}
          placeholder="QmHash... or similar"
        />
      </div>

      <div className="form-group">
        <label>Key Shard Hashes (need {shamirConfig.threshold} of {shamirConfig.totalShares}):</label>
        {shardHashes.map((hash, index) => (
          <div key={index} style={{ display: 'flex', marginBottom: '0.5rem' }}>
            <input
              type="text"
              value={hash}
              onChange={(e) => updateShardHash(index, e.target.value)}
              placeholder={`Shard ${index + 1} hash`}
              style={{ flex: 1, marginRight: '0.5rem' }}
            />
            {shardHashes.length > 1 && (
              <button 
                type="button" 
                onClick={() => removeShardField(index)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem' }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button 
          type="button" 
          onClick={addShardField}
          className="btn btn-secondary"
          style={{ marginTop: '0.5rem' }}
        >
          Add Shard Field
        </button>
      </div>

      {safeConfig.safeAddress && (
        <div className="form-group">
          <label htmlFor="safeSignature">Safe Signature (EIP-712):</label>
          <input
            id="safeSignature"
            type="text"
            value={safeSignature}
            onChange={(e) => setSafeSignature(e.target.value)}
            placeholder="0x..."
          />
        </div>
      )}

      <button 
        className="btn" 
        onClick={handleRestore} 
        disabled={isLoading || !encryptedBlobHash || shardHashes.filter(h => h.trim()).length < shamirConfig.threshold}
      >
        {isLoading ? 'Restoring...' : 'Restore Profile'}
      </button>

      {status && (
        <div className={`status ${status.type}`}>
          {status.message}
        </div>
      )}

      {restoredProfile && (
        <div className="card" style={{ marginTop: '1rem', textAlign: 'left' }}>
          <h3>Restored Profile</h3>
          <p><strong>ID:</strong> {restoredProfile.id}</p>
          <p><strong>Name:</strong> {restoredProfile.metadata.name}</p>
          <p><strong>Created:</strong> {restoredProfile.metadata.createdAt.toISOString()}</p>
          <p><strong>Version:</strong> {restoredProfile.metadata.version}</p>
          <div style={{ marginTop: '1rem' }}>
            <strong>Data:</strong>
            <pre style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
              {new TextDecoder().decode(restoredProfile.data)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
} 