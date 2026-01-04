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

module.exports = ResponseUtil;