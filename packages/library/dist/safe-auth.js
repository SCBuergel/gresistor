"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafeAuthService = void 0;
class SafeAuthService {
    constructor(config) {
        this.config = config;
    }
    /**
     * Creates EIP-712 message for shard request
     */
    createShardRequestMessage(shardId, requesterAddress) {
        // Stub implementation
        throw new Error('createShardRequestMessage() not implemented');
    }
    /**
     * Signs an EIP-712 message (would typically be done by Safe)
     */
    async signMessage(message) {
        // Stub implementation
        throw new Error('signMessage() not implemented');
    }
    /**
     * Verifies EIP-712 signature using EIP-1271
     */
    async verifySignature(message, signature) {
        // Stub implementation
        throw new Error('verifySignature() not implemented');
    }
    /**
     * Checks if address is a Safe owner
     */
    async isOwner(address) {
        // Stub implementation
        return this.config.owners.includes(address.toLowerCase());
    }
}
exports.SafeAuthService = SafeAuthService;
//# sourceMappingURL=safe-auth.js.map