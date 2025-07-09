# 🛡️ gresistor - Gnosis Resilient Storage

A robust, decentralized backup system for wallet profile data using **Shamir Secret Sharing** and multiple storage backends.

> **🚀 Live Demo:** [https://scbuergel.github.io/gresistor/](https://scbuergel.github.io/gresistor/)

*Last updated: July 2025*

---

## ✨ Features

### ✅ **Implemented**
- 🔐 **Shamir Secret Sharing** - Split sensitive data into configurable N-of-M threshold schemes
- 🏠 **Local Browser Storage** - Full support for IndexedDB-based storage with multiple service management
- 🔒 **AES-256-GCM Encryption** - Client-side encryption ensures complete data privacy
- 🌍 **Browser-First Design** - Works entirely in the browser with no server dependencies
- ⚡ **Zero-Trust Architecture** - Your keys never leave your device unencrypted
- 🎨 **React UI** - Complete user interface for backup, restore, and configuration
- 📚 **TypeScript Library** - Full core library with backup/restore logic

### 🚧 **Planned / In Development**
- 🌐 **Remote Storage Backends** - IPFS and Swarm integration *(API stubs ready)*
- 🛡️ **Safe Wallet Integration** - EIP-712 signature validation and EIP-1271 support *(structure in place)*
- 🚀 **Remote Key-Backup Service** - Secure shard storage with Safe authentication *(server framework ready)*
- 🔒 **Privacy Routing** - Enhanced anonymity features
- 🔧 **Additional Encryption Options** - ChaCha20-Poly1305 and AES-GCM-SIV algorithms
- 📊 **Advanced Nonce Strategies** - Counter-based and XChaCha20 192-bit nonces

---

## 🏗️ Architecture

This project is organized as a **monorepo** with the following packages:

```
📦 gresistor/
├── 📚 packages/library/     # ✅ Core TypeScript library (IMPLEMENTED)
├── 🎨 packages/ui/          # ✅ React-based user interface (IMPLEMENTED)
└── 🚀 services/key-backup/  # 🚧 Express.js backend for remote storage (PLANNED)
```

### Current Implementation Status

| Component | Status | Description |
|-----------|--------|-------------|
| **Core Library** | ✅ Complete | Encryption, Shamir sharing, local storage |
| **React UI** | ✅ Complete | Backup, restore, and configuration interfaces |
| **Local Storage** | ✅ Complete | IndexedDB with multi-service management |
| **Remote Storage** | 🚧 API Only | Swarm/IPFS interfaces defined but not implemented |
| **Safe Integration** | 🚧 Stubs | EIP-712/EIP-1271 structure in place |
| **Key-Backup Service** | 🚧 Framework | Express server with route stubs |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ 
- **pnpm** 8+

### Installation

```bash
# Clone the repository
git clone https://github.com/SCBuergel/gresistor.git
cd gresistor

# Install dependencies
pnpm install
```

### Development

```bash
# Start all services
pnpm dev
```

This launches:
- 🎨 **UI Server** → `http://localhost:3000` *(fully functional)*
- 🚀 **Backend Service** → `http://localhost:3001` *(framework only)*

### Production Build

```bash
# Build for production
pnpm run deploy
```

### Testing

```bash
# Run end-to-end tests (headless, fast)
pnpm test:e2e

# Run with debug mode (conditional pauses)
pnpm test:e2e:debug

# Run with visible browser window
pnpm test:e2e:headed
```

---

## 📖 How It Works

### Current Workflow (Local Storage)

1. **🔧 Configure Storage** - Set up local browser storage services in the Config tab
2. **💾 Create Backup** - Enter your sensitive data and configure N-of-M parameters  
3. **✂️ Generate Shares** - System splits data using AES-256-GCM + Shamir Secret Sharing
4. **🏠 Store Locally** - Shards distributed across multiple IndexedDB services
5. **🔄 Restore Data** - Collect required threshold of shards to reconstruct original data

### Planned Workflow (Remote Storage)

1. **🌍 Configure Backends** - Choose from IPFS, Swarm, or remote key services
2. **🛡️ Safe Authentication** - Sign EIP-712 messages for secure shard requests
3. **📤 Distributed Storage** - Upload encrypted blob and shards to different services
4. **🔐 Secure Retrieval** - Authenticate with Safe to retrieve and reconstruct data

---

## 🛠️ Technology Stack

### ✅ **Currently Used**
- **Frontend**: React + TypeScript + Vite
- **Crypto**: Web Crypto API + shamirs-secret-sharing
- **Storage**: IndexedDB (browser-native)
- **Build**: pnpm workspaces

### 🚧 **Planned Integration**
- **Backend**: Express.js + Node.js
- **Remote Storage**: IPFS, Swarm APIs  
- **Blockchain**: Safe SDK, EIP-712/EIP-1271
- **Privacy**: Enhanced anonymity protocols
- **CI/CD**: GitHub Actions

---

## 🧪 Testing

### End-to-End Testing with Playwright

The project includes comprehensive **Playwright** tests that validate the complete backup and restore workflow:

#### Test Coverage
- ✅ **Service Creation** - Configure multiple key share storage services
- ✅ **Shamir Configuration** - Set up N-of-M threshold schemes (2-of-3, 2-of-2)
- ✅ **Backup Creation** - Create encrypted backups with profile data
- ✅ **Authentication Flow** - Test no-auth, mock-signature, and safe-signature services
- ✅ **Restore Workflow** - Complete backup restoration with shard selection
- ✅ **State Persistence** - Verify data persists across browser sessions

#### Running Tests

```bash
# Quick test run (headless, ~5 seconds)
pnpm test:e2e

# Debug mode with conditional pauses
pnpm test:e2e:debug

# Visual debugging with browser window
pnpm test:e2e:headed
```

#### Test Workflow

The complete test suite validates this end-to-end workflow:

1. **🔧 Service Setup** - Creates 3 storage services with different auth types
2. **⚙️ Shamir Config** - Configures 2-of-3 threshold, then changes to 2-of-2
3. **💾 Backup Creation** - Creates backup with profile data using 2 services
4. **🔄 Restore Process** - Selects backup, authenticates services, selects shards
5. **✅ Verification** - Confirms profile data is restored and persists

#### Test Features
- **Persistent Browser Profile** - Uses `.pw-profile` for state persistence across tests
- **Reliable Selectors** - Uses `data-testid` attributes for stable element targeting
- **Serial Execution** - Tests run in sequence to maintain state continuity
- **Fast Execution** - Complete workflow tested in ~5 seconds

---

## 🔒 Security Model

### Current Implementation
- **AES-256-GCM** encryption with 96-bit random nonces
- **Shamir Secret Sharing** with user-configurable N-of-M thresholds
- **Browser-only execution** - no server-side key handling
- **Multiple storage services** for redundancy within browser

### Planned Enhancements
- **EIP-712 signature validation** for shard requests
- **Safe multisig authentication** via EIP-1271
- **Transport-layer privacy** via enhanced routing protocols
- **Hardware security module** support for enterprise deployments

---

## 🎯 Development Roadmap

### Phase 1: Core Foundation ✅ **COMPLETE**
- [x] TypeScript library with Shamir sharing
- [x] AES-256-GCM encryption
- [x] Local browser storage
- [x] React UI components

### Phase 2: Remote Storage 🚧 **IN PROGRESS**
- [ ] IPFS backend implementation
- [ ] Swarm backend implementation  
- [ ] Remote service API completion
- [ ] Integration testing

### Phase 3: Safe Integration 📋 **PLANNED**
- [ ] EIP-712 message signing
- [ ] EIP-1271 signature verification
- [ ] Safe SDK integration
- [ ] Multi-owner authentication

### Phase 4: Privacy & Enterprise 🔮 **FUTURE**
- [ ] Enhanced privacy transport layers
- [ ] Alternative encryption algorithms
- [ ] Hardware security modules
- [ ] Enterprise key management

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

This project is actively being developed. The core library and UI are functional for local storage use cases. 

**Current priorities:**
1. Complete IPFS/Swarm storage backend implementations
2. Implement Safe wallet authentication features  
3. Build out the remote key-backup service functionality

See the roadmap above for detailed development phases.
