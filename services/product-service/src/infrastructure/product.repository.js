const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    pid: { type: Number, required: true, unique: true },
    pname: { type: String, required: true, maxlength: 100 },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
  },
  { versionKey: false }
);

const ProductModel = mongoose.model('Product', productSchema);

class ProductRepository {
  async initDbAndSeed() {
    await mongoose.connect(process.env.MONGO_URI);

    const defaultProducts = [
      { pid: 1, pname: 'Laptop', price: 1500, quantity: 10 },
      { pid: 2, pname: 'Wireless Mouse', price: 25, quantity: 50 },
    ];

    for (const item of defaultProducts) {
      await ProductModel.updateOne(
        { pid: item.pid },
        { $setOnInsert: item },
        { upsert: true }
      );
    }
  }

  async getNextPid() {
    const lastProduct = await ProductModel.findOne().sort({ pid: -1 }).lean();
    return lastProduct ? lastProduct.pid + 1 : 1;
  }

  async findAll() {
    return ProductModel.find({}, { _id: 0 }).sort({ pid: 1 }).lean();
  }

  async findById(pid) {
    return ProductModel.findOne({ pid: Number(pid) }, { _id: 0 }).lean();
  }

  async create({ pname, price, quantity }) {
    const nextPid = await this.getNextPid();
    const created = await ProductModel.create({
      pid: nextPid,
      pname,
      price: Number(price),
      quantity: Number(quantity),
    });
    return {
      pid: created.pid,
      pname: created.pname,
      price: created.price,
      quantity: created.quantity,
    };
  }

  async update(pid, { pname, price, quantity }) {
    const updated = await ProductModel.findOneAndUpdate(
      { pid: Number(pid) },
      {
        $set: {
          pname,
          price: Number(price),
          quantity: Number(quantity),
        },
      },
      { new: true }
    ).lean();
    return updated;
  }

  async delete(pid) {
    const deleted = await ProductModel.findOneAndDelete({ pid: Number(pid) }).lean();
    return deleted;
  }

  async checkAndReduceStock(items) {
    // Bước 1: Kiểm tra sự tồn tại và số lượng tồn kho của từng sản phẩm
    const validatedItems = [];
    for (const item of items) {
      const product = await ProductModel.findOne({ pid: Number(item.pid) }).lean();
      if (!product) {
        const error = new Error(`Product pid=${item.pid} not found`);
        error.code = 'NOT_FOUND'; // Map sang 404
        throw error;
      }
      if (product.quantity < item.qty) {
        const error = new Error(
          `Insufficient stock for product pid=${item.pid} (available: ${product.quantity}, requested: ${item.qty})`
        );
        error.code = 'ALREADY_EXISTS'; // Map sang 409 Conflict (Insufficient stock)
        throw error;
      }
      validatedItems.push({
        pid: product.pid,
        qty: Number(item.qty),
        unit_price: product.price,
      });
    }

    // Bước 2: Trừ tồn kho với điều kiện nguyên tử (quantity >= qty)
    const deductedItems = [];
    for (const vItem of validatedItems) {
      const updated = await ProductModel.findOneAndUpdate(
        { pid: vItem.pid, quantity: { $gte: vItem.qty } },
        { $inc: { quantity: -vItem.qty } },
        { new: true }
      );

      if (!updated) {
        // Rollback các sản phẩm đã trừ trước đó nếu xảy ra tranh chấp đồng thời (race condition)
        for (const rollbackItem of deductedItems) {
          await ProductModel.updateOne(
            { pid: rollbackItem.pid },
            { $inc: { quantity: rollbackItem.qty } }
          );
        }
        const error = new Error(`Insufficient stock for product pid=${vItem.pid}`);
        error.code = 'ALREADY_EXISTS';
        throw error;
      }
      deductedItems.push(vItem);
    }

    return validatedItems;
  }
}

module.exports = new ProductRepository();