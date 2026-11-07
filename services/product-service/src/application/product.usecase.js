const ProductEntity = require('../domain/product.entity');
const productRepository = require('../infrastructure/product.repository');

class ProductUseCase {
  async getProducts() {
    const items = await productRepository.findAll();
    return { items };
  }

  async getProductById({ pid }) {
    if (!pid || pid <= 0) {
      const error = new Error('Invalid product pid');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }

    const product = await productRepository.findById(pid);
    if (!product) {
      const error = new Error('Product not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    return product;
  }

  async createProduct({ pname, price, quantity }) {
    ProductEntity.validateProductInput({ pname, price, quantity });
    return productRepository.create({
      pname: pname.trim(),
      price,
      quantity,
    });
  }

  async updateProduct({ pid, pname, price, quantity }) {
    if (!pid || pid <= 0) {
      const error = new Error('Invalid product pid');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }
    ProductEntity.validateProductInput({ pname, price, quantity });

    const updated = await productRepository.update(pid, {
      pname: pname.trim(),
      price,
      quantity,
    });

    if (!updated) {
      const error = new Error('Product not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    return {
      message: 'Product updated successfully',
      pid: updated.pid,
    };
  }

  async deleteProduct({ pid }) {
    if (!pid || pid <= 0) {
      const error = new Error('Invalid product pid');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }

    const deleted = await productRepository.delete(pid);
    if (!deleted) {
      const error = new Error('Product not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    return {
      message: 'Product deleted successfully',
      pid: deleted.pid,
    };
  }

  async checkAndReduceStock({ items }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      const error = new Error('Order items cannot be empty');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }

    for (const item of items) {
      if (!item.pid || item.pid <= 0 || !item.qty || item.qty <= 0) {
        const error = new Error('Each item must have a valid pid and qty > 0');
        error.code = 'INVALID_ARGUMENT';
        throw error;
      }
    }

    const validatedItems = await productRepository.checkAndReduceStock(items);
    return {
      success: true,
      validated_items: validatedItems,
    };
  }
}

module.exports = new ProductUseCase();