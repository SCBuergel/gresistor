import { useState, useEffect, useRef } from 'react'
import { EncryptionService, ShamirSecretSharing, EncryptedDataStorageService, KeyShareStorageService, ShamirConfig, KeyShardStorageBackend, EncryptedDataStorage, SafeConfig, AuthData, AuthorizationType, KeyShard, SafeAuthService } from '@gresistor/library'
import { KeyShareRegistryService } from '@gresistor/library'
import { SIWESafeAuthService } from '@gresistor/library'
import { SiweMessage } from 'siwe'
import { ethers } from 'ethers'

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
  isAuthenticated: boolean
  authData?: AuthData
  authError?: string
}

interface TestProfile {
  name: string
  age: number
}

interface ServiceShards {
  serviceName: string
  shards: KeyShard[]
}

const CHAIN_OPTIONS = [
  { id: 100, name: 'Gnosis Chain', rpcUrl: 'https://rpc.gnosischain.com' },
  { id: 1, name: 'Ethereum', rpcUrl: 'https://eth.drpc.org' }
]

export default function RestoreComponent({ shamirConfig, keyShardStorageBackend, encryptedDataStorage, safeConfig }: RestoreComponentProps) {
  // Hardcoded WalletConnect Project ID
  const walletConnectProjectId = '62626bd02bc0c91a73103509f9da4896'
  
  console.log('🔑 WalletConnect Project ID:', walletConnectProjectId)

  const [availableBackups, setAvailableBackups] = useState<StoredBackup[]>([])
  const [encryptedBlobHash, setEncryptedBlobHash] = useState<string>('')
  const [activeServices, setActiveServices] = useState<Array<{name: string, createdAt: Date}>>([])
  const [servicesAuthInfo, setServicesAuthInfo] = useState<ServiceAuthInfo[]>([])
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [restoredProfile, setRestoredProfile] = useState<TestProfile | null>(null)
  const [serviceShards, setServiceShards] = useState<ServiceShards[]>([])
  const [selectedShards, setSelectedShards] = useState<{[serviceShardKey: string]: boolean}>({})
  
  // Per-service authentication data
  const [noAuthData, setNoAuthData] = useState<{ownerAddress: string}>({ownerAddress: '123'})
  const [mockSigData, setMockSigData] = useState<{ownerAddress: string, signature: string}>({ownerAddress: '123', signature: '246'})
  
  // Safe authentication state
  const [siweConfig, setSiweConfig] = useState({
    safeAddress: '0xCadD4Ea3BCC361Fc4aF2387937d7417be8d7dfC2',
    chainId: 100,
    rpcProvider: 'https://rpc.gnosischain.com'
  })
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [connectedAddress, setConnectedAddress] = useState<string>('')
  const [safeAuthService, setSafeAuthService] = useState<SafeAuthService | null>(null)
  const [siweAuthService, setSiweAuthService] = useState<SIWESafeAuthService | null>(null)
  const [connectedSiweService, setConnectedSiweService] = useState<SIWESafeAuthService | null>(null)

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

  useEffect(() => {
    // Initialize Safe config and SafeAuthService
    if (safeConfig.safeAddress && safeConfig.chainId) {
      setSiweConfig(prev => ({
        ...prev,
        // Only set safeAddress if it's not already set by user input
        safeAddress: prev.safeAddress || safeConfig.safeAddress,
        chainId: safeConfig.chainId
      }))
      
      // Initialize SafeAuthService with current config
      const authService = new SafeAuthService(safeConfig)
      setSafeAuthService(authService)
      
      // Initialize SIWE Safe Auth Service with WalletConnect Project ID
      
      // Debug Safe configuration
      console.log('🔍 Debug Safe configuration:')
      console.log('  - safeConfig.safeAddress:', safeConfig.safeAddress)
      console.log('  - siweConfig.safeAddress:', siweConfig.safeAddress)
      console.log('  - safeConfig.chainId:', safeConfig.chainId)
      console.log('  - Full safeConfig:', safeConfig)
      
      // Use the UI Safe address if available, otherwise fall back to safeConfig
      const actualSafeConfig = {
        ...safeConfig,
        safeAddress: siweConfig.safeAddress || safeConfig.safeAddress
      }
      console.log('🔧 Using Safe config for authentication:', actualSafeConfig)
      
      // Get WalletConnect Project ID from Vite environment
      const authWalletConnectProjectId = '62626bd02bc0c91a73103509f9da4896'
      
      console.log('🔧 Initializing SIWESafeAuthService with Project ID:', authWalletConnectProjectId)
      
      const siweService = new SIWESafeAuthService(actualSafeConfig, authWalletConnectProjectId)
      setSiweAuthService(siweService)
    }
  }, [safeConfig, siweConfig.safeAddress])

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
            description: authConfig.description,
            isAuthenticated: false
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
      // Convert storage config to only supported types
      const storageConfig = encryptedDataStorage.type === 'memory' || encryptedDataStorage.type === 'local-browser' 
        ? { type: encryptedDataStorage.type }
        : { type: 'memory' as const }
      const encryptedDataStorageService = new EncryptedDataStorageService(storageConfig)
      
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

  // Secure wallet connection with Safe owner validation
  const connectWallet = async () => {
    try {
      console.log('🔗 Connecting WalletConnect wallet...')
      console.log('🔍 DEBUG: Current Safe addresses:')
      console.log('  - siweConfig.safeAddress:', siweConfig.safeAddress)
      console.log('  - safeConfig.safeAddress:', safeConfig.safeAddress)
      
      // Create a fresh SIWESafeAuthService with the current UI Safe address
      const currentSafeConfig = {
        ...safeConfig,
        safeAddress: siweConfig.safeAddress || safeConfig.safeAddress
      }
      console.log('🔧 Creating fresh SIWESafeAuthService with current Safe address:', currentSafeConfig.safeAddress)
      
      const walletConnectProjectId = '62626bd02bc0c91a73103509f9da4896'
      
      const freshSiweService = new SIWESafeAuthService(currentSafeConfig, walletConnectProjectId)
      
      const address = await freshSiweService.connectWallet('walletconnect')
      setConnectedAddress(address)
      setIsWalletConnected(true)
      
      // Store the connected service for later use in authentication
      setConnectedSiweService(freshSiweService)
      
      console.log('✅ WalletConnect wallet connected:', address)
      return address
    } catch (error) {
      console.error('Failed to connect WalletConnect wallet:', error)
      throw error
    }
  }

  // Secure Safe authentication message signing
  const signAuthMessage = async (): Promise<AuthData> => {
    // Debug: Log current connection state
    console.log('🔍 Debug - Authentication check:')
    console.log('  - isWalletConnected:', isWalletConnected)
    console.log('  - connectedAddress:', connectedAddress)
    console.log('  - siweConfig.safeAddress:', siweConfig.safeAddress)
    console.log('  - safeConfig.safeAddress:', safeConfig.safeAddress)

    if (!isWalletConnected) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    try {
      console.log('📝 Signing SIWE authentication message...')
      
      if (!connectedSiweService) {
        throw new Error('No connected SIWE service available. Please connect your wallet first.')
      }
      
      console.log('🔗 Using connected SIWE service for signing')
      
      const authData = await connectedSiweService.signAuthMessage('Gresistor Shard Access')
      console.log('✅ SIWE message signed successfully')
      return authData
    } catch (error) {
      console.error('❌ Failed to sign SIWE message:', error)
      throw error
    }
  }

  const authenticateService = async (serviceName: string) => {
    console.log(`🔑 Authenticating service: ${serviceName}...`)
    
    const serviceInfo = servicesAuthInfo.find(s => s.serviceName === serviceName)
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
      } else if (serviceInfo.authType === 'safe-signature') {
        if (!isWalletConnected) {
          throw new Error('Wallet not connected. Please connect your wallet first.')
        }
        
        // Sign Safe authentication message with owner validation
        authData = await signAuthMessage()
        
      } else {
        throw new Error(`Unknown auth type: ${serviceInfo.authType}`)
      }
      
      // Test authentication by trying to get shards
      await storageService.getAllShardsWithAuth(authData)
      
      // Update service auth status
      setServicesAuthInfo(prev => prev.map(s => 
        s.serviceName === serviceName 
          ? { ...s, isAuthenticated: true, authData, authError: undefined }
          : s
      ))
      
      console.log(`✅ Authentication successful for service: ${serviceName}`)
      
      // Reload shards for this service
      await loadShardsForService(serviceName, authData)
      
    } catch (error) {
      console.error(`❌ Authentication failed for service ${serviceName}:`, error)
      setServicesAuthInfo(prev => prev.map(s => 
        s.serviceName === serviceName 
          ? { ...s, isAuthenticated: false, authError: error instanceof Error ? error.message : 'Unknown error' }
          : s
      ))
    }
  }

  const loadShardsForService = async (serviceName: string, authData: AuthData) => {
    try {
      const storageService = new KeyShareStorageService(serviceName)
      const storedShards = await storageService.getAllShardsWithAuth(authData)
      
      // Convert StoredKeyShardData to KeyShard format
      const shards: KeyShard[] = storedShards.map((stored, index) => ({
        id: `${serviceName}-${index}`,
        data: stored.data,
        threshold: shamirConfig.threshold,
        totalShares: shamirConfig.totalShares,
        authorizationAddress: stored.authorizationAddress,
        timestamp: stored.timestamp ? new Date(stored.timestamp) : undefined
      }))
      
      setServiceShards(prev => {
        const updated = prev.filter(s => s.serviceName !== serviceName)
        updated.push({
          serviceName,
          shards: shards
        })
        return updated
      })
    } catch (error) {
      console.error(`❌ Failed to load shards for service ${serviceName}:`, error)
    }
  }

  const clearServiceAuthentication = (serviceName: string) => {
    setServicesAuthInfo(prev => prev.map(s => 
      s.serviceName === serviceName 
        ? { ...s, isAuthenticated: false, authData: undefined, authError: undefined }
        : s
    ))
    
    // Remove shards for this service
    setServiceShards(prev => prev.filter(s => s.serviceName !== serviceName))
    
    // Clear selected shards for this service
    setSelectedShards(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(key => {
        if (key.startsWith(`${serviceName}-`)) {
          delete updated[key]
        }
      })
      return updated
    })
  }

  const handleShardSelection = (serviceName: string, shardIndex: number, checked: boolean) => {
    const key = `${serviceName}-${shardIndex}`
    setSelectedShards(prev => ({
      ...prev,
      [key]: checked
    }))
  }

  const getSelectedShardsList = () => {
    const selected: Array<{serviceName: string, shard: KeyShard}> = []
    
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
    return encryptedBlobHash && selectedShardsList.length >= shamirConfig.threshold
  }

  const handleRestore = async () => {
    if (!canRestore()) {
      setStatus({ type: 'error', message: 'Cannot restore: missing blob hash or insufficient shards selected' })
      return
    }

    setIsLoading(true)
    setStatus({ type: 'info', message: 'Starting restore process...' })

    try {
      // 1. Create individual services (like minimal example)
      // Convert storage config to only supported types
      const storageConfig = encryptedDataStorage.type === 'memory' || encryptedDataStorage.type === 'local-browser' 
        ? { type: encryptedDataStorage.type }
        : { type: 'memory' as const }
      const encryptedDataStorageService = new EncryptedDataStorageService(storageConfig)
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

  // Group services by auth type
  const servicesByAuthType = servicesAuthInfo.reduce((acc, service) => {
    if (!acc[service.authType]) {
      acc[service.authType] = []
    }
    acc[service.authType].push(service)
    return acc
  }, {} as Record<AuthorizationType, ServiceAuthInfo[]>)

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
                  {backup.timestamp.toLocaleString()} ({backup.size} bytes)
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
        <h2>Service Authentication</h2>
        <p>Authenticate with each key storage service individually:</p>
        
        {Object.entries(servicesByAuthType).map(([authType, services]) => (
          <div key={authType} style={{ marginBottom: '30px', border: '1px solid black', padding: '15px' }}>
            <h3>
              {authType === 'no-auth' ? 'No Authentication Required' : 
               authType === 'mock-signature-2x' ? 'Mock Signature Authentication (×2)' : 
               authType === 'safe-signature' ? 'Safe Signature Authentication' :
               authType}
            </h3>
            
            {authType === 'no-auth' && (
              <div style={{ marginBottom: '15px' }}>
                <label>
                  Owner Address:
                  <input
                    data-testid="no-auth-owner-address"
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
                      data-testid="mock-auth-owner-address"
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
                      data-testid="mock-auth-signature"
                      type="text"
                      value={mockSigData.signature}
                      onChange={(e) => setMockSigData({...mockSigData, signature: e.target.value})}
                      placeholder="Signature"
                    />
                  </label>
                </div>
                <p><small>Signature should be address × 2 (e.g., 123 × 2 = 246)</small></p>
              </div>
            )}
            
            {authType === 'safe-signature' && (
              <div style={{ marginBottom: '15px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <label>
                      Safe Address:
                      <input
                        data-testid="safe-auth-owner-address"
                        type="text"
                        value={siweConfig.safeAddress}
                        onChange={(e) => setSiweConfig(prev => ({ ...prev, safeAddress: e.target.value }))}
                        placeholder="0xCadD4Ea3BCC361Fc4aF2387937d7417be8d7dfC2"
                        style={{ width: '400px', marginLeft: '10px' }}
                      />
                    </label>
                  </div>
                  
                  <div style={{ marginBottom: '10px' }}>
                    <label>
                      Chain ID:
                      <select
                        value={siweConfig.chainId}
                        onChange={(e) => {
                          const selectedChain = CHAIN_OPTIONS.find(c => c.id === Number(e.target.value))
                          setSiweConfig(prev => ({ 
                            ...prev, 
                            chainId: Number(e.target.value),
                            rpcProvider: selectedChain?.rpcUrl || prev.rpcProvider
                          }))
                        }}
                        style={{ marginLeft: '10px' }}
                      >
                        {CHAIN_OPTIONS.map(chain => (
                          <option key={chain.id} value={chain.id}>
                            {chain.name} ({chain.id})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  
                  <div style={{ marginBottom: '10px' }}>
                    <label>
                      RPC Provider:
                      <input
                        type="text"
                        value={siweConfig.rpcProvider}
                        onChange={(e) => setSiweConfig(prev => ({ ...prev, rpcProvider: e.target.value }))}
                        placeholder="https://rpc.gnosischain.com"
                        style={{ width: '400px', marginLeft: '10px' }}
                      />
                    </label>
                  </div>
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  {!isWalletConnected ? (
                    <div>
                      <button 
                        onClick={async () => {
                          try {
                            await connectWallet()
                          } catch (error) {
                            alert(`Failed to connect WalletConnect: ${error instanceof Error ? error.message : 'Unknown error'}`)
                          }
                        }}
                      >
                        Connect WalletConnect
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p>✅ <strong>Connected:</strong> {connectedAddress}</p>
                      <button 
                        onClick={() => {
                          safeAuthService?.disconnect()
                          setIsWalletConnected(false)
                          setConnectedAddress('')
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
                
                <p><small>
                  SIWE (Sign-In With Ethereum) authentication for Safe. 
                  Your wallet must be connected and the address must be a Safe owner.
                </small></p>
              </div>
            )}
            
            <h4>Services using {authType}:</h4>
            {services.map(service => (
              <div key={service.serviceName} style={{ marginBottom: '10px', padding: '10px', border: '1px solid gray' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <strong>{service.serviceName}</strong>
                  {service.isAuthenticated ? (
                    <span>✅ Authenticated</span>
                  ) : (
                    <span>❌ Not authenticated</span>
                  )}
                </div>
                
                <div style={{ fontSize: '0.9em', marginTop: '5px' }}>
                  {service.description}
                </div>
                
                <div style={{ marginTop: '10px' }}>
                  {!service.isAuthenticated ? (
                    <button 
                      data-testid={`${service.serviceName.toLowerCase().replace(/\s+/g, '-')}-authenticate-button`}
                      onClick={() => authenticateService(service.serviceName)}
                    >
                      Authenticate
                    </button>
                  ) : (
                    <button 
                      data-testid={`${service.serviceName.toLowerCase().replace(/\s+/g, '-')}-clear-auth-button`}
                      onClick={() => clearServiceAuthentication(service.serviceName)}
                    >
                      Clear Authentication
                    </button>
                  )}
                </div>
                
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
            ))}
          </div>
        ))}
      </div>

      {serviceShards.length > 0 && (
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
                        Shard {shardIndex + 1} - ID: {shard.id}
                      </label>
                      <div style={{ marginLeft: '20px', fontSize: '0.8em' }}>
                        <p>Size: {shard.data.length} bytes</p>
                        <p>Owner: {shard.authorizationAddress}</p>
                        <p>Created: {shard.timestamp ? shard.timestamp.toLocaleString() : 'Legacy shard (no timestamp)'}</p>
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
          <li><b>Authenticated Services:</b> {servicesAuthInfo.filter(s => s.isAuthenticated).length}</li>
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
        {!canRestore() && (
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
