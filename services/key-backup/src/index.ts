import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { shardRoutes } from './routes/shards'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/shards', shardRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
app.listen(PORT, () => {
  console.log(`Key backup service running on port ${PORT}`)
}) 