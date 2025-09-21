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
 * Validates serie format (17 alphanumeric characters)
 * @param {string} serie - Serie to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const validateSerie = (serie) => {
  return /^[A-Z0-9]{17}$/i.test(serie);
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

  // Validate code - can be either barcode (8 digits) or serie (17 alphanumeric)
  if (scanData.code) {
    // Check if it's a QR scan with serie data
    if (scanData.carData?.serie) {
      if (!validateSerie(scanData.carData.serie)) {
        errors.push('Serie must be exactly 17 alphanumeric characters');
      }
    } else {
      // Legacy barcode validation
      if (!validateBarcode(scanData.code)) {
        errors.push('Code must be either 8-digit barcode or 17-character serie');
      }
    }
  } else {
    errors.push('Code or serie is required');
  }

  if (scanData.month && !validateMonth(scanData.month)) {
    errors.push('Month must be in MM format (01-12)');
  }

  if (scanData.year && !validateYear(scanData.year)) {
    errors.push('Year must be between 2020 and next year');
  }

  if (!validateEmail(scanData.user)) {
    errors.push('Invalid user email format');
  }

  if (scanData.timestamp && !validateTimestamp(scanData.timestamp)) {
    errors.push('Invalid timestamp format');
  }

  if (!scanData.userName || typeof scanData.userName !== 'string') {
    errors.push('User name is required');
  }

  // Validate car data if present (for QR scans)
  if (scanData.carData) {
    const carValidation = validateCSVRowData(scanData.carData);
    if (!carValidation.isValid) {
      errors.push(...carValidation.errors);
    }
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

/**
 * Comprehensive validation for QR data
 * @param {Object} qrData - QR data to validate
 * @returns {Object} - Validation result with success and errors
 */
const validateQRData = (qrData) => {
  const errors = [];

  if (!qrData.serie || typeof qrData.serie !== 'string') {
    errors.push('Serie is required');
  } else if (!validateSerie(qrData.serie)) {
    errors.push('Serie must be exactly 17 alphanumeric characters');
  }

  if (!qrData.marca || typeof qrData.marca !== 'string') {
    errors.push('Marca is required');
  }

  if (!qrData.color || typeof qrData.color !== 'string') {
    errors.push('Color is required');
  }

  if (!qrData.ubicaciones || typeof qrData.ubicaciones !== 'string') {
    errors.push('Ubicaciones is required');
  }

  if (!qrData.location || typeof qrData.location !== 'string') {
    errors.push('Location is required');
  }

  if (qrData.type !== 'car_inventory') {
    errors.push('Invalid QR code type. Expected car_inventory');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Comprehensive validation for CSV row data
 * @param {Object} rowData - CSV row data to validate
 * @returns {Object} - Validation result with success and errors
 */
const validateCSVRowData = (rowData) => {
  const errors = [];

  if (!rowData.serie || typeof rowData.serie !== 'string') {
    errors.push('Serie is required');
  } else if (!validateSerie(rowData.serie)) {
    errors.push('Serie must be exactly 17 alphanumeric characters');
  }

  if (!rowData.marca || typeof rowData.marca !== 'string') {
    errors.push('Marca is required');
  }

  if (!rowData.color || typeof rowData.color !== 'string') {
    errors.push('Color is required');
  }

  if (!rowData.ubicaciones || typeof rowData.ubicaciones !== 'string') {
    errors.push('Ubicaciones is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateBarcode,
  validateSerie,
  validateMonth,
  validateYear,
  validateAgency,
  validateEmail,
  validateTimestamp,
  validateScanData,
  validateSessionData,
  validateQRData,
  validateCSVRowData
};
