const express = require('express');
const router = express.Router();
const inventoryService = require('../services/inventoryService');
const { asyncHandler, ValidationError, GoogleSheetsError } = require('../middleware/errorHandler');

// POST /api/inventory/save-scan
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

// POST /api/inventory/finish-session
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

// GET /api/inventory/monthly-inventory/:agency/:month/:year
router.get('/monthly-inventory/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.getMonthlyInventory(agency, month, year);
  res.status(200).json(result);
}));

// GET /api/inventory/agency-inventories/:agency
router.get('/agency-inventories/:agency', asyncHandler(async (req, res) => {
  const { agency } = req.params;

  // Validate parameters
  if (!agency) {
    throw new ValidationError('Missing required parameter: agency');
  }

  const result = await inventoryService.getAgencyInventories(agency);
  res.status(200).json(result);
}));

// GET /api/inventory/check-monthly-inventory/:agency/:month/:year
router.get('/check-monthly-inventory/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.checkMonthlyInventory(agency, month, year);
  res.status(200).json(result);
}));

// GET /api/inventory/duplicate-barcodes/:agency/:month/:year
router.get('/duplicate-barcodes/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.getDuplicateBarcodes(agency, month, year);
  res.status(200).json(result);
}));

// GET /api/inventory/scan-count/:agency/:month/:year
router.get('/scan-count/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.getScanCount(agency, month, year);
  res.status(200).json(result);
}));

// DELETE /api/inventory/delete-scanned-entry
router.delete('/delete-scanned-entry', asyncHandler(async (req, res) => {
  const { agency, barcode } = req.body;

  // Validate required fields
  if (!agency || !barcode) {
    throw new ValidationError('Missing required fields: agency, barcode');
  }

  const result = await inventoryService.deleteScannedEntry(agency, barcode);
  res.status(200).json(result);
}));

// GET /api/inventory/inventory-data/:agency/:month/:year
router.get('/inventory-data/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.getInventoryDataForDownload(agency, month, year);
  res.status(200).json(result);
}));

// GET /api/inventory/check-inventory-limits/:agency/:month/:year
router.get('/check-inventory-limits/:agency/:month/:year', asyncHandler(async (req, res) => {
  const { agency, month, year } = req.params;

  // Validate parameters
  if (!agency || !month || !year) {
    throw new ValidationError('Missing required parameters: agency, month, year');
  }

  const result = await inventoryService.checkInventoryLimits(agency, month, year);
  res.status(200).json(result);
}));

module.exports = router;
