const grpc = require('@grpc/grpc-js');
const orderUseCase = require('../application/order.usecase');

const mapErrorToGrpcStatus = (err) => {
  switch (err.code) {
    case 'INVALID_ARGUMENT':
      return grpc.status.INVALID_ARGUMENT;  // 400
    case 'NOT_FOUND':
      return grpc.status.NOT_FOUND;         // 404
    case 'ALREADY_EXISTS':
      return grpc.status.ALREADY_EXISTS;    // 409 (Insufficient stock)
    case 'PERMISSION_DENIED':
      return grpc.status.PERMISSION_DENIED; // 403
    default:
      return grpc.status.INTERNAL;          // 500
  }
};

const orderGrpcController = {
  CreateOrder: async (call, callback) => {
    try {
      const result = await orderUseCase.createOrder(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },

  GetOrders: async (call, callback) => {
    try {
      const result = await orderUseCase.getOrders(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },

  GetOrderById: async (call, callback) => {
    try {
      const result = await orderUseCase.getOrderById(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },
};

module.exports = orderGrpcController;