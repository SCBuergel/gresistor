import { useState, useEffect } from 'react'
import { ShamirConfig, KeyShardStorageBackend, EncryptedDataStorage, SafeConfig, AuthorizationType } from '@gresistor/library'
import { KeyShareRegistryService, KeyShareService, KeyShareStorageService } from '@gresistor/library'

// Constants
const MIN_THRESHOLD = 2
const MAX_THRESHOLD = 10
const MAX_TOTAL_SHARES = 20

// Available authorization types
const AUTHORIZATION_TYPES: { value: AuthorizationType; label: string; description: string }[] = [
  { 
    value: 'no-auth', 
    label: 'No Authorization', 
    description: 'Open access - no authorization required' 
  },
  { 
    value: 'mock-signature-2x', 
    label: 'Mock Signature (2x)', 
    description: 'Mock signature validation (address × 2)' 
  },
  { 
    value: 'safe-signature', 
    label: 'Safe Signature', 
    description: 'Safe wallet signature using EIP-712' 
  }
]

// Utility functions
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

interface ConfigComponentProps {
  shamirConfig: ShamirConfig
  setShamirConfig: (config: ShamirConfig) => void
  keyShardStorageBackend: KeyShardStorageBackend
  setKeyShardStorageBackend: (backend: KeyShardStorageBackend) => void
  encryptedDataStorage: EncryptedDataStorage
  setEncryptedDataStorage: (storage: EncryptedDataStorage) => void
  safeConfig: SafeConfig
  setSafeConfig: (config: SafeConfig) => void
}

