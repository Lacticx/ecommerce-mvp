require('dotenv').config();
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const productRepository = require('./infrastructure/product.repository');
const productGrpcController = require('./interfaces/grpc.controller');

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
  await productRepository.initDbAndSeed();
  console.log('[Product Service] Connected to MongoDB and seeded default products.');

  const server = new grpc.Server();
  server.addService(ecommerceProto.ProductService.service, productGrpcController);

  const port = process.env.GRPC_PORT || 50053;
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error('[Product Service] Failed to bind server:', err);
        process.exit(1);
      }
      console.log(`[Product Service] gRPC Server running on port ${boundPort}`);
    }
  );
}

startServer();