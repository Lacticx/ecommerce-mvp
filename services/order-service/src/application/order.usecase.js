const OrderEntity = require('../domain/order.entity');
const orderRepository = require('../infrastructure/order.repository');
const grpcClients = require('../infrastructure/grpc.clients');
const kafkaProducer = require('../infrastructure/kafka.producer');

class OrderUseCase {
  async createOrder({ uid, items }) {
    // 1. Validate request input
    OrderEntity.validateCreateOrder({ uid, items });

    // 2. Bước 3 & 4: Lấy thông tin Customer và điểm thành viên (score) qua gRPC
    let membership;
    try {
      membership = await grpcClients.getMembershipScore(uid);
    } catch (err) {
      const error = new Error(err.details || 'Customer not found');
      error.code = err.code === 5 ? 'NOT_FOUND' : 'INTERNAL';
      throw error;
    }

    // 3. Bước 5: Tính mức giảm giá (discount) dựa trên score
    const discount = OrderEntity.calculateDiscount(membership.score);

    // 4. Bước 6 & 7: Kiểm tra số lượng sản phẩm và trừ tồn kho qua gRPC Product Service
    let stockResult;
    try {
      stockResult = await grpcClients.checkAndReduceStock(items);
    } catch (err) {
      const error = new Error(err.details || 'Failed to check/reduce product stock');
      if (err.code === 5) error.code = 'NOT_FOUND';        // 404 Product not found
      else if (err.code === 6) error.code = 'ALREADY_EXISTS'; // 409 Insufficient stock
      else error.code = 'INVALID_ARGUMENT';
      throw error;
    }

    // 5. Bước 8: Lưu Order, OrderDetail và OutboxEvent trong cùng DB Transaction
    const createdOrder = await orderRepository.createOrderWithOutbox({
      uid,
      discount,
      validatedItems: stockResult.validated_items,
    });

    // 6. Bước 9: Phát sự kiện OrderCreated lên Kafka (asynchronous) và cập nhật Outbox
    try {
      await kafkaProducer.publishOrderCreatedEvent(createdOrder.eventPayload);
      await orderRepository.markOutboxPublished(createdOrder.outboxId);
    } catch (kafkaErr) {
      console.error('[Order Service] Kafka publish deferred to Outbox retry worker:', kafkaErr.message);
    }

    // 7. Bước 10: Trả kết quả Order kèm trạng thái Shipment khởi tạo (PENDING)
    return {
      oid: createdOrder.oid,
      uid: createdOrder.uid,
      discount: createdOrder.discount,
      items: createdOrder.items,
      shipment: {
        shipid: createdOrder.oid,
        status: 'PENDING',
      },
    };
  }

  async getOrders({ uid, role }) {
    const items = await orderRepository.findOrdersByUser(uid, role);
    return { items };
  }

  async getOrderById({ oid, uid, role }) {
    if (!oid || oid <= 0) {
      const error = new Error('Invalid order oid');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }

    const order = await orderRepository.findOrderById(oid);
    if (!order) {
      const error = new Error('Order not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (role !== 'ADMIN' && order.uid !== Number(uid)) {
      const error = new Error('Forbidden access to this order');
      error.code = 'PERMISSION_DENIED'; // Map sang HTTP 403
      throw error;
    }

    return order;
  }
}

module.exports = new OrderUseCase();