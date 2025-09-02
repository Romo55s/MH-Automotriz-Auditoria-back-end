const express = require('express');
const router = express.Router();
const inventoryService = require('../services/inventoryService');
const { asyncHandler, ValidationError, GoogleSheetsError } = require('../middleware/errorHandler');

// GET /api/validation/monthly-summary
router.get('/monthly-summary', asyncHandler(async (req, res) => {
  const result = await inventoryService.validateMonthlySummaryStructure();
  res.status(200).json(result);
}));

// GET /api/validation/monthly-summary/:agency/:month/:year
router.get('/monthly-summary/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.validateSingleMonthlySummary(agency, month, year);
  res.status(200).json(result);
}));

// POST /api/validation/cleanup-duplicates
router.post('/cleanup-duplicates', asyncHandler(async (req, res) => {
  const result = await inventoryService.cleanupDuplicateRows();
  res.status(200).json(result);
}));

// POST /api/validation/cleanup-specific-duplicates
router.post('/cleanup-specific-duplicates', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.body;

  // Validate required fields
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required fields: agency, month, year');
  }

  const result = await inventoryService.cleanupSpecificDuplicates(agency, month, year);
  res.status(200).json(result);
}));

module.exports = router;
