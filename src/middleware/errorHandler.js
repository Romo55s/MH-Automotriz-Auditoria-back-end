/**
 * Comprehensive Error Handling Middleware
 * Handles all types of errors and provides consistent error responses
 */

// Custom error classes
class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized access') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Forbidden access') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

class ConflictError extends Error {
  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class GoogleSheetsError extends Error {
  constructor(message = 'Google Sheets operation failed', originalError = null) {
    super(message);
    this.name = 'GoogleSheetsError';
    this.statusCode = 500;
    this.originalError = originalError;
  }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  // Log the error for debugging
  console.error('🚨 Error occurred:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });

  // Determine status code
  let statusCode = err.statusCode || 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An internal server error occurred';
  let details = null;

  // Handle specific error types
  switch (err.name) {
    case 'ValidationError':
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      details = err.details;
      break;
      
    case 'NotFoundError':
      statusCode = 404;
      errorCode = 'NOT_FOUND';
      break;
      
    case 'UnauthorizedError':
      statusCode = 401;
      errorCode = 'UNAUTHORIZED';
      break;
      
    case 'ForbiddenError':
      statusCode = 403;
      errorCode = 'FORBIDDEN';
      break;
      
    case 'ConflictError':
      statusCode = 409;
      errorCode = 'CONFLICT';
      break;
      
    case 'GoogleSheetsError':
      statusCode = 500;
      errorCode = 'GOOGLE_SHEETS_ERROR';
      // Log original Google Sheets error for debugging
      if (err.originalError) {
        console.error('Original Google Sheets error:', err.originalError);
      }
      break;
      
    case 'SyntaxError':
      statusCode = 400;
      errorCode = 'INVALID_JSON';
      message = 'Invalid JSON format in request body';
      break;
      
    case 'MulterError':
      statusCode = 400;
      errorCode = 'FILE_UPLOAD_ERROR';
      message = 'File upload error';
      break;
      
    default:
      // Handle other types of errors
      if (err.code === 'ENOENT') {
        statusCode = 404;
        errorCode = 'NOT_FOUND';
        message = 'File or directory not found';
      } else if (err.code === 'EACCES') {
        statusCode = 403;
        errorCode = 'FORBIDDEN';
        message = 'Permission denied';
      } else if (err.code === 'ECONNREFUSED') {
        statusCode = 503;
        errorCode = 'SERVICE_UNAVAILABLE';
        message = 'External service unavailable';
      }
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An internal server error occurred';
    details = null;
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: errorCode,
    message: message,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      timestamp: new Date().toISOString()
    })
  });
};

// 404 handler for unmatched routes
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString()
  });
};

// Async error wrapper for route handlers
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  GoogleSheetsError
};
