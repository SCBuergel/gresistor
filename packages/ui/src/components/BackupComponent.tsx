import { useState, useEffect } from 'react'
import { BackupService, BackupProfile, ShamirConfig, KeyShardStorageBackend, EncryptedDataStorage, SafeConfig } from '@gresistor/library'

// Default values
const DEFAULT_PROFILE_NAME = 'Demo Profile'
const DEFAULT_PROFILE_DATA = {
  address: 'demo.eth',
  timestamp: new Date().toISOString()
}

interface BackupComponentProps {
  shamirConfig: ShamirConfig
  keyShardStorageBackend: KeyShardStorageBackend
  encryptedDataStorage: EncryptedDataStorage
  safeConfig: SafeConfig
}

export default function BackupComponent({ shamirConfig, keyShardStorageBackend, encryptedDataStorage, safeConfig }: BackupComponentProps) {
  const [profileName, setProfileName] = useState('')
  const [profileData, setProfileData] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const [backupResult, setBackupResult] = useState<any>(null)

  useEffect(() => {
    setProfileName(DEFAULT_PROFILE_NAME);
    setProfileData(JSON.stringify(DEFAULT_PROFILE_DATA, null, 2));
  }, []);

  const handleBackup = async () => {
    if (!profileName || !profileData) {
      setStatus({ type: 'error', message: 'Please provide both profile name and data' })
      return
    }

    setIsLoading(true)
    setStatus({ type: 'info', message: 'Starting backup process...' })

    try {
      const backupService = new BackupService(shamirConfig, keyShardStorageBackend, encryptedDataStorage, undefined, safeConfig)
      
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
    <div>
      <h1>Create Backup</h1>
      <p>Encrypt and split your wallet profile data using Shamir Secret Sharing</p>
      
      <div>
        <h2>Profile Name</h2>
        <input
          type="text"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          placeholder="My Wallet Profile"
        />
      </div>

      <div>
        <h2>Profile Data (JSON)</h2>
        <textarea
          value={profileData}
          onChange={(e) => setProfileData(e.target.value)}
          placeholder='{"address": "0x...", "privateKey": "0x...", "metadata": {...}}'
          rows={6}
          cols={80}
        />
      </div>

      <div>
        <h2>Configuration</h2>
        <ul>
          <li><b>Threshold:</b> {shamirConfig.threshold} of {shamirConfig.totalShares} shares required</li>
          <li><b>Key Shard Storage:</b> {keyShardStorageBackend.type} {keyShardStorageBackend.endpoint && `(${keyShardStorageBackend.endpoint})`}</li>
          <li><b>Encrypted Data Storage:</b> {encryptedDataStorage.type} {encryptedDataStorage.endpoint && `(${encryptedDataStorage.endpoint})`}</li>
          {safeConfig.safeAddress && <li><b>Safe:</b> {safeConfig.safeAddress}</li>}
        </ul>
      </div>

      <div>
        <h2>Create Backup</h2>
        <button 
          onClick={handleBackup} 
          disabled={isLoading || !profileName || !profileData}
        >
          {isLoading ? 'Creating Backup...' : 'Create Backup'}
        </button>
      </div>

      {status && (
        <div>
          <h3>{status.type === 'error' ? 'Error' : status.type === 'success' ? 'Success' : 'Info'}</h3>
          <p>{status.message}</p>
        </div>
      )}

      {backupResult && (
        <div>
          <h2>Backup Result</h2>
          
          {backupResult.cryptoDetails && (
            <div>
              <div>
                <h3>Encrypted Data (Hex)</h3>
                <textarea 
                  value={backupResult.cryptoDetails.encryptedDataHex} 
                  readOnly 
                  rows={4} 
                  cols={80}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>
              
              <div>
                <h3>Encryption Key (Hex)</h3>
                <textarea 
                  value={backupResult.cryptoDetails.encryptionKeyHex} 
                  readOnly 
                  rows={2} 
                  cols={80}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>
              
              <div>
                <h3>SSS Key Shares</h3>
                {backupResult.cryptoDetails.shardsHex.map((shard: string, index: number) => (
                  <div key={index}>
                    <h4>Share {index + 1} (sent to: {backupResult.cryptoDetails!.serviceNames[index]})</h4>
                    <textarea 
                      value={shard} 
                      readOnly 
                      rows={2} 
                      cols={80}
                      style={{ fontFamily: 'monospace', fontSize: '12px' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <p><b>Backup completed at:</b> {backupResult.metadata.timestamp.toISOString()}</p>
        </div>
      )}
    </div>
  )
} 