export default function ConfigComponent({
  shamirConfig,
  setShamirConfig,
  keyShardStorageBackend,
  setKeyShardStorageBackend,
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
  const [newServiceAuthType, setNewServiceAuthType] = useState<AuthorizationType>('no-auth')
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  useEffect(() => {
    if (keyShardStorageBackend.type === 'local-browser') {
      loadKeyShareServices()
    }
  }, [keyShardStorageBackend.type])

  const loadKeyShareServices = async () => {
    setIsLoadingServices(true)
    try {
      const registry = new KeyShareRegistryService()
      const services = await registry.listServices()
      setKeyShareServices(services.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
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
      const newService = {
        name: newServiceName.trim(),
        description: newServiceDescription.trim() || undefined,
        isActive: true,
        authType: newServiceAuthType
      }
      
      await registry.registerService(newService)
      setNewServiceName('')
      setNewServiceDescription('')
      setShowCreateForm(false)
      await loadKeyShareServices()
      setStatus({ type: 'success', message: `Service "${newServiceName.trim()}" added with ${newServiceAuthType} authorization` })
    } catch (error) {
      console.error('Failed to create key share service:', error)
      if (error instanceof Error && error.message.includes('already exists')) {
        alert(error.message)
      }
    }
  }

  const deleteKeyShareService = async (serviceName: string) => {
    if (!confirm('Are you sure you want to delete this key share service? This will also delete all stored key shards.')) {
      return
    }

    try {
      const registry = new KeyShareRegistryService()
      await registry.deleteService(serviceName)
      
      const storageService = new KeyShareStorageService(serviceName)
      await storageService.deleteDatabase()
      
      await loadKeyShareServices()
    } catch (error) {
      console.error('Failed to delete key share service:', error)
    }
  }

  const toggleServiceActive = async (service: KeyShareService) => {
    try {
      const registry = new KeyShareRegistryService()
      await registry.updateService({ ...service, isActive: !service.isActive })
      await loadKeyShareServices()
    } catch (error) {
      console.error('Failed to update key share service:', error)
    }
  }

  const updateServiceAuthType = async (serviceName: string, authType: AuthorizationType) => {
    try {
      const registry = new KeyShareRegistryService()
      await registry.updateServiceAuthType(serviceName, authType)
      await loadKeyShareServices()
      setStatus({ type: 'success', message: `Updated "${serviceName}" authorization to ${authType}` })
    } catch (error) {
      console.error('Failed to update service auth type:', error)
      setStatus({ type: 'error', message: `Failed to update authorization: ${error instanceof Error ? error.message : 'Unknown error'}` })
    }
  }

  const clearAllData = async () => {
    if (!window.confirm('This will delete ALL backup data and service configurations. Are you sure?')) {
      return;
    }

    try {
      // Get list of all databases
      const databases = await window.indexedDB.databases();
      
      for (const db of databases) {
        if (db.name && (
          db.name.includes('KeyShardService_') || 
          db.name.includes('KeyShareRegistry') || 
          db.name === 'ResilientBackupDB' ||
          db.name === 'KeyShareRegistryDB'
        )) {
          console.log(`Deleting database: ${db.name}`);
          const deleteRequest = window.indexedDB.deleteDatabase(db.name);
          await new Promise((resolve, reject) => {
            deleteRequest.onsuccess = () => resolve(undefined);
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
        }
      }
      
      // Reload the page to reinitialize everything
      setStatus({ type: 'success', message: 'All data cleared successfully. Reloading page...' });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Failed to clear data:', error);
      setStatus({ type: 'error', message: `Failed to clear data: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  }

  const handleApplyConfig = () => {
    setShamirConfig(shamirConfig)
    setKeyShardStorageBackend(keyShardStorageBackend)
    setEncryptedDataStorage(encryptedDataStorage)
    setSafeConfig(safeConfig)
    setStatus({ type: 'success', message: 'Configuration applied successfully' })
  }

  return (
    <div>
      <div>
        <h1>Shamir Secret Sharing</h1>
        <p>Configure the N-of-M threshold for key splitting</p>
        
        <div>
          <h2>Threshold (N - shares needed to restore)</h2>
          <input
            id="shamir-threshold"
            type="number"
            value={shamirConfig.threshold}
            onChange={(e) => setShamirConfig({
              ...shamirConfig,
              threshold: parseInt(e.target.value) || 2
            })}
            min={MIN_THRESHOLD}
            max={shamirConfig.totalShares}
          />
        </div>

        <div>
          <h2>Total Shares (M - total shares created)</h2>
          <input
            id="shamir-total-shares"
            type="number"
            value={shamirConfig.totalShares}
            onChange={(e) => setShamirConfig({
              ...shamirConfig,
              totalShares: parseInt(e.target.value) || 3
            })}
            min={shamirConfig.threshold}
            max={MAX_TOTAL_SHARES}
          />
        </div>

        <p><b>Current:</b> {shamirConfig.threshold} of {shamirConfig.totalShares} shares required for recovery</p>
      </div>

      <hr />

      <div>
        <h1>Key Shard Storage</h1>
        <p>Configure where key shards are stored (separate from encrypted data)</p>
        
        <div>
          <h2>Storage Type</h2>
          <select
            value={keyShardStorageBackend.type}
            onChange={(e) => setKeyShardStorageBackend({
              ...keyShardStorageBackend,
              type: e.target.value as 'swarm' | 'ipfs' | 'local-browser'
            })}
          >
            <option value="local-browser">Local Browser Storage</option>
            <option value="swarm" disabled>Swarm (Coming Soon)</option>
            <option value="ipfs" disabled>IPFS (Coming Soon)</option>
          </select>
        </div>

        {keyShardStorageBackend.type === 'local-browser' ? (
          <div>
            <p><b>Local Browser Storage:</b> Key shards will be stored in separate IndexedDB databases. You can create multiple storage services for redundancy.</p>

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
                      <th>Authorization</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keyShareServices.map((service) => (
                      <tr key={service.name}>
                        <td><b>{service.name}</b></td>
                        <td><small>{service.description || '-'}</small></td>
                        <td>
                          <select
                            value={service.authType}
                            onChange={(e) => updateServiceAuthType(service.name, e.target.value as AuthorizationType)}
                          >
                            {AUTHORIZATION_TYPES.map(type => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td><small>{service.createdAt.toLocaleString()}</small></td>
                        <td>{service.isActive ? <b>Active</b> : 'Inactive'}</td>
                        <td>
                          <button type="button" onClick={() => toggleServiceActive(service)}>
                            {service.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          {' '}
                          <button type="button" onClick={() => deleteKeyShareService(service.name)}>
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
                      id="new-service-name"
                      type="text"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      placeholder="My Key Storage"
                    />
                  </div>
                  <div>
                    <h4>Description (optional)</h4>
                    <input
                      id="new-service-description"
                      type="text"
                      value={newServiceDescription}
                      onChange={(e) => setNewServiceDescription(e.target.value)}
                      placeholder="Description of this storage service"
                    />
                  </div>
                  <div>
                    <h4>Authorization Type</h4>
                    <select
                      id="new-service-auth-type"
                      value={newServiceAuthType}
                      onChange={(e) => setNewServiceAuthType(e.target.value as AuthorizationType)}
                    >
                      {AUTHORIZATION_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p>
                    <button type="button" onClick={createKeyShareService} disabled={!newServiceName.trim()}>
                      Create Service
                    </button>
                    {' '}
                    <button type="button" onClick={() => {
                      setShowCreateForm(false)
                      setNewServiceName('')
                      setNewServiceDescription('')
                    }}>
                      Cancel
                    </button>
                  </p>
                </div>
              ) : (
                <button type="button" onClick={() => setShowCreateForm(true)}>
                  Create New Service
                </button>
              )}

              <p><b>Note:</b> Only active services will be used for storing key shards. You can create multiple services for redundancy and toggle them on/off as needed.</p>
            </div>
          </div>
        ) : (
          <div>
            <div>
              <h2>Endpoint URL</h2>
              <input
                type="text"
                value={keyShardStorageBackend.endpoint}
                onChange={(e) => setKeyShardStorageBackend({
                  ...keyShardStorageBackend,
                  endpoint: e.target.value
                })}
                placeholder="http://localhost:8080"
              />
            </div>

            <div>
              <h2>API Key (optional)</h2>
              <input
                type="password"
                value={keyShardStorageBackend.apiKey || ''}
                onChange={(e) => setKeyShardStorageBackend({
                  ...keyShardStorageBackend,
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
            <option value="swarm" disabled>Swarm (Coming Soon)</option>
            <option value="ipfs" disabled>IPFS (Coming Soon)</option>
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
      </div>



      <div>
        <h2>Apply Configuration</h2>
        <button onClick={handleApplyConfig}>
          Apply All Changes
        </button>
      </div>

      <div>
        <h2>Troubleshooting</h2>
        <p>If you're experiencing database errors or corruption issues:</p>
        <button onClick={clearAllData}>
          Clear All Data & Reset
        </button>
        <p><small><strong>Warning:</strong> This will delete all backups, services, and configurations!</small></p>
      </div>

      {status && (
        <div>
          <h3>{status.type === 'error' ? 'Error' : status.type === 'success' ? 'Success' : 'Info'}</h3>
          <p>{status.message}</p>
        </div>
      )}
    </div>
  )
} 