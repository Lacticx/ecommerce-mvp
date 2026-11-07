const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.resolve(__dirname, '../../proto/ecommerce.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, { keepCase: true });
const ecommerceProto = grpc.loadPackageDefinition(packageDef).ecommerce;

const client = new ecommerceProto.CustomerService(
  'localhost:50052',
  grpc.credentials.createInsecure()
);

const callRpc = (method, payload) =>
  new Promise((resolve) => {
    client[method](payload, (err, res) => resolve({ err, res }));
  });

async function runTests() {
  console.log('--- RUNNING CUSTOMER & MEMBERSHIP TEST CASES ---');

  // TC-CUS-01: Lấy Customer tồn tại (uid = 1)
  const tc1 = await callRpc('GetCustomer', { uid: 1 });
  console.log('TC-CUS-01 (Get Existing Customer):', tc1.err ? tc1.err.message : tc1.res);

  // TC-CUS-02: Lấy Customer không tồn tại (uid = 9999 -> 404 NOT_FOUND - gRPC code 5)
  const tc2 = await callRpc('GetCustomer', { uid: 9999 });
  console.log('TC-CUS-02 (Customer Not Found):', tc2.err ? `Code ${tc2.err.code}: ${tc2.err.details}` : tc2.res);

  // TC-CUS-03: Cập nhật fullname hợp lệ (uid = 1, fullname = 'John Smith', mid = 2)
  const tc3 = await callRpc('UpdateCustomer', { uid: 1, fullname: 'John Smith', mid: 2 });
  const verifyTc3 = await callRpc('GetCustomer', { uid: 1 });
  console.log('TC-CUS-03 (Update Fullname):', tc3.err ? tc3.err.message : { updateRes: tc3.res, updatedCustomer: verifyTc3.res });

  // TC-CUS-04: Lấy thông tin Membership (Trả mname và score)
  const tc4 = await callRpc('GetMembershipScore', { uid: 1 });
  console.log('TC-CUS-04 (Get Membership Score):', tc4.err ? tc4.err.message : tc4.res);
}

runTests();