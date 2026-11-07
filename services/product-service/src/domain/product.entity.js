class ProductEntity {
  constructor({ pid, pname, price, quantity }) {
    this.pid = pid;
    this.pname = pname;
    this.price = price;
    this.quantity = quantity;
  }

  static validateProductInput({ pname, price, quantity }) {
    if (!pname || !String(pname).trim()) {
      const error = new Error('Product name (pname) is required');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }
    if (price === undefined || price === null || Number(price) <= 0) {
      const error = new Error('Product price must be greater than 0');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }
    if (quantity === undefined || quantity === null || Number(quantity) < 0 || !Number.isInteger(Number(quantity))) {
      const error = new Error('Product quantity must be a non-negative integer');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }
  }
}

module.exports = ProductEntity;