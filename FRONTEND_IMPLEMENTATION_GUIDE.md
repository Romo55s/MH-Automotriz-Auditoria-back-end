# Frontend Implementation Guide

## Overview
This guide provides instructions for implementing the new inventory management features in the frontend application. The backend has been updated with new endpoints and functionality for inventory session enforcement, data deletion, and file downloads.

## Important: New Route Structure
The API routes have been refactored into separate modules for better organization and performance. All endpoints now use a structured path format:

- **Inventory Routes**: `/api/inventory/*`
- **Download Routes**: `/api/download/*`
- **Validation Routes**: `/api/validation/*`

**⚠️ Breaking Change**: All existing frontend API calls must be updated to use the new endpoint structure.

## Route Migration Guide

### Common Endpoint Changes
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

### Quick Migration Examples
```javascript
// OLD - Update these in your frontend code
const response = await fetch('/api/save-scan', { ... });
const response = await fetch('/api/download-inventory/agency/12/2024/csv');
const response = await fetch('/api/validate-monthly-summary');

// NEW - Use these updated endpoints
const response = await fetch('/api/inventory/save-scan', { ... });
const response = await fetch('/api/download/inventory/agency/12/2024/csv');
const response = await fetch('/api/validation/monthly-summary');
```

## New Backend Features Implemented

### 1. Inventory Session Enforcement
- **Limit**: Maximum 2 inventories per month per agency
- **Active Limit**: Only 1 active inventory at a time per agency
- **Enforcement**: Automatically checked before starting new inventory sessions

### 2. Delete Scanned Data
- **Functionality**: Delete individual scanned entries from Google Sheets
- **Use Case**: Remove mistakenly scanned barcodes

### 3. Download & Delete Inventory Data
- **Formats**: CSV and Excel file downloads
- **Auto-cleanup**: Data is automatically deleted from Google Sheets after successful download

## New API Endpoints

### 1. Check Inventory Limits
```
GET /api/inventory/check-inventory-limits/:agency/:month/:year
```
**Response:**
```json
{
  "canStart": true,
  "currentMonthCount": 1,
  "activeCount": 0
}
```

### 2. Delete Scanned Entry
```
DELETE /api/inventory/delete-scanned-entry
```
**Request Body:**
```json
{
  "agency": "AgencyName",
  "barcode": "123456789"
}
```

### 3. Get Inventory Data
```
GET /api/inventory/inventory-data/:agency/:month/:year
```
**Response:**
```json
{
  "agency": "AgencyName",
  "month": "December",
  "year": "2024",
  "totalScans": 150,
  "status": "Completed",
  "createdAt": "December 1, 2024 at 9:00:00 AM",
  "completedAt": "December 15, 2024 at 5:30:00 PM",
  "scans": [
    {
      "date": "Dec 1, 2024",
      "barcode": "123456789"
    }
  ]
}
```

### 4. Download CSV
```
GET /api/download/inventory/:agency/:month/:year/csv
```
**Response:** File download (CSV format)

### 5. Download Excel
```
GET /api/download/inventory/:agency/:month/:year/excel
```
**Response:** File download (Excel format)

## Frontend Implementation Requirements

### 1. Inventory Session Enforcement UI

#### Before Starting New Inventory
Add a check before allowing users to start a new inventory:

```javascript
// Check inventory limits before starting
const checkInventoryLimits = async (agency, month, year) => {
  try {
    const response = await fetch(`/api/inventory/check-inventory-limits/${agency}/${month}/${year}`);
    const result = await response.json();
    
    if (!result.canStart) {
      // Show error message to user
      showErrorMessage('Cannot start inventory: ' + result.message);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking inventory limits:', error);
    return false;
  }
};
```

#### UI Components Needed:
- **Warning Messages**: Display when limits are reached
- **Status Indicators**: Show current month count (e.g., "1/2 inventories this month")
- **Active Inventory Alert**: Show if another inventory is already active

### 2. Delete Scanned Data UI

#### Delete Button for Each Scan Entry
Add a delete button next to each scanned entry in the inventory list:

```javascript
// Delete scanned entry
const deleteScannedEntry = async (agency, barcode) => {
  if (!confirm('Are you sure you want to delete this scanned entry?')) {
    return;
  }
  
  try {
    const response = await fetch('/api/inventory/delete-scanned-entry', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agency,
        barcode
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Remove entry from UI
      removeEntryFromList(barcode);
      // Update scan count
      updateScanCount();
      showSuccessMessage('Entry deleted successfully');
    }
  } catch (error) {
    console.error('Error deleting entry:', error);
    showErrorMessage('Failed to delete entry');
  }
};
```

