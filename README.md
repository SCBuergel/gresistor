# 🛡️ Resilient Backup System

A robust, decentralized backup system for wallet profile data using **Shamir Secret Sharing** and multiple storage backends.

> **🚀 Live Demo:** [https://scbuergel.github.io/gresistor/](https://scbuergel.github.io/gresistor/)

*Last updated: January 2025*

---

## ✨ Features

- 🔐 **Shamir Secret Sharing** - Split sensitive data into multiple shares with configurable threshold schemes
- 🌐 **Multiple Storage Backends** - Support for local browser storage, IPFS, and remote services  
- 🔒 **Safe Wallet Integration** - Backup and restore Safe wallet configurations and transaction data
- 🛡️ **End-to-End Encryption** - Client-side encryption ensures complete data privacy
- 🌍 **Browser-First Design** - Works entirely in the browser with no server dependencies required
- ⚡ **Zero-Trust Architecture** - Your keys never leave your device unencrypted

---

## 🏗️ Architecture

This project is organized as a **monorepo** with the following packages:

```
📦 resilient-backup/
├── 📚 packages/library/     # Core TypeScript library with backup/restore logic
├── 🎨 packages/ui/          # React-based user interface  
└── 🚀 services/key-backup/  # Optional Express.js backend for remote key storage
```

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
- 🎨 **UI Server** → `http://localhost:3000`
- 🚀 **Backend Service** → `http://localhost:3001` *(optional)*

### Production Build

```bash
# Build for production
pnpm run deploy
```

---

## 📖 How It Works

### 1. **🔧 Configure Storage**
Set up your preferred storage backends in the **Config** tab

### 2. **💾 Create Backup** 
Enter your sensitive data and configure Shamir sharing parameters

### 3. **✂️ Generate Shares**
The system splits your data into encrypted shares using cryptographic algorithms

### 4. **🌍 Distribute Shares**
Store shares across different services and locations for maximum resilience

### 5. **🔄 Restore Data**
Collect the required threshold of shares to reconstruct your original data

---

## 🔒 Security Features

- **AES-256-GCM Encryption** - Industry-standard encryption for your data
- **Shamir Secret Sharing** - Mathematically proven threshold cryptography
- **EIP-712 Signatures** - Safe wallet signature validation
- **EIP-1271 Support** - Smart contract signature verification
- **Optional Privacy Routing** - Tor/HOPR integration available

---

## 🛠️ Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + Node.js  
- **Crypto**: Web Crypto API + Shamir Secret Sharing
- **Storage**: IndexedDB, IPFS, Swarm
- **Build**: pnpm workspaces + GitHub Actions

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🎯 Project Vision

The project's aim is to provide a **general-purpose, resilient backup system** while immediately covering the concrete need to safeguard wallet profile data. Each profile is encrypted locally with **AES-256-GCM**, the encryption key is split with **Shamir secret sharing**, and both the ciphertext and the key shards are uploaded through a plain HTTP API to user-selected storage backends such as **Swarm** or **IPFS**. Optional privacy routing via **Tor** or **HOPR** can be enabled but is not required by default.

### 🏗️ Core Architecture

Three core services make this work:

1. **📚 TypeScript Library** - Handles encryption, key splitting, upload, recovery, and Safe-signature generation/verification
2. **🎨 React UI** - Consumes the library allowing users to choose N-of-M parameters, storage targets, and run backup/restore operations
3. **🚀 Key-Backup Service** - Validates off-chain EIP-712 messages signed by Gnosis Safe, encrypts requested shards, and returns them securely

### 🧪 Development Environment

A **local test harness** completes the picture: it spins up the UI, multiple dockerized storage nodes that mimic Swarm or IPFS APIs, and one instance of the key-backup service, allowing any developer to exercise a full **M-of-N backup and restore cycle** on a laptop with no external dependencies.

Implementation axes and selectable options

– Authentication / authorisation of key-share release
• Safe off-chain REST: EIP-712 message signed by Safe owners, verified by key-backup service with EIP-1271
• Safe on-chain exchange: service writes the encrypted share to a contract event that only the Safe can decrypt / read
• Fallback single-device key or password for air-gapped scenarios

– Transport for blob and shard upload / download
• Plain HTTP (default)
• HTTP routed through Tor SOCKS proxy
• HTTP routed through HOPR mixnet

– Key-splitting / recovery scheme
• Shamir Secret Sharing (N-of-M, default)
• Simple XOR two-of-two split for very small setups

– Symmetric encryption primitive
• AES-256-GCM (hardware-accelerated, default)
• ChaCha20-Poly1305 for CPUs without AES-NI
• AES-GCM-SIV when nonce-misuse resistance is required

– Nonce strategy
• Random 96-bit nonce per backup (default)
• Persistent counter stored alongside profile
• XChaCha20 192-bit nonce when using the ChaCha suite

– Encrypted blob storage back ends
• Swarm (recommended for redundancy)
• IPFS pinning service or self-hosted IPFS node
• Local filesystem or NAS share for offline tests
• Generic S3/WebDAV adapter for cloud buckets

– Key-share storage / delivery back ends
• Same Swarm or IPFS as blob for simplicity
• Dedicated key-backup REST service with Safe validation
• Secrets manager such as Hashicorp Vault in enterprise deployments

– Developer workflow options
• pnpm monorepo with React + Vite example UI (default)
• CLI-only prototype driven by Node scripts
• Browser extension front-end if Metri moves to in-tab backups

– Quorum parameters
• User-chosen N and M at backup time
• Hard-coded 3-of-5 for quick demos
