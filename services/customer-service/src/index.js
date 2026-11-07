require('dotenv').config();
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const customerRepository = require('./infrastructure/customer.repository');
const customerGrpcController = require('./interfaces/grpc.controller');

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
  await customerRepository.initDbAndSeed();
  console.log('[Customer Service] Database tables initialized and MemberShip seeded.');

  const server = new grpc.Server();
  server.addService(ecommerceProto.CustomerService.service, customerGrpcController);

  const port = process.env.GRPC_PORT || 50052;
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error('[Customer Service] Failed to bind server:', err);
        process.exit(1);
      }
      console.log(`[Customer Service] gRPC Server running on port ${boundPort}`);
    }
  );
}

startServer();