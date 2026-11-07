class CustomerEntity {
  constructor({ uid, fullname, mid }) {
    this.uid = uid;
    this.fullname = fullname;
    this.mid = mid;
  }

  static validateUpdateInput({ uid, fullname, mid }) {
    if (!uid || uid <= 0) {
      const error = new Error('Invalid customer uid');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }
    if (!fullname || !String(fullname).trim()) {
      const error = new Error('Invalid or empty fullname');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }
    if (mid !== undefined && mid !== null && Number(mid) <= 0) {
      const error = new Error('Invalid membership id (mid)');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }
  }
}

module.exports = CustomerEntity;