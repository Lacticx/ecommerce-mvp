class OrderEntity {
  static validateCreateOrder({ uid, items }) {
    if (!uid || Number(uid) <= 0) {
      const error = new Error('Invalid customer uid');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      const error = new Error('Order items cannot be empty');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }
    for (const item of items) {
      if (!item.pid || Number(item.pid) <= 0 || !item.qty || Number(item.qty) <= 0) {
        const error = new Error('Invalid product pid or qty in order items');
        error.code = 'INVALID_ARGUMENT';
        throw error;
      }
    }
  }

  /**
   * Tính mức giảm giá (discount) dựa trên điểm thành viên (score)
   * Ví dụ: Bronze (score 50) -> discount 5; Silver (score 100) -> discount 10; Gold (score 200) -> discount 20
   */
  static calculateDiscount(score) {
    const numericScore = Number(score) || 0;
    if (numericScore <= 0) return 0;
    return Number((numericScore * 0.1).toFixed(2));
  }
}

module.exports = OrderEntity;