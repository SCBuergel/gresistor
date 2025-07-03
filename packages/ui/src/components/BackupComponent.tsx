import { useState, useEffect } from 'react'
import { EncryptionService, ShamirSecretSharing, EncryptedDataStorageService, KeyShareStorageService, KeyShareRegistryService, ShamirConfig, KeyShardStorageBackend, EncryptedDataStorage, SafeConfig } from '@gresistor/library'

// Default values - simplified profile like minimal example
const DEFAULT_PROFILE_NAME = 'Alice Johnson'
const DEFAULT_PROFILE_AGE = 28
const DEFAULT_AUTHORIZATION_ADDRESS = '123' // Mock address (number for now)

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

export default function BackupComponent({ shamirConfig, keyShardStorageBackend, encryptedDataStorage, safeConfig }: BackupComponentProps) {
  const [profileName, setProfileName] = useState('')
  const [profileAge, setProfileAge] = useState(28)
  const [authorizationAddress, setAuthorizationAddress] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const [backupResult, setBackupResult] = useState<any>(null)
  const [activeServices, setActiveServices] = useState<Array<{name: string, createdAt: Date}>>([])
  const [servicesLoaded, setServicesLoaded] = useState(false)

  useEffect(() => {
    setProfileName(DEFAULT_PROFILE_NAME);
    setProfileAge(DEFAULT_PROFILE_AGE);
    setAuthorizationAddress(DEFAULT_AUTHORIZATION_ADDRESS);
  }, []);

  useEffect(() => {
    if (keyShardStorageBackend.type === 'local-browser') {
      loadActiveServices()
    }
  }, [keyShardStorageBackend.type])

  const loadActiveServices = async () => {
    try {
      const registry = new KeyShareRegistryService()
      const services = await registry.listServices()
      const activeServices = services.filter(s => s.isActive)
      
      setActiveServices(activeServices)
      setServicesLoaded(true)
      
      if (activeServices.length === 0) {
        setStatus({ type: 'info', message: 'No active key shard services found. Configure key shard services in the Config tab.' })
      }
    } catch (error) {
      console.error('❌ Failed to load active services:', error)
      setStatus({ type: 'error', message: `Failed to load services: ${error instanceof Error ? error.message : 'Unknown error'}` })
      setServicesLoaded(true)
    }
  }

  const handleBackup = async () => {
    if (!profileName || profileAge < 0) {
      setStatus({ type: 'error', message: 'Please provide valid profile name and age' })
      return
    }

    if (!authorizationAddress.trim()) {
      setStatus({ type: 'error', message: 'Please provide an authorization address' })
      return
    }

    if (!servicesLoaded) {
      setStatus({ type: 'error', message: 'Services not yet loaded. Please wait...' })
      return
    }

    if (activeServices.length === 0) {
      setStatus({ type: 'error', message: 'No active key shard services found. Please configure services in the Config tab.' })
      return
    }

    if (activeServices.length < shamirConfig.totalShares) {
      setStatus({ type: 'error', message: `Insufficient services: need ${shamirConfig.totalShares} active services but only ${activeServices.length} available. Configure more services in the Config tab.` })
      return
    }

    setIsLoading(true)
    setStatus({ type: 'info', message: 'Starting backup process...' })

    try {
      // 1. Create individual services (like minimal example)
      const encryptedDataStorageService = new EncryptedDataStorageService(encryptedDataStorage)
      const encryptionService = new EncryptionService()
      const shamirService = new ShamirSecretSharing(shamirConfig)

      // Use existing active services instead of creating new ones
      const keyShardServices = []
      for (let i = 0; i < shamirConfig.totalShares; i++) {
        const service = new KeyShareStorageService(activeServices[i].name)
        keyShardServices.push(service)
      }

      // 2. Create test profile (simple like minimal example)
      const testProfile: TestProfile = {
        name: profileName,
        age: profileAge
      }

      // Authentication data
      const authData = {
        ownerAddress: authorizationAddress.trim(),
        signature: (parseInt(authorizationAddress.trim()) * 2).toString()
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
        const shard = keyShards[i]
        
        // Get auth config to determine if authorization address is needed
        const authConfig = await service.getAuthConfig()
        const authorizationAddr = authConfig.authType !== 'no-auth' ? authData.ownerAddress : undefined
        
        await service.storeShard(shard.data, authorizationAddr)
        
        serviceNames.push(activeServices[i].name)
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
        blobHash: blobHash
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
        <h2>Authorization Address</h2>
        <p>Address that can authorize retrieval of key shards (for now: mock number)</p>
        <input
          type="text"
          value={authorizationAddress}
          onChange={(e) => setAuthorizationAddress(e.target.value)}
          placeholder="123"
        />
        <p><small>Note: Signature for restore will be this number × 2 (e.g., 123 → 246)</small></p>
      </div>

      <div>
        <h2>Configuration</h2>
        <ul>
          <li><b>Threshold:</b> {shamirConfig.threshold} of {shamirConfig.totalShares} shares required</li>
          <li><b>Key Shard Storage:</b> {keyShardStorageBackend.type} {keyShardStorageBackend.endpoint && `(${keyShardStorageBackend.endpoint})`}</li>
          <li><b>Encrypted Data Storage:</b> {encryptedDataStorage.type} {encryptedDataStorage.endpoint && `(${encryptedDataStorage.endpoint})`}</li>
          <li><b>Authorization:</b> {authorizationAddress || 'none'}</li>
          <li><b>Active Services:</b> {servicesLoaded ? `${activeServices.length} services configured` : 'Loading...'}</li>
          {activeServices.length > 0 && (
            <li><b>Service Names:</b> {activeServices.map(s => s.name).join(', ')}</li>
          )}
          {safeConfig.safeAddress && <li><b>Safe:</b> {safeConfig.safeAddress}</li>}
        </ul>
      </div>

      <div>
        <h2>Create Backup</h2>
        <button 
          onClick={handleBackup} 
          disabled={isLoading || !profileName || profileAge < 0 || !authorizationAddress.trim() || !servicesLoaded || activeServices.length < shamirConfig.totalShares}
        >
          {isLoading ? 'Creating Backup...' : 'Create Backup'}
        </button>
        {servicesLoaded && activeServices.length < shamirConfig.totalShares && (
          <p>
            ⚠️ Need {shamirConfig.totalShares} active services, but only {activeServices.length} configured. Please add more services in the Config tab.
          </p>
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
                    <p><small>Authorization Address: {backupResult.authAddresses?.[index] || 'none'}</small></p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <p><b>Backup completed at:</b> {backupResult.metadata.timestamp.toISOString()}</p>
          <p><b>Blob Hash:</b> {backupResult.blobHash}</p>
          <p><b>Authorization Address:</b> {authorizationAddress}</p>
          <p><b>Required Signature for Restore:</b> {parseInt(authorizationAddress) * 2}</p>
        </div>
      )}
    </div>
  )
} 