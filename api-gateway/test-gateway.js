require('dotenv').config();
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function waitForPort(port, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for port ${port} to open`);
}

const spawnedProcesses = [];

async function ensureService(name, port, dir, customEnv) {
  if (await isPortOpen(port)) {
    console.log(`[Check] ${name} already running on port ${port}`);
    return;
  }
  console.log(`[Auto-Start] Starting ${name} on port ${port}...`);
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: dir,
    stdio: 'inherit',
    env: { ...process.env, ...customEnv },
  });
  spawnedProcesses.push(child);
  await waitForPort(port);
}

async function httpRequest(method, endpoint, token = null, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`http://127.0.0.1:3000${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data, rateLimitRemaining: res.headers.get('x-ratelimit-remaining') };
}

async function runTests() {
  try {
    const rootServices = path.resolve(__dirname, '../services');

    await ensureService('Auth Service', 50051, path.join(rootServices, 'auth-service'), {
      DATABASE_URL: 'postgresql://postgres:password123@127.0.0.1:5433/auth_db',
      JWT_SECRET: 'super_secret_ecommerce_jwt_key_2026',
      GRPC_PORT: '50051',
    });
    await ensureService('Customer Service', 50052, path.join(rootServices, 'customer-service'), {
      DATABASE_URL: 'postgresql://postgres:password123@127.0.0.1:5434/customer_db',
      GRPC_PORT: '50052',
    });
    await ensureService('Product Service', 50053, path.join(rootServices, 'product-service'), {
      MONGO_URI: 'mongodb://127.0.0.1:27017/product_db',
      GRPC_PORT: '50053',
    });
    await ensureService('Order Service', 50054, path.join(rootServices, 'order-service'), {
      DATABASE_URL: 'postgresql://postgres:password123@127.0.0.1:5435/order_db',
      KAFKA_BROKERS: '127.0.0.1:9092',
      CUSTOMER_SERVICE_URL: '127.0.0.1:50052',
      PRODUCT_SERVICE_URL: '127.0.0.1:50053',
      GRPC_PORT: '50054',
    });
    await ensureService('Shipment Service', 50055, path.join(rootServices, 'shipment-service'), {
      MONGO_URI: 'mongodb://127.0.0.1:27018/shipment_db',
      KAFKA_BROKERS: '127.0.0.1:9092',
      GRPC_PORT: '50055',
    });
    await ensureService('API Gateway', 3000, __dirname, {
      PORT: '3000',
      REDIS_URL: 'redis://127.0.0.1:6379',
    });

    console.log('\n--- RUNNING API GATEWAY & END-TO-END REST TESTS ---');

    // 1. Health Check (API-HEALTH-01)
    const health = await httpRequest('GET', '/api/health');
    console.log('1. Health Check (GET /api/health):', health);

    // 2. TC-CUS-05: Truy vấn Customer không có token -> Trả 401 Unauthorized
    const tcCus05 = await httpRequest('GET', '/api/customers/1');
    console.log('2. TC-CUS-05 (GET /api/customers/1 without JWT):', tcCus05);

    // 3. TC-ORD-02: Tạo Order không có JWT -> Trả 401 Unauthorized
    const tcOrd02 = await httpRequest('POST', '/api/orders', null, { items: [{ pid: 1, qty: 1 }] });
    console.log('3. TC-ORD-02 (POST /api/orders without JWT):', tcOrd02);

    // 4. Đăng nhập Customer (john_doe) & Đăng ký + Đăng nhập Admin (admin)
    const custLogin = await httpRequest('POST', '/api/auth/login', null, {
      username: 'john_doe',
      password: 'Password123',
    });
    const customerToken = custLogin.data.accessToken;

    await httpRequest('POST', '/api/auth/register', null, {
      username: 'admin',
      password: 'AdminPassword123',
    });
    const adminLogin = await httpRequest('POST', '/api/auth/login', null, {
      username: 'admin',
      password: 'AdminPassword123',
    });
    const adminToken = adminLogin.data.accessToken;

    // 5. Kiểm tra RBAC: Customer cố tình tạo Product -> 403 Forbidden (UC13)
    const forbiddenCreate = await httpRequest('POST', '/api/products', customerToken, {
      pname: 'Unauthorized Item',
      price: 100,
      quantity: 5,
    });
    console.log('4. RBAC Check (Customer POST /api/products -> 403):', forbiddenCreate);

    // 6. Kiểm tra RBAC: Admin tạo Product -> 201 Created
    const adminCreate = await httpRequest('POST', '/api/products', adminToken, {
      pname: 'Gaming Monitor',
      price: 350,
      quantity: 20,
    });
    console.log('5. RBAC Check (Admin POST /api/products -> 201):', adminCreate);

    // 7. Đặt hàng End-to-End qua API Gateway (POST /api/orders)
    const orderRes = await httpRequest('POST', '/api/orders', customerToken, {
      items: [{ pid: 2, qty: 1 }],
    });
    console.log('6. End-to-End Place Order (POST /api/orders):', orderRes);
  } finally {
    for (const proc of spawnedProcesses) {
      proc.kill();
    }
    process.exit(0);
  }
}

runTests();