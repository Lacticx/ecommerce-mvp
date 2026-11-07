const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.resolve(__dirname, '../../../proto/ecommerce.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const ecommerceProto = grpc.loadPackageDefinition(packageDef).ecommerce;

const authClient = new ecommerceProto.AuthService(
  process.env.AUTH_SERVICE_URL || '127.0.0.1:50051',
  grpc.credentials.createInsecure()
);

const customerClient = new ecommerceProto.CustomerService(
  process.env.CUSTOMER_SERVICE_URL || '127.0.0.1:50052',
  grpc.credentials.createInsecure()
);

const productClient = new ecommerceProto.ProductService(
  process.env.PRODUCT_SERVICE_URL || '127.0.0.1:50053',
  grpc.credentials.createInsecure()
);

const orderClient = new ecommerceProto.OrderService(
  process.env.ORDER_SERVICE_URL || '127.0.0.1:50054',
  grpc.credentials.createInsecure()
);

const shipmentClient = new ecommerceProto.ShipmentService(
  process.env.SHIPMENT_SERVICE_URL || '127.0.0.1:50055',
  grpc.credentials.createInsecure()
);

const callGrpc = (client, method, payload = {}) =>
  new Promise((resolve, reject) => {
    client[method](payload, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });

module.exports = {
  authClient,
  customerClient,
  productClient,
  orderClient,
  shipmentClient,
  callGrpc,
};