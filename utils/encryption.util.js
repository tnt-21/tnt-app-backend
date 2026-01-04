// ============================================
// FILE: utils/encryption.util.js
// ============================================

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class EncryptionUtil {
  /**
   * Hash a password or sensitive data
   */
  static async hash(data, rounds = 10) {
    return bcrypt.hash(data, rounds);
  }

  /**
   * Compare plain text with hashed data
   */
  static async compare(plain, hashed) {
    return bcrypt.compare(plain, hashed);
  }

  /**
   * Generate a random OTP
   */
  static generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
  }

  /**
   * Generate a secure random token
   */
  static generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash data using SHA256 (for quick comparisons)
   */
  static sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

module.exports = EncryptionUtil;