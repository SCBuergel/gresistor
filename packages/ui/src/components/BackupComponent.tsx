import { useState } from 'react'
import { BackupService, BackupProfile, ShamirConfig, StorageBackend, SafeConfig } from '@resilient-backup/library'

interface BackupComponentProps {
  shamirConfig: ShamirConfig
  storageBackend: StorageBackend
  safeConfig: SafeConfig
}

export default function BackupComponent({ shamirConfig, storageBackend, safeConfig }: BackupComponentProps) {
  const [profileName, setProfileName] = useState('')
  const [profileData, setProfileData] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const [backupResult, setBackupResult] = useState<any>(null)

  const handleBackup = async () => {
    if (!profileName || !profileData) {
      setStatus({ type: 'error', message: 'Please provide both profile name and data' })
      return
    }

    setIsLoading(true)
    setStatus({ type: 'info', message: 'Starting backup process...' })

    try {
      const backupService = new BackupService(shamirConfig, storageBackend, undefined, safeConfig)
      
      const profile: BackupProfile = {
        id: crypto.randomUUID(),
        data: new TextEncoder().encode(profileData),
        metadata: {
          name: profileName,
          createdAt: new Date(),
          version: '1.0.0'
        }
      }

      const result = await backupService.backup(profile)
      setBackupResult(result)
      setStatus({ type: 'success', message: 'Backup completed successfully!' })
    } catch (error) {
      console.error('Backup failed:', error)
      setStatus({ type: 'error', message: `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}` })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="card">
      <h2>Create Backup</h2>
      <p>Encrypt and split your wallet profile data using Shamir Secret Sharing</p>
      
      <div className="form-group">
        <label htmlFor="profileName">Profile Name:</label>
        <input
          id="profileName"
          type="text"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          placeholder="My Wallet Profile"
        />
      </div>

      <div className="form-group">
        <label htmlFor="profileData">Profile Data (JSON):</label>
        <textarea
          id="profileData"
          value={profileData}
          onChange={(e) => setProfileData(e.target.value)}
          placeholder='{"address": "0x...", "privateKey": "0x...", "metadata": {...}}'
          rows={6}
          style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <p><strong>Configuration:</strong></p>
        <p>Threshold: {shamirConfig.threshold} of {shamirConfig.totalShares} shares required</p>
        <p>Storage: {storageBackend.type} ({storageBackend.endpoint})</p>
        {safeConfig.safeAddress && <p>Safe: {safeConfig.safeAddress}</p>}
      </div>

      <button 
        className="btn" 
        onClick={handleBackup} 
        disabled={isLoading || !profileName || !profileData}
      >
        {isLoading ? 'Creating Backup...' : 'Create Backup'}
      </button>

      {status && (
        <div className={`status ${status.type}`}>
          {status.message}
        </div>
      )}

      {backupResult && (
        <div className="card" style={{ marginTop: '1rem', textAlign: 'left' }}>
          <h3>Backup Result</h3>
          <p><strong>Encrypted Blob Hash:</strong> {backupResult.encryptedBlobHash}</p>
          <p><strong>Key Shards:</strong></p>
          <ul>
            {backupResult.shardHashes.map((hash: string, index: number) => (
              <li key={index}>Shard {index + 1}: {hash}</li>
            ))}
          </ul>
          <p><strong>Timestamp:</strong> {backupResult.metadata.timestamp.toISOString()}</p>
        </div>
      )}
    </div>
  )
} 