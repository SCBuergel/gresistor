import { useState, useEffect } from 'react'
import BackupComponent from './components/BackupComponent'
import RestoreComponent from './components/RestoreComponent'
import ConfigComponent from './components/ConfigComponent'
import { ShamirConfig, KeyShardStorageBackend, EncryptedDataStorage, SafeConfig } from '@gresistor/library'

const DEFAULT_SHAMIR_CONFIG: ShamirConfig = {
  threshold: 3,
  totalShares: 5
}

const DEFAULT_KEY_SHARD_STORAGE_BACKEND: KeyShardStorageBackend = {
  type: 'local-browser'
}

const DEFAULT_ENCRYPTED_DATA_STORAGE: EncryptedDataStorage = {
  type: 'local-browser'
}

const DEFAULT_SAFE_CONFIG: SafeConfig = {
  safeAddress: '',
  chainId: 100,
  owners: []
}

type Tab = 'backup' | 'restore' | 'config'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('backup')
  const [shamirConfig, setShamirConfig] = useState<ShamirConfig>(DEFAULT_SHAMIR_CONFIG)
  const [keyShardStorageBackend, setKeyShardStorageBackend] = useState<KeyShardStorageBackend>(DEFAULT_KEY_SHARD_STORAGE_BACKEND)
  const [encryptedDataStorage, setEncryptedDataStorage] = useState<EncryptedDataStorage>(DEFAULT_ENCRYPTED_DATA_STORAGE)
  const [safeConfig, setSafeConfig] = useState<SafeConfig>(DEFAULT_SAFE_CONFIG)

  useEffect(() => {
    const saved = localStorage.getItem('gresistor-config')
    if (saved) {
      try {
        const config = JSON.parse(saved)
        if (config.shamirConfig) setShamirConfig(config.shamirConfig)
        if (config.keyShardStorageBackend) setKeyShardStorageBackend(config.keyShardStorageBackend)
        if (config.storageBackend) setKeyShardStorageBackend(config.storageBackend) // Legacy support
        if (config.encryptedDataStorage) setEncryptedDataStorage(config.encryptedDataStorage)
        if (config.safeConfig) setSafeConfig(config.safeConfig)
      } catch (error) {
        console.warn('Failed to load saved configuration:', error)
      }
    }
  }, [])

  useEffect(() => {
    const config = {
      shamirConfig,
      keyShardStorageBackend,
      encryptedDataStorage,
      safeConfig
    }
    localStorage.setItem('gresistor-config', JSON.stringify(config))
  }, [shamirConfig, keyShardStorageBackend, encryptedDataStorage, safeConfig])

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
  }

  return (
    <div>
      <h1>gresistor - Gnosis Resilient Storage</h1>
      <p>Secure wallet profile backup with Shamir Secret Sharing and Safe authentication</p>
      
      <nav>
        <button onClick={() => handleTabChange('backup')}>
          {activeTab === 'backup' ? <b>Backup</b> : 'Backup'}
        </button>
        <button onClick={() => handleTabChange('restore')}>
          {activeTab === 'restore' ? <b>Restore</b> : 'Restore'}
        </button>
        <button onClick={() => handleTabChange('config')}>
          {activeTab === 'config' ? <b>Config</b> : 'Config'}
        </button>
      </nav>

      <hr />

      {activeTab === 'backup' && (
        <BackupComponent
          shamirConfig={shamirConfig}
          keyShardStorageBackend={keyShardStorageBackend}
          encryptedDataStorage={encryptedDataStorage}
          safeConfig={safeConfig}
        />
      )}
      
      {activeTab === 'restore' && (
        <RestoreComponent
          shamirConfig={shamirConfig}
          keyShardStorageBackend={keyShardStorageBackend}
          encryptedDataStorage={encryptedDataStorage}
          safeConfig={safeConfig}
        />
      )}
      
      {activeTab === 'config' && (
        <ConfigComponent
          shamirConfig={shamirConfig}
          setShamirConfig={setShamirConfig}
          keyShardStorageBackend={keyShardStorageBackend}
          setKeyShardStorageBackend={setKeyShardStorageBackend}
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