require('dotenv').config();
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const userRepository = require('./infrastructure/user.repository');
const authGrpcController = require('./interfaces/grpc.controller');

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
  await userRepository.initDbAndSeedRoles();
  console.log('[Auth Service] Database tables initialized and Roles seeded.');

  const server = new grpc.Server();
  server.addService(ecommerceProto.AuthService.service, authGrpcController);

  const port = process.env.GRPC_PORT || 50051;
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error('[Auth Service] Failed to bind server:', err);
        process.exit(1);
      }
      console.log(`[Auth Service] gRPC Server running on port ${boundPort}`);
    }
  );
}

startServer();