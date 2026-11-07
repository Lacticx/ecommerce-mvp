const grpc = require('@grpc/grpc-js');
const customerUseCase = require('../application/customer.usecase');

const mapErrorToGrpcStatus = (err) => {
  switch (err.code) {
    case 'INVALID_ARGUMENT':
      return grpc.status.INVALID_ARGUMENT; // 400
    case 'NOT_FOUND':
      return grpc.status.NOT_FOUND;        // 404
    default:
      return grpc.status.INTERNAL;         // 500
  }
};

const customerGrpcController = {
  CreateCustomer: async (call, callback) => {
    try {
      const result = await customerUseCase.createCustomer(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },

  GetCustomer: async (call, callback) => {
    try {
      const result = await customerUseCase.getCustomer(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },

  UpdateCustomer: async (call, callback) => {
    try {
      const result = await customerUseCase.updateCustomer(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },

  GetMembershipScore: async (call, callback) => {
    try {
      const result = await customerUseCase.getMembershipScore(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },
};

module.exports = customerGrpcController;