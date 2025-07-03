import { useState, useEffect, useRef } from 'react'
import { BackupService, RestoreRequest, ShamirConfig, KeyShardStorageBackend, EncryptedDataStorage, SafeConfig, BackupProfile, AuthData, AuthorizationType } from '@gresistor/library'
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

interface ServiceAuthInfo {
  serviceName: string
  authType: AuthorizationType
  description: string
}

export default function RestoreComponent({ shamirConfig, keyShardStorageBackend, encryptedDataStorage, safeConfig }: RestoreComponentProps) {
  const [availableBackups, setAvailableBackups] = useState<StoredBackup[]>([])
  const [encryptedBlobHash, setEncryptedBlobHash] = useState<string>('')
  const [availableKeyShards, setAvailableKeyShards] = useState<KeyShardInfo[]>([])
  const [activeServices, setActiveServices] = useState<Array<{name: string, createdAt: Date}>>([])
  const [servicesAuthInfo, setServicesAuthInfo] = useState<ServiceAuthInfo[]>([])
  const [shardIds, setShardIds] = useState<string[]>([''])
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [restoredProfile, setRestoredProfile] = useState<BackupProfile | null>(null)
  const [safeSignature, setSafeSignature] = useState<string>('')
  const [availableShards, setAvailableShards] = useState<{ [serviceName: string]: Array<{ timestamp: Date; data: Uint8Array; authorizationAddress?: string; authType?: AuthorizationType }> }>({})
  const [selectedShards, setSelectedShards] = useState<{ [serviceName: string]: number }>({})
  const [ownerAddress, setOwnerAddress] = useState<string>('123') // Default address
  const [globalSignature, setGlobalSignature] = useState<string>('246') // Default signature (123 × 2)
  const [authSignatures, setAuthSignatures] = useState<{ [serviceName: string]: string }>({})
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  
  const loadingRef = useRef(false)

  useEffect(() => {
    if (loadingRef.current) return
    loadingRef.current = true
    
    const loadData = async () => {
      if (encryptedDataStorage.type === 'local-browser') {
        await loadAvailableBackups()
      }
      // Only load service info, not actual shards yet
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
      console.log('   Created registry service')
      
      const services = await registry.listServices()
      console.log('   Found services:', services.length, services.map(s => ({ name: s.name, isActive: s.isActive })))
      
      const activeServices = services.filter(s => s.isActive)
      console.log('   Active services:', activeServices.length, activeServices.map(s => s.name))
      
      setActiveServices(activeServices)
      
      if (activeServices.length === 0) {
        console.log('⚠️  No active services found')
        setStatus({ type: 'info', message: 'No active key shard services found. Configure key shard services in the Config tab.' })
        return
      }
      
      // Get auth info for each service
      const authInfoList: ServiceAuthInfo[] = []
      
      for (const service of activeServices) {
        console.log(`   Getting auth config for service: ${service.name}`)
        try {
          const storageService = new KeyShareStorageService(service.name)
          const authConfig = await storageService.getAuthConfig()
          console.log(`   Auth config for ${service.name}:`, authConfig)
          authInfoList.push({
            serviceName: service.name,
            authType: authConfig.authType,
            description: authConfig.description
          })
        } catch (error) {
          console.error(`❌ Failed to get auth config for service ${service.name}:`, error)
        }
      }
      
      console.log('✅ Auth info loaded:', authInfoList)
      setServicesAuthInfo(authInfoList)
    } catch (error) {
      console.error('❌ Failed to load active services:', error)
      setStatus({ type: 'error', message: `Failed to load services: ${error instanceof Error ? error.message : 'Unknown error'}` })
    }
  }

  const authenticate = async () => {
    console.log('🔑 Starting authentication...')
    setAuthError(null)
    setIsAuthenticated(false)
    setAvailableShards({}) // Clear previous shards
    
    if (!ownerAddress.trim()) {
      console.log('❌ No owner address provided')
      setAuthError('Please provide an owner address')
      return
    }

    // Check if any service requires signature authentication
    const signatureRequiredServices = servicesAuthInfo.filter(service => service.authType === 'mock-signature-2x')
    if (signatureRequiredServices.length > 0 && !globalSignature.trim()) {
      console.log('❌ Signature required but not provided')
      console.log('   Services requiring signature:', signatureRequiredServices.map(s => s.serviceName))
      setAuthError(`Signature required for services: ${signatureRequiredServices.map(s => s.serviceName).join(', ')}`)
      return
    }
    
    console.log('✅ Credentials provided:')
    console.log('   Owner address:', ownerAddress.trim())
    console.log('   Global signature:', globalSignature.trim() || 'none')
    console.log('📋 Active services found:', activeServices.length)
    console.log('📋 Services:', activeServices.map(s => s.name))
    console.log('📋 Services auth info:', servicesAuthInfo.map(s => ({ name: s.serviceName, auth: s.authType })))
    
    // Test authentication by trying to load shards
    console.log('🔄 Testing authentication by loading shards...')
    try {
      await loadAvailableShards(true)
      
      // Check if we actually got shards (authentication successful)
      const totalShards = Object.values(availableShards).reduce((sum, shards) => sum + shards.length, 0)
      if (totalShards > 0) {
        console.log('✅ Authentication successful - shards loaded')
        setIsAuthenticated(true)
        setAuthError(null)
      } else {
        console.log('⚠️  Authentication completed but no shards found')
        setIsAuthenticated(true) // Still consider authenticated, just no data
        setAuthError(null)
      }
    } catch (error) {
      console.error('❌ Authentication failed:', error)
      setAuthError(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsAuthenticated(false)
    }
  }

  const clearAuthentication = () => {
    console.log('🔓 Clearing authentication...')
    setIsAuthenticated(false)
    setAvailableShards({})
    setSelectedShards({})
    setAuthError(null)
    setOwnerAddress('')
    setGlobalSignature('')
  }

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
      setServicesAuthInfo(authInfoList)
    } catch (error) {
      console.error('Failed to load key shards:', error)
    }
  }

  const loadAvailableShards = async (forceAuthenticated?: boolean) => {
    const authenticated = forceAuthenticated ?? isAuthenticated
    console.log('🔍 loadAvailableShards called - checking conditions...')
    console.log('   isAuthenticated (state):', isAuthenticated)
    console.log('   forceAuthenticated (param):', forceAuthenticated)
    console.log('   authenticated (final):', authenticated)
    console.log('   ownerAddress:', ownerAddress.trim())
    console.log('   keyShardStorageBackend.type:', keyShardStorageBackend.type)
    
    if (!authenticated || !ownerAddress.trim()) {
      console.log('❌ Authentication check failed')
      setStatus({ type: 'error', message: 'Authentication required before loading shards' })
      return
    }
    
    try {
      console.log('🔄 Loading available shards with authentication...')
      console.log('📋 Active services before loading:', activeServices.length, activeServices.map(s => s.name))
      
      if (keyShardStorageBackend.type === 'local-browser') {
        console.log('💾 Using local-browser storage')
        
        const shardsByService: { [serviceName: string]: Array<{ timestamp: Date; data: Uint8Array; authorizationAddress?: string; authType?: AuthorizationType }> } = {}
        
        for (const service of activeServices) {
          console.log(`\n🔧 Processing service: "${service.name}"`)
          try {
            const storageService = new KeyShareStorageService(service.name)
            console.log(`   Created storage service for "${service.name}"`)
            
            // Get service auth configuration
            const authConfig = await storageService.getAuthConfig()
            console.log(`   Auth config for "${service.name}":`, authConfig)
            
            // Create proper auth data with user-provided information
            const authData: AuthData = {
              ownerAddress: ownerAddress.trim(),
              signature: authConfig.authType === 'mock-signature-2x' ? globalSignature.trim() : undefined
            }
            console.log(`   Auth data for "${service.name}":`, authData)
            
            // Load shards with proper authorization
            console.log(`   Calling getAllShardsWithAuth for "${service.name}"...`)
            const shards = await storageService.getAllShardsWithAuth(authData)
            console.log(`✅ Found ${shards.length} shards in service "${service.name}" (auth: ${authConfig.authType})`)
            
            if (shards.length > 0) {
              console.log(`   Shard details for "${service.name}":`, shards.map(s => ({
                timestamp: s.timestamp.toISOString(),
                dataSize: s.data.length,
                authAddress: s.authorizationAddress
              })))
            }
            
            shardsByService[service.name] = shards.sort((a: { timestamp: Date }, b: { timestamp: Date }) => b.timestamp.getTime() - a.timestamp.getTime())
          } catch (error) {
            console.error(`❌ Failed to load shards from service "${service.name}":`, error)
            console.error(`   Error details:`, error instanceof Error ? {
              message: error.message,
              name: error.name,
              stack: error.stack?.split('\n').slice(0, 3)
            } : error)
            setStatus({ type: 'error', message: `Failed to authenticate with service "${service.name}": ${error instanceof Error ? error.message : 'Unknown error'}` })
            shardsByService[service.name] = []
          }
        }
        
        console.log('\n📊 Final shards by service:', Object.fromEntries(
          Object.entries(shardsByService).map(([name, shards]) => [
            name, 
            `${shards.length} shards`
          ])
        ))
        
        setAvailableShards(shardsByService)
        
        const totalShards = Object.values(shardsByService).reduce((sum, shards) => sum + shards.length, 0)
        console.log(`🎯 Total shards loaded: ${totalShards}`)
        
        if (totalShards > 0) {
          setStatus({ type: 'success', message: `Successfully authenticated and loaded ${totalShards} shards from ${Object.keys(shardsByService).length} services` })
        } else {
          setStatus({ type: 'info', message: 'No shards found in any service. Create a backup first.' })
        }
      }
    } catch (error) {
      console.error('❌ Failed to load available shards:', error)
      setStatus({ type: 'error', message: `Failed to load shards: ${error instanceof Error ? error.message : 'Unknown error'}` })
    }
  }

  const getServiceAuthType = (serviceName: string): AuthorizationType => {
    const authInfo = servicesAuthInfo.find(info => info.serviceName === serviceName)
    return authInfo?.authType || 'no-auth'
  }

  const handleShardSelection = (serviceName: string, timestamp: number) => {
    setSelectedShards(prev => {
      // If the same shard is clicked again, unselect it
      if (prev[serviceName] === timestamp) {
        const updated = { ...prev }
        delete updated[serviceName]
        return updated
      }
      // Otherwise, select the new shard
      return {
        ...prev,
        [serviceName]: timestamp
      }
    })
    
    // Use global signature for all services requiring signatures
    const authType = getServiceAuthType(serviceName)
    if (authType === 'mock-signature-2x') {
      setAuthSignatures(prev => ({
        ...prev,
        [serviceName]: globalSignature
      }))
    } else {
      // Remove signature if no signature auth required
      setAuthSignatures(prev => {
        const updated = { ...prev }
        delete updated[serviceName]
        return updated
      })
    }
  }



  const getSelectedShardsCount = () => {
    return Object.keys(selectedShards).length
  }

  const canRestore = () => {
    // Must be authenticated first
    if (!isAuthenticated) {
      return false
    }
    
    const selectedCount = getSelectedShardsCount()
    if (selectedCount < shamirConfig.threshold) {
      return false
    }
    
    if (!ownerAddress.trim()) {
      return false
    }

    // Check if we have a backup available (either selected or automatic)
    if (!encryptedBlobHash && availableBackups.length === 0) {
      return false
    }
    
    // Check if any selected service requires signature and we have it
    const selectedServiceNames = Object.keys(selectedShards)
    const signatureRequiredServices = selectedServiceNames.filter(serviceName => {
      const authType = getServiceAuthType(serviceName)
      return authType === 'mock-signature-2x'
    })
    
    if (signatureRequiredServices.length > 0 && !globalSignature.trim()) {
      return false
    }
    
    return true
  }

  const handleRestore = async () => {
    const selectedCount = getSelectedShardsCount()
    if (selectedCount < shamirConfig.threshold) {
      setStatus({ type: 'error', message: `Need at least ${shamirConfig.threshold} shards, but only ${selectedCount} selected` })
      return
    }

    if (!ownerAddress.trim()) {
      setStatus({ type: 'error', message: 'Please provide an owner address for authorization' })
      return
    }

    // Check if we have available backups and use the most recent one
    let selectedBackupHash = encryptedBlobHash
    if (!selectedBackupHash && availableBackups.length > 0) {
      selectedBackupHash = availableBackups[0].hash // Most recent backup (sorted by timestamp)
      console.log(`🔧 Using most recent backup: ${selectedBackupHash}`)
    }

    if (!selectedBackupHash) {
      setStatus({ type: 'error', message: 'No backup selected and no available backups found' })
      return
    }

    setIsLoading(true)
    setRestoredProfile(null) // Clear previous results
    setStatus({ type: 'info', message: 'Starting restore process...' })

    try {
      const backupService = new BackupService(shamirConfig, keyShardStorageBackend, encryptedDataStorage, undefined, safeConfig)
      
      // Build shard IDs with timestamps and prepare auth data
      const shardIds: string[] = []
      const signatures: { [serviceName: string]: string } = {}
      
      for (const [serviceName, timestamp] of Object.entries(selectedShards)) {
        shardIds.push(`${serviceName}@${timestamp}`)
        
        // Include signature if the service requires signature-based auth
        const authType = getServiceAuthType(serviceName)
        if (authType === 'mock-signature-2x') {
          const signature = authSignatures[serviceName]
          if (signature) {
            signatures[serviceName] = signature.trim()
          }
        }
      }
      
      // Create auth data using global signature
      const authData: AuthData = {
        ownerAddress: ownerAddress.trim(),
        signature: globalSignature.trim() || undefined
      }
      
      console.log('Restore request:', {
        encryptedBlobHash: selectedBackupHash,
        shardIds,
        requiredShards: shamirConfig.threshold,
        authData,
        authorizationSignatures: signatures
      })

      const restoreRequest: RestoreRequest = {
        encryptedBlobHash: selectedBackupHash,
        shardIds,
        requiredShards: shamirConfig.threshold,
        authData,
        authorizationSignatures: signatures // Keep for backwards compatibility
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

  const addShardField = () => {
    setShardIds(prev => [...prev, ''])
  }

  const removeShardField = (index: number) => {
    if (shardIds.length > 1) {
      setShardIds(prev => prev.filter((_, i) => i !== index))
    }
  }

  return (
    <div>
      <h1>Restore Profile</h1>
      <p>Select {shamirConfig.threshold} or more key shards to restore your encrypted profile</p>

      <div>
        <h2>Authentication {isAuthenticated ? '✓' : 'Required'}</h2>
        <p>{isAuthenticated ? 'Authenticated and ready to view shards.' : 'You must authenticate before viewing available key shards.'}</p>
        
        <div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Owner Address: 
              <input
                type="text"
                value={ownerAddress}
                onChange={(e) => setOwnerAddress(e.target.value)}
                placeholder="Enter your authorization address (e.g., 123)"
                style={{ marginLeft: '5px', width: '200px' }}
              />
            </label>
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <label>
              Mock Signature: 
              <input
                type="text"
                value={globalSignature}
                onChange={(e) => setGlobalSignature(e.target.value)}
                placeholder="Enter signature (e.g., for address 123, signature is 246)"
                style={{ marginLeft: '5px', width: '300px' }}
              />
            </label>
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <button 
              onClick={authenticate} 
              disabled={isLoading || !ownerAddress.trim()}
              style={{ marginRight: '10px' }}
            >
              {isAuthenticated ? 'Re-Authenticate' : 'Authenticate & Load Shards'}
            </button>
            
            {isAuthenticated && (
              <button onClick={clearAuthentication} style={{ marginRight: '10px' }}>
                Clear Authentication
              </button>
            )}
          </div>
          
          {authError && (
            <div style={{ marginBottom: '10px', padding: '5px', border: '1px solid black' }}>
              <strong>Authentication Error:</strong> {authError}
            </div>
          )}
          
          {isAuthenticated && (
            <div style={{ marginBottom: '10px', padding: '5px', border: '1px solid black' }}>
              <strong>✓ Authenticated:</strong> Address: {ownerAddress}, Signature: {globalSignature || 'none'}
            </div>
          )}
          
          <div style={{ fontSize: '12px' }}>
            <p><strong>Testing Tips:</strong></p>
            <ul>
              <li>For address "123", correct signature is "246" (123 × 2)</li>
              <li>Try wrong signatures to test authentication failure</li>
              <li>Use "Clear Authentication" to reset and test again</li>
              <li>Services with "no-auth" only need an address</li>
            </ul>
          </div>
        </div>
        
        {servicesAuthInfo.length > 0 && (
          <div>
            <h3>Service Authorization Requirements</h3>
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Auth Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {servicesAuthInfo.map(info => (
                  <tr key={info.serviceName}>
                    <td>{info.serviceName}</td>
                    <td>{info.authType}</td>
                    <td>{info.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2>Available Backups</h2>
        {availableBackups.length === 0 ? (
          <p>No backups found. Create a backup first.</p>
        ) : (
          <div>
            <p>Select a backup to restore from:</p>
            {availableBackups.map((backup, index) => (
              <div key={backup.hash} style={{ marginBottom: '10px', padding: '10px', border: encryptedBlobHash === backup.hash ? '2px solid black' : '1px solid black' }}>
                <label>
                  <input
                    type="radio"
                    name="backup-selection"
                    checked={encryptedBlobHash === backup.hash}
                    onChange={() => setEncryptedBlobHash(backup.hash)}
                  />
                  {' '}Backup {index + 1}: {backup.timestamp.toLocaleDateString()} {backup.timestamp.toLocaleTimeString()}
                </label>
                <div>
                  <small>Hash: {backup.hash.substring(0, 16)}...</small>
                  <br />
                  <small>Size: {backup.size} bytes</small>
                </div>
              </div>
            ))}
            {!encryptedBlobHash && (
              <div style={{ marginTop: '5px' }}>
                <small>💡 If no backup is selected, the most recent backup will be used automatically.</small>
              </div>
            )}
          </div>
        )}
      </div>

      {isAuthenticated && (
        <div>
          <h2>Available Key Shards</h2>
          <p>Select {shamirConfig.threshold} of {shamirConfig.totalShares} shards (showing latest backups first):</p>
          
          {Object.keys(availableShards).length === 0 ? (
            <p>No key shards found. Create a backup first.</p>
          ) : (
          Object.entries(availableShards).map(([serviceName, shards]) => {
            const authType = getServiceAuthType(serviceName)
            const authInfo = servicesAuthInfo.find(info => info.serviceName === serviceName)
            
            return (
              <div key={serviceName}>
                <h3>{serviceName} ({shards.length} shards available) - {authInfo?.description || 'Unknown auth'}</h3>
                {shards.length === 0 ? (
                  <p>No shards in this service</p>
                ) : (
                  shards.map((shard, index) => {
                    const timestamp = shard.timestamp.getTime()
                    const isSelected = selectedShards[serviceName] === timestamp
                    const needsSignature = authType === 'mock-signature-2x'
                    const hasValidSignature = !needsSignature || (authSignatures[serviceName]?.trim() !== '')
                    
                    return (
                      <div key={timestamp} style={{ marginBottom: '10px', padding: '10px', border: isSelected ? '2px solid black' : '1px solid black' }}>
                        <label>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleShardSelection(serviceName, timestamp)}
                          />
                          {' '}Shard {index + 1}: {shard.timestamp.toLocaleDateString()} {shard.timestamp.toLocaleTimeString()}
                        </label>
                        
                        <div>
                          <small>Size: {shard.data.length} bytes</small>
                          {shard.authorizationAddress && (
                            <>
                              <br />
                              <small>🔐 Authorization Address: {shard.authorizationAddress}</small>
                            </>
                          )}
                        </div>
                        
                        {needsSignature && (
                          <div style={{ marginTop: '5px', fontSize: '12px' }}>
                            🔐 Requires signature authentication (using global signature: {globalSignature || 'none provided'})
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )
          })
        )}
        </div>
      )}

      {isAuthenticated && (
        <div>
          <h2>Selection Summary</h2>
          <p><b>Owner Address:</b> {ownerAddress || 'not set'}</p>
          <p><b>Selected Shards:</b> {getSelectedShardsCount()} of {shamirConfig.threshold} required</p>
        
        {Object.entries(selectedShards).length > 0 && (
          <div>
            <h3>Selected Shard Details</h3>
            {Object.entries(selectedShards).map(([serviceName, timestamp]) => {
              const shard = availableShards[serviceName]?.find(s => s.timestamp.getTime() === timestamp)
              const authType = getServiceAuthType(serviceName)
              
              return (
                <div key={serviceName} style={{ marginBottom: '5px', padding: '5px', border: '1px solid black' }}>
                  <b>{serviceName}:</b> {new Date(timestamp).toLocaleString()}
                  <br />
                  <small>Auth Type: {authType}</small>
                  {authType === 'mock-signature-2x' && (
                    <>
                      <br />
                      <small>🔐 Using Global Signature: {globalSignature || 'none provided'}</small>
                    </>
                  )}
                  <br />
                  <small>Data Size: {shard?.data.length || 0} bytes</small>
                </div>
              )
            })}
          </div>
        )}
        </div>
      )}

      {isAuthenticated && (
        <div>
          <h2>Restore Profile</h2>
          <button 
            onClick={handleRestore} 
            disabled={isLoading || !canRestore()}
          >
            {isLoading ? 'Restoring...' : `Restore with ${getSelectedShardsCount()} Shards`}
          </button>
          
          {!canRestore() && (
            <p>
              {!isAuthenticated 
                ? 'Please authenticate first'
                : !ownerAddress.trim() 
                  ? 'Please provide an owner address' 
                  : getSelectedShardsCount() < shamirConfig.threshold 
                    ? `Need ${shamirConfig.threshold - getSelectedShardsCount()} more shards (selected: ${getSelectedShardsCount()})`
                    : !encryptedBlobHash && availableBackups.length === 0
                      ? 'No backups available to restore from'
                      : 'Missing global signature for services that require authentication'
              }
            </p>
          )}
        </div>
      )}

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
          <p><b>Created:</b> {restoredProfile.metadata.createdAt.toLocaleString()}</p>
          <p><b>Version:</b> {restoredProfile.metadata.version}</p>
          
          <h3>Profile Data</h3>
          <textarea 
            value={new TextDecoder().decode(restoredProfile.data)} 
            readOnly 
            rows={10} 
            cols={80}
          />
        </div>
      )}
    </div>
  )
}
