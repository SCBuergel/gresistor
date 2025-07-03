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
// @ts-ignore - shamirs-secret-sharing doesn't have official types
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
        const { threshold, totalShares } = this.config;
        try {
            // Split the secret using shamirs-secret-sharing
            const shares = sss.split(secret, { shares: totalShares, threshold });
            // Convert shares to KeyShard format
            const keyShards = [];
            for (let i = 0; i < shares.length; i++) {
                keyShards.push({
                    id: `share_${i + 1}`,
                    data: shares[i],
                    threshold,
                    totalShares
                });
            }
            return keyShards;
        }
        catch (error) {
            throw new Error(`Failed to split secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Reconstructs the secret from shares
     */
    async reconstructSecret(shares) {
        if (shares.length < this.config.threshold) {
            throw new Error(`Need at least ${this.config.threshold} shares to reconstruct the secret`);
        }
        try {
            // Convert shares to the format expected by shamirs-secret-sharing
            const shareBuffers = shares.map(share => share.data);
            const reconstructed = sss.combine(shareBuffers);
            return reconstructed;
        }
        catch (error) {
            throw new Error(`Failed to reconstruct secret: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Validates that the shares are consistent
     */
    validateShards(shards) {
        if (shards.length === 0) {
            return false;
        }
        const firstShard = shards[0];
        return shards.every(shard => shard.threshold === firstShard.threshold &&
            shard.totalShares === firstShard.totalShares &&
            shard.data.length === firstShard.data.length);
    }
}
exports.ShamirSecretSharing = ShamirSecretSharing;
//# sourceMappingURL=shamir.js.map