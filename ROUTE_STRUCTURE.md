# API Route Structure

## Overview
The API routes have been refactored into separate modules for better organization, maintainability, and performance. Each service now has its own dedicated route file.

## Route Organization

### 1. **Inventory Routes** (`/src/routes/inventoryRoutes.js`)
**Base Path:** `/api/inventory`

#### Core Inventory Operations
- `POST /api/inventory/save-scan` - Save a barcode scan
- `POST /api/inventory/finish-session` - Finish an inventory session
- `GET /api/inventory/monthly-inventory/:agency/:month/:year` - Get monthly inventory data
- `GET /api/inventory/agency-inventories/:agency` - Get all inventories for an agency

#### Inventory Management
- `GET /api/inventory/check-monthly-inventory/:agency/:month/:year` - Check inventory status
- `GET /api/inventory/duplicate-barcodes/:agency/:month/:year` - Get duplicate barcodes
- `GET /api/inventory/scan-count/:agency/:month/:year` - Get real-time scan count
- `DELETE /api/inventory/delete-scanned-entry` - Delete a scanned entry
- `GET /api/inventory/inventory-data/:agency/:month/:year` - Get inventory data for download
- `GET /api/inventory/check-inventory-limits/:agency/:month/:year` - Check session limits

### 2. **Download Routes** (`/src/routes/downloadRoutes.js`)
**Base Path:** `/api/download`

#### File Downloads
- `GET /api/download/inventory/:agency/:month/:year/csv` - Download CSV file
- `GET /api/download/inventory/:agency/:month/:year/excel` - Download Excel file

#### Maintenance
- `POST /api/download/cleanup-temp-files` - Clean up temporary files

### 3. **Validation Routes** (`/src/routes/validationRoutes.js`)
**Base Path:** `/api/validation`

#### Data Validation
- `GET /api/validation/monthly-summary` - Validate monthly summary structure
- `GET /api/validation/monthly-summary/:agency/:month/:year` - Validate specific summary

#### Data Cleanup
- `POST /api/validation/cleanup-duplicates` - Clean up all duplicate rows
- `POST /api/validation/cleanup-specific-duplicates` - Clean up specific duplicates

## Benefits of This Structure

### 1. **Performance Improvements**
- **Lazy Loading**: Routes are only loaded when needed
- **Reduced Memory Footprint**: Smaller individual modules
- **Faster Startup**: Less code to parse during initialization
- **Better Caching**: Node.js can cache modules more efficiently

### 2. **Maintainability**
- **Separation of Concerns**: Each service has its own file
- **Easier Debugging**: Issues are isolated to specific modules
- **Cleaner Code**: Smaller, focused files are easier to understand
- **Team Collaboration**: Multiple developers can work on different modules

### 3. **Scalability**
- **Modular Architecture**: Easy to add new services
- **Independent Development**: Services can be developed separately
- **Testing**: Each module can be tested independently
- **Deployment**: Services can be deployed independently if needed

## Migration Guide

### Old Endpoints → New Endpoints

| Old Endpoint | New Endpoint |
|--------------|--------------|
| `POST /api/save-scan` | `POST /api/inventory/save-scan` |
| `POST /api/finish-session` | `POST /api/inventory/finish-session` |
| `GET /api/monthly-inventory/:agency/:month/:year` | `GET /api/inventory/monthly-inventory/:agency/:month/:year` |
| `GET /api/agency-inventories/:agency` | `GET /api/inventory/agency-inventories/:agency` |
| `GET /api/check-monthly-inventory/:agency/:month/:year` | `GET /api/inventory/check-monthly-inventory/:agency/:month/:year` |
| `GET /api/duplicate-barcodes/:agency/:month/:year` | `GET /api/inventory/duplicate-barcodes/:agency/:month/:year` |
| `GET /api/scan-count/:agency/:month/:year` | `GET /api/inventory/scan-count/:agency/:month/:year` |
| `DELETE /api/delete-scanned-entry` | `DELETE /api/inventory/delete-scanned-entry` |
| `GET /api/inventory-data/:agency/:month/:year` | `GET /api/inventory/inventory-data/:agency/:month/:year` |
| `GET /api/check-inventory-limits/:agency/:month/:year` | `GET /api/inventory/check-inventory-limits/:agency/:month/:year` |
| `GET /api/download-inventory/:agency/:month/:year/csv` | `GET /api/download/inventory/:agency/:month/:year/csv` |
| `GET /api/download-inventory/:agency/:month/:year/excel` | `GET /api/download/inventory/:agency/:month/:year/excel` |
| `GET /api/validate-monthly-summary` | `GET /api/validation/monthly-summary` |
| `GET /api/validate-monthly-summary/:agency/:month/:year` | `GET /api/validation/monthly-summary/:agency/:month/:year` |
| `POST /api/cleanup-duplicates` | `POST /api/validation/cleanup-duplicates` |
| `POST /api/cleanup-specific-duplicates` | `POST /api/validation/cleanup-specific-duplicates` |

## Frontend Updates Required

### 1. Update API Base URLs
```javascript
// Old
const response = await fetch('/api/save-scan', { ... });

// New
const response = await fetch('/api/inventory/save-scan', { ... });
```

### 2. Update Download URLs
```javascript
// Old
const csvUrl = `/api/download-inventory/${agency}/${month}/${year}/csv`;
const excelUrl = `/api/download-inventory/${agency}/${month}/${year}/excel`;

// New
const csvUrl = `/api/download/inventory/${agency}/${month}/${year}/csv`;
const excelUrl = `/api/download/inventory/${agency}/${month}/${year}/excel`;
```

### 3. Update Validation URLs
```javascript
// Old
const response = await fetch('/api/validate-monthly-summary', { ... });

// New
const response = await fetch('/api/validation/monthly-summary', { ... });
```

## Backward Compatibility

**Note**: The old endpoints are no longer available. All frontend applications must be updated to use the new endpoint structure.

## File Structure

```
src/routes/
├── api.js                 # Main router that mounts all sub-routes
├── inventoryRoutes.js     # Inventory-related endpoints
├── downloadRoutes.js      # Download-related endpoints
└── validationRoutes.js    # Validation and cleanup endpoints
```

## Adding New Routes

### 1. **For Inventory Features**
Add to `src/routes/inventoryRoutes.js`:
```javascript
router.get('/new-endpoint', asyncHandler(async (req, res) => {
  // Implementation
}));
```

### 2. **For Download Features**
Add to `src/routes/downloadRoutes.js`:
```javascript
router.get('/new-download', asyncHandler(async (req, res) => {
  // Implementation
}));
```

### 3. **For Validation Features**
Add to `src/routes/validationRoutes.js`:
```javascript
router.get('/new-validation', asyncHandler(async (req, res) => {
  // Implementation
}));
```

## Performance Monitoring

Monitor the following metrics to ensure the refactoring improves performance:

1. **Startup Time**: Measure server startup time
2. **Memory Usage**: Monitor memory consumption
3. **Response Times**: Track API response times
4. **Load Testing**: Test under various load conditions

## Best Practices

1. **Keep Routes Focused**: Each route file should handle related functionality
2. **Consistent Naming**: Use consistent naming conventions across all routes
3. **Error Handling**: Maintain consistent error handling patterns
4. **Documentation**: Keep this documentation updated when adding new routes
5. **Testing**: Test each route module independently

## Support

For questions about the new route structure or migration issues, refer to this documentation or contact the development team.
