The project’s aim is to provide a general-purpose, resilient backup system while immediately covering the concrete need to safeguard wallet profile data. Each profile is encrypted locally with AES-256-GCM, the encryption key is split with Shamir secret sharing, and both the ciphertext and the key shards are uploaded through a plain HTTP API to user-selected storage back ends such as Swarm or IPFS. Optional privacy routing via Tor or HOPR can be enabled but is not required by default.

Three core services make this work. First, a TypeScript library handles encryption, key splitting, upload, recovery, and Safe-signature generation or verification. Second, a reference React UI consumes that library so users can choose N-of-M parameters, storage targets, and run backup or restore, while the interface prompts for Safe signatures whenever a shard is requested. Third, a lightweight key-backup service validates off-chain EIP-712 messages signed by the user’s Gnosis Safe (checked with EIP-1271), then encrypts the requested shard to the caller’s supplied public key and returns it.

A local test harness completes the picture: it spins up the UI, multiple dockerised storage nodes that mimic Swarm or IPFS APIs, and one instance of the key-backup service, allowing any developer to exercise a full M-of-N backup and restore cycle on a laptop with no external dependencies.

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
