# Detailed Refactoring Plan for Gresistor

## Overview
This document provides a detailed, step-by-step plan for refactoring the Gresistor project. Each change is designed to be implemented and tested independently before moving to the next step.

## Prerequisites
- Ensure all changes are reverted to the original working state
- Run `npm run build` to verify the project builds successfully
- Run `npm test` (if available) to ensure all tests pass

## Phase 1: Remove Excessive Logging

### Step 1.1: Identify and Document Current Logging
**Files to examine:**
- `/packages/library/src/backup.ts`
- `/packages/library/src/storage.ts`
- `/packages/library/src/safe-auth.ts`
- `/packages/library/src/encryption.ts`
- `/packages/library/src/shamir.ts`

**Action:**
1. Create a list of all console.log statements
2. Categorize them as:
   - Essential (errors, critical warnings)
   - Debug (can be removed or made conditional)
   - Info (status updates that might be useful)

### Step 1.2: Remove Non-Essential Logging
**Specific changes:**

1. In `backup.ts`:
   - Remove console.log statements in the `backup()` method that log intermediate steps
   - Keep only error logging
   - Example: Remove lines like `console.log('🔐 Starting backup process...')`

2. In `storage.ts`:
   - Remove verbose logging in `validateAuthData()` method
   - Remove logging in `getAuthTypeDescription()`
   - Keep error logging for failed operations

3. In other files:
   - Apply similar pattern: remove info/debug logs, keep error logs

**Testing after this step:**
```bash
npm run build
# Manually test backup and restore functionality
# Verify no functionality is broken
```

## Phase 2: Fix TypeScript Errors and Method Usage

### Step 2.1: Fix BackupService TypeScript Error
**File:** `/packages/library/src/backup.ts`
**Line:** ~259

**Current problematic code:**
```typescript
const latestShard = await storageService.getAuthorizedShard(
  authData,
  Date.now()
);
```

**Issue:** The `getAuthorizedShard` method expects a timestamp as the second parameter, but the method signature might not match the usage.

**Fix:**
1. Check the actual signature of `getAuthorizedShard` in `storage.ts`
2. If it needs adjustment, use:
```typescript
const allShards = await storageService.getAllShardsWithAuth(authData);
const latestShard = allShards.length > 0 
  ? allShards.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    )
  : null;
```

**Testing:**
```bash
npm run build
# Should compile without TypeScript errors
```

## Phase 3: Simplify Mock Authentication

### Step 3.1: Document Current Mock Auth Logic
**Files:** `/packages/library/src/storage.ts`

**Current logic:**
- Mock signature validation uses "address * 2" pattern
- Requires specific signature format "mock-sigmock-sig"

### Step 3.2: Simplify Mock Auth Validation
**Changes:**

1. In `KeyShareStorageService.validateAuthData()`:
   - Replace the complex number multiplication logic
   - Simply check that signature exists and is non-empty
   
2. In `SimpleKeyShardStorage.validateAuthData()`:
   - Remove the "mock-sigmock-sig" requirement
   - Just validate presence of signature

**Specific code changes:**
```typescript
case 'mock-signature-2x':
  if (!authData || !authData.ownerAddress || !authData.signature) {
    console.error(`Mock signature auth requires ownerAddress and signature`);
    return false;
  }
  // Simple validation - just check signature exists
  return authData.signature.length > 0;
```

**Testing:**
```bash
npm run build
# Test with mock authentication
# Ensure existing auth flows still work
```

## Phase 4: Consolidate Storage Type Definitions

### Step 4.1: Identify Redundant Types
**File:** `/packages/library/src/types.ts`

**Redundant types:**
- `KeyShardStorageBackend`
- `EncryptedDataStorage`
- `KeyShareStorage`

All have identical structure except `KeyShareStorage` has an additional `selectedServices` field.

### Step 4.2: Create Unified Type
**Changes:**

1. Create a base `StorageConfig` interface:
```typescript
export interface StorageConfig {
  type: 'swarm' | 'ipfs' | 'local-browser' | 'memory';
  endpoint?: string;
  apiKey?: string;
  selectedServices?: string[]; // Optional for specific use cases
}
```

