"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shardRoutes = void 0;
const express_1 = require("express");
const ShardService_1 = require("../services/ShardService");
exports.shardRoutes = (0, express_1.Router)();
const shardService = new ShardService_1.ShardService();
/**
 * Request a key shard with EIP-712 signature validation
 */
exports.shardRoutes.post('/request', async (req, res) => {
    try {
        const { shardId, requesterAddress, signature, message, publicKey } = req.body;
        if (!shardId || !requesterAddress || !signature || !message || !publicKey) {
            return res.status(400).json({
                error: 'Missing required fields: shardId, requesterAddress, signature, message, publicKey'
            });
        }
        const encryptedShard = await shardService.requestShard({
            shardId,
            requesterAddress,
            signature,
            message,
            publicKey
        });
        res.json({
            success: true,
            encryptedShard
        });
    }
    catch (error) {
        console.error('Shard request failed:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
/**
 * Store a key shard
 */
exports.shardRoutes.post('/store', async (req, res) => {
    try {
        const { shardId, encryptedShard } = req.body;
        if (!shardId || !encryptedShard) {
            return res.status(400).json({
                error: 'Missing required fields: shardId, encryptedShard'
            });
        }
        await shardService.storeShard({
            shardId,
            encryptedShard
        });
        res.json({
            success: true,
            message: 'Shard stored successfully'
        });
    }
    catch (error) {
        console.error('Shard storage failed:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
/**
 * Check if a shard exists
 */
exports.shardRoutes.get('/:shardId/exists', async (req, res) => {
    try {
        const { shardId } = req.params;
        const exists = await shardService.shardExists(shardId);
        res.json({
            exists,
            shardId
        });
    }
    catch (error) {
        console.error('Shard existence check failed:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});
//# sourceMappingURL=shards.js.map