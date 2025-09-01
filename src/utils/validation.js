/**
 * Validation utilities for the inventory system
 */

/**
 * Validates barcode format (8 digits)
 * @param {string} code - Barcode to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const validateBarcode = (code) => {
  return /^\d{8}$/.test(code);
};

/**
 * Validates month format (MM)
 * @param {string} month - Month to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const validateMonth = (month) => {
  return /^(0[1-9]|1[0-2])$/.test(month);
};

/**
 * Validates year format (4 digits, reasonable range)
 * @param {number} year - Year to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const validateYear = (year) => {
  const currentYear = new Date().getFullYear();
  return year >= 2020 && year <= currentYear + 1;
};

/**
 * Validates agency name (non-empty string)
 * @param {string} agency - Agency name to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const validateAgency = (agency) => {
  return typeof agency === 'string' && agency.trim().length > 0;
};

/**
 * Validates user email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates timestamp format (ISO string)
 * @param {string} timestamp - Timestamp to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const validateTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
};

/**
 * Comprehensive validation for scan data
 * @param {Object} scanData - Scan data to validate
 * @returns {Object} - Validation result with success and errors
 */
const validateScanData = (scanData) => {
  const errors = [];

  if (!validateAgency(scanData.agency)) {
    errors.push('Invalid agency name');
  }

  if (!validateBarcode(scanData.code)) {
    errors.push('Barcode must be exactly 8 digits');
  }

  if (!validateMonth(scanData.month)) {
    errors.push('Month must be in MM format (01-12)');
  }

  if (!validateYear(scanData.year)) {
    errors.push('Year must be between 2020 and next year');
  }

  if (!validateEmail(scanData.user)) {
    errors.push('Invalid user email format');
  }

  if (!validateTimestamp(scanData.timestamp)) {
    errors.push('Invalid timestamp format');
  }

  if (!scanData.userName || typeof scanData.userName !== 'string') {
    errors.push('User name is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Comprehensive validation for session data
 * @param {Object} sessionData - Session data to validate
 * @returns {Object} - Validation result with success and errors
 */
const validateSessionData = (sessionData) => {
  const errors = [];

  if (!validateAgency(sessionData.agency)) {
    errors.push('Invalid agency name');
  }

  if (!validateMonth(sessionData.month)) {
    errors.push('Month must be in MM format (01-12)');
  }

  if (!validateYear(sessionData.year)) {
    errors.push('Year must be between 2020 and next year');
  }

  if (!validateEmail(sessionData.user)) {
    errors.push('Invalid user email format');
  }

  if (!sessionData.userName || typeof sessionData.userName !== 'string') {
    errors.push('User name is required');
  }

  if (typeof sessionData.totalScans !== 'number' || sessionData.totalScans < 0) {
    errors.push('Total scans must be a non-negative number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateBarcode,
  validateMonth,
  validateYear,
  validateAgency,
  validateEmail,
  validateTimestamp,
  validateScanData,
  validateSessionData
};
