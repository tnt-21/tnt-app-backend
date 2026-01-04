// ============================================
// FILE: config/auth.js
// ============================================

module.exports = {
	jwt: {
		accessSecret: process.env.JWT_ACCESS_SECRET || 'your-access-secret-min-32-chars-change-in-prod',
		refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-min-32-chars-change-in-prod',
		accessExpiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
		refreshExpiresIn: process.env.JWT_REFRESH_EXPIRY || '7d'
	},
	otp: {
		expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES) || 5,
		maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS) || 3,
		length: 6
	},
	session: {
		expiryDays: 7
	}
};
