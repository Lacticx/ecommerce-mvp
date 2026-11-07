const CustomerEntity = require('../domain/customer.entity');
const customerRepository = require('../infrastructure/customer.repository');

class CustomerUseCase {
  async createCustomer({ uid, fullname, mid }) {
    const safeFullname = fullname && String(fullname).trim() ? fullname.trim() : `Customer #${uid}`;
    const safeMid = mid && mid > 0 ? mid : 1;
    return customerRepository.createOrUpsertCustomer({
      uid,
      fullname: safeFullname,
      mid: safeMid,
    });
  }

  async getCustomer({ uid }) {
    if (!uid || uid <= 0) {
      const error = new Error('Invalid customer uid');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }

    const customer = await customerRepository.findById(uid);
    if (!customer) {
      const error = new Error('Customer not found');
      error.code = 'NOT_FOUND'; // Map sang HTTP 404
      throw error;
    }

    return customer;
  }

  async updateCustomer({ uid, fullname, mid }) {
    CustomerEntity.validateUpdateInput({ uid, fullname, mid });

    const updated = await customerRepository.updateCustomer({
      uid,
      fullname: fullname.trim(),
      mid,
    });

    if (!updated) {
      const error = new Error('Customer not found');
      error.code = 'NOT_FOUND'; // Map sang HTTP 404
      throw error;
    }

    return {
      message: 'Customer updated successfully',
      uid: updated.uid,
    };
  }

  async getMembershipScore({ uid }) {
    if (!uid || uid <= 0) {
      const error = new Error('Invalid customer uid');
      error.code = 'INVALID_ARGUMENT';
      throw error;
    }

    const membership = await customerRepository.findMembershipScoreByUid(uid);
    if (!membership) {
      const error = new Error('Customer or Membership not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    return membership;
  }
}

module.exports = new CustomerUseCase();