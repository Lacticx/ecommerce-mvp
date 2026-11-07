const VALID_STATUSES = ['PENDING', 'SHIPPING', 'DELIVERED', 'CANCELLED'];

class ShipmentEntity {
  static validateOrderCreatedEvent(eventPayload) {
    if (!eventPayload || !eventPayload.oid || Number(eventPayload.oid) <= 0) {
      const error = new Error('Invalid OrderCreated event: missing or invalid oid');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }
  }

  static validateUpdateStatus({ shipid, status }) {
    if (!shipid || Number(shipid) <= 0) {
      const error = new Error('Invalid shipid');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }
    const normalizedStatus = status ? String(status).trim().toUpperCase() : '';
    if (!VALID_STATUSES.includes(normalizedStatus)) {
      const error = new Error(
        `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}`
      );
      error.code = 'INVALID_ARGUMENT'; // Map sang HTTP 400
      throw error;
    }
    return normalizedStatus;
  }
}

module.exports = ShipmentEntity;