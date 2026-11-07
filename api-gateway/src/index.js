require('dotenv').config();
const express = require('express');
const { connectRedis } = require('./config/redis');
const loggerMiddleware = require('./middlewares/logger.middleware');
const rateLimiterMiddleware = require('./middlewares/rateLimiter.middleware');
const apiRoutes = require('./routes/api.routes');

const app = express();
app.use(express.json());
app.use(loggerMiddleware);
app.use(rateLimiterMiddleware);

app.use('/api', apiRoutes);

const port = process.env.PORT || 3000;

async function startGateway() {
  await connectRedis();
  app.listen(port, () => {
    console.log(`[API Gateway] HTTP REST Server running on http://127.0.0.1:${port}`);
  });
}

startGateway();