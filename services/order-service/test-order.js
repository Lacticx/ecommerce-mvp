require('dotenv').config();
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const { Pool } = require('pg');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.resolve(__dirname, '../../proto/ecommerce.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, { keepCase: true });
const ecommerceProto = grpc.loadPackageDefinition(packageDef).ecommerce;

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

async function ensureServiceRunning(name, port, serviceDir, customEnv) {
  const open = await isPortOpen(port);
  if (open) {
    console.log(`[Check] ${name} is already running on port ${port}.`);
    return;
  }
  console.log(`[Auto-Start] Starting ${name} on port ${port}...`);
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: serviceDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...customEnv,
      GRPC_PORT: String(port),
    },
  });
  spawnedProcesses.push(child);
  await waitForPort(port);
}

const client = new ecommerceProto.OrderService(
  '127.0.0.1:50054',
  grpc.credentials.createInsecure()
);

const callRpc = (method, payload) =>
  new Promise((resolve) => {
    client[method](payload, (err, res) => resolve({ err, res }));
  });

async function runTests() {
  try {
    // 1. Đảm bảo Customer Service chạy trên cổng 50052 với customer_db (5434)
    await ensureServiceRunning(
      'Customer Service',
      50052,
      path.resolve(__dirname, '../customer-service'),
      { DATABASE_URL: 'postgresql://postgres:password123@127.0.0.1:5434/customer_db' }
    );

    // 2. Đảm bảo Product Service chạy trên cổng 50053 với product_db (27017)
    await ensureServiceRunning(
      'Product Service',
      50053,
      path.resolve(__dirname, '../product-service'),
      { MONGO_URI: 'mongodb://127.0.0.1:27017/product_db' }
    );

    // 3. Đảm bảo Order Service chạy trên cổng 50054 với order_db (5435)
    await ensureServiceRunning(
      'Order Service',
      50054,
      path.resolve(__dirname, '../order-service'),
      {
        DATABASE_URL: 'postgresql://postgres:password123@127.0.0.1:5435/order_db',
        KAFKA_BROKERS: '127.0.0.1:9092',
        CUSTOMER_SERVICE_URL: '127.0.0.1:50052',
        PRODUCT_SERVICE_URL: '127.0.0.1:50053',
      }
    );

    console.log('\n--- RUNNING ORDER MANAGEMENT TEST CASES ---');

    // TC-ORD-01 & TC-ORD-04: Tạo Order hợp lệ + Tính discount theo score (uid=1 có score=100 -> discount=10)
    const tc1 = await callRpc('CreateOrder', {
      uid: 1,
      items: [
        { pid: 1, qty: 1 },
        { pid: 2, qty: 2 },
      ],
    });
    console.log(
      'TC-ORD-01 (Create Valid Order & OrderDetail):',
      tc1.err ? tc1.err.message : tc1.res
    );
    console.log(
      'TC-ORD-04 (Calculate Discount from Score=100):',
      tc1.res ? `Discount = ${tc1.res.discount}` : 'Failed'
    );

    // TC-ORD-03: Đặt số lượng vượt tồn kho (qty = 9999 > quantity -> 409 ALREADY_EXISTS - gRPC code 6)
    const tc3 = await callRpc('CreateOrder', {
      uid: 1,
      items: [{ pid: 1, qty: 9999 }],
    });
    console.log(
      'TC-ORD-03 (Exceed Stock Quantity):',
      tc3.err ? `Code ${tc3.err.code}: ${tc3.err.details}` : tc3.res
    );

    // Đợi 1 giây để Kafka Producer/Outbox cập nhật trạng thái PUBLISHED
    await new Promise((r) => setTimeout(r, 1000));

    // TC-ORD-05: Kiểm tra OutboxEvent đã được lưu và phát OrderCreated vào Kafka
    const pool = new Pool({
      connectionString: 'postgresql://postgres:password123@127.0.0.1:5435/order_db',
    });
    const outboxRes = await pool.query(
      `SELECT id, aggregate_id, event_type, status FROM "OutboxEvent" ORDER BY id DESC LIMIT 1`
    );
    console.log('TC-ORD-05 (Outbox & Kafka Event Published):', outboxRes.rows[0]);
    await pool.end();
  } finally {
    for (const proc of spawnedProcesses) {
      proc.kill();
    }
    process.exit(0);
  }
}

runTests();