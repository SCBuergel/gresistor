"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShamirSecretSharing = void 0;
const sss = __importStar(require("shamirs-secret-sharing"));
// Browser-compatible Shamir Secret Sharing implementation
class ShamirSecretSharing {
    constructor(config) {
        this.config = config;
    }
    /**
     * Splits a secret into N shares using Shamir Secret Sharing
     */
    async splitSecret(secret) {
        console.log('🔧 [SHAMIR] splitSecret() called');
        console.log('   📊 Config:', {
            threshold: this.config.threshold,
            totalShares: this.config.totalShares,
            secretSize: secret.length
        });
        const { threshold, totalShares } = this.config;
        try {
            console.log('   🔑 Converting secret to buffer for processing...');
            // Split the secret using shamirs-secret-sharing
            const shares = sss.split(secret, { shares: totalShares, threshold });
            console.log('   ✂️  Generated shares:', shares.length);
            // Convert shares to KeyShard format
            const keyShards = [];
            for (let i = 0; i < shares.length; i++) {
                const share = shares[i];
                console.log(`   📦 Share ${i + 1}: ${share.length} bytes`);
                keyShards.push({
                    id: `share_${i + 1}`,
                    data: share,
                    threshold,
                    totalShares
                });
            }
            console.log('   ✅ Secret splitting completed');
            return keyShards;
        }
        catch (error) {
            console.error('   ❌ [SHAMIR] Secret splitting failed:', error);
            throw error;
        }
    }
    /**
     * Reconstructs the secret from shares
     */
    async reconstructSecret(shares) {
        console.log('🔧 [SHAMIR] reconstructSecret() called');
        console.log('   📊 Input:', {
            sharesCount: shares.length,
            requiredThreshold: this.config.threshold,
            totalShares: this.config.totalShares
        });
        if (shares.length < this.config.threshold) {
            console.error('   ❌ [SHAMIR] Insufficient shares for reconstruction');
            throw new Error(`Need at least ${this.config.threshold} shares to reconstruct the secret`);
        }
        try {
            // Convert shares to the format expected by shamirs-secret-sharing
            const shareBuffers = [];
            for (let i = 0; i < shares.length; i++) {
                const share = shares[i];
                console.log(`   📦 Share ${i + 1}: ${share.data.length} bytes`);
                shareBuffers.push(share.data);
            }
            console.log('   🔑 [SHAMIR] Reconstructing secret using shamirs-secret-sharing...');
            const reconstructed = sss.combine(shareBuffers);
            console.log('   ✅ [SHAMIR] Secret reconstruction successful');
            console.log('   📊 Reconstructed bytes length:', reconstructed.length);
            return reconstructed;
        }
        catch (error) {
            console.error('   ❌ [SHAMIR] Secret reconstruction failed:', error);
            console.error('   🔍 Error details:', {
                message: error instanceof Error ? error.message : String(error),
                type: error instanceof Error ? error.constructor.name : typeof error
            });
            throw error;
        }
    }
    /**
     * Validates that the shares are consistent
     */
    validateShards(shards) {
        console.log('🔧 [SHAMIR] validateShards() called');
        console.log('   📊 Shards count:', shards.length);
        if (shards.length === 0) {
            console.log('   ❌ [SHAMIR] No shards provided');
            return false;
        }
        const firstShard = shards[0];
        const isValid = shards.every((shard, index) => {
            const valid = shard.threshold === firstShard.threshold &&
                shard.totalShares === firstShard.totalShares &&
                shard.data.length === firstShard.data.length;
            if (!valid) {
                console.log(`   ❌ [SHAMIR] Shard ${index + 1} validation failed:`, {
                    threshold: shard.threshold,
                    totalShares: shard.totalShares,
                    dataLength: shard.data.length,
                    expectedThreshold: firstShard.threshold,
                    expectedTotalShares: firstShard.totalShares,
                    expectedDataLength: firstShard.data.length
                });
            }
            return valid;
        });
        console.log('   ✅ [SHAMIR] Shard validation:', isValid ? 'PASSED' : 'FAILED');
        return isValid;
    }
}
exports.ShamirSecretSharing = ShamirSecretSharing;
//# sourceMappingURL=shamir.js.map