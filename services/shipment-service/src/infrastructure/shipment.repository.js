const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema(
  {
    shipid: { type: Number, required: true, unique: true },
    oid: { type: Number, required: true, unique: true },
    status: { type: String, required: true, maxlength: 50, default: 'PENDING' },
  },
  { versionKey: false }
);

const ShipmentModel = mongoose.model('Shipment', shipmentSchema);

class ShipmentRepository {
  async initDb() {
    await mongoose.connect(process.env.MONGO_URI);
    await ShipmentModel.init(); // Đảm bảo unique index được tạo
  }

  async getNextShipId() {
    const lastShipment = await ShipmentModel.findOne().sort({ shipid: -1 }).lean();
    return lastShipment ? lastShipment.shipid + 1 : 5001;
  }

  /**
   * Tạo Shipment từ sự kiện OrderCreated với cơ chế Idempotent (TC-SHP-05):
   * Nếu oid đã tồn tại thì trả về bản ghi hiện có, tuyệt đối không tạo bản ghi trùng lặp.
   */
  async createFromOrderEvent(oid) {
    const numericOid = Number(oid);
    const existing = await ShipmentModel.findOne({ oid: numericOid }, { _id: 0 }).lean();
    if (existing) {
      return { shipment: existing, createdNew: false };
    }

    const nextShipId = await this.getNextShipId();
    try {
      const created = await ShipmentModel.create({
        shipid: nextShipId,
        oid: numericOid,
        status: 'PENDING',
      });
      return {
        shipment: {
          shipid: created.shipid,
          oid: created.oid,
          status: created.status,
        },
        createdNew: true,
      };
    } catch (err) {
      // Nếu có race condition trùng key oid (E11000), trả về bản ghi đã tồn tại
      if (err.code === 11000) {
        const current = await ShipmentModel.findOne({ oid: numericOid }, { _id: 0 }).lean();
        return { shipment: current, createdNew: false };
      }
      throw err;
    }
  }

  async findByShipId(shipid) {
    return ShipmentModel.findOne({ shipid: Number(shipid) }, { _id: 0 }).lean();
  }

  async findByOrderId(oid) {
    return ShipmentModel.findOne({ oid: Number(oid) }, { _id: 0 }).lean();
  }

  async updateStatus(shipid, status) {
    return ShipmentModel.findOneAndUpdate(
      { shipid: Number(shipid) },
      { $set: { status } },
      { returnDocument: 'after', projection: { _id: 0 } }
    ).lean();
  }

  async countByOrderId(oid) {
    return ShipmentModel.countDocuments({ oid: Number(oid) });
  }
}

module.exports = new ShipmentRepository();