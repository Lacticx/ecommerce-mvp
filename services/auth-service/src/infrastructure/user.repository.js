const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

class UserRepository {
  async initDbAndSeedRoles() {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Tạo bảng Role theo Bounded-Context.jpg
      await client.query(`
        CREATE TABLE IF NOT EXISTS "Role" (
          roleid SERIAL PRIMARY KEY,
          rolename VARCHAR(50) UNIQUE NOT NULL
        );
      `);

      // Tạo bảng User theo Bounded-Context.jpg
      await client.query(`
        CREATE TABLE IF NOT EXISTS "User" (
          uid SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          roleid INT NOT NULL REFERENCES "Role"(roleid)
        );
      `);

      // Khởi tạo 3 vai trò mặc định phục vụ phân quyền
      const defaultRoles = [
        { roleid: 1, rolename: 'CUSTOMER' },
        { roleid: 2, rolename: 'ADMIN' },
        { roleid: 3, rolename: 'SHIPMENT_STAFF' },
      ];

      for (const r of defaultRoles) {
        await client.query(
          `INSERT INTO "Role" (roleid, rolename)
           VALUES ($1, $2)
           ON CONFLICT (roleid) DO NOTHING;`,
          [r.roleid, r.rolename]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findByUsername(username) {
    const result = await pool.query(
      `SELECT u.uid, u.username, u.password, u.roleid, r.rolename
       FROM "User" u
       JOIN "Role" r ON u.roleid = r.roleid
       WHERE u.username = $1`,
      [username]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      uid: row.uid,
      username: row.username,
      password: row.password,
      roleid: row.roleid,
      role: {
        roleid: row.roleid,
        rolename: row.rolename,
      },
    };
  }

  async createUser({ username, password, roleid = 1 }) {
    const result = await pool.query(
      `INSERT INTO "User" (username, password, roleid)
       VALUES ($1, $2, $3)
       RETURNING uid, username, password, roleid`,
      [username, password, roleid]
    );
    return result.rows[0];
  }
}

module.exports = new UserRepository();