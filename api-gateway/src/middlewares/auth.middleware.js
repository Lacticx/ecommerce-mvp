const { redisClient } = require('../config/redis');
const { authClient, callGrpc } = require('../grpc-clients');

async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization Bearer token' });
  }

  const token = authHeader.split(' ')[1];
  const cacheKey = `auth:token:${token}`;

  try {
    // 1. Kiểm tra cache token trên Redis trước để tăng tốc độ xác thực
    if (redisClient.isOpen) {
      const cachedUser = await redisClient.get(cacheKey);
      if (cachedUser) {
        req.user = JSON.parse(cachedUser);
        return next();
      }
    }

    // 2. Nếu chưa có trong Redis, gọi gRPC sang Auth Service (Bước 2 trong Business-Process-Model.png)
    const verifyRes = await callGrpc(authClient, 'VerifyToken', { token });
    if (!verifyRes || !verifyRes.valid) {
      return res.status(401).json({ error: 'Invalid or expired JWT token' });
    }

    const userPayload = { uid: verifyRes.uid, role: verifyRes.role };

    // 3. Lưu kết quả xác thực vào Redis trong 10 phút (600s)
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(userPayload));
    }

    req.user = userPayload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Requires one of roles [${allowedRoles.join(', ')}]`,
      });
    }
    next();
  };
}

module.exports = {
  authenticateJWT,
  authorizeRoles,
};