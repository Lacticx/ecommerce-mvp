const ShipmentEntity = require('../domain/shipment.entity');
const shipmentRepository = require('../infrastructure/shipment.repository');

class ShipmentUseCase {
  async handleOrderCreatedEvent(eventPayload) {
    // Kiểm tra tính hợp lệ của sự kiện (TC-SHP-02: Event thiếu oid -> ghi nhận lỗi, không tạo Shipment)
    ShipmentEntity.validateOrderCreatedEvent(eventPayload);

    // Tạo Shipment với cơ chế Idempotent chống trùng lặp (TC-SHP-01 & TC-SHP-05)
    const result = await shipmentRepository.createFromOrderEvent(eventPayload.oid);
    return result;
  }

  async getShipmentById({ shipid }) {
    if (!shipid || Number(shipid) <= 0) {
      const error = new Error('Invalid shipid');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }

    const shipment = await shipmentRepository.findByShipId(shipid);
    if (!shipment) {
      const error = new Error('Shipment not found');
      error.code = 'NOT_FOUND'; // Map sang HTTP 404
      throw error;
    }

    return shipment;
  }

  async getShipmentByOrderId({ oid }) {
    if (!oid || Number(oid) <= 0) {
      const error = new Error('Invalid order oid');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }

    const shipment = await shipmentRepository.findByOrderId(oid);
    if (!shipment) {
      const error = new Error('Shipment not found for this order');
      error.code = 'NOT_FOUND';
      throw error;
    }

    return shipment;
  }

  async updateShipmentStatus({ shipid, status }) {
    const normalizedStatus = ShipmentEntity.validateUpdateStatus({ shipid, status });

    const updated = await shipmentRepository.updateStatus(shipid, normalizedStatus);
    if (!updated) {
      const error = new Error('Shipment not found');
      error.code = 'NOT_FOUND'; // Map sang HTTP 404 (TC-SHP-04)
      throw error;
    }

    return updated;
  }
}

module.exports = new ShipmentUseCase();