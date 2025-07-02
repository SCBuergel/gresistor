import { useState } from 'react'
import { BackupService, RestoreRequest, ShamirConfig, StorageBackend, SafeConfig } from '@resilient-backup/library'

interface RestoreComponentProps {
  shamirConfig: ShamirConfig
  storageBackend: StorageBackend
  safeConfig: SafeConfig
}

export default function RestoreComponent({ shamirConfig, storageBackend, safeConfig }: RestoreComponentProps) {
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
      const backupService = new BackupService(shamirConfig, storageBackend, undefined, safeConfig)
      
      const restoreRequest: RestoreRequest = {
        encryptedBlobHash,
        shardHashes: validShards,
        requiredShards: shamirConfig.threshold,
        safeSignature: safeSignature || undefined
      }

      const profile = await backupService.restore(restoreRequest)
      setRestoredProfile(profile)
      setStatus({ type: 'success', message: 'Profile restored successfully!' })
    } catch (error) {
      console.error('Restore failed:', error)
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