import { useState, useEffect } from 'react'
import BackupComponent from './components/BackupComponent'
import RestoreComponent from './components/RestoreComponent'
import ConfigComponent from './components/ConfigComponent'
import { ShamirConfig, StorageBackend, EncryptedDataStorage, SafeConfig } from '@gresistor/library'

type Tab = 'backup' | 'restore' | 'config'

// Helper functions for localStorage persistence
const SHAMIR_CONFIG_KEY = 'gresistor-shamir-config'

const loadShamirConfigFromStorage = (): ShamirConfig => {
  try {
    const stored = localStorage.getItem(SHAMIR_CONFIG_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate the parsed data has the required fields
      if (typeof parsed.threshold === 'number' && typeof parsed.totalShares === 'number') {
        return {
          threshold: Math.max(2, Math.min(20, parsed.threshold)), // Clamp to reasonable bounds
          totalShares: Math.max(parsed.threshold, Math.min(20, parsed.totalShares))
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load Shamir config from localStorage:', error)
  }
  // Return default values if localStorage is empty or invalid
  return { threshold: 3, totalShares: 5 }
}

const saveShamirConfigToStorage = (config: ShamirConfig) => {
  try {
    localStorage.setItem(SHAMIR_CONFIG_KEY, JSON.stringify(config))
  } catch (error) {
    console.warn('Failed to save Shamir config to localStorage:', error)
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('backup')
  const [shamirConfig, setShamirConfig] = useState<ShamirConfig>(loadShamirConfigFromStorage())
  const [storageBackend, setStorageBackend] = useState<StorageBackend>({
    type: 'local-browser',
    endpoint: ''
  })
  const [encryptedDataStorage, setEncryptedDataStorage] = useState<EncryptedDataStorage>({
    type: 'local-browser'
  })
  const [safeConfig, setSafeConfig] = useState<SafeConfig>({
    safeAddress: '',
    chainId: 100,
    owners: []
  })

  // Persist shamirConfig to localStorage whenever it changes
  useEffect(() => {
    saveShamirConfigToStorage(shamirConfig)
  }, [shamirConfig])

  return (
    <div>
      <h1>gresistor - Gnosis Resilient Storage</h1>
      <p>Secure wallet profile backup with Shamir Secret Sharing and Safe authentication</p>
      
      <nav>
        <button onClick={() => setActiveTab('backup')}>
          {activeTab === 'backup' ? <b>Backup</b> : 'Backup'}
        </button>
        {' '}
        <button onClick={() => setActiveTab('restore')}>
          {activeTab === 'restore' ? <b>Restore</b> : 'Restore'}
        </button>
        {' '}
        <button onClick={() => setActiveTab('config')}>
          {activeTab === 'config' ? <b>Configuration</b> : 'Configuration'}
        </button>
      </nav>

      <hr />

      {activeTab === 'backup' && (
        <BackupComponent 
          shamirConfig={shamirConfig}
          storageBackend={storageBackend}
          encryptedDataStorage={encryptedDataStorage}
          safeConfig={safeConfig}
        />
      )}
      
      {activeTab === 'restore' && (
        <RestoreComponent 
          shamirConfig={shamirConfig}
          storageBackend={storageBackend}
          encryptedDataStorage={encryptedDataStorage}
          safeConfig={safeConfig}
        />
      )}
      
      {activeTab === 'config' && (
        <ConfigComponent 
          shamirConfig={shamirConfig}
          setShamirConfig={setShamirConfig}
          storageBackend={storageBackend}
          setStorageBackend={setStorageBackend}
          encryptedDataStorage={encryptedDataStorage}
          setEncryptedDataStorage={setEncryptedDataStorage}
          safeConfig={safeConfig}
          setSafeConfig={setSafeConfig}
        />
      )}
    </div>
  )
}

export default App 