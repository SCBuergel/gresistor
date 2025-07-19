import { Router, Request, Response } from 'express'
import { ShardService } from '../services/ShardService'

export const shardRoutes: Router = Router()
const shardService = new ShardService()

/**
 * Request a key shard with EIP-712 signature validation
 */
shardRoutes.post('/request', async (req: Request, res: Response) => {
  try {
    const { shardId, requesterAddress, signature, message, publicKey } = req.body

    if (!shardId || !requesterAddress || !signature || !message || !publicKey) {
      return res.status(400).json({
        error: 'Missing required fields: shardId, requesterAddress, signature, message, publicKey'
      })
    }

    const encryptedShard = await shardService.requestShard({
      shardId,
      requesterAddress,
      signature,
      message,
      publicKey
    })

    res.json({
      success: true,
      encryptedShard
    })
  } catch (error) {
    console.error('Shard request failed:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
})

/**
 * Store a key shard
 */
shardRoutes.post('/store', async (req: Request, res: Response) => {
  try {
    const { shardId, encryptedShard, user } = req.body

    if (!shardId || !encryptedShard) {
      return res.status(400).json({
        error: 'Missing required fields: shardId, encryptedShard'
      })
    }

    await shardService.storeShard({
      shardId,
      encryptedShard,
      user
    })

    res.json({
      success: true,
      message: 'Shard stored successfully'
    })
  } catch (error) {
    console.error('Shard storage failed:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
})

/**
 * Check if a shard exists
 */
shardRoutes.get('/:shardId/exists', async (req: Request, res: Response) => {
  try {
    const { shardId } = req.params
    const exists = await shardService.shardExists(shardId)
    
    res.json({
      exists,
      shardId
    })
  } catch (error) {
    console.error('Shard existence check failed:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
})

/**
 * List shards for a specific user
 */
shardRoutes.get('/user/:userAddress', async (req: Request, res: Response) => {
  try {
    const { userAddress } = req.params
    const shardIds = await shardService.listShardsForUser(userAddress)
    
    res.json({
      success: true,
      userAddress,
      shardIds,
      count: shardIds.length
    })
  } catch (error) {
    console.error('User shard listing failed:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}) 