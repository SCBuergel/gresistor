import { useState } from 'react'
import BackupComponent from './components/BackupComponent'
import RestoreComponent from './components/RestoreComponent'
import ConfigComponent from './components/ConfigComponent'
import { ShamirConfig, StorageBackend, EncryptedDataStorage, SafeConfig } from '@resilient-backup/library'

type Tab = 'backup' | 'restore' | 'config'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('backup')
  const [shamirConfig, setShamirConfig] = useState<ShamirConfig>({
    threshold: 3,
    totalShares: 5
  })
  const [storageBackend, setStorageBackend] = useState<StorageBackend>({
    type: 'local-browser',
    endpoint: ''
  })
  const [encryptedDataStorage, setEncryptedDataStorage] = useState<EncryptedDataStorage>({
    type: 'local-browser'
  })
  const [safeConfig, setSafeConfig] = useState<SafeConfig>({
    safeAddress: '',
    chainId: 1,
    owners: []
  })

  return (
    <div>
      <h1>Resilient Backup System</h1>
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