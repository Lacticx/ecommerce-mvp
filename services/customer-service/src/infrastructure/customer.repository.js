const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

class CustomerRepository {
  async initDbAndSeed() {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Tạo bảng MemberShip theo Bounded-Context.jpg
      await client.query(`
        CREATE TABLE IF NOT EXISTS "MemberShip" (
          mid SERIAL PRIMARY KEY,
          mname VARCHAR(50) NOT NULL,
          score INT NOT NULL
        );
      `);

      // 2. Tạo bảng Customer theo Bounded-Context.jpg
      await client.query(`
        CREATE TABLE IF NOT EXISTS "Customer" (
          uid INT PRIMARY KEY,
          fullname VARCHAR(100) NOT NULL,
          mid INT NOT NULL REFERENCES "MemberShip"(mid)
        );
      `);

      // 3. Seed dữ liệu hạng thành viên (MemberShip)
      const memberships = [
        { mid: 1, mname: 'Bronze', score: 50 },
        { mid: 2, mname: 'Silver', score: 100 },
        { mid: 3, mname: 'Gold', score: 200 },
      ];

      for (const m of memberships) {
        await client.query(
          `INSERT INTO "MemberShip" (mid, mname, score)
           VALUES ($1, $2, $3)
           ON CONFLICT (mid) DO UPDATE SET mname = EXCLUDED.mname, score = EXCLUDED.score;`,
          [m.mid, m.mname, m.score]
        );
      }

      // 4. Seed sẵn Customer mặc định cho uid = 1 (khớp với tài khoản vừa đăng ký ở Auth Service)
      await client.query(
        `INSERT INTO "Customer" (uid, fullname, mid)
         VALUES (1, 'John Doe', 2)
         ON CONFLICT (uid) DO NOTHING;`
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(uid) {
    const result = await pool.query(
      `SELECT uid, fullname, mid FROM "Customer" WHERE uid = $1`,
      [uid]
    );
    return result.rows[0] || null;
  }

  async createOrUpsertCustomer({ uid, fullname, mid = 1 }) {
    const result = await pool.query(
      `INSERT INTO "Customer" (uid, fullname, mid)
       VALUES ($1, $2, $3)
       ON CONFLICT (uid) DO UPDATE SET fullname = EXCLUDED.fullname, mid = EXCLUDED.mid
       RETURNING uid, fullname, mid`,
      [uid, fullname, mid]
    );
    return result.rows[0];
  }

  async updateCustomer({ uid, fullname, mid }) {
    const existing = await this.findById(uid);
    if (!existing) return null;

    const targetMid = mid && mid > 0 ? mid : existing.mid;
    const result = await pool.query(
      `UPDATE "Customer"
       SET fullname = $1, mid = $2
       WHERE uid = $3
       RETURNING uid, fullname, mid`,
      [fullname, targetMid, uid]
    );
    return result.rows[0];
  }

  async findMembershipScoreByUid(uid) {
    const result = await pool.query(
      `SELECT c.uid, m.mid, m.mname, m.score
       FROM "Customer" c
       JOIN "MemberShip" m ON c.mid = m.mid
       WHERE c.uid = $1`,
      [uid]
    );
    return result.rows[0] || null;
  }
}

module.exports = new CustomerRepository();