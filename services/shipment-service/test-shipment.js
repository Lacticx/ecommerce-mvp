require('dotenv').config();
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const shipmentUseCase = require('./src/application/shipment.usecase');
const shipmentRepository = require('./src/infrastructure/shipment.repository');

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

let spawnedServer = null;

const client = new ecommerceProto.ShipmentService(
  '127.0.0.1:50055',
  grpc.credentials.createInsecure()
);

const callRpc = (method, payload) =>
  new Promise((resolve) => {
    client[method](payload, (err, res) => resolve({ err, res }));
  });

async function runTests() {
  try {
    const open = await isPortOpen(50055);
    if (!open) {
      console.log('[Auto-Start] Starting Shipment Service on port 50055...');
      spawnedServer = spawn(process.execPath, ['src/index.js'], {
        cwd: __dirname,
        stdio: 'inherit',
        env: {
          ...process.env,
          MONGO_URI: 'mongodb://127.0.0.1:27018/shipment_db',
          KAFKA_BROKERS: '127.0.0.1:9092',
          GRPC_PORT: '50055',
        },
      });
      await waitForPort(50055);
    }

    // Kết nối DB cho tiến trình test để kiểm tra trực tiếp
    await shipmentRepository.initDb();

    // Đợi 2 giây để Kafka Consumer kịp xử lý message từ topic 'order-created'
    await new Promise((r) => setTimeout(r, 2000));

    console.log('\n--- RUNNING 5 SHIPMENT TEST CASES ---');

    // TC-SHP-01: Nhận OrderCreated Event hợp lệ -> Tạo Shipment (status = PENDING)
    const tc1 = await shipmentUseCase.handleOrderCreatedEvent({
      eventType: 'OrderCreated',
      oid: 1,
      uid: 1,
    });
    console.log('TC-SHP-01 (Valid OrderCreated Event):', tc1.shipment);

    // TC-SHP-02: Event thiếu oid -> Không tạo Shipment, ghi nhận lỗi
    try {
      await shipmentUseCase.handleOrderCreatedEvent({ eventType: 'OrderCreated' });
      console.log('TC-SHP-02 (Missing oid Event): Failed (Should have thrown error)');
    } catch (err) {
      console.log('TC-SHP-02 (Missing oid Event Rejected):', `${err.code}: ${err.message}`);
    }

    // TC-SHP-03: Cập nhật trạng thái Shipment hợp lệ (status = SHIPPING) qua gRPC
    const targetShipId = tc1.shipment.shipid;
    const tc3 = await callRpc('UpdateShipmentStatus', {
      shipid: targetShipId,
      status: 'SHIPPING',
    });
    console.log('TC-SHP-03 (Update Shipment Status to SHIPPING):', tc3.err ? tc3.err.message : tc3.res);

    // TC-SHP-04: Cập nhật Shipment không tồn tại (shipid = 9999 -> 404 NOT_FOUND - gRPC code 5)
    const tc4 = await callRpc('UpdateShipmentStatus', {
      shipid: 9999,
      status: 'SHIPPING',
    });
    console.log(
      'TC-SHP-04 (Update Non-Existent Shipment):',
      tc4.err ? `Code ${tc4.err.code}: ${tc4.err.details}` : tc4.res
    );

    // TC-SHP-05: Nhận cùng OrderCreated Event hai lần (Idempotency) -> Không tạo Shipment trùng
    const secondCall = await shipmentUseCase.handleOrderCreatedEvent({
      eventType: 'OrderCreated',
      oid: 1,
      uid: 1,
    });
    const countOid1 = await shipmentRepository.countByOrderId(1);
    console.log('TC-SHP-05 (Duplicate Event Idempotency):', {
      createdNewOnSecondEvent: secondCall.createdNew,
      totalShipmentsForOid1: countOid1,
      shipment: secondCall.shipment,
    });
  } finally {
    if (spawnedServer) {
      spawnedServer.kill();
    }
    process.exit(0);
  }
}

runTests();