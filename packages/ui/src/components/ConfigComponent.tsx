import { useState, useEffect } from 'react'
import { ShamirConfig, StorageBackend, EncryptedDataStorage, SafeConfig } from '@resilient-backup/library'
import { KeyShareRegistryService, KeyShareService, KeyShareStorageService } from '@resilient-backup/library'

interface ConfigComponentProps {
  shamirConfig: ShamirConfig
  setShamirConfig: (config: ShamirConfig) => void
  storageBackend: StorageBackend
  setStorageBackend: (backend: StorageBackend) => void
  encryptedDataStorage: EncryptedDataStorage
  setEncryptedDataStorage: (storage: EncryptedDataStorage) => void
  safeConfig: SafeConfig
  setSafeConfig: (config: SafeConfig) => void
}

function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  (typeof crypto !== 'undefined' && crypto.getRandomValues)
    ? crypto.getRandomValues(bytes)
    : Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return Array.from(bytes).map((b, i) =>
    [4, 6, 8, 10].includes(i) ? '-' + b.toString(16).padStart(2, '0') : b.toString(16).padStart(2, '0')
  ).join('');
}

export default function ConfigComponent({
  shamirConfig,
  setShamirConfig,
  storageBackend,
  setStorageBackend,
  encryptedDataStorage,
  setEncryptedDataStorage,
  safeConfig,
  setSafeConfig
}: ConfigComponentProps) {
  const [keyShareServices, setKeyShareServices] = useState<KeyShareService[]>([])
  const [isLoadingServices, setIsLoadingServices] = useState(false)
  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceDescription, setNewServiceDescription] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Load key share services when component mounts or when storage type changes
  useEffect(() => {
    if (storageBackend.type === 'local-browser') {
      loadKeyShareServices()
    }
  }, [storageBackend.type])

  const loadKeyShareServices = async () => {
    setIsLoadingServices(true)
    try {
      const registry = new KeyShareRegistryService()
      const services = await registry.listServices()
      setKeyShareServices(services)
    } catch (error) {
      console.error('Failed to load key share services:', error)
    } finally {
      setIsLoadingServices(false)
    }
  }

  const createKeyShareService = async () => {
    if (!newServiceName.trim()) return

    try {
      const registry = new KeyShareRegistryService()
      const serviceId = generateUUIDv4()
      
      await registry.registerService({
        id: serviceId,
        name: newServiceName.trim(),
        description: newServiceDescription.trim() || undefined,
        isActive: true
      })

      setNewServiceName('')
      setNewServiceDescription('')
      setShowCreateForm(false)
      await loadKeyShareServices()
    } catch (error) {
      console.error('Failed to create key share service:', error)
    }
  }

  const deleteKeyShareService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this key share service? This will also delete all stored key shards.')) {
      return
    }

    try {
      const registry = new KeyShareRegistryService()
      await registry.deleteService(serviceId)
      
      // Also delete the database
      const storageService = new KeyShareStorageService(serviceId)
      await storageService.deleteDatabase()
      
      await loadKeyShareServices()
    } catch (error) {
      console.error('Failed to delete key share service:', error)
    }
  }

  const toggleServiceActive = async (service: KeyShareService) => {
    try {
      const registry = new KeyShareRegistryService()
      await registry.updateService({
        ...service,
        isActive: !service.isActive
      })
      await loadKeyShareServices()
    } catch (error) {
      console.error('Failed to update key share service:', error)
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>Shamir Secret Sharing</h2>
        <p>Configure the N-of-M threshold for key splitting</p>
        
        <div className="form-group">
          <label htmlFor="threshold">Threshold (N - shares needed to restore):</label>
          <input
            id="threshold"
            type="number"
            min="2"
            max="10"
            value={shamirConfig.threshold}
            onChange={(e) => setShamirConfig({
              ...shamirConfig,
              threshold: parseInt(e.target.value) || 2
            })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="totalShares">Total Shares (M - total shares created):</label>
          <input
            id="totalShares"
            type="number"
            min={shamirConfig.threshold}
            max="20"
            value={shamirConfig.totalShares}
            onChange={(e) => setShamirConfig({
              ...shamirConfig,
              totalShares: parseInt(e.target.value) || shamirConfig.threshold
            })}
          />
        </div>

        <p style={{ marginTop: '1rem', color: '#6b7280' }}>
          Current: {shamirConfig.threshold} of {shamirConfig.totalShares} shares required for recovery
        </p>
      </div>

      <div className="card">
        <h2>Key Share Storage</h2>
        <p>Configure where key shards are stored (separate from encrypted data)</p>
        
        <div className="form-group">
          <label htmlFor="storageType">Storage Type:</label>
          <select
            id="storageType"
            value={storageBackend.type}
            onChange={(e) => setStorageBackend({
              ...storageBackend,
              type: e.target.value as 'swarm' | 'ipfs' | 'local-browser'
            })}
          >
            <option value="local-browser">Local Browser Storage</option>
            <option value="swarm">Swarm</option>
            <option value="ipfs">IPFS</option>
          </select>
        </div>

        {storageBackend.type === 'local-browser' ? (
          <div>
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '6px' }}>
              <p style={{ margin: 0, color: '#6b7280' }}>
                <strong>Local Browser Storage:</strong> Key shards will be stored in separate IndexedDB databases. 
                You can create multiple storage services for redundancy.
              </p>
            </div>

            {/* Key Share Services Management */}
            <div style={{ marginTop: '1rem' }}>
              <h3>Key Share Services</h3>
              
              {isLoadingServices ? (
                <p>Loading services...</p>
              ) : keyShareServices.length > 0 ? (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {keyShareServices.map((service) => (
                    <div 
                      key={service.id}
                      style={{
                        padding: '0.75rem',
                        margin: '0.5rem 0',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        backgroundColor: service.isActive ? '#eff6ff' : '#f9fafb'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{service.name}</div>
                          {service.description && (
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{service.description}</div>
                          )}
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            Created: {service.createdAt.toLocaleString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => toggleServiceActive(service)}
                            className={`btn ${service.isActive ? 'btn-secondary' : 'btn'}`}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            {service.isActive ? 'Active' : 'Inactive'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteKeyShareService(service.id)}
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No key share services found</p>
              )}

              {showCreateForm ? (
                <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                  <h4>Create New Key Share Service</h4>
                  <div className="form-group">
                    <label htmlFor="serviceName">Service Name:</label>
                    <input
                      id="serviceName"
                      type="text"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      placeholder="My Key Storage"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="serviceDescription">Description (optional):</label>
                    <input
                      id="serviceDescription"
                      type="text"
                      value={newServiceDescription}
                      onChange={(e) => setNewServiceDescription(e.target.value)}
                      placeholder="Description of this storage service"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={createKeyShareService}
                      className="btn"
                      disabled={!newServiceName.trim()}
                    >
                      Create Service
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false)
                        setNewServiceName('')
                        setNewServiceDescription('')
                      }}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="btn btn-secondary"
                  style={{ marginTop: '1rem' }}
                >
                  Create New Service
                </button>
              )}

              <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef3c7', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e' }}>
                  <strong>Note:</strong> Only active services will be used for storing key shards. 
                  You can create multiple services for redundancy and toggle them on/off as needed.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="endpoint">Endpoint URL:</label>
              <input
                id="endpoint"
                type="text"
                value={storageBackend.endpoint}
                onChange={(e) => setStorageBackend({
                  ...storageBackend,
                  endpoint: e.target.value
                })}
                placeholder="http://localhost:8080"
              />
            </div>

            <div className="form-group">
              <label htmlFor="apiKey">API Key (optional):</label>
              <input
                id="apiKey"
                type="password"
                value={storageBackend.apiKey || ''}
                onChange={(e) => setStorageBackend({
                  ...storageBackend,
                  apiKey: e.target.value || undefined
                })}
                placeholder="Your API key"
              />
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Encrypted Data Storage</h2>
        <p>Configure where encrypted profile data is stored (separate from key shards)</p>
        
        <div className="form-group">
          <label htmlFor="encryptedStorageType">Storage Type:</label>
          <select
            id="encryptedStorageType"
            value={encryptedDataStorage.type}
            onChange={(e) => setEncryptedDataStorage({
              ...encryptedDataStorage,
              type: e.target.value as 'swarm' | 'ipfs' | 'local-browser'
            })}
          >
            <option value="local-browser">Local Browser Storage</option>
            <option value="swarm">Swarm</option>
            <option value="ipfs">IPFS</option>
          </select>
        </div>

        {encryptedDataStorage.type !== 'local-browser' && (
          <>
            <div className="form-group">
              <label htmlFor="encryptedEndpoint">Endpoint URL:</label>
              <input
                id="encryptedEndpoint"
                type="text"
                value={encryptedDataStorage.endpoint || ''}
                onChange={(e) => setEncryptedDataStorage({
                  ...encryptedDataStorage,
                  endpoint: e.target.value
                })}
                placeholder="http://localhost:8080"
              />
            </div>

            <div className="form-group">
              <label htmlFor="encryptedApiKey">API Key (optional):</label>
              <input
                id="encryptedApiKey"
                type="password"
                value={encryptedDataStorage.apiKey || ''}
                onChange={(e) => setEncryptedDataStorage({
                  ...encryptedDataStorage,
                  apiKey: e.target.value || undefined
                })}
                placeholder="Your API key"
              />
            </div>
          </>
        )}

        {encryptedDataStorage.type === 'local-browser' && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '6px' }}>
            <p style={{ margin: 0, color: '#6b7280' }}>
              <strong>Local Browser Storage:</strong> Encrypted data will be stored in your browser's IndexedDB database. 
              This data is only accessible from this browser and will persist until you clear your browser data.
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Gnosis Safe Configuration</h2>
        <p>Configure Safe for EIP-712 authentication of shard requests</p>
        
        <div className="form-group">
          <label htmlFor="safeAddress">Safe Address:</label>
          <input
            id="safeAddress"
            type="text"
            value={safeConfig.safeAddress}
            onChange={(e) => setSafeConfig({
              ...safeConfig,
              safeAddress: e.target.value
            })}
            placeholder="0x..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="chainId">Chain ID:</label>
          <select
            id="chainId"
            value={safeConfig.chainId}
            onChange={(e) => setSafeConfig({
              ...safeConfig,
              chainId: parseInt(e.target.value)
            })}
          >
            <option value="1">Ethereum Mainnet (1)</option>
            <option value="5">Goerli Testnet (5)</option>
            <option value="100">Gnosis Chain (100)</option>
            <option value="137">Polygon (137)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="owners">Safe Owners (comma-separated):</label>
          <textarea
            id="owners"
            value={safeConfig.owners.join(', ')}
            onChange={(e) => setSafeConfig({
              ...safeConfig,
              owners: e.target.value.split(',').map(addr => addr.trim()).filter(addr => addr)
            })}
            placeholder="0x..., 0x..., 0x..."
            rows={3}
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
          />
        </div>
      </div>
    </div>
  )
} 