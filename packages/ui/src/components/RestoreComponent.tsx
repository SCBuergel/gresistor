import { useState, useEffect } from 'react'
import { BackupService, RestoreRequest, ShamirConfig, StorageBackend, EncryptedDataStorage, SafeConfig } from '@resilient-backup/library'
import { KeyShareRegistryService, KeyShareStorageService } from '@resilient-backup/library'

interface RestoreComponentProps {
  shamirConfig: ShamirConfig
  storageBackend: StorageBackend
  encryptedDataStorage: EncryptedDataStorage
  safeConfig: SafeConfig
}

interface StoredBackup {
  hash: string
  size: number
  timestamp: Date
}

interface KeyShardInfo {
  id: string
  serviceId: string
  serviceName: string
  backupId: string
  shardIndex: number
  threshold: number
  totalShares: number
  timestamp: Date
  isSelected: boolean
}

export default function RestoreComponent({ shamirConfig, storageBackend, encryptedDataStorage, safeConfig }: RestoreComponentProps) {
  const [encryptedBlobHash, setEncryptedBlobHash] = useState('')
  const [shardHashes, setShardHashes] = useState<string[]>(['', '', ''])
  const [safeSignature, setSafeSignature] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const [restoredProfile, setRestoredProfile] = useState<any>(null)
  const [availableBackups, setAvailableBackups] = useState<StoredBackup[]>([])
  const [selectedBackup, setSelectedBackup] = useState<string>('')
  const [isLoadingBackups, setIsLoadingBackups] = useState(false)
  const [availableKeyShards, setAvailableKeyShards] = useState<KeyShardInfo[]>([])
  const [isLoadingKeyShards, setIsLoadingKeyShards] = useState(false)

  // Load available backups when component mounts or when encryptedDataStorage changes
  useEffect(() => {
    if (encryptedDataStorage.type === 'local-browser') {
      loadAvailableBackups()
    }
  }, [encryptedDataStorage])

  // Load key shards when a backup is selected
  useEffect(() => {
    if (selectedBackup) {
      loadAvailableKeyShards(selectedBackup)
    } else {
      setAvailableKeyShards([])
    }
  }, [selectedBackup, storageBackend])

  const loadAvailableBackups = async () => {
    setIsLoadingBackups(true)
    try {
      console.log('🔍 [RESTORE] Loading available encrypted backups from storage...')
      console.log(`   📦 Storage Type: ${encryptedDataStorage.type}`)
      
      const backupService = new BackupService(shamirConfig, storageBackend, encryptedDataStorage, undefined, safeConfig)
      const browserStorage = (backupService as any).encryptedDataStorage
      
      if (browserStorage && browserStorage.listHashes) {
        const hashes = await browserStorage.listHashes()
        console.log(`   📋 Found ${hashes.length} encrypted backups in storage`)
        
        const backups: StoredBackup[] = []
        
        for (const hash of hashes) {
          try {
            const metadata = await browserStorage.getMetadata(hash)
            backups.push({
              hash,
              size: metadata.size,
              timestamp: metadata.timestamp
            })
            console.log(`     ✅ Backup: ${hash.substring(0, 16)}... (${metadata.size} bytes, ${metadata.timestamp.toLocaleString()})`)
          } catch (error) {
            console.warn(`     ⚠️  Failed to get metadata for backup ${hash}:`, error)
          }
        }
        
        // Sort by creation date (newest first)
        backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        setAvailableBackups(backups)
        
        console.log(`   📊 Successfully loaded ${backups.length} valid backups`)
      } else {
        console.log('   ⚠️  Browser storage not available or doesn\'t support listing')
      }
    } catch (error) {
      console.error('❌ [RESTORE] Failed to load available backups:', error)
      setStatus({ type: 'error', message: 'Failed to load available backups' })
    } finally {
      setIsLoadingBackups(false)
    }
  }

  const loadAvailableKeyShards = async (backupHash: string) => {
    setIsLoadingKeyShards(true)
    try {
      console.log('🔍 [RESTORE] ========================================')
      console.log('🔍 [RESTORE] Searching for key shards across all storage services...')
      console.log(`   🎯 Target backup: ${backupHash}`)
      console.log(`   🔧 Storage backend configured as: ${storageBackend.type}`)
      console.log('🔍 [RESTORE] ========================================')
      
      const allShards: KeyShardInfo[] = []
      
      if (storageBackend.type === 'local-browser') {
        console.log('🔍 [RESTORE] Connecting to local key share registry...')
        
        const registry = new KeyShareRegistryService()
        let services = await registry.listServices()
        
        // Auto-create default service if none exist
        if (services.length === 0) {
          console.log('   🔧 No storage services found. Creating default service...')
          try {
            const defaultServiceId = crypto.randomUUID()
            await registry.registerService({
              id: defaultServiceId,
              name: 'Default Local Storage',
              description: 'Automatically created default key share storage service',
              isActive: true
            })
            console.log(`   ✅ Created default service: "${defaultServiceId}"`)
            
            // Reload services
            services = await registry.listServices()
          } catch (error) {
            console.error('   ❌ Failed to create default service:', error)
          }
        }
        
        const activeServices = services.filter(s => s.isActive)
        
        console.log(`   📋 Total services registered: ${services.length}`)
        console.log(`   ✅ Active services: ${activeServices.length}`)
        
        if (activeServices.length === 0) {
          console.log('   ⚠️  No active key share services found. Please configure storage services in the Config tab.')
          setStatus({ 
            type: 'info', 
            message: 'No active key share services found. Please configure storage services in the Config tab.' 
          })
          setAvailableKeyShards([])
          setIsLoadingKeyShards(false)
          return
        }
        
        activeServices.forEach((service, index) => {
          console.log(`     ${index + 1}. "${service.name}" (ID: ${service.id})`)
          console.log(`        Description: ${service.description || 'No description'}`)
          console.log(`        Created: ${service.createdAt.toLocaleString()}`)
        })
        
        console.log('🔍 [RESTORE] Searching each service for matching key shards...')
        
        for (const service of activeServices) {
          console.log(`\n   🔍 [SERVICE: ${service.name}] Connecting to storage service...`)
          try {
            const storageService = new KeyShareStorageService(service.id)
            const shardIds = await storageService.listShardIds()
            console.log(`     📦 Total shards in service: ${shardIds.length}`)
            
            // Filter shards that match the backup hash
            const backupShards = shardIds.filter(id => id.includes(backupHash))
            console.log(`     🎯 Shards matching backup ${backupHash.substring(0, 16)}...: ${backupShards.length}`)
            
            if (backupShards.length === 0) {
              console.log(`     ➡️  No matching shards found in "${service.name}"`)
              continue
            }
            
            for (const shardId of backupShards) {
              try {
                console.log(`     📥 Loading shard: ${shardId}`)
                const shardData = await storageService.getShard(shardId)
                const metadata = shardData.metadata
                
                console.log(`       ✅ Shard loaded successfully:`)
                console.log(`          - Shard Index: ${metadata.shardIndex}`)
                console.log(`          - Threshold: ${metadata.threshold}`)
                console.log(`          - Total Shares: ${metadata.totalShares}`)
                console.log(`          - Data Size: ${shardData.data.length} bytes`)
                console.log(`          - Service: ${service.name}`)
                
                allShards.push({
                  id: shardId,
                  serviceId: service.id,
                  serviceName: service.name,
                  backupId: metadata.backupId || backupHash,
                  shardIndex: metadata.shardIndex || 0,
                  threshold: metadata.threshold || shamirConfig.threshold,
                  totalShares: metadata.totalShares || shamirConfig.totalShares,
                  timestamp: new Date(metadata.timestamp || Date.now()),
                  isSelected: false
                })
              } catch (error) {
                console.error(`       ❌ Failed to load shard ${shardId}:`, error)
              }
            }
          } catch (error) {
            console.error(`   ❌ [SERVICE: ${service.name}] Failed to access service:`, error)
          }
        }
      } else {
        console.log(`🔍 [RESTORE] Remote storage backend (${storageBackend.type}) - using manual shard input`)
        console.log(`   📡 Endpoint: ${storageBackend.endpoint}`)
        console.log('   ℹ️  For remote storage, please manually enter shard hashes below')
      }
      
      // Sort by service name, then by shard index, then by creation date
      allShards.sort((a, b) => {
        if (a.serviceName !== b.serviceName) {
          return a.serviceName.localeCompare(b.serviceName)
        }
        if (a.shardIndex !== b.shardIndex) {
          return a.shardIndex - b.shardIndex
        }
        return b.timestamp.getTime() - a.timestamp.getTime()
      })
      
      console.log('\n🔍 [RESTORE] ========================================')
      console.log(`🔍 [RESTORE] Search complete! Found ${allShards.length} total key shards`)
      if (allShards.length > 0) {
        console.log('   📋 Available shards:')
        allShards.forEach((shard, index) => {
          console.log(`     ${index + 1}. ${shard.serviceName}: Shard ${shard.shardIndex + 1}/${shard.totalShares} (${shard.timestamp.toLocaleString()})`)
        })
        console.log(`   🔧 Required for restore: ${shamirConfig.threshold} shards`)
        console.log('   👆 Click shards below to select them for restoration')
      } else {
        console.log('   ⚠️  No key shards found for this backup')
      }
      console.log('🔍 [RESTORE] ========================================')
      
      setAvailableKeyShards(allShards)
      
    } catch (error) {
      console.error('❌ [RESTORE] Failed to load key shards:', error)
      console.error('   🔍 Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error
      })
      setStatus({ type: 'error', message: 'Failed to load key shards' })
    } finally {
      setIsLoadingKeyShards(false)
    }
  }

  const handleBackupSelect = (hash: string) => {
    setSelectedBackup(hash)
    setEncryptedBlobHash(hash)
    setAvailableKeyShards([]) // Clear previous shards
    console.log(`🔍 [RESTORE] Selected backup: ${hash}`)
    console.log('   🔄 Loading key shards for selected backup...')
  }

  const toggleShardSelection = (shardId: string) => {
    setAvailableKeyShards(prev => {
      const newShards = prev.map(shard => 
        shard.id === shardId ? { ...shard, isSelected: !shard.isSelected } : shard
      )
      
      const selectedCount = newShards.filter(s => s.isSelected).length
      const shard = newShards.find(s => s.id === shardId)
      
      if (shard) {
        console.log(`🔧 [RESTORE] ${shard.isSelected ? 'Selected' : 'Deselected'} shard: ${shard.serviceName} - Shard ${shard.shardIndex + 1}`)
        console.log(`   📊 Total selected: ${selectedCount}/${shamirConfig.threshold} required`)
      }
      
      return newShards
    })
  }

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
    const selectedKeyShards = availableKeyShards.filter(shard => shard.isSelected)
    
    if (!encryptedBlobHash) {
      setStatus({ 
        type: 'error', 
        message: 'Please select an encrypted backup' 
      })
      return
    }

    if (storageBackend.type === 'local-browser') {
      if (selectedKeyShards.length < shamirConfig.threshold) {
        setStatus({ 
          type: 'error', 
          message: `Please select at least ${shamirConfig.threshold} key shards for decryption` 
        })
        return
      }
    } else {
      if (validShards.length < shamirConfig.threshold) {
        setStatus({ 
          type: 'error', 
          message: `Please provide at least ${shamirConfig.threshold} shard hashes` 
        })
        return
      }
    }

    setIsLoading(true)
    setStatus({ type: 'info', message: 'Starting restore process...' })

    try {
      // Step 1: Initialize restore service
      console.log('🔧 [RESTORE] Initializing restore service...')
      console.log('   📊 Shamir Config:', {
        threshold: shamirConfig.threshold,
        totalShares: shamirConfig.totalShares,
        providedShards: storageBackend.type === 'local-browser' ? selectedKeyShards.length : validShards.length,
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
      
      let restoreRequest: RestoreRequest
      
      if (storageBackend.type === 'local-browser') {
        // Use selected key shards from local storage
        console.log('   🔑 Selected Key Shards:', selectedKeyShards.length)
        selectedKeyShards.forEach((shard, index) => {
          console.log(`     Shard ${index + 1}: ${shard.serviceName} (${shard.shardIndex})`)
        })
        
        // For local storage, we'll pass the selected shard IDs
        // The backup service will handle retrieving them
        restoreRequest = {
          encryptedBlobHash,
          shardHashes: selectedKeyShards.map(shard => shard.id), // Use shard IDs instead of hashes
          requiredShards: shamirConfig.threshold,
          safeSignature: safeSignature || undefined
        }
      } else {
        // Use manual shard hashes
        console.log('   🔑 Provided Shards:', validShards.length)
        validShards.forEach((hash, index) => {
          console.log(`     Shard ${index + 1}: ${hash.substring(0, 20)}...`)
        })
        
        restoreRequest = {
          encryptedBlobHash,
          shardHashes: validShards,
          requiredShards: shamirConfig.threshold,
          safeSignature: safeSignature || undefined
        }
      }
      
      if (safeSignature) {
        console.log('   🔐 Safe Signature: Provided (EIP-712)')
      } else {
        console.log('   🔐 Safe Signature: Not provided')
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
      
      {/* Configuration Summary */}
      <div style={{ 
        padding: '1rem', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '6px', 
        marginBottom: '1rem',
        border: '1px solid #e9ecef'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#495057' }}>Current Configuration</h3>
        <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>Threshold:</strong> {shamirConfig.threshold} of {shamirConfig.totalShares} shares required
          </p>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>Key Storage:</strong> {storageBackend.type} 
            {storageBackend.endpoint && ` (${storageBackend.endpoint})`}
          </p>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>Data Storage:</strong> {encryptedDataStorage.type}
            {encryptedDataStorage.endpoint && ` (${encryptedDataStorage.endpoint})`}
          </p>
          {safeConfig.safeAddress && (
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Safe:</strong> {safeConfig.safeAddress} (Chain {safeConfig.chainId})
            </p>
          )}
        </div>
      </div>
      
      {/* Available Backups Section */}
      {encryptedDataStorage.type === 'local-browser' && (
        <div className="form-group">
          <label>Available Encrypted Backups:</label>
          {isLoadingBackups ? (
            <p>Loading available backups...</p>
          ) : availableBackups.length > 0 ? (
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '4px', padding: '0.5rem' }}>
              {availableBackups.map((backup) => (
                <div 
                  key={backup.hash}
                  onClick={() => handleBackupSelect(backup.hash)}
                  style={{
                    padding: '0.5rem',
                    margin: '0.25rem 0',
                    border: selectedBackup === backup.hash ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: selectedBackup === backup.hash ? '#eff6ff' : '#f9fafb'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                    {backup.hash.substring(0, 16)}...
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    Size: {backup.size} bytes | Created: {backup.timestamp.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No encrypted backups found in local storage</p>
          )}
          <button 
            type="button" 
            onClick={loadAvailableBackups}
            className="btn btn-secondary"
            style={{ marginTop: '0.5rem' }}
          >
            Refresh List
          </button>
        </div>
      )}
      
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

      {/* Key Shards Section */}
      {storageBackend.type === 'local-browser' && selectedBackup ? (
        <div className="form-group">
          <label>Available Key Shards (select {shamirConfig.threshold} of {shamirConfig.totalShares}):</label>
          {isLoadingKeyShards ? (
            <p>Loading key shards...</p>
          ) : availableKeyShards.length > 0 ? (
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '4px', padding: '0.5rem' }}>
              {availableKeyShards.map((shard) => (
                <div 
                  key={shard.id}
                  onClick={() => toggleShardSelection(shard.id)}
                  style={{
                    padding: '0.5rem',
                    margin: '0.25rem 0',
                    border: shard.isSelected ? '2px solid #10b981' : '1px solid #e5e7eb',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: shard.isSelected ? '#ecfdf5' : '#f9fafb'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
                        Shard {shard.shardIndex + 1} - {shard.serviceName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        Service: {shard.serviceId.substring(0, 8)}... | Created: {shard.timestamp.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: shard.isSelected ? '#10b981' : '#6b7280' }}>
                      {shard.isSelected ? '✓ Selected' : 'Click to select'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No key shards found for this backup</p>
          )}
          <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
            Selected: {availableKeyShards.filter(s => s.isSelected).length} of {shamirConfig.threshold} required
          </div>
        </div>
      ) : (
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
      )}

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
        disabled={
          isLoading || 
          !encryptedBlobHash || 
          (storageBackend.type === 'local-browser' 
            ? availableKeyShards.filter(s => s.isSelected).length < shamirConfig.threshold
            : shardHashes.filter(h => h.trim()).length < shamirConfig.threshold)
        }
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