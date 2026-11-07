const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.resolve(__dirname, '../../proto/ecommerce.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, { keepCase: true });
const ecommerceProto = grpc.loadPackageDefinition(packageDef).ecommerce;

const client = new ecommerceProto.AuthService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

const callRpc = (method, payload) =>
  new Promise((resolve) => {
    client[method](payload, (err, res) => resolve({ err, res }));
  });

async function runTests() {
  console.log('--- RUNNING 5 IAM TEST CASES ---');

  // TC-IAM-01: Đăng ký tài khoản hợp lệ
  const tc1 = await callRpc('Register', { username: 'john_doe', password: 'Password123' });
  console.log('TC-IAM-01 (Valid Register):', tc1.err ? tc1.err.message : tc1.res);

  // TC-IAM-02: Đăng ký username đã tồn tại (409 ALREADY_EXISTS - gRPC code 6)
  const tc2 = await callRpc('Register', { username: 'john_doe', password: 'Password123' });
  console.log('TC-IAM-02 (Duplicate Username):', tc2.err ? `Code ${tc2.err.code}: ${tc2.err.details}` : tc2.res);

  // TC-IAM-03: Đăng ký thiếu password (400 INVALID_ARGUMENT - gRPC code 3)
  const tc3 = await callRpc('Register', { username: 'jane_doe', password: '' });
  console.log('TC-IAM-03 (Missing Password):', tc3.err ? `Code ${tc3.err.code}: ${tc3.err.details}` : tc3.res);

  // TC-IAM-04: Đăng nhập đúng thông tin
  const tc4 = await callRpc('Login', { username: 'john_doe', password: 'Password123' });
  console.log('TC-IAM-04 (Valid Login):', tc4.err ? tc4.err.message : { ...tc4.res, accessToken: tc4.res.accessToken.substring(0, 25) + '...' });

  // TC-IAM-05: Đăng nhập sai password (401 UNAUTHENTICATED - gRPC code 16)
  const tc5 = await callRpc('Login', { username: 'john_doe', password: 'WrongPassword' });
  console.log('TC-IAM-05 (Wrong Password):', tc5.err ? `Code ${tc5.err.code}: ${tc5.err.details}` : tc5.res);
}

runTests();