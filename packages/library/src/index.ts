// Core services
export { BackupService } from './backup';
export { EncryptionService } from './encryption';
export { ShamirSecretSharing } from './shamir';
export { KeyShareRegistryService, KeyShareStorageService, BaseKeyShareStorage, NodeKeyShareStorage, BrowserKeyShareStorage, SimpleKeyShardStorage } from './KeySharing';
export { BrowserStorageService, InMemoryStorageService, EncryptedDataStorageService } from './EncryptedDataStorage';
export { SafeAuthService } from './safe-auth';
export { SIWESafeAuthService } from './siwe-safe-auth';
export { WalletConnector } from './wallet-connector';
export type { WalletType, WalletConnection } from './wallet-connector';

// Types
export * from './types';
export type { KeyShareService } from './KeySharing';

// Main API
export { BackupService as default } from './backup';

// Removed CLI export for browser compatibility 