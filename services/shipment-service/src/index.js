require('dotenv').config();
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const shipmentRepository = require('./infrastructure/shipment.repository');
const { startKafkaConsumer } = require('./infrastructure/kafka.consumer');
const shipmentGrpcController = require('./interfaces/grpc.controller');

const PROTO_PATH = path.resolve(__dirname, '../../../proto/ecommerce.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const ecommerceProto = grpc.loadPackageDefinition(packageDefinition).ecommerce;

async function startServer() {
  await shipmentRepository.initDb();
  console.log('[Shipment Service] Connected to MongoDB (shipment_db).');

  try {
    await startKafkaConsumer();
  } catch (err) {
    console.warn('[Shipment Service] Kafka Consumer warning:', err.message);
  }

  const server = new grpc.Server();
  server.addService(ecommerceProto.ShipmentService.service, shipmentGrpcController);

  const port = process.env.GRPC_PORT || 50055;
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error('[Shipment Service] Failed to bind server:', err);
        process.exit(1);
      }
      console.log(`[Shipment Service] gRPC Server running on port ${boundPort}`);
    }
  );
}

startServer();