const grpc = require('@grpc/grpc-js');
const shipmentUseCase = require('../application/shipment.usecase');

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

const shipmentGrpcController = {
  GetShipmentById: async (call, callback) => {
    try {
      const result = await shipmentUseCase.getShipmentById(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },

  GetShipmentByOrderId: async (call, callback) => {
    try {
      const result = await shipmentUseCase.getShipmentByOrderId(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },

  UpdateShipmentStatus: async (call, callback) => {
    try {
      const result = await shipmentUseCase.updateShipmentStatus(call.request);
      callback(null, result);
    } catch (err) {
      callback({ code: mapErrorToGrpcStatus(err), message: err.message });
    }
  },
};

module.exports = shipmentGrpcController;