#### UI Components Needed:
- **Delete Button**: Small trash icon next to each scan entry
- **Confirmation Dialog**: "Are you sure?" confirmation
- **Success/Error Messages**: Feedback for user actions
- **Real-time Updates**: Remove deleted entries from the list immediately

### 3. Download & Delete Inventory Data UI

#### Download Buttons
Add download buttons for completed inventories:

```javascript
// Download inventory data
const downloadInventory = async (agency, month, year, format) => {
  try {
    // Show loading indicator
    showLoadingIndicator('Preparing download...');
    
    const response = await fetch(`/api/download/inventory/${agency}/${month}/${year}/${format}`);
    
    if (response.ok) {
      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${agency}_${month}_${year}_inventory.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Show success message
      showSuccessMessage('Download completed successfully');
      
      // Note: Data is automatically deleted from Google Sheets after download
      showInfoMessage('Inventory data has been cleared from the system');
    } else {
      throw new Error('Download failed');
    }
  } catch (error) {
    console.error('Error downloading inventory:', error);
    showErrorMessage('Failed to download inventory data');
  } finally {
    hideLoadingIndicator();
  }
};
```

#### UI Components Needed:
- **Download Buttons**: CSV and Excel download options
- **Loading Indicators**: Show progress during download
- **Success Messages**: Confirm successful download
- **Info Messages**: Inform user that data will be cleared
- **File Naming**: Use format: `{Agency}_{Month}_{Year}_inventory.{format}`

## Error Handling

### Common Error Scenarios

1. **Inventory Limit Reached**
   - Error: "Monthly inventory limit reached for {Agency}. Maximum 2 inventories per month allowed."
   - UI: Show warning message, disable "Start Inventory" button

2. **Active Inventory Exists**
   - Error: "Another inventory is already active for {Agency}. Only one inventory can be active at a time."
   - UI: Show current active inventory info, disable "Start Inventory" button

3. **Entry Not Found for Deletion**
   - Error: "Scanned entry not found: {barcode} for {Agency}"
   - UI: Show error message, refresh the inventory list

4. **Download Failures**
   - Error: Network or server errors during download
   - UI: Show retry option, maintain data in system

## UI/UX Recommendations

### 1. Inventory Status Dashboard
Create a dashboard showing:
- Current month inventory count (e.g., "1/2 inventories this month")
- Active inventory status
- Recent inventory history
- Quick actions (Start, Download, Delete)

### 2. Scan Entry List
Enhance the scan entry list with:
- Delete buttons (trash icons)
- Hover effects for better UX
- Confirmation dialogs for destructive actions
- Real-time updates after deletions

### 3. Download Section
Add a dedicated download section with:
- Format selection (CSV/Excel)
- Progress indicators
- File size information
- Clear messaging about data cleanup

### 4. Error States
Implement proper error states for:
- Network failures
- Permission errors
- Validation errors
- System limits

## Testing Checklist

### 1. Inventory Limits
- [ ] Test starting inventory when limit is reached
- [ ] Test starting inventory when another is active
- [ ] Verify proper error messages
- [ ] Test UI state updates

### 2. Delete Functionality
- [ ] Test deleting individual entries
- [ ] Verify scan count updates
- [ ] Test error handling for non-existent entries
- [ ] Verify UI updates after deletion

### 3. Download Functionality
- [ ] Test CSV download
- [ ] Test Excel download
- [ ] Verify file naming convention
- [ ] Test download with large datasets
- [ ] Verify data cleanup after download

### 4. Integration
- [ ] Test complete workflow: start → scan → delete → download
- [ ] Verify all error scenarios
- [ ] Test with different agencies
- [ ] Verify month/year handling

## Security Considerations

1. **Input Validation**: Validate all user inputs on the frontend
2. **Error Messages**: Don't expose sensitive system information
3. **File Downloads**: Ensure proper file type validation
4. **Rate Limiting**: Handle API rate limiting gracefully
5. **Authentication**: Ensure proper user authentication for all operations

## Performance Considerations

1. **Lazy Loading**: Load inventory data only when needed
2. **Caching**: Cache inventory limits and status information
3. **Pagination**: Implement pagination for large inventory lists
4. **Debouncing**: Debounce delete confirmations to prevent accidental clicks
5. **File Size**: Monitor download file sizes and provide progress indicators

## Additional Notes

- The backend automatically handles data cleanup after successful downloads
- All new endpoints include proper error handling and validation
- The system maintains data integrity through atomic operations
- Temporary files are automatically cleaned up after downloads
- All operations are logged for audit purposes

## Support

For technical support or questions about the implementation, refer to the backend API documentation or contact the development team.
