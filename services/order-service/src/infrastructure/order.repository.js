const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

class OrderRepository {
  async initDb() {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Bảng Order theo Bounded-Context.jpg
      await client.query(`
        CREATE TABLE IF NOT EXISTS "Order" (
          oid SERIAL PRIMARY KEY,
          uid INT NOT NULL,
          discount DECIMAL(10,2) NOT NULL DEFAULT 0.00
        );
      `);

      // 2. Bảng OrderDetail theo Bounded-Context.jpg (Composite PK: oid, pid)
      await client.query(`
        CREATE TABLE IF NOT EXISTS "OrderDetail" (
          oid INT NOT NULL REFERENCES "Order"(oid) ON DELETE CASCADE,
          pid INT NOT NULL,
          qty INT NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          PRIMARY KEY (oid, pid)
        );
      `);

      // 3. Bảng OutboxEvent phục vụ Transactional Outbox Pattern
      await client.query(`
        CREATE TABLE IF NOT EXISTS "OutboxEvent" (
          id SERIAL PRIMARY KEY,
          aggregate_id INT NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          payload JSONB NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Bước 8 trong Business-Process-Model.png:
   * Lưu Order, OrderDetail và OutboxEvent trong cùng một DB Transaction
   */
  async createOrderWithOutbox({ uid, discount, validatedItems }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert Order
      const orderRes = await client.query(
        `INSERT INTO "Order" (uid, discount)
         VALUES ($1, $2)
         RETURNING oid, uid, discount`,
        [uid, discount]
      );
      const order = orderRes.rows[0];

      // 2. Insert OrderDetail records
      for (const item of validatedItems) {
        await client.query(
          `INSERT INTO "OrderDetail" (oid, pid, qty, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [order.oid, item.pid, item.qty, item.unit_price]
        );
      }

      // 3. Insert OutboxEvent (OrderCreated)
      const eventPayload = {
        eventType: 'OrderCreated',
        oid: order.oid,
        uid: order.uid,
        discount: Number(order.discount),
        items: validatedItems,
        timestamp: new Date().toISOString(),
      };

      const outboxRes = await client.query(
        `INSERT INTO "OutboxEvent" (aggregate_id, event_type, payload, status)
         VALUES ($1, 'OrderCreated', $2, 'PENDING')
         RETURNING id`,
        [order.oid, JSON.stringify(eventPayload)]
      );

      await client.query('COMMIT');

      return {
        oid: order.oid,
        uid: order.uid,
        discount: Number(order.discount),
        items: validatedItems,
        outboxId: outboxRes.rows[0].id,
        eventPayload,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async markOutboxPublished(outboxId) {
    await pool.query(
      `UPDATE "OutboxEvent" SET status = 'PUBLISHED' WHERE id = $1`,
      [outboxId]
    );
  }

  async findPendingOutboxEvents() {
    const res = await pool.query(
      `SELECT id, payload FROM "OutboxEvent" WHERE status = 'PENDING' ORDER BY id ASC LIMIT 20`
    );
    return res.rows;
  }

  async findOrdersByUser(uid, role) {
    const query =
      role === 'ADMIN'
        ? `SELECT oid, uid, discount FROM "Order" ORDER BY oid DESC`
        : `SELECT oid, uid, discount FROM "Order" WHERE uid = $1 ORDER BY oid DESC`;
    const params = role === 'ADMIN' ? [] : [uid];
    const res = await pool.query(query, params);
    return res.rows.map((r) => ({
      oid: r.oid,
      uid: r.uid,
      discount: Number(r.discount),
      items: [],
    }));
  }

  async findOrderById(oid) {
    const orderRes = await pool.query(
      `SELECT oid, uid, discount FROM "Order" WHERE oid = $1`,
      [oid]
    );
    if (orderRes.rows.length === 0) return null;

    const detailsRes = await pool.query(
      `SELECT pid, qty, unit_price FROM "OrderDetail" WHERE oid = $1`,
      [oid]
    );

    const order = orderRes.rows[0];
    return {
      oid: order.oid,
      uid: order.uid,
      discount: Number(order.discount),
      items: detailsRes.rows.map((d) => ({
        pid: d.pid,
        qty: d.qty,
        unit_price: Number(d.unit_price),
      })),
    };
  }
}

module.exports = new OrderRepository();