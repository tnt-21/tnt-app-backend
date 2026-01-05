// ============================================
// FILE: utils/response.util.js
// ============================================

class ResponseUtil {
	/**
	 * Success response
	 */
	static success(res, data = {}, message = 'Success', statusCode = 200) {
		return res.status(statusCode).json({
			success: true,
			message,
			data,
			timestamp: new Date().toISOString()
		});
	}

	/**
	 * Error response
	 */
	static error(res, message = 'An error occurred', statusCode = 500, errors = null) {
		return res.status(statusCode).json({
			success: false,
			message,
			errors,
			timestamp: new Date().toISOString()
		});
	}

	/**
	 * Validation error response
	 */
	static validationError(res, errors) {
		return res.status(400).json({
			success: false,
			message: 'Validation failed',
			errors,
			timestamp: new Date().toISOString()
		});
	}

	/**
	 * Unauthorized response
	 */
	static unauthorized(res, message = 'Unauthorized access') {
		return res.status(401).json({
			success: false,
			message,
			timestamp: new Date().toISOString()
		});
	}

	/**
	 * Forbidden response
	 */
	static forbidden(res, message = 'Access forbidden') {
		return res.status(403).json({
			success: false,
			message,
			timestamp: new Date().toISOString()
		});
	}

	/**
	 * Not found response
	 */
	static notFound(res, message = 'Resource not found') {
		return res.status(404).json({
			success: false,
			message,
			timestamp: new Date().toISOString()
		});
	}
}

// Custom error class
class AppError extends Error {
	constructor(message, statusCode, errorCode = null) {
		super(message);
		this.statusCode = statusCode;
		this.errorCode = errorCode;
		this.isOperational = true;
		Error.captureStackTrace(this, this.constructor);
	}
}

// Export both the class and standalone functions for backward compatibility
module.exports = ResponseUtil;

// Also export standalone functions that your controllers expect
module.exports.successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
	return ResponseUtil.success(res, data, message, statusCode);
};

module.exports.errorResponse = (res, message, statusCode = 500, errorCode = null, errors = null) => {
	return res.status(statusCode).json({
		success: false,
		message,
		error_code: errorCode,
		errors,
		timestamp: new Date().toISOString()
	});
};

module.exports.AppError = AppError;