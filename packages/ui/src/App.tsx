import { useState } from 'react'
import BackupComponent from './components/BackupComponent'
import RestoreComponent from './components/RestoreComponent'
import ConfigComponent from './components/ConfigComponent'
import { ShamirConfig, StorageBackend, SafeConfig } from '@resilient-backup/library'

type Tab = 'backup' | 'restore' | 'config'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('backup')
  const [shamirConfig, setShamirConfig] = useState<ShamirConfig>({
    threshold: 3,
    totalShares: 5
  })
  const [storageBackend, setStorageBackend] = useState<StorageBackend>({
    type: 'swarm',
    endpoint: 'http://localhost:8080'
  })
  const [safeConfig, setSafeConfig] = useState<SafeConfig>({
    safeAddress: '',
    chainId: 1,
    owners: []
  })

  return (
    <div className="App">
      <h1>Resilient Backup System</h1>
      <p>Secure wallet profile backup with Shamir Secret Sharing and Safe authentication</p>
      
      <nav style={{ margin: '2rem 0' }}>
        <button 
          className={`btn ${activeTab === 'backup' ? '' : 'btn-secondary'}`}
          onClick={() => setActiveTab('backup')}
          style={{ marginRight: '1rem' }}
        >
          Backup
        </button>
        <button 
          className={`btn ${activeTab === 'restore' ? '' : 'btn-secondary'}`}
          onClick={() => setActiveTab('restore')}
          style={{ marginRight: '1rem' }}
        >
          Restore
        </button>
        <button 
          className={`btn ${activeTab === 'config' ? '' : 'btn-secondary'}`}
          onClick={() => setActiveTab('config')}
        >
          Configuration
        </button>
      </nav>

      {activeTab === 'backup' && (
        <BackupComponent 
          shamirConfig={shamirConfig}
          storageBackend={storageBackend}
          safeConfig={safeConfig}
        />
      )}
      
      {activeTab === 'restore' && (
        <RestoreComponent 
          shamirConfig={shamirConfig}
          storageBackend={storageBackend}
          safeConfig={safeConfig}
        />
      )}
      
      {activeTab === 'config' && (
        <ConfigComponent 
          shamirConfig={shamirConfig}
          setShamirConfig={setShamirConfig}
          storageBackend={storageBackend}
          setStorageBackend={setStorageBackend}
          safeConfig={safeConfig}
          setSafeConfig={setSafeConfig}
        />
      )}
    </div>
  )
}

export default App 