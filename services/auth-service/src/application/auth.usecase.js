const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserEntity = require('../domain/user.entity');
const userRepository = require('../infrastructure/user.repository');

class AuthUseCase {
  async register({ username, password }) {
    // 1. Kiểm tra đầu vào hợp lệ (TC-IAM-03)
    UserEntity.validateCredentials(username, password);

    // 2. Kiểm tra trùng username (TC-IAM-02)
    const existingUser = await userRepository.findByUsername(username);
    if (existingUser) {
      const error = new Error('Username already exists');
      error.code = 'ALREADY_EXISTS'; // Map sang HTTP 409
      throw error;
    }

    // 3. Băm mật khẩu với bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Lưu tài khoản (nếu username là 'admin' thì gán role ADMIN = 2, nếu là 'staff' thì gán SHIPMENT_STAFF = 3, còn lại là CUSTOMER = 1)
    let roleid = 1;
    if (username.toLowerCase() === 'admin') roleid = 2;
    if (username.toLowerCase() === 'staff') roleid = 3;

    const newUser = await userRepository.createUser({
      username,
      password: hashedPassword,
      roleid,
    });

    return {
      message: 'User registered successfully',
      uid: newUser.uid,
    };
  }

  async login({ username, password }) {
    // 1. Kiểm tra đầu vào
    UserEntity.validateCredentials(username, password);

    // 2. Tìm user trong CSDL
    const user = await userRepository.findByUsername(username);
    if (!user) {
      const error = new Error('Invalid username or password');
      error.code = 'UNAUTHENTICATED'; // Map sang HTTP 401
      throw error;
    }

    // 3. Đối chiếu mật khẩu (TC-IAM-05)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const error = new Error('Invalid username or password');
      error.code = 'UNAUTHENTICATED';
      throw error;
    }

    // 4. Ký JWT chứa sub (uid) và role (rolename)
    const expiresIn = parseInt(process.env.JWT_EXPIRES_IN || '3600', 10);
    const accessToken = jwt.sign(
      { sub: user.uid, role: user.role.rolename, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  async verifyToken({ token }) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return {
        valid: true,
        uid: decoded.sub,
        role: decoded.role,
      };
    } catch (err) {
      return {
        valid: false,
        uid: 0,
        role: '',
      };
    }
  }
}

module.exports = new AuthUseCase();