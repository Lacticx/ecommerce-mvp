const grpc = require('@grpc/grpc-js');
const authUseCase = require('../application/auth.usecase');

const mapErrorToGrpcStatus = (err) => {
  switch (err.code) {
    case 'INVALID_ARGUMENT':
      return grpc.status.INVALID_ARGUMENT; // 400 Bad Request
    case 'ALREADY_EXISTS':
      return grpc.status.ALREADY_EXISTS;   // 409 Conflict
    case 'UNAUTHENTICATED':
      return grpc.status.UNAUTHENTICATED;  // 401 Unauthorized
    default:
      return grpc.status.INTERNAL;         // 500 Internal Error
  }
};

const authGrpcController = {
  Register: async (call, callback) => {
    try {
      const result = await authUseCase.register(call.request);
      callback(null, result);
    } catch (err) {
      callback({
        code: mapErrorToGrpcStatus(err),
        message: err.message,
      });
    }
  },

  Login: async (call, callback) => {
    try {
      const result = await authUseCase.login(call.request);
      callback(null, result);
    } catch (err) {
      callback({
        code: mapErrorToGrpcStatus(err),
        message: err.message,
      });
    }
  },

  VerifyToken: async (call, callback) => {
    try {
      const result = await authUseCase.verifyToken(call.request);
      callback(null, result);
    } catch (err) {
      callback({
        code: grpc.status.INTERNAL,
        message: err.message,
      });
    }
  },
};

module.exports = authGrpcController;