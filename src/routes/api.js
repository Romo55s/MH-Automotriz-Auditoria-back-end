const express = require('express');
const router = express.Router();
const inventoryService = require('../services/inventoryService');
const { asyncHandler, ValidationError, GoogleSheetsError } = require('../middleware/errorHandler');

// POST /api/save-scan
router.post('/save-scan', asyncHandler(async (req, res) => {
  const { agency, month, year, code, user, userName } = req.body;

  // Validate required fields
  if (!agency || !month || !year || !code || !user) {
    throw new ValidationError('Missing required fields: agency, month, year, code, user');
  }

  const result = await inventoryService.saveScan({
    agency,
    month,
    year,
    code,
    user,
    userName: userName || user
  });

  res.status(200).json(result);
}));

// POST /api/finish-session
router.post('/finish-session', asyncHandler(async (req, res) => {
  const { agency, month, year, user } = req.body;

  // Validate required fields
  if (!agency || !month || !year || !user) {
    throw new ValidationError('Missing required fields: agency, month, year, user');
  }

  const result = await inventoryService.finishSession({
    agency,
    month,
    year,
    user
  });

  res.status(200).json(result);
}));

// GET /api/monthly-inventory/:agency/:month/:year
router.get('/monthly-inventory/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.getMonthlyInventory(agency, month, year);
  res.status(200).json(result);
}));

// GET /api/agency-inventories/:agency
router.get('/agency-inventories/:agency', asyncHandler(async (req, res) => {
  const { agency } = req.params;

  // Validate parameters
  if (!agency) {
    throw new ValidationError('Missing required parameter: agency');
  }

  const result = await inventoryService.getAgencyInventories(agency);
  res.status(200).json(result);
}));

// GET /api/check-monthly-inventory/:agency/:month/:year
router.get('/check-monthly-inventory/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.checkMonthlyInventory(agency, month, year);
  res.status(200).json(result);
}));

// GET /api/duplicate-barcodes/:agency/:month/:year
router.get('/duplicate-barcodes/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.getDuplicateBarcodes(agency, month, year);
  res.status(200).json(result);
}));

// GET /api/scan-count/:agency/:month/:year
router.get('/scan-count/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.getScanCount(agency, month, year);
  res.status(200).json(result);
}));

// GET /api/validate-monthly-summary
router.get('/validate-monthly-summary', asyncHandler(async (req, res) => {
  const result = await inventoryService.validateMonthlySummaryStructure();
  res.status(200).json(result);
}));

// POST /api/cleanup-duplicates
router.post('/cleanup-duplicates', asyncHandler(async (req, res) => {
  const result = await inventoryService.cleanupDuplicateRows();
  res.status(200).json(result);
}));

// POST /api/cleanup-specific-duplicates
router.post('/cleanup-specific-duplicates', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.body;

  // Validate required fields
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required fields: agency, month, year');
  }

  const result = await inventoryService.cleanupSpecificDuplicates(agency, month, year);
  res.status(200).json(result);
}));

// GET /api/validate-monthly-summary/:agency/:month/:year
router.get('/validate-monthly-summary/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.validateSingleMonthlySummary(agency, month, year);
  res.status(200).json(result);
}));

module.exports = router;
