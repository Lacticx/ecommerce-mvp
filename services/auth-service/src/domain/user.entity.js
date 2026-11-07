class UserEntity {
  constructor({ uid, username, password, roleid, role }) {
    this.uid = uid;
    this.username = username;
    this.password = password;
    this.roleid = roleid;
    this.role = role;
  }

  static validateCredentials(username, password) {
    if (!username || !String(username).trim() || !password || !String(password).trim()) {
      const error = new Error('Missing or invalid username/password');
      error.code = 'INVALID_ARGUMENT'; // Map sang HTTP 400
      throw error;
    }
  }
}

module.exports = UserEntity;