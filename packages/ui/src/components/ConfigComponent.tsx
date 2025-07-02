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
    <div>
      <div>
        <h1>Shamir Secret Sharing</h1>
        <p>Configure the N-of-M threshold for key splitting</p>
        
        <div>
          <h2>Threshold (N - shares needed to restore)</h2>
          <input
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

        <div>
          <h2>Total Shares (M - total shares created)</h2>
          <input
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

        <p>
          <b>Current:</b> {shamirConfig.threshold} of {shamirConfig.totalShares} shares required for recovery
        </p>
      </div>

      <hr />

      <div>
        <h1>Key Share Storage</h1>
        <p>Configure where key shards are stored (separate from encrypted data)</p>
        
        <div>
          <h2>Storage Type</h2>
          <select
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
            <p>
              <b>Local Browser Storage:</b> Key shards will be stored in separate IndexedDB databases. 
              You can create multiple storage services for redundancy.
            </p>

            <div>
              <h2>Key Share Services</h2>
              
              {isLoadingServices ? (
                <p>Loading services...</p>
              ) : keyShareServices.length > 0 ? (
                <table border={1}>
                  <thead>
                    <tr>
                      <th>Service Name</th>
                      <th>Description</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keyShareServices.map((service) => (
                      <tr key={service.id}>
                        <td><b>{service.name}</b></td>
                        <td><small>{service.description || '-'}</small></td>
                        <td><small>{service.createdAt.toLocaleString()}</small></td>
                        <td>{service.isActive ? <b>Active</b> : 'Inactive'}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => toggleServiceActive(service)}
                          >
                            {service.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          {' '}
                          <button
                            type="button"
                            onClick={() => deleteKeyShareService(service.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p><i>No key share services found</i></p>
              )}

              {showCreateForm ? (
                <div>
                  <h3>Create New Key Share Service</h3>
                  <div>
                    <h4>Service Name</h4>
                    <input
                      type="text"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      placeholder="My Key Storage"
                    />
                  </div>
                  <div>
                    <h4>Description (optional)</h4>
                    <input
                      type="text"
                      value={newServiceDescription}
                      onChange={(e) => setNewServiceDescription(e.target.value)}
                      placeholder="Description of this storage service"
                    />
                  </div>
                  <p>
                    <button
                      type="button"
                      onClick={createKeyShareService}
                      disabled={!newServiceName.trim()}
                    >
                      Create Service
                    </button>
                    {' '}
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false)
                        setNewServiceName('')
                        setNewServiceDescription('')
                      }}
                    >
                      Cancel
                    </button>
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                >
                  Create New Service
                </button>
              )}

              <p>
                <b>Note:</b> Only active services will be used for storing key shards. 
                You can create multiple services for redundancy and toggle them on/off as needed.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div>
              <h2>Endpoint URL</h2>
              <input
                type="text"
                value={storageBackend.endpoint}
                onChange={(e) => setStorageBackend({
                  ...storageBackend,
                  endpoint: e.target.value
                })}
                placeholder="http://localhost:8080"
              />
            </div>

            <div>
              <h2>API Key (optional)</h2>
              <input
                type="password"
                value={storageBackend.apiKey || ''}
                onChange={(e) => setStorageBackend({
                  ...storageBackend,
                  apiKey: e.target.value || undefined
                })}
                placeholder="Your API key"
              />
            </div>
          </div>
        )}
      </div>

      <hr />

      <div>
        <h1>Encrypted Data Storage</h1>
        <p>Configure where encrypted profile data is stored (separate from key shards)</p>
        
        <div>
          <h2>Storage Type</h2>
          <select
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
          <div>
            <div>
              <h2>Endpoint URL</h2>
              <input
                type="text"
                value={encryptedDataStorage.endpoint || ''}
                onChange={(e) => setEncryptedDataStorage({
                  ...encryptedDataStorage,
                  endpoint: e.target.value
                })}
                placeholder="http://localhost:8080"
              />
            </div>

            <div>
              <h2>API Key (optional)</h2>
              <input
                type="password"
                value={encryptedDataStorage.apiKey || ''}
                onChange={(e) => setEncryptedDataStorage({
                  ...encryptedDataStorage,
                  apiKey: e.target.value || undefined
                })}
                placeholder="Your API key"
              />
            </div>
          </div>
        )}

        {encryptedDataStorage.type === 'local-browser' && (
          <p>
            <b>Local Browser Storage:</b> Encrypted data will be stored in your browser's IndexedDB database. 
            This data is only accessible from this browser and will persist until you clear your browser data.
          </p>
        )}
      </div>

      <hr />

      <div>
        <h1>Gnosis Safe Configuration</h1>
        <p>Configure Safe for EIP-712 authentication of shard requests</p>
        
        <div>
          <h2>Safe Address</h2>
          <input
            type="text"
            value={safeConfig.safeAddress}
            onChange={(e) => setSafeConfig({
              ...safeConfig,
              safeAddress: e.target.value
            })}
            placeholder="0x..."
          />
        </div>

        <div>
          <h2>Chain ID</h2>
          <select
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

        <div>
          <h2>Safe Owners (comma-separated)</h2>
          <textarea
            value={safeConfig.owners.join(', ')}
            onChange={(e) => setSafeConfig({
              ...safeConfig,
              owners: e.target.value.split(',').map(addr => addr.trim()).filter(addr => addr)
            })}
            placeholder="0x..., 0x..., 0x..."
            rows={3}
            cols={80}
          />
        </div>
      </div>
    </div>
  )
} 