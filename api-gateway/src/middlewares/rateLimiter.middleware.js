const { redisClient } = require('../config/redis');

async function rateLimiterMiddleware(req, res, next) {
  try {
    if (!redisClient.isOpen) return next();

    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `ratelimit:${clientIp}`;
    const windowSec = parseInt(process.env.RATE_LIMIT_WINDOW_SEC || '60', 10);
    const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

    const currentCount = await redisClient.incr(key);
    if (currentCount === 1) {
      await redisClient.expire(key, windowSec);
    }

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount));

    if (currentCount > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests, please try again later.',
      });
    }

    next();
  } catch (err) {
    // Nếu Redis gặp sự cố tạm thời, vẫn cho phép request đi qua (Fail-open)
    next();
  }
}

module.exports = rateLimiterMiddleware;