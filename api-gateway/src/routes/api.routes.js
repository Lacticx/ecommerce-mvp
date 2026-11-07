const express = require('express');
const router = express.Router();
const { redisClient } = require('../config/redis');
const {
  authClient,
  customerClient,
  productClient,
  orderClient,
  shipmentClient,
  callGrpc,
} = require('../grpc-clients');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth.middleware');
const { handleGrpcError } = require('../utils/grpc-error.mapper');

// ==========================================
// 0. SYSTEM HEALTH CHECK (API-HEALTH-01)
// ==========================================
router.get('/health', async (req, res) => {
  try {
    const redisPing = redisClient.isOpen ? await redisClient.ping() : 'DOWN';
    if (redisPing !== 'PONG') {
      return res.status(503).json({ status: 'DOWN', message: 'Redis is unhealthy' });
    }
    return res.status(200).json({
      status: 'UP',
      message: 'E-commerce API is running',
    });
  } catch (err) {
    return res.status(503).json({ status: 'DOWN', message: err.message });
  }
});

// ==========================================
// 1. IDENTITY & ACCESS ROUTES (API-AUTH-01, 02)
// ==========================================
router.post('/auth/register', async (req, res) => {
  try {
    const result = await callGrpc(authClient, 'Register', req.body);
    // Tự động khởi tạo hồ sơ Customer mặc định bên Customer Service
    try {
      await callGrpc(customerClient, 'CreateCustomer', {
        uid: result.uid,
        fullname: req.body.fullname || req.body.username,
        mid: 1,
      });
    } catch (_) {
      // Bỏ qua nếu hồ sơ đã tồn tại
    }
    return res.status(201).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const result = await callGrpc(authClient, 'Login', req.body);
    return res.status(200).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

// ==========================================
// 2. CUSTOMER & MEMBERSHIP ROUTES (API-CUS-01, 02)
// ==========================================
router.get('/customers/:uid', authenticateJWT, async (req, res) => {
  try {
    const uid = parseInt(req.params.uid, 10);
    const result = await callGrpc(customerClient, 'GetCustomer', { uid });
    return res.status(200).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

router.put('/customers/:uid', authenticateJWT, async (req, res) => {
  try {
    const uid = parseInt(req.params.uid, 10);
    if (req.user.role !== 'ADMIN' && req.user.uid !== uid) {
      return res.status(403).json({ error: 'Forbidden: Cannot update another customer profile' });
    }
    const result = await callGrpc(customerClient, 'UpdateCustomer', {
      uid,
      fullname: req.body.fullname,
      mid: req.body.mid,
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

// ==========================================
// 3. PRODUCT CATALOG ROUTES + REDIS CACHE (API-PRO-01 -> 05)
// ==========================================
async function invalidateProductCache(pid) {
  if (!redisClient.isOpen) return;
  await redisClient.del('cache:products:all');
  if (pid) await redisClient.del(`cache:products:${pid}`);
}

router.get('/products', authenticateJWT, async (req, res) => {
  try {
    const cacheKey = 'cache:products:all';
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    }

    const result = await callGrpc(productClient, 'GetProducts', {});
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(result));
    }
    return res.status(200).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

router.get('/products/:pid', authenticateJWT, async (req, res) => {
  try {
    const pid = parseInt(req.params.pid, 10);
    const cacheKey = `cache:products:${pid}`;
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    }

    const result = await callGrpc(productClient, 'GetProductById', { pid });
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 60, JSON.stringify(result));
    }
    return res.status(200).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

router.post('/products', authenticateJWT, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const result = await callGrpc(productClient, 'CreateProduct', req.body);
    await invalidateProductCache();
    return res.status(201).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

router.put('/products/:pid', authenticateJWT, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const pid = parseInt(req.params.pid, 10);
    const result = await callGrpc(productClient, 'UpdateProduct', {
      pid,
      ...req.body,
    });
    await invalidateProductCache(pid);
    return res.status(200).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

router.delete('/products/:pid', authenticateJWT, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const pid = parseInt(req.params.pid, 10);
    const result = await callGrpc(productClient, 'DeleteProduct', { pid });
    await invalidateProductCache(pid);
    return res.status(200).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

// ==========================================
// 4. ORDER MANAGEMENT ROUTES (API-ORD-01 -> 03)
// ==========================================
router.post('/orders', authenticateJWT, async (req, res) => {
  try {
    const result = await callGrpc(orderClient, 'CreateOrder', {
      uid: req.user.uid,
      items: req.body.items,
    });
    // Xóa cache sản phẩm vì tồn kho đã thay đổi sau khi đặt hàng
    await invalidateProductCache();
    return res.status(201).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

router.get('/orders', authenticateJWT, async (req, res) => {
  try {
    const result = await callGrpc(orderClient, 'GetOrders', {
      uid: req.user.uid,
      role: req.user.role,
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

router.get('/orders/:oid', authenticateJWT, async (req, res) => {
  try {
    const oid = parseInt(req.params.oid, 10);
    const result = await callGrpc(orderClient, 'GetOrderById', {
      oid,
      uid: req.user.uid,
      role: req.user.role,
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

// ==========================================
// 5. SHIPMENT ROUTES (API-SHP-01, 02)
// ==========================================
router.get('/shipments/:shipid', authenticateJWT, async (req, res) => {
  try {
    const shipid = parseInt(req.params.shipid, 10);
    const result = await callGrpc(shipmentClient, 'GetShipmentById', { shipid });
    return res.status(200).json(result);
  } catch (err) {
    return handleGrpcError(res, err);
  }
});

router.patch(
  '/shipments/:shipid/status',
  authenticateJWT,
  authorizeRoles('SHIPMENT_STAFF', 'ADMIN'),
  async (req, res) => {
    try {
      const shipid = parseInt(req.params.shipid, 10);
      const result = await callGrpc(shipmentClient, 'UpdateShipmentStatus', {
        shipid,
        status: req.body.status,
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleGrpcError(res, err);
    }
  }
);

module.exports = router;