const express = require('express');
const router = express.Router();

// Import separate route modules
const inventoryRoutes = require('./inventoryRoutes');
const downloadRoutes = require('./downloadRoutes');
const validationRoutes = require('./validationRoutes');

// Mount route modules with their respective prefixes
router.use('/inventory', inventoryRoutes);
router.use('/download', downloadRoutes);
router.use('/validation', validationRoutes);

module.exports = router;
