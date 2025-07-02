import { ShamirConfig, StorageBackend, SafeConfig } from '@resilient-backup/library'

interface ConfigComponentProps {
  shamirConfig: ShamirConfig
  setShamirConfig: (config: ShamirConfig) => void
  storageBackend: StorageBackend
  setStorageBackend: (backend: StorageBackend) => void
  safeConfig: SafeConfig
  setSafeConfig: (config: SafeConfig) => void
}

export default function ConfigComponent({
  shamirConfig,
  setShamirConfig,
  storageBackend,
  setStorageBackend,
  safeConfig,
  setSafeConfig
}: ConfigComponentProps) {

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
        <h2>Storage Backend</h2>
        <p>Configure where encrypted data and shards are stored</p>
        
        <div className="form-group">
          <label htmlFor="storageType">Storage Type:</label>
          <select
            id="storageType"
            value={storageBackend.type}
            onChange={(e) => setStorageBackend({
              ...storageBackend,
              type: e.target.value as 'swarm' | 'ipfs' | 'local'
            })}
          >
            <option value="swarm">Swarm</option>
            <option value="ipfs">IPFS</option>
            <option value="local">Local</option>
          </select>
        </div>

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