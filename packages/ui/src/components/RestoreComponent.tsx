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
  const [shardIds, setShardIds] = useState<string[]>(['', '', ''])
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
    // Load all available key shards on component mount (no backup selection needed)
    if (storageBackend.type === 'local-browser') {
      loadAvailableKeyShards()
    }
  }, [storageBackend.type])

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

  const loadAvailableKeyShards = async () => {
    setIsLoadingKeyShards(true)
    try {
      console.log('🔍 [RESTORE] ========================================')
      console.log('🔍 [RESTORE] Loading ALL available key shards from all storage services...')
      console.log('   ℹ️  Since metadata was removed for security, all shards are shown')
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
            
            // Load ALL shards from this service (no filtering by backup hash)
            console.log(`     📥 Loading ALL ${shardIds.length} shards from service`)
            
            for (const shardId of shardIds) {
              try {
                console.log(`     📥 Loading shard: ${shardId}`)
                const shardData = await storageService.getShard(shardId)
                
                // Extract shard index from shardId (format: shard_timestamp_index)
                const shardIndexMatch = shardId.match(/_(\d+)$/)
                const shardIndex = shardIndexMatch ? parseInt(shardIndexMatch[1]) : 0
                
                console.log(`       ✅ Shard loaded successfully:`)
                console.log(`          - Shard Index: ${shardIndex}`)
                console.log(`          - Data Size: ${shardData.data.length} bytes`)
                console.log(`          - Service: ${service.name}`)
                
                // Extract timestamp from shard ID for more accurate timestamp
                const timestampMatch = shardId.match(/shard_(\d+)_/)
                const shardTimestamp = timestampMatch ? new Date(parseInt(timestampMatch[1])) : new Date()
                
                allShards.push({
                  id: shardId,
                  serviceId: service.id,
                  serviceName: service.name,
                  backupId: 'unknown', // No longer available due to metadata removal
                  shardIndex: shardIndex,
                  threshold: shamirConfig.threshold,
                  totalShares: shamirConfig.totalShares,
                  timestamp: shardTimestamp,
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
      
      console.log('\n🔍 [RESTORE] ========================================')
      console.log(`🔍 [RESTORE] Search complete! Found ${allShards.length} total key shards`)
      if (allShards.length > 0) {
        // Group by service for better logging
        const shardsByService = allShards.reduce((acc, shard) => {
          if (!acc[shard.serviceId]) {
            acc[shard.serviceId] = {
              serviceName: shard.serviceName,
              shards: []
            };
          }
          acc[shard.serviceId].shards.push(shard);
          return acc;
        }, {} as Record<string, { serviceName: string; shards: typeof allShards }>);

        console.log('   📦 Available shards by storage service:')
        Object.values(shardsByService).forEach((service) => {
          console.log(`     📁 ${service.serviceName} (Local Browser IndexedDB):`)
          service.shards
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .forEach((shard, index) => {
              console.log(`       ${index + 1}. Shard ${shard.shardIndex + 1} - ${shard.timestamp.toLocaleString()}`)
            })
        })
        console.log(`   🔧 Required for restore: ${shamirConfig.threshold} shards`)
        console.log('   👆 Select shards from the organized sections below')
      } else {
        console.log('   ⚠️  No key shards found in any storage service')
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
    // Don't clear shards anymore - we show all available shards regardless of backup selection
    console.log(`🔍 [RESTORE] Selected backup: ${hash}`)
    console.log('   ℹ️  All available shards remain visible for manual selection')
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
    setShardIds([...shardIds, ''])
  }

  const removeShardField = (index: number) => {
    setShardIds(shardIds.filter((_, i) => i !== index))
  }

  const updateShardHash = (index: number, value: string) => {
    const newIds = [...shardIds]
    newIds[index] = value
    setShardIds(newIds)
  }

  const handleRestore = async () => {
    const validShards = shardIds.filter(id => id.trim())
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
          shardIds: selectedKeyShards.map(shard => shard.id), // Use shard IDs instead of hashes
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
          shardIds: validShards,
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
    <div>
      <h1>Restore Profile</h1>
      <p>Reconstruct your wallet profile from encrypted blob and key shards</p>
      
      <h2>Current Configuration</h2>
      <ul>
        <li><b>Threshold:</b> {shamirConfig.threshold} of {shamirConfig.totalShares} shares required</li>
        <li><b>Key Storage:</b> {storageBackend.type} {storageBackend.endpoint && `(${storageBackend.endpoint})`}</li>
        <li><b>Data Storage:</b> {encryptedDataStorage.type} {encryptedDataStorage.endpoint && `(${encryptedDataStorage.endpoint})`}</li>
        {safeConfig.safeAddress && (
          <li><b>Safe:</b> {safeConfig.safeAddress} (Chain {safeConfig.chainId})</li>
        )}
      </ul>
      
      {encryptedDataStorage.type === 'local-browser' && (
        <div>
          <h2>Available Encrypted Backups</h2>
          {isLoadingBackups ? (
            <p>Loading available backups...</p>
          ) : availableBackups.length > 0 ? (
            <div>
              <table border={1}>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Backup Hash</th>
                    <th>Size (bytes)</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {availableBackups.map((backup) => (
                    <tr key={backup.hash}>
                      <td>
                        <input
                          type="radio"
                          name="backup"
                          value={backup.hash}
                          checked={selectedBackup === backup.hash}
                          onChange={() => handleBackupSelect(backup.hash)}
                        />
                      </td>
                      <td><b>{backup.hash.substring(0, 16)}...</b></td>
                      <td>{backup.size}</td>
                      <td>{backup.timestamp.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p><i>No encrypted backups found in local storage</i></p>
          )}
          <button type="button" onClick={loadAvailableBackups}>Refresh List</button>
        </div>
      )}

      {storageBackend.type === 'local-browser' ? (
        <div>
          <h2>Key Shard Service List</h2>
          <p>Select <b>{shamirConfig.threshold}</b> shards from any services to try restoring:</p>
          
          {isLoadingKeyShards ? (
            <p>Loading key shards...</p>
          ) : availableKeyShards.length > 0 ? (
            <div>
              {(() => {
                // Group shards by service and sort by timestamp within each service
                const shardsByService = availableKeyShards.reduce((acc, shard) => {
                  if (!acc[shard.serviceId]) {
                    acc[shard.serviceId] = {
                      serviceName: shard.serviceName,
                      serviceId: shard.serviceId,
                      shards: []
                    };
                  }
                  acc[shard.serviceId].shards.push(shard);
                  return acc;
                }, {} as Record<string, { serviceName: string; serviceId: string; shards: typeof availableKeyShards }>);

                // Sort shards within each service by timestamp (newest first)
                Object.values(shardsByService).forEach(service => {
                  service.shards.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                });

                return Object.values(shardsByService).map((service) => (
                  <div key={service.serviceId}>
                    <table border={1} style={{ marginBottom: '20px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f0f0f0' }}>
                          <th colSpan={4}>
                            <b>{service.serviceName}</b> - Storage Type: Local Browser IndexedDB | 
                            Service ID: {service.serviceId.substring(0, 12)}... | 
                            {service.shards.length} shard{service.shards.length !== 1 ? 's' : ''} available
                          </th>
                        </tr>
                        <tr>
                          <th>Select</th>
                          <th>Shard</th>
                          <th>Shard ID</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {service.shards.map((shard) => (
                          <tr key={shard.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={shard.isSelected}
                                onChange={() => toggleShardSelection(shard.id)}
                              />
                            </td>
                            <td><b>Shard {shard.shardIndex + 1}</b></td>
                            <td><small>{shard.id}</small></td>
                            <td><small>{shard.timestamp.toLocaleString()}</small></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <p><i>No key shards found in any storage service</i></p>
          )}

          <p>
            {(() => {
              const selectedShards = availableKeyShards.filter(s => s.isSelected);
              const selectedByService = selectedShards.reduce((acc, shard) => {
                if (!acc[shard.serviceName]) acc[shard.serviceName] = 0;
                acc[shard.serviceName]++;
                return acc;
              }, {} as Record<string, number>);
              
              const serviceBreakdown = Object.entries(selectedByService)
                .map(([service, count]) => `${service} (${count})`)
                .join(', ');

              return (
                <>
                  <b>Selected: {selectedShards.length} of {shamirConfig.threshold} required for restore attempt</b>
                  {selectedShards.length > 0 && (
                    <><br /><small>From services: {serviceBreakdown}</small></>
                  )}
                </>
              );
            })()}
          </p>
        </div>
      ) : (
        <div>
          <h2>Key Shard IDs</h2>
          <p>Need {shamirConfig.threshold} of {shamirConfig.totalShares}:</p>
          {shardIds.map((id, index) => (
            <div key={index}>
              <input
                type="text"
                value={id}
                onChange={(e) => updateShardHash(index, e.target.value)}
                placeholder={`Shard ${index + 1} ID`}
              />
              {shardIds.length > 1 && (
                <button type="button" onClick={() => removeShardField(index)}>Remove</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addShardField}>Add Shard Field</button>
        </div>
      )}

      {safeConfig.safeAddress && (
        <div>
          <h2>Safe Signature (EIP-712)</h2>
          <input
            type="text"
            value={safeSignature}
            onChange={(e) => setSafeSignature(e.target.value)}
            placeholder="0x..."
          />
        </div>
      )}

      <div>
        <h2>Restore</h2>
        <button 
          onClick={handleRestore} 
          disabled={
            isLoading || 
            (storageBackend.type === 'local-browser' 
              ? availableKeyShards.filter(s => s.isSelected).length < shamirConfig.threshold
              : shardIds.filter(h => h.trim()).length < shamirConfig.threshold)
          }
        >
          {isLoading ? 'Restoring...' : 'Restore Profile'}
        </button>
      </div>

      {status && (
        <div>
          <h3>{status.type === 'error' ? 'Error' : status.type === 'success' ? 'Success' : 'Info'}</h3>
          <p>{status.message}</p>
        </div>
      )}

      {restoredProfile && (
        <div>
          <h2>Restored Profile</h2>
          <p><b>ID:</b> {restoredProfile.id}</p>
          <p><b>Name:</b> {restoredProfile.metadata.name}</p>
          <p><b>Created:</b> {restoredProfile.metadata.createdAt.toISOString()}</p>
          <p><b>Version:</b> {restoredProfile.metadata.version}</p>
          <div>
            <h3>Data</h3>
            <pre>{new TextDecoder().decode(restoredProfile.data)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}