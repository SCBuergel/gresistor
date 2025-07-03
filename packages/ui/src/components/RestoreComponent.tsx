import { useState, useEffect, useRef } from 'react'
import { EncryptionService, ShamirSecretSharing, EncryptedDataStorageService, KeyShareStorageService, ShamirConfig, KeyShardStorageBackend, EncryptedDataStorage, SafeConfig, AuthData, AuthorizationType, KeyShard, StoredKeyShardData } from '@gresistor/library'
import { KeyShareRegistryService } from '@gresistor/library'

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

interface ServiceAuthInfo {
  serviceName: string
  authType: AuthorizationType
  description: string
}

interface TestProfile {
  name: string
  age: number
}

interface ServiceShards {
  serviceName: string
  shards: StoredKeyShardData[]
}

export default function RestoreComponent({ shamirConfig, keyShardStorageBackend, encryptedDataStorage, safeConfig }: RestoreComponentProps) {
  const [availableBackups, setAvailableBackups] = useState<StoredBackup[]>([])
  const [encryptedBlobHash, setEncryptedBlobHash] = useState<string>('')
  const [activeServices, setActiveServices] = useState<Array<{name: string, createdAt: Date}>>([])
  const [servicesAuthInfo, setServicesAuthInfo] = useState<ServiceAuthInfo[]>([])
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [restoredProfile, setRestoredProfile] = useState<TestProfile | null>(null)
  const [ownerAddress, setOwnerAddress] = useState<string>('123') // Default address
  const [globalSignature, setGlobalSignature] = useState<string>('246') // Default signature (123 × 2)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [serviceShards, setServiceShards] = useState<ServiceShards[]>([])
  const [selectedShards, setSelectedShards] = useState<{[serviceShardKey: string]: boolean}>({})

  const loadingRef = useRef(false)

  useEffect(() => {
    if (loadingRef.current) return
    loadingRef.current = true
    
    const loadData = async () => {
      if (encryptedDataStorage.type === 'local-browser') {
        await loadAvailableBackups()
      }
      if (keyShardStorageBackend.type === 'local-browser') {
        await loadActiveServices()
      }
    }
    
    loadData().finally(() => {
      loadingRef.current = false
    })
  }, [encryptedDataStorage.type, keyShardStorageBackend.type])

  const loadActiveServices = async () => {
    console.log('🔄 Loading active services...')
    try {
      const registry = new KeyShareRegistryService()
      const services = await registry.listServices()
      const activeServices = services.filter(s => s.isActive)
      
      setActiveServices(activeServices)
      
      if (activeServices.length === 0) {
        setStatus({ type: 'info', message: 'No active key shard services found. Configure key shard services in the Config tab.' })
        return
      }
      
      // Get auth info for each service
      const authInfoList: ServiceAuthInfo[] = []
      for (const service of activeServices) {
        try {
          const storageService = new KeyShareStorageService(service.name)
          const authConfig = await storageService.getAuthConfig()
          authInfoList.push({
            serviceName: service.name,
            authType: authConfig.authType,
            description: authConfig.description
          })
        } catch (error) {
          console.error(`❌ Failed to get auth config for service ${service.name}:`, error)
        }
      }
      
      setServicesAuthInfo(authInfoList)
    } catch (error) {
      console.error('❌ Failed to load active services:', error)
      setStatus({ type: 'error', message: `Failed to load services: ${error instanceof Error ? error.message : 'Unknown error'}` })
    }
  }

  const loadAvailableBackups = async () => {
    try {
      const encryptedDataStorageService = new EncryptedDataStorageService(encryptedDataStorage)
      
      if ((encryptedDataStorageService as any).listHashes) {
        const hashes = await (encryptedDataStorageService as any).listHashes()
        const backups: StoredBackup[] = []
        
        for (const hash of hashes) {
          try {
            const metadata = await (encryptedDataStorageService as any).getMetadata(hash)
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
      setStatus({ type: 'error', message: `Failed to load backups: ${error instanceof Error ? error.message : 'Unknown error'}` })
    }
  }

  const loadAvailableShards = async () => {
    console.log('🔄 Loading available shards from all services...')
    try {
      const authData: AuthData = {
        ownerAddress: ownerAddress.trim(),
        signature: globalSignature.trim()
      }

      const allServiceShards: ServiceShards[] = []
      
      for (const service of activeServices) {
        try {
          const storageService = new KeyShareStorageService(service.name)
          const shards = await storageService.getAllShardsWithAuth(authData)
          
          allServiceShards.push({
            serviceName: service.name,
            shards: shards.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) // Sort by newest first
          })
        } catch (error) {
          console.error(`❌ Failed to load shards from service ${service.name}:`, error)
          allServiceShards.push({
            serviceName: service.name,
            shards: []
          })
        }
      }
      
      setServiceShards(allServiceShards)
      
      // Clear previous selections
      setSelectedShards({})
      
      console.log('✅ Loaded shards from all services')
    } catch (error) {
      console.error('❌ Failed to load available shards:', error)
      setStatus({ type: 'error', message: `Failed to load shards: ${error instanceof Error ? error.message : 'Unknown error'}` })
    }
  }

  const authenticate = async () => {
    console.log('🔑 Starting authentication...')
    setAuthError(null)
    setIsAuthenticated(false)
    setServiceShards([])
    setSelectedShards({})
    
    if (!ownerAddress.trim()) {
      setAuthError('Please provide an owner address')
      return
    }

    // Check if any service requires signature authentication
    const signatureRequiredServices = servicesAuthInfo.filter(service => service.authType === 'mock-signature-2x')
    if (signatureRequiredServices.length > 0 && !globalSignature.trim()) {
      setAuthError(`Signature required for services: ${signatureRequiredServices.map(s => s.serviceName).join(', ')}`)
      return
    }
    
    try {
      // Test authentication by trying to access a service
      if (activeServices.length > 0) {
        const testService = new KeyShareStorageService(activeServices[0].name)
        const authData: AuthData = {
          ownerAddress: ownerAddress.trim(),
          signature: globalSignature.trim()
        }
        
        // Try to get shard metadata to test authentication
        await testService.getShardMetadata()
        
        setIsAuthenticated(true)
        setAuthError(null)
        setStatus({ type: 'success', message: 'Authentication successful' })
        
        // Load available shards from all services
        await loadAvailableShards()
      } else {
        setIsAuthenticated(true)
        setAuthError(null)
      }
    } catch (error) {
      console.error('❌ Authentication failed:', error)
      setAuthError(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsAuthenticated(false)
    }
  }

  const clearAuthentication = () => {
    setIsAuthenticated(false)
    setAuthError(null)
    setOwnerAddress('')
    setGlobalSignature('')
    setServiceShards([])
    setSelectedShards({})
  }

  const handleShardSelection = (serviceName: string, shardIndex: number, checked: boolean) => {
    const key = `${serviceName}-${shardIndex}`
    setSelectedShards(prev => ({
      ...prev,
      [key]: checked
    }))
  }

  const getSelectedShardsList = () => {
    const selected: Array<{serviceName: string, shard: StoredKeyShardData}> = []
    
    for (const [key, isSelected] of Object.entries(selectedShards)) {
      if (isSelected) {
        const [serviceName, shardIndexStr] = key.split('-')
        const shardIndex = parseInt(shardIndexStr)
        const serviceShardData = serviceShards.find(s => s.serviceName === serviceName)
        
        if (serviceShardData && serviceShardData.shards[shardIndex]) {
          selected.push({
            serviceName,
            shard: serviceShardData.shards[shardIndex]
          })
        }
      }
    }
    
    return selected
  }

  const canRestore = () => {
    const selectedShardsList = getSelectedShardsList()
    return encryptedBlobHash && isAuthenticated && selectedShardsList.length >= shamirConfig.threshold
  }

  const handleRestore = async () => {
    if (!canRestore()) {
      setStatus({ type: 'error', message: 'Cannot restore: missing blob hash, authentication, or insufficient shards selected' })
      return
    }

    setIsLoading(true)
    setStatus({ type: 'info', message: 'Starting restore process...' })

    try {
      // 1. Create individual services (like minimal example)
      const encryptedDataStorageService = new EncryptedDataStorageService(encryptedDataStorage)
      const encryptionService = new EncryptionService()
      const shamirService = new ShamirSecretSharing(shamirConfig)

      // 2. Manual restore orchestration (like minimal example)
      // Get encrypted blob
      const retrievedBlob = await encryptedDataStorageService.retrieve(encryptedBlobHash)
      
      // Get selected key shards
      const selectedShardsList = getSelectedShardsList()
      const retrievedShards = selectedShardsList.map((selected, index) => ({
        id: `shard_${index + 1}`,
        data: selected.shard.data,
        threshold: shamirConfig.threshold,
        totalShares: shamirConfig.totalShares
      }))

      if (retrievedShards.length < shamirConfig.threshold) {
        throw new Error(`Insufficient shards selected: ${retrievedShards.length} < ${shamirConfig.threshold}`)
      }

      // Reconstruct encryption key
      const reconstructedKey = await shamirService.reconstructSecret(retrievedShards)
      
      // Parse encrypted blob
      const blobView = new DataView(retrievedBlob.buffer)
      const ciphertextLength = blobView.getUint16(0, false)
      const nonceLength = blobView.getUint16(2, false)
      const retrievedCiphertext = retrievedBlob.slice(4, 4 + ciphertextLength)
      const retrievedNonce = retrievedBlob.slice(4 + ciphertextLength, 4 + ciphertextLength + nonceLength)
      const retrievedTag = retrievedBlob.slice(4 + ciphertextLength + nonceLength)
      
      // Decrypt profile data
      const decryptedBytes = await encryptionService.decrypt(retrievedCiphertext, reconstructedKey, retrievedNonce, retrievedTag)
      const decryptedJson = new TextDecoder().decode(decryptedBytes)
      const profile = JSON.parse(decryptedJson) as TestProfile

      setRestoredProfile(profile)
      setStatus({ type: 'success', message: 'Restore completed successfully!' })
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
      <p>Restore your profile data using individual services and manual orchestration</p>
      
      {availableBackups.length > 0 && (
        <div>
          <h2>Available Backups</h2>
          <div>
            {availableBackups.map((backup, index) => (
              <div key={index}>
                <label>
                  <input
                    type="radio"
                    name="backup"
                    value={backup.hash}
                    onChange={(e) => setEncryptedBlobHash(e.target.value)}
                  />
                  {backup.timestamp.toISOString()} ({backup.size} bytes)
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2>Encrypted Blob Hash</h2>
        <input
          type="text"
          value={encryptedBlobHash}
          onChange={(e) => setEncryptedBlobHash(e.target.value)}
          placeholder="Enter blob hash"
          style={{ width: '100%' }}
        />
      </div>

      <div>
        <h2>Authentication</h2>
        <div>
          <label>
            Owner Address:
            <input
              type="text"
              value={ownerAddress}
              onChange={(e) => setOwnerAddress(e.target.value)}
              placeholder="123"
            />
          </label>
        </div>
        <div>
          <label>
            Signature:
            <input
              type="text"
              value={globalSignature}
              onChange={(e) => setGlobalSignature(e.target.value)}
              placeholder="246"
            />
          </label>
        </div>
        <p><small>Note: For mock signature auth, signature should be address × 2</small></p>
        
        {!isAuthenticated && (
          <button onClick={authenticate} disabled={!ownerAddress.trim()}>
            Authenticate
          </button>
        )}
        
        {isAuthenticated && (
          <div>
            <p>✅ Authenticated as: {ownerAddress}</p>
            <button onClick={clearAuthentication}>Clear Authentication</button>
          </div>
        )}
        
        {authError && (
          <div>
            <p>❌ {authError}</p>
          </div>
        )}
      </div>

      {servicesAuthInfo.length > 0 && (
        <div>
          <h2>Service Authorization Requirements</h2>
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Auth Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {servicesAuthInfo.map((service, index) => (
                <tr key={index}>
                  <td>{service.serviceName}</td>
                  <td>{service.authType}</td>
                  <td>{service.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAuthenticated && serviceShards.length > 0 && (
        <div>
          <h2>Available Shards per Service</h2>
          <p>Select {shamirConfig.threshold} or more shards to restore your profile:</p>
          
          {serviceShards.map((service, serviceIndex) => (
            <div key={serviceIndex} style={{ marginBottom: '20px', border: '1px solid black', padding: '10px' }}>
              <h3>{service.serviceName}</h3>
              {service.shards.length === 0 ? (
                <p>No shards available in this service</p>
              ) : (
                <div>
                  {service.shards.map((shard, shardIndex) => (
                    <div key={shardIndex} style={{ marginBottom: '10px' }}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedShards[`${service.serviceName}-${shardIndex}`] || false}
                          onChange={(e) => handleShardSelection(service.serviceName, shardIndex, e.target.checked)}
                        />
                        Shard {shardIndex + 1} - Created: {shard.timestamp.toISOString()}
                      </label>
                      <div style={{ marginLeft: '20px', fontSize: '0.8em' }}>
                        <p>Size: {shard.data.length} bytes</p>
                        <p>Owner: {shard.authorizationAddress || 'Not specified'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          
          <p><strong>Selected: {getSelectedShardsList().length} shards (need {shamirConfig.threshold})</strong></p>
        </div>
      )}

      <div>
        <h2>Configuration</h2>
        <ul>
          <li><b>Threshold:</b> {shamirConfig.threshold} of {shamirConfig.totalShares} shares required</li>
          <li><b>Key Shard Storage:</b> {keyShardStorageBackend.type} {keyShardStorageBackend.endpoint && `(${keyShardStorageBackend.endpoint})`}</li>
          <li><b>Encrypted Data Storage:</b> {encryptedDataStorage.type} {encryptedDataStorage.endpoint && `(${encryptedDataStorage.endpoint})`}</li>
          <li><b>Active Services:</b> {activeServices.length}</li>
          <li><b>Authentication:</b> {isAuthenticated ? '✅ Authenticated' : '❌ Not authenticated'}</li>
        </ul>
      </div>

      <div>
        <h2>Restore Profile</h2>
        <button 
          onClick={handleRestore} 
          disabled={!canRestore() || isLoading}
        >
          {isLoading ? 'Restoring...' : 'Restore Profile'}
        </button>
        {!canRestore() && isAuthenticated && (
          <p>Please select {shamirConfig.threshold} or more shards to enable restore.</p>
        )}
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
          <p><b>Name:</b> {restoredProfile.name}</p>
          <p><b>Age:</b> {restoredProfile.age}</p>
        </div>
      )}
    </div>
  )
}