2. Create type aliases for backward compatibility:
```typescript
export type KeyShardStorageBackend = StorageConfig;
export type EncryptedDataStorage = StorageConfig;
export type KeyShareStorage = StorageConfig;
```

**Testing:**
```bash
npm run build
# Ensure no type errors
# Verify existing code using old type names still works
```

## Phase 5: Extract Business Logic to Library

### Step 5.1: Identify Business Logic in UI
**Files to examine:**
- `/packages/ui/src/components/BackupComponent.tsx`
- `/packages/ui/src/components/RestoreComponent.tsx`

**Logic to extract:**
- Service initialization and configuration
- Backup orchestration logic
- Restore orchestration logic
- Authentication validation

### Step 5.2: Create BackupManager Service
**File:** Create `/packages/library/src/backup-manager.ts`

**Structure:**
```typescript
export class BackupManager {
  private backupService: BackupService;
  private registryService: KeyShareRegistryService;
  
  constructor(config: BackupManagerConfig) {
    // Initialize services
  }
  
  // High-level methods that UI can call
  async performBackup(profile: BackupProfile, services: string[]): Promise<BackupResult>
  async performRestore(request: RestoreRequest): Promise<BackupProfile>
  async validateServiceAuth(serviceName: string, authData: AuthData): Promise<boolean>
  async getAvailableServices(): Promise<ServiceInfo[]>
}
```

### Step 5.3: Update UI to Use BackupManager
**Changes:**
1. Import BackupManager in UI components
2. Replace direct service calls with BackupManager methods
3. Simplify UI components to focus on presentation

**Testing:**
```bash
npm run build
# Test backup flow
# Test restore flow
# Ensure all functionality preserved
```

## Phase 6: Create Configuration Manager

### Step 6.1: Design Configuration Structure
**Requirements:**
- Centralize all configuration
- Support different config types (storage, shamir, transport, etc.)
- Provide easy access and updates

### Step 6.2: Implement ConfigManager
**File:** Create `/packages/library/src/config-manager.ts`

**Key features:**
- Singleton pattern for global access
- Type-safe configuration access
- Default values
- Configuration validation

**Testing:**
```bash
npm run build
# Test configuration changes
# Verify defaults work correctly
```

## Phase 7: Standardize Error Handling

### Step 7.1: Design Error Hierarchy
**Base error class:**
```typescript
export class GresistorError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'GresistorError';
  }
}
```

**Specific error types:**
- AuthenticationError
- StorageError
- EncryptionError
- ShamirError
- BackupError
- RestoreError
- ConfigurationError

### Step 7.2: Replace Generic Errors
**Process:**
1. Find all `throw new Error()` statements
2. Replace with appropriate custom error type
3. Add error codes for better debugging

**Testing:**
```bash
npm run build
# Test error scenarios
# Verify error messages are clear and helpful
```

## Phase 8: Fix Import/Export Issues

### Step 8.1: Audit Current Exports
**File:** `/packages/library/src/index.ts`

**Check:**
- All public APIs are exported
- No internal implementation details are exposed
- Type exports are complete

### Step 8.2: Fix UI Import Statements
**Files:**
- `/packages/ui/src/components/BackupComponent.tsx`
- `/packages/ui/src/components/RestoreComponent.tsx`

**Common issues:**
- Missing imports for new services

## Testing Strategy

### After Each Phase:
1. Run `npm run build` to check for compilation errors
2. Run `npm test` if tests exist
3. Manually test the specific functionality affected
4. Commit changes if successful
5. Document any issues encountered

### Integration Testing:
After all phases complete:
1. Full backup and restore flow
2. All authentication methods
3. All storage backends
4. Error scenarios

## Rollback Strategy

If any phase causes issues:
1. Use git to revert to the last working commit
2. Analyze what went wrong
3. Adjust the plan for that phase
4. Re-attempt with smaller changes

## Notes

- Each phase should be completed and tested before moving to the next
- If a phase seems too large, break it down further
- Keep the UI minimal as requested
- Preserve all existing functionality
- No breaking changes to public APIs
