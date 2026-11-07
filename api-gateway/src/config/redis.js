const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
});

redisClient.on('error', (err) => {
  console.error('[API Gateway] Redis Error:', err.message);
});

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('[API Gateway] Connected to Redis (Cache & Rate Limiting).');
  }
}

module.exports = {
  redisClient,
  connectRedis,
};