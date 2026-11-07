const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.resolve(__dirname, '../../proto/ecommerce.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, { keepCase: true });
const ecommerceProto = grpc.loadPackageDefinition(packageDef).ecommerce;

const client = new ecommerceProto.ProductService(
  'localhost:50053',
  grpc.credentials.createInsecure()
);

const callRpc = (method, payload) =>
  new Promise((resolve) => {
    client[method](payload, (err, res) => resolve({ err, res }));
  });

async function runTests() {
  console.log('--- RUNNING 5 PRODUCT TEST CASES ---');

  // TC-PRO-01: Lấy danh sách Product
  const tc1 = await callRpc('GetProducts', {});
  console.log('TC-PRO-01 (Get Product List):', tc1.err ? tc1.err.message : tc1.res);

  // TC-PRO-02: Lấy Product tồn tại (pid = 1)
  const tc2 = await callRpc('GetProductById', { pid: 1 });
  console.log('TC-PRO-02 (Get Existing Product):', tc2.err ? tc2.err.message : tc2.res);

  // TC-PRO-03: Lấy Product không tồn tại (pid = 9999 -> 404 NOT_FOUND - gRPC code 5)
  const tc3 = await callRpc('GetProductById', { pid: 9999 });
  console.log('TC-PRO-03 (Product Not Found):', tc3.err ? `Code ${tc3.err.code}: ${tc3.err.details}` : tc3.res);

  // TC-PRO-04: Tạo Product mới hợp lệ
  const tc4 = await callRpc('CreateProduct', {
    pname: 'Mechanical Keyboard',
    price: 120,
    quantity: 15,
  });
  console.log('TC-PRO-04 (Create Product):', tc4.err ? tc4.err.message : tc4.res);

  // TC-PRO-05: Cập nhật tồn kho (Giảm số lượng khi đặt hàng hoặc cập nhật sản phẩm)
  const stockRes = await callRpc('CheckAndReduceStock', {
    items: [{ pid: 1, qty: 2 }],
  });
  const afterStock = await callRpc('GetProductById', { pid: 1 });
  console.log('TC-PRO-05 (Update Inventory):', stockRes.err ? stockRes.err.message : {
    stockUpdate: stockRes.res,
    updatedProduct: afterStock.res,
  });
}

runTests();