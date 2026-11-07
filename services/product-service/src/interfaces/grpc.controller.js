const grpc = require('@grpc/grpc-js');
const productUseCase = require('../application/product.usecase');

const mapErrorToGrpcStatus = (err) => {
  switch (err.code) {
    case 'INVALID_ARGUMENT':
      return grpc.status.INVALID_ARGUMENT; // 400 Bad Request
    case 'NOT_FOUND':
      return grpc.status.NOT_FOUND;        // 404 Not Found
    case 'ALREADY_EXISTS':
      return grpc.status.ALREADY_EXISTS;   // 409 Conflict (Insufficient stock)
    default:
      return grpc.status.INTERNAL;         // 500 Internal Error
  }
};

const productGrpcController = {
  GetProducts: async (call, callback) => {
    try {
      const result = await productUseCase.getProducts();
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },

  GetProductById: async (call, callback) => {
    try {
      const result = await productUseCase.getProductById(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },

  CreateProduct: async (call, callback) => {
    try {
      const result = await productUseCase.createProduct(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },

  UpdateProduct: async (call, callback) => {
    try {
      const result = await productUseCase.updateProduct(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },

  DeleteProduct: async (call, callback) => {
    try {
      const result = await productUseCase.deleteProduct(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },

  CheckAndReduceStock: async (call, callback) => {
    try {
      const result = await productUseCase.checkAndReduceStock(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },
};

module.exports = productGrpcController;