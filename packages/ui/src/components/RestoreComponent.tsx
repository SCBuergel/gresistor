import { useState, useEffect, useRef } from 'react'
import { BackupService, RestoreRequest, ShamirConfig, KeyShardStorageBackend, EncryptedDataStorage, SafeConfig, BackupProfile } from '@gresistor/library'
import { KeyShareRegistryService, KeyShareStorageService } from '@gresistor/library'

interface RestoreComponentProps {
  shamirConfig: ShamirConfig
  keyShardStorageBackend: KeyShardStorageBackend
  encryptedDataStorage: EncryptedDataStorage
  safeConfig: SafeConfig
}

interface StoredBackup {
  hash: string
  size: number
  timestamp: Date
}

interface KeyShardInfo {
  serviceName: string
  timestamp: Date
  isSelected: boolean
  shardId: string
}

export default function RestoreComponent({ shamirConfig, keyShardStorageBackend, encryptedDataStorage, safeConfig }: RestoreComponentProps) {
  const [availableBackups, setAvailableBackups] = useState<StoredBackup[]>([])
  const [encryptedBlobHash, setEncryptedBlobHash] = useState<string>('')
  const [availableKeyShards, setAvailableKeyShards] = useState<KeyShardInfo[]>([])
  const [activeServices, setActiveServices] = useState<Array<{name: string, createdAt: Date}>>([])
  const [shardIds, setShardIds] = useState<string[]>([''])
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [restoredProfile, setRestoredProfile] = useState<BackupProfile | null>(null)
  const [safeSignature, setSafeSignature] = useState<string>('')
  
  const loadingRef = useRef(false)

  useEffect(() => {
    if (loadingRef.current) return
    loadingRef.current = true
    
    const loadData = async () => {
      if (encryptedDataStorage.type === 'local-browser') {
        await loadAvailableBackups()
      }
      if (keyShardStorageBackend.type === 'local-browser') {
        await loadAvailableKeyShards()
      }
    }
    
    loadData().finally(() => {
      loadingRef.current = false
    })
  }, [encryptedDataStorage.type, keyShardStorageBackend.type])

  const loadAvailableBackups = async () => {
    try {
      const backupService = new BackupService(shamirConfig, keyShardStorageBackend, encryptedDataStorage, undefined, safeConfig)
      const browserStorage = (backupService as any).encryptedDataStorage
      
      if (browserStorage?.listHashes) {
        const hashes = await browserStorage.listHashes()
        const backups: StoredBackup[] = []
        
        for (const hash of hashes) {
          try {
            const metadata = await browserStorage.getMetadata(hash)
            backups.push({ hash, size: metadata.size, timestamp: metadata.timestamp })
          } catch (error) {
            console.warn(`Failed to get metadata for backup ${hash}:`, error)
          }
        }
        
        backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        setAvailableBackups(backups)
      }
    } catch (error) {
      console.error('Failed to load available backups:', error)
    }
  }

  const loadAvailableKeyShards = async () => {
    try {
      const registry = new KeyShareRegistryService()
      const services = await registry.listServices()
      const activeServices = services.filter(s => s.isActive)
      
      setActiveServices(activeServices)
      
      if (activeServices.length === 0) {
        setStatus({ type: 'info', message: 'No active key shard services found. Configure key shard services in the Config tab.' })
        return
      }
      
      const allShards: KeyShardInfo[] = []
      
      for (const service of activeServices) {
        try {
          const storageService = new KeyShareStorageService(service.name)
          const shardsInService = await storageService.getAllShards()
          
          shardsInService.forEach((shard) => {
            allShards.push({
              serviceName: service.name,
              timestamp: shard.timestamp,
              isSelected: false,
              shardId: `${service.name}_${shard.timestamp.getTime()}`
            })
          })
        } catch (error) {
          console.error(`Failed to access service ${service.name}:`, error)
        }
      }
      
      setAvailableKeyShards(allShards)
    } catch (error) {
      console.error('Failed to load key shards:', error)
    }
  }

  const toggleShardSelection = (shardId: string) => {
    setAvailableKeyShards(prev => prev.map(shard => 
      shard.shardId === shardId ? { ...shard, isSelected: !shard.isSelected } : shard
    ))
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
      setStatus({ type: 'error', message: 'Please select an encrypted backup' })
      return
    }

    if (keyShardStorageBackend.type === 'local-browser') {
      if (selectedKeyShards.length < shamirConfig.threshold) {
        setStatus({ type: 'error', message: `Please select at least ${shamirConfig.threshold} key shards for decryption` })
        return
      }
    } else {
      if (validShards.length < shamirConfig.threshold) {
        setStatus({ type: 'error', message: `Please provide at least ${shamirConfig.threshold} shard hashes` })
        return
      }
    }

    setIsLoading(true)
    setRestoredProfile(null)
    setStatus({ type: 'info', message: 'Starting restore process...' })

    try {
      const backupService = new BackupService(shamirConfig, keyShardStorageBackend, encryptedDataStorage, undefined, safeConfig)
      
      // Build specific shard identifiers that include timestamps
      const shardIdentifiers = keyShardStorageBackend.type === 'local-browser' 
        ? selectedKeyShards.map(shard => `${shard.serviceName}@${shard.timestamp.getTime()}`)
        : validShards;
      
      console.log('🔧 RestoreComponent: Selected shards for restore:', selectedKeyShards.map(s => ({
        service: s.serviceName,
        timestamp: s.timestamp.toISOString(),
        shardId: s.shardId
      })));
      
      const restoreRequest: RestoreRequest = {
        encryptedBlobHash,
        shardIds: shardIdentifiers,
        requiredShards: shamirConfig.threshold,
        safeSignature: safeSignature || undefined
      }

      console.log('🔧 RestoreComponent: Restore request:', restoreRequest);

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
    <div>
      <h1>Restore Profile</h1>
      <p>Reconstruct your wallet profile from encrypted blob and key shards</p>
      
      <div>
        <h2>Current Configuration</h2>
        <ul>
          <li><b>Threshold:</b> {shamirConfig.threshold} of {shamirConfig.totalShares} shares required</li>
          <li><b>Key Shard Storage:</b> {keyShardStorageBackend.type} {keyShardStorageBackend.endpoint && `(${keyShardStorageBackend.endpoint})`}</li>
          <li><b>Encrypted Data Storage:</b> {encryptedDataStorage.type} {encryptedDataStorage.endpoint && `(${encryptedDataStorage.endpoint})`}</li>
          {safeConfig.safeAddress && <li><b>Safe:</b> {safeConfig.safeAddress} (Chain {safeConfig.chainId})</li>}
        </ul>
      </div>
      
      {encryptedDataStorage.type === 'local-browser' && (
        <div>
          <h2>Available Encrypted Backups</h2>
          {availableBackups.length > 0 ? (
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
                        checked={encryptedBlobHash === backup.hash}
                        onChange={() => setEncryptedBlobHash(backup.hash)}
                      />
                    </td>
                    <td><b>{backup.hash.substring(0, 16)}...</b></td>
                    <td>{backup.size}</td>
                    <td>{backup.timestamp.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p><i>No encrypted backups found in local storage</i></p>
          )}
          <button type="button" onClick={loadAvailableBackups}>Refresh List</button>
        </div>
      )}

      {keyShardStorageBackend.type === 'local-browser' ? (
        <div>
          <h2>Key Shard Service List</h2>
          <p>Select <b>{shamirConfig.threshold}</b> shards from any services to try restoring:</p>
          
          {activeServices.length > 0 ? (
            <div>
              <p><b>Storage Type:</b> Local Browser IndexedDB</p>
              {activeServices.map((service) => {
                const serviceShards = availableKeyShards
                  .filter(shard => shard.serviceName === service.name)
                  .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

                return (
                  <div key={service.name}>
                    <h3>📦 {service.name}</h3>
                    <p><small>Created: {service.createdAt.toLocaleString()}</small></p>
                    
                    {serviceShards.length > 0 ? (
                      <div>
                        <p><b>Available shards:</b> {serviceShards.length}</p>
                        <table border={1}>
                          <thead>
                            <tr>
                              <th>Select</th>
                              <th>Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {serviceShards.map((shard) => (
                              <tr key={shard.shardId}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={shard.isSelected}
                                    onChange={() => toggleShardSelection(shard.shardId)}
                                  />
                                </td>
                                <td>{shard.timestamp.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p><i>No shards found in this service</i></p>
                    )}
                  </div>
                );
              })}
              
              <p><b>Selected shards:</b> {availableKeyShards.filter(s => s.isSelected).length} of {shamirConfig.threshold} required</p>
              <button type="button" onClick={loadAvailableKeyShards}>Refresh Shard List</button>
            </div>
          ) : (
            <p><i>No active key shard services found. Please configure services in the Config tab.</i></p>
          )}
        </div>
      ) : (
        <div>
          <h2>Manual Shard Input</h2>
          <p>Enter the shard hashes manually for remote storage:</p>
          
          {shardIds.map((shardId, index) => (
            <div key={index}>
              <h3>Shard {index + 1}</h3>
              <input
                type="text"
                value={shardId}
                onChange={(e) => updateShardHash(index, e.target.value)}
                placeholder="Enter shard hash"
                style={{ width: '400px' }}
              />
              {shardIds.length > 1 && (
                <button type="button" onClick={() => setShardIds(shardIds.filter((_, i) => i !== index))}>Remove</button>
              )}
            </div>
          ))}
          
          <button type="button" onClick={() => setShardIds([...shardIds, ''])}>Add Another Shard</button>
        </div>
      )}

      {encryptedDataStorage.type !== 'local-browser' && (
        <div>
          <h2>Encrypted Blob Hash</h2>
          <input
            type="text"
            value={encryptedBlobHash}
            onChange={(e) => setEncryptedBlobHash(e.target.value)}
            placeholder="Enter encrypted blob hash"
            style={{ width: '400px' }}
          />
        </div>
      )}

      {safeConfig.safeAddress && (
        <div>
          <h2>Safe Signature (Optional)</h2>
          <input
            type="text"
            value={safeSignature}
            onChange={(e) => setSafeSignature(e.target.value)}
            placeholder="EIP-712 signature for Safe authentication"
            style={{ width: '400px' }}
          />
        </div>
      )}

      <div>
        <h2>Restore</h2>
        <button 
          onClick={handleRestore} 
          disabled={
            isLoading || 
            (keyShardStorageBackend.type === 'local-browser' 
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
          <p><b>Name:</b> {restoredProfile.metadata.name}</p>
          <p><b>Version:</b> {restoredProfile.metadata.version}</p>
          <p><b>Originally Created:</b> {restoredProfile.metadata.createdAt.toISOString()}</p>
          <div>
            <h3>Profile Data</h3>
            <pre>{new TextDecoder().decode(restoredProfile.data)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}