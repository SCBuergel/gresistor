import { useState, useEffect } from 'react'
import { EncryptionService, ShamirSecretSharing, EncryptedDataStorageService, KeyShareStorageService, KeyShareRegistryService, ShamirConfig, KeyShardStorageBackend, EncryptedDataStorage, SafeConfig, AuthData, AuthorizationType } from '@gresistor/library'

// Default values - simplified profile like minimal example
const DEFAULT_PROFILE_NAME = 'Alice Johnson'
const DEFAULT_PROFILE_AGE = 28

interface BackupComponentProps {
  shamirConfig: ShamirConfig
  keyShardStorageBackend: KeyShardStorageBackend
  encryptedDataStorage: EncryptedDataStorage
  safeConfig: SafeConfig
}

interface TestProfile {
  name: string
  age: number
}

interface ServiceInfo {
  serviceName: string
  authType: AuthorizationType
  description: string
  isSelected: boolean
  isAuthenticated: boolean
  authData?: AuthData
  authError?: string
}

export default function BackupComponent({ shamirConfig, keyShardStorageBackend, encryptedDataStorage, safeConfig }: BackupComponentProps) {
  const [profileName, setProfileName] = useState('')
  const [profileAge, setProfileAge] = useState(28)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const [backupResult, setBackupResult] = useState<any>(null)
  const [allServices, setAllServices] = useState<ServiceInfo[]>([])
  const [servicesLoaded, setServicesLoaded] = useState(false)
  
  // Per-service authentication data
  const [noAuthData, setNoAuthData] = useState<{ownerAddress: string}>({ownerAddress: '123'})
  const [mockSigData, setMockSigData] = useState<{ownerAddress: string, signature: string}>({ownerAddress: '123', signature: '246'})

  useEffect(() => {
    setProfileName(DEFAULT_PROFILE_NAME);
    setProfileAge(DEFAULT_PROFILE_AGE);
  }, []);

  useEffect(() => {
    if (keyShardStorageBackend.type === 'local-browser') {
      loadAllServices()
    }
  }, [keyShardStorageBackend.type])

  const loadAllServices = async () => {
    try {
      const registry = new KeyShareRegistryService()
      const services = await registry.listServices()
      const activeServices = services.filter(s => s.isActive)
      
      // Load auth info for each service
      const serviceInfoList: ServiceInfo[] = []
      for (const service of activeServices) {
        try {
          const storageService = new KeyShareStorageService(service.name)
          const authConfig = await storageService.getAuthConfig()
          serviceInfoList.push({
            serviceName: service.name,
            authType: authConfig.authType,
            description: authConfig.description,
            isSelected: false,
            isAuthenticated: false
          })
        } catch (error) {
          console.error(`❌ Failed to get auth config for service ${service.name}:`, error)
        }
      }
      
      setAllServices(serviceInfoList)
      setServicesLoaded(true)
      
      if (serviceInfoList.length === 0) {
        setStatus({ type: 'info', message: 'No active key shard services found. Configure key shard services in the Config tab.' })
      }
    } catch (error) {
      console.error('❌ Failed to load services:', error)
      setStatus({ type: 'error', message: `Failed to load services: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setServicesLoaded(true)
    }
  }

  const toggleServiceSelection = (serviceName: string) => {
    setAllServices(prev => {
      const updated = prev.map(s => 
        s.serviceName === serviceName 
          ? { ...s, isSelected: !s.isSelected, isAuthenticated: false, authData: undefined, authError: undefined }
          : s
      )
      
      // If deselecting, clear authentication
      const service = updated.find(s => s.serviceName === serviceName)
      if (service && !service.isSelected) {
        // Service was deselected, clear its authentication
        return updated
      }
      
      return updated
    })
  }

  const authenticateService = async (serviceName: string) => {
    console.log(`🔑 Authenticating service: ${serviceName}...`)
    
    const serviceInfo = allServices.find(s => s.serviceName === serviceName)
    if (!serviceInfo) return
    
    try {
      const storageService = new KeyShareStorageService(serviceName)
      let authData: AuthData
      
      // Get auth data based on service type
      if (serviceInfo.authType === 'no-auth') {
        authData = {
          ownerAddress: noAuthData.ownerAddress.trim(),
          signature: ''
        }
      } else if (serviceInfo.authType === 'mock-signature-2x') {
        if (!mockSigData.ownerAddress.trim() || !mockSigData.signature.trim()) {
          throw new Error('Owner address and signature required for mock-signature-2x')
        }
        authData = {
          ownerAddress: mockSigData.ownerAddress.trim(),
          signature: mockSigData.signature.trim()
        }
      } else {
        throw new Error(`Unknown auth type: ${serviceInfo.authType}`)
      }
      
      // Test authentication by trying to get shard metadata
      await storageService.getShardMetadata()
      
      // Update service auth status
      setAllServices(prev => prev.map(s => 
        s.serviceName === serviceName 
          ? { ...s, isAuthenticated: true, authData, authError: undefined }
          : s
      ))
      
      console.log(`✅ Authentication successful for service: ${serviceName}`)
      
    } catch (error) {
      console.error(`❌ Authentication failed for service ${serviceName}:`, error)
      setAllServices(prev => prev.map(s => 
        s.serviceName === serviceName 
          ? { ...s, isAuthenticated: false, authError: error instanceof Error ? error.message : 'Unknown error' }
          : s
      ))
    }
  }

  const clearServiceAuthentication = (serviceName: string) => {
    setAllServices(prev => prev.map(s => 
      s.serviceName === serviceName 
        ? { ...s, isAuthenticated: false, authData: undefined, authError: undefined }
        : s
    ))
  }

  const getSelectedServices = () => allServices.filter(s => s.isSelected)
  const getAuthenticatedSelectedServices = () => allServices.filter(s => s.isSelected && s.isAuthenticated)
  
  const canCreateBackup = () => {
    const selectedServices = getSelectedServices()
    const authenticatedServices = getAuthenticatedSelectedServices()
    
    return profileName.trim() && 
           profileAge > 0 && 
           servicesLoaded && 
           selectedServices.length === shamirConfig.totalShares &&
           authenticatedServices.length === shamirConfig.totalShares
  }

  const handleBackup = async () => {
    if (!canCreateBackup()) {
      setStatus({ type: 'error', message: 'Cannot create backup: missing profile data or insufficient authenticated services' })
      return
    }

    setIsLoading(true)
    setStatus({ type: 'info', message: 'Starting backup process...' })

    try {
      // 1. Create individual services (like minimal example)
      const encryptedDataStorageService = new EncryptedDataStorageService(encryptedDataStorage)
      const encryptionService = new EncryptionService()
      const shamirService = new ShamirSecretSharing(shamirConfig)

      // Get authenticated selected services
      const selectedServices = getAuthenticatedSelectedServices()
      const keyShardServices = selectedServices.map(s => new KeyShareStorageService(s.serviceName))

      // 2. Create test profile (simple like minimal example)
      const testProfile: TestProfile = {
        name: profileName,
        age: profileAge
      }

      // 3. Manual backup orchestration (like minimal example)
      const encryptionKey = await encryptionService.generateKey()
      const profileJson = JSON.stringify(testProfile)
      const profileBytes = new TextEncoder().encode(profileJson)
      const { ciphertext, nonce, tag } = await encryptionService.encrypt(profileBytes, encryptionKey)
      
      // Create encrypted blob
      const encryptedBlob = new Uint8Array(ciphertext.length + nonce.length + tag.length + 4)
      const view = new DataView(encryptedBlob.buffer)
      view.setUint16(0, ciphertext.length, false)
      view.setUint16(2, nonce.length, false)
      encryptedBlob.set(ciphertext, 4)
      encryptedBlob.set(nonce, 4 + ciphertext.length)
      encryptedBlob.set(tag, 4 + ciphertext.length + nonce.length)
      
      // Store encrypted blob
      const blobHash = await encryptedDataStorageService.store(encryptedBlob)
      
      // Split encryption key
      const keyShards = await shamirService.splitSecret(encryptionKey)
      
      // Store shards in services with authorization
      const serviceNames = []
      const shardsHex = []
      const authAddresses = []
      for (let i = 0; i < keyShards.length; i++) {
        const service = keyShardServices[i]
        const serviceInfo = selectedServices[i]
        const shard = keyShards[i]
        
        // Use the stored auth data for this service
        const authorizationAddr = serviceInfo.authData?.ownerAddress
        
        await service.storeShard(shard.data, authorizationAddr)
        
        serviceNames.push(serviceInfo.serviceName)
        shardsHex.push(Array.from(shard.data).map(b => b.toString(16).padStart(2, '0')).join(''))
        authAddresses.push(authorizationAddr || 'none')
      }

      // Create result object for display
      const result = {
        metadata: {
          timestamp: new Date()
        },
        cryptoDetails: {
          encryptedDataHex: Array.from(encryptedBlob).map(b => b.toString(16).padStart(2, '0')).join(''),
          encryptionKeyHex: Array.from(encryptionKey).map(b => b.toString(16).padStart(2, '0')).join(''),
          shardsHex: shardsHex,
          serviceNames: serviceNames
        },
        authAddresses: authAddresses,
        blobHash: blobHash,
        selectedServices: selectedServices.map(s => ({
          name: s.serviceName,
          authType: s.authType,
          authData: s.authData
        }))
      }

      setBackupResult(result)
      setStatus({ type: 'success', message: 'Backup completed successfully!' })
    } catch (error) {
      console.error('Backup failed:', error)
      setStatus({ type: 'error', message: `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}` })
    } finally {
      setIsLoading(false)
    }
  }

  // Group services by auth type
  const servicesByAuthType = allServices.reduce((acc, service) => {
    if (!acc[service.authType]) {
      acc[service.authType] = []
    }
    acc[service.authType].push(service)
    return acc
  }, {} as Record<AuthorizationType, ServiceInfo[]>)

  const selectedCount = getSelectedServices().length
  const authenticatedCount = getAuthenticatedSelectedServices().length

  return (
    <div>
      <h1>Create Backup</h1>
      <p>Encrypt and split your profile data using individual services and manual orchestration</p>
      
      <div>
        <h2>Profile Name</h2>
        <input
          type="text"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          placeholder="Alice Johnson"
        />
      </div>

      <div>
        <h2>Profile Age</h2>
        <input
          type="number"
          value={profileAge}
          onChange={(e) => setProfileAge(parseInt(e.target.value) || 0)}
          min="0"
          max="150"
        />
      </div>

      <div>
        <h2>Service Selection</h2>
        <p>Select exactly {shamirConfig.totalShares} services to store your key shards:</p>
        
        {!servicesLoaded ? (
          <p>Loading services...</p>
        ) : allServices.length === 0 ? (
          <p>No active key shard services found. Configure services in the Config tab.</p>
        ) : (
          <div>
            <p><strong>Selected: {selectedCount} / {shamirConfig.totalShares} services</strong></p>
            
            {Object.entries(servicesByAuthType).map(([authType, services]) => (
              <div key={authType} style={{ marginBottom: '30px', border: '1px solid black', padding: '15px' }}>
                <h3>{authType === 'no-auth' ? 'No Authentication Required' : authType === 'mock-signature-2x' ? 'Mock Signature Authentication (×2)' : authType}</h3>
                
                {authType === 'no-auth' && (
                  <div style={{ marginBottom: '15px' }}>
                    <label>
                      Owner Address:
                      <input
                        type="text"
                        value={noAuthData.ownerAddress}
                        onChange={(e) => setNoAuthData({...noAuthData, ownerAddress: e.target.value})}
                        placeholder="123"
                      />
                    </label>
                    <p><small>Only owner address required for no-auth services</small></p>
                  </div>
                )}
                
                {authType === 'mock-signature-2x' && (
                  <div style={{ marginBottom: '15px' }}>
                    <div>
                      <label>
                        Owner Address:
                        <input
                          type="text"
                          value={mockSigData.ownerAddress}
                          onChange={(e) => setMockSigData({...mockSigData, ownerAddress: e.target.value})}
                          placeholder="123"
                        />
                      </label>
                    </div>
                    <div>
                      <label>
                        Signature:
                        <input
                          type="text"
                          value={mockSigData.signature}
                          onChange={(e) => setMockSigData({...mockSigData, signature: e.target.value})}
                          placeholder="246"
                        />
                      </label>
                    </div>
                    <p><small>Signature should be address × 2 (e.g., 123 × 2 = 246)</small></p>
                  </div>
                )}
                
                <h4>Available services using {authType}:</h4>
                {services.map(service => (
                  <div key={service.serviceName} style={{ marginBottom: '15px', padding: '10px', border: `2px solid ${service.isSelected ? 'black' : 'gray'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <button 
                        onClick={() => toggleServiceSelection(service.serviceName)}
                        disabled={!service.isSelected && selectedCount >= shamirConfig.totalShares}
                        style={{ 
                          padding: '5px 10px',
                          backgroundColor: service.isSelected ? 'black' : 'white',
                          color: service.isSelected ? 'white' : 'black',
                          border: '1px solid black'
                        }}
                      >
                        {service.isSelected ? 'Deselect' : 'Select'}
                      </button>
                      <strong>{service.serviceName}</strong>
                      {service.isSelected && (
                        <span>
                          {service.isAuthenticated ? '✅ Selected & Authenticated' : '❌ Selected but not authenticated'}
                        </span>
                      )}
                    </div>
                    
                    <div style={{ fontSize: '0.9em', marginBottom: '10px' }}>
                      {service.description}
                    </div>
                    
                    {service.isSelected && (
                      <div>
                        {!service.isAuthenticated ? (
                          <button onClick={() => authenticateService(service.serviceName)}>
                            Authenticate
                          </button>
                        ) : (
                          <button onClick={() => clearServiceAuthentication(service.serviceName)}>
                            Clear Authentication
                          </button>
                        )}
                        
                        {service.authError && (
                          <div style={{ marginTop: '5px' }}>
                            <p>❌ {service.authError}</p>
                          </div>
                        )}
                        
                        {service.isAuthenticated && service.authData && (
                          <div style={{ marginTop: '5px', fontSize: '0.8em' }}>
                            <p>Authenticated with: {service.authData.ownerAddress}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2>Configuration</h2>
        <ul>
          <li><b>Threshold:</b> {shamirConfig.threshold} of {shamirConfig.totalShares} shares required</li>
          <li><b>Key Shard Storage:</b> {keyShardStorageBackend.type} {keyShardStorageBackend.endpoint && `(${keyShardStorageBackend.endpoint})`}</li>
          <li><b>Encrypted Data Storage:</b> {encryptedDataStorage.type} {encryptedDataStorage.endpoint && `(${encryptedDataStorage.endpoint})`}</li>
          <li><b>Available Services:</b> {allServices.length}</li>
          <li><b>Selected Services:</b> {selectedCount} / {shamirConfig.totalShares}</li>
          <li><b>Authenticated Services:</b> {authenticatedCount} / {selectedCount}</li>
          {safeConfig.safeAddress && <li><b>Safe:</b> {safeConfig.safeAddress}</li>}
        </ul>
      </div>

      <div>
        <h2>Create Backup</h2>
        <button 
          onClick={handleBackup} 
          disabled={!canCreateBackup() || isLoading}
        >
          {isLoading ? 'Creating Backup...' : 'Create Backup'}
        </button>
        {!canCreateBackup() && servicesLoaded && (
          <div>
            {!profileName.trim() && <p>❌ Please provide a profile name</p>}
            {profileAge <= 0 && <p>❌ Please provide a valid age</p>}
            {selectedCount < shamirConfig.totalShares && <p>❌ Please select exactly {shamirConfig.totalShares} services</p>}
            {selectedCount > shamirConfig.totalShares && <p>❌ Too many services selected ({selectedCount}), need exactly {shamirConfig.totalShares}</p>}
            {selectedCount === shamirConfig.totalShares && authenticatedCount < selectedCount && <p>❌ Please authenticate with all selected services ({authenticatedCount}/{selectedCount} authenticated)</p>}
          </div>
        )}
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
          
          <div>
            <h3>Services Used</h3>
            {backupResult.selectedServices.map((service: any, index: number) => (
              <div key={index} style={{ marginBottom: '10px', padding: '10px', border: '1px solid gray' }}>
                <p><b>Service:</b> {service.name}</p>
                <p><b>Auth Type:</b> {service.authType}</p>
                <p><b>Owner Address:</b> {service.authData?.ownerAddress || 'none'}</p>
                <p><b>Shard {index + 1} (Hex):</b></p>
                <textarea 
                  value={backupResult.cryptoDetails.shardsHex[index]} 
                  readOnly 
                  rows={2} 
                  cols={80}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>
            ))}
          </div>
          
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
            </div>
          )}
          
          <p><b>Backup completed at:</b> {backupResult.metadata.timestamp.toISOString()}</p>
          <p><b>Blob Hash:</b> {backupResult.blobHash}</p>
        </div>
      )}
    </div>
  )
} 