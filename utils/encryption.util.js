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

  /**
   * Encrypt data using AES-256-CBC
   */
  static encrypt(text) {
    if (!text) return null;
    const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default_secret_key_change_in_prod';
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt data using AES-256-CBC
   */
  static decrypt(text) {
    if (!text) return null;
    const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default_secret_key_change_in_prod';
    const key = crypto.createHash('sha256').update(secret).digest();
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = textParts.join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

module.exports = EncryptionUtil;