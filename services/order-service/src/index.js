require('dotenv').config();
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const orderRepository = require('./infrastructure/order.repository');
const kafkaProducer = require('./infrastructure/kafka.producer');
const orderGrpcController = require('./interfaces/grpc.controller');

const PROTO_PATH = path.resolve(__dirname, '../../../proto/ecommerce.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const ecommerceProto = grpc.loadPackageDefinition(packageDefinition).ecommerce;

// Background worker quét bảng OutboxEvent định kỳ để retry nếu Kafka tạm thời gián đoạn
function startOutboxPoller() {
  setInterval(async () => {
    try {
      const pendingEvents = await orderRepository.findPendingOutboxEvents();
      for (const evt of pendingEvents) {
        await kafkaProducer.publishOrderCreatedEvent(evt.payload);
        await orderRepository.markOutboxPublished(evt.id);
        console.log(`[Order Service] Outbox event #${evt.id} published to Kafka.`);
      }
    } catch (err) {
      // Sẽ tự động thử lại ở chu kỳ tiếp theo
    }
  }, 5000);
}

async function startServer() {
  await orderRepository.initDb();
  console.log('[Order Service] PostgreSQL tables (Order, OrderDetail, OutboxEvent) initialized.');

  await kafkaProducer.connectProducer();
  startOutboxPoller();

  const server = new grpc.Server();
  server.addService(ecommerceProto.OrderService.service, orderGrpcController);

  const port = process.env.GRPC_PORT || 50054;
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error('[Order Service] Failed to bind server:', err);
        process.exit(1);
      }
      console.log(`[Order Service] gRPC Server running on port ${boundPort}`);
    }
  );
}

startServer();