import { useState, useEffect } from 'react'
import { BackupService, BackupProfile, ShamirConfig, StorageBackend, EncryptedDataStorage, SafeConfig } from '@gresistor/library'

interface BackupComponentProps {
  shamirConfig: ShamirConfig
  storageBackend: StorageBackend
  encryptedDataStorage: EncryptedDataStorage
  safeConfig: SafeConfig
}

export default function BackupComponent({ shamirConfig, storageBackend, encryptedDataStorage, safeConfig }: BackupComponentProps) {
  const [profileName, setProfileName] = useState('')
  const [profileData, setProfileData] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const [backupResult, setBackupResult] = useState<any>(null)

  // Set default values at page load
  useEffect(() => {
    setProfileName('Seb');
    setProfileData(JSON.stringify({ address: 'scbuergel.eth', timestamp: new Date().toISOString() }, null, 2));
  }, []);

  const handleBackup = async () => {
    if (!profileName || !profileData) {
      setStatus({ type: 'error', message: 'Please provide both profile name and data' })
      return
    }

    setIsLoading(true)
    setStatus({ type: 'info', message: 'Starting backup process...' })

    try {
      // Step 1: Initialize backup service with configuration
      console.log('🔧 [BACKUP] Initializing backup service...')
      console.log('   📊 Shamir Config:', {
        threshold: shamirConfig.threshold,
        totalShares: shamirConfig.totalShares,
        description: `${shamirConfig.threshold}-of-${shamirConfig.totalShares} secret sharing`
      })
      console.log('   💾 Key Share Storage:', {
        type: storageBackend.type,
        endpoint: storageBackend.endpoint,
        hasApiKey: !!storageBackend.apiKey
      })
      console.log('   📦 Encrypted Data Storage:', {
        type: encryptedDataStorage.type,
        endpoint: encryptedDataStorage.endpoint,
        hasApiKey: !!encryptedDataStorage.apiKey
      })
      if (safeConfig.safeAddress) {
        console.log('   🔐 Safe Authentication:', {
          address: safeConfig.safeAddress,
          chainId: safeConfig.chainId,
          owners: safeConfig.owners.length
        })
      }
      
      const backupService = new BackupService(shamirConfig, storageBackend, encryptedDataStorage, undefined, safeConfig)
      
      // Step 2: Create backup profile
      console.log('📝 [BACKUP] Creating backup profile...')
      const profileId = crypto.randomUUID()
      const profileDataBytes = new TextEncoder().encode(profileData)
      console.log('   🆔 Profile ID:', profileId)
      console.log('   📏 Data Size:', `${profileDataBytes.length} bytes`)
      console.log('   📅 Created:', new Date().toISOString())
      
      const profile: BackupProfile = {
        id: profileId,
        data: profileDataBytes,
        metadata: {
          name: profileName,
          createdAt: new Date(),
          version: '1.0.0'
        }
      }

      // Step 3: Execute backup process
      console.log('🚀 [BACKUP] Executing backup process...')
      console.log('   🔒 Encryption: AES-256-GCM with random 96-bit nonce')
      console.log('   🔑 Key Generation: Cryptographically secure random key')
      console.log('   ✂️  Key Splitting: Shamir Secret Sharing algorithm')
      console.log('   📤 Storage: Uploading encrypted blob to', encryptedDataStorage.type)
      console.log('   🔐 Shard Storage: Encrypting shards for key backup service')
      
      const result = await backupService.backup(profile)
      
      // Step 4: Backup completed
      console.log('✅ [BACKUP] Backup completed successfully!')
      console.log('   📦 Encrypted Blob Hash:', result.encryptedBlobHash)
      console.log('   🔑 Key Shards Generated:', result.shardIds.length)
      console.log('   ⏰ Backup Timestamp:', result.metadata.timestamp.toISOString())
      
      setBackupResult(result)
      setStatus({ type: 'success', message: 'Backup completed successfully!' })
    } catch (error) {
      console.error('❌ [BACKUP] Backup failed:', error)
      console.log('   🔍 Error Type:', error instanceof Error ? error.constructor.name : typeof error)
      console.log('   📋 Error Message:', error instanceof Error ? error.message : String(error))
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
          <li><b>Key Share Storage:</b> {storageBackend.type} {storageBackend.endpoint && `(${storageBackend.endpoint})`}</li>
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
          <p><b>Encrypted Blob Hash:</b> {backupResult.encryptedBlobHash}</p>
          <div>
            <h3>Key Shards</h3>
            <ul>
              {backupResult.shardIds.map((id: string, index: number) => (
                <li key={index}>{id}</li>
              ))}
            </ul>
          </div>
          <p><b>Timestamp:</b> {backupResult.metadata.timestamp.toISOString()}</p>
        </div>
      )}
    </div>
  )
} 