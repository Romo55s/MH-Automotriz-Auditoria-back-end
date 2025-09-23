# Frontend Implementation Guide - Google Drive Integration

## 📋 Overview

This guide explains how to implement the Google Drive integration in the frontend application.

## 🔄 Changes Required

### 1. Update API Endpoints

**❌ OLD Endpoints (Remove these):**
```javascript
// Remove these old backup endpoints
POST /api/inventory/backup/:agency/:month/:year/csv
GET /api/download/backup/:agency/:month/:year/csv
```

**✅ NEW Endpoints (Use these):**
```javascript
// Main download endpoint - handles both first-time and subsequent downloads
GET /api/download/inventory/:agency/:month/:year/csv
GET /api/download/inventory/:agency/:month/:year/excel

// Specific inventory download by session ID (for multiple inventories per month)
GET /api/download/inventory/:agency/:month/:year/csv/:sessionId

// Google Drive management endpoints
GET /api/download/stored-files/:agency          // List files for an agency
GET /api/download/stored-file/:fileId           // Download specific file by ID
```

### 2. Update Download Logic

**Current Implementation:**
```javascript
// OLD - Manual backup call
const downloadInventory = async (agency, month, year, type) => {
  try {
    // Download file
    const response = await apiRequest(`/api/download/inventory/${agency}/${month}/${year}/${type}`);
    
    // Manual backup call (REMOVE THIS)
    await apiRequest(`/api/inventory/backup/${agency}/${month}/${year}/${type}`, 'POST');
    
    return response;
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
};
```

**New Implementation:**
```javascript
// NEW - Smart download flow (no changes needed to download logic)
const downloadInventory = async (agency, month, year, type) => {
  try {
    // Download file - handles both first-time and subsequent downloads automatically
    const response = await apiRequest(`/api/download/inventory/${agency}/${month}/${year}/${type}`);
    
    // Backend automatically:
    // - First download: Generates CSV → Stores backup → Clears Google Sheets
    // - Subsequent downloads: Downloads from Google Drive backup
    
    return response;
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
};
```

### 3. Remove Backup UI Elements

**Remove these UI elements:**
- Backup buttons
- Backup status indicators
- Manual backup triggers
- Backup confirmation modals

**Keep these UI elements:**
- Download buttons (CSV/Excel)
- Download progress indicators
- Download success/error messages

### 4. Handle Multiple Inventories Per Month

**❌ OLD WAY (Always downloads most recent):**
```javascript
// DON'T USE THIS - always downloads the most recent inventory
const downloadInventory = async (agency, month, year, type) => {
  const response = await apiRequest(`/api/download/inventory/${agency}/${month}/${year}/${type}`);
  return response;
};
```

**✅ NEW WAY (Downloads specific inventory by session ID):**
```javascript
// Download specific inventory by session ID
const downloadSpecificInventory = async (agency, month, year, sessionId, type = 'csv') => {
  try {
    const response = await apiRequest(`/api/download/inventory/${agency}/${month}/${year}/${type}/${sessionId}`);
    
    // Backend automatically finds the correct file by session ID
    // Falls back to most recent if specific session not found
    
    return response;
  } catch (error) {
    console.error('Specific inventory download failed:', error);
    throw error;
  }
};

// Example usage in React component
const handleDownloadInventory = async (inventory) => {
  try {
    await downloadSpecificInventory(
      inventory.agency,
      inventory.month,
      inventory.year,
      inventory.sessionId, // Use the session ID from inventory data
      'csv'
    );
    
    showSuccessMessage(`Downloaded inventory: ${inventory.sessionId}`);
  } catch (error) {
    showErrorMessage('Download failed: ' + error.message);
  }
};
```

**Updated Inventory List Component:**
```javascript
// Inventory card component
const InventoryCard = ({ inventory }) => {
  const handleDownload = () => {
    downloadSpecificInventory(
      inventory.agency,
      inventory.month,
      inventory.year,
      inventory.sessionId,
      'csv'
    );
  };

  return (
    <div className="inventory-card">
      <div className="inventory-info">
        <h3>{inventory.month} {inventory.year} - {inventory.totalScans} códigos</h3>
        <p>por {inventory.userName}</p>
        <p>Completado: {inventory.completedAt}</p>
        <p>Tiempo restante: {inventory.timeRemaining}</p>
      </div>
      <button onClick={handleDownload} className="download-btn">
        Descargar
      </button>
    </div>
  );
};
```

### 5. Multiple Inventories Implementation (COMPLETED)

**✅ Working Solution:**

The multiple inventories per month feature is now fully implemented and working. Here's the final implementation:

**Frontend Download Function:**
```javascript
const downloadSpecificInventory = async (agency, month, year, sessionId, type = 'csv') => {
  try {
    const response = await apiRequest(`/api/download/inventory/${agency}/${month}/${year}/${type}/${sessionId}`);
    return response;
  } catch (error) {
    console.error('Specific inventory download failed:', error);
    throw error;
  }
};
```

**Inventory Card Component:**
```javascript
const InventoryCard = ({ inventory }) => {
  const handleDownload = () => {
    downloadSpecificInventory(
      inventory.agency,
      inventory.month,
      inventory.year,
      inventory.sessionId, // Key: Use session ID for specific downloads
      'csv'
    );
  };

  return (
    <div className="inventory-card">
      <h3>{inventory.month} {inventory.year} - {inventory.totalScans} códigos</h3>
      <p>Session: {inventory.sessionId}</p>
      <button onClick={handleDownload}>Descargar</button>
    </div>
  );
};
```

**✅ Features Working:**
- Multiple inventories per month (up to 2)
- Unique session tracking
- Individual downloads by session ID
- Automatic Google Drive backups
- Smart fallback to most recent
- Clean Google Sheets after backup

### 6. Update Error Handling

**Add Google Drive error handling:**
```javascript
const downloadInventory = async (agency, month, year, type) => {
  try {
    const response = await apiRequest(`/api/download/inventory/${agency}/${month}/${year}/${type}`);
    
    // Show success message
    showSuccessMessage('File downloaded and backed up successfully!');
    
    return response;
  } catch (error) {
    if (error.message.includes('Google Drive')) {
      showWarningMessage('File downloaded but backup failed. Please contact support.');
    } else {
      showErrorMessage('Download failed: ' + error.message);
    }
    throw error;
  }
};
```

## 🎨 UI Changes

### 1. Download Confirmation Modal

**Update the modal text:**
```jsx
<DownloadConfirmationModal
  title="Download Inventory"
  message="This will download the inventory file. On first download, it will be automatically backed up to Google Drive and the data will be cleared from the system."
  confirmText="Download"
  onConfirm={handleDownload}
/>
```

### 2. Success Messages

**Update success messages:**
```javascript
const showDownloadSuccess = () => {
  showToast({
    type: 'success',
    title: 'Download Complete',
    message: 'File downloaded successfully. Backup to Google Drive handled automatically.'
  });
};
```

### 3. Error Messages

**Add backup-specific error handling:**
```javascript
const handleDownloadError = (error) => {
  if (error.message.includes('backup')) {
    showToast({
      type: 'warning',
      title: 'Partial Success',
      message: 'File downloaded but backup failed. Data will be cleared from system.'
    });
  } else {
    showToast({
      type: 'error',
      title: 'Download Failed',
      message: error.message
    });
  }
};
```

## 🔧 Implementation Steps

### Step 1: Update API Calls
1. Remove all calls to `/api/inventory/backup/*`
2. Remove all calls to `/api/download/backup/*`
3. Keep existing calls to `/api/download/inventory/*`

### Step 2: Update UI Components
1. Remove backup-related buttons and modals
2. Update download confirmation messages
3. Add Google Drive error handling

### Step 3: Update State Management
1. Remove backup-related state variables
2. Remove backup-related actions/reducers
3. Update download success handlers

### Step 4: Test Integration
1. Test download functionality
2. Verify automatic backup works
3. Test error handling scenarios

## 📱 Example Implementation

### Download Component
```jsx
import React, { useState } from 'react';

const DownloadButton = ({ agency, month, year, type }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await apiRequest(
        `/api/download/inventory/${agency}/${month}/${year}/${type}`
      );
      
      // Download the file
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.filename;
      link.click();
      
      // Show success message
      showToast({
        type: 'success',
        title: 'Download Complete',
        message: 'File downloaded successfully. Backup to Google Drive handled automatically.'
      });
      
    } catch (error) {
      handleDownloadError(error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button 
      onClick={handleDownload}
      disabled={isDownloading}
      className="download-button"
    >
      {isDownloading ? 'Downloading...' : `Download ${type.toUpperCase()}`}
    </button>
  );
};
```

### Error Handling
```javascript
const handleDownloadError = (error) => {
  console.error('Download error:', error);
  
  if (error.response?.status === 500) {
    if (error.response.data?.message?.includes('Google Drive')) {
      showToast({
        type: 'warning',
        title: 'Partial Success',
        message: 'File downloaded but backup failed. Please contact support.'
      });
    } else {
      showToast({
        type: 'error',
        title: 'Server Error',
        message: 'Please try again or contact support.'
      });
    }
  } else {
    showToast({
      type: 'error',
      title: 'Download Failed',
      message: error.message || 'An error occurred during download.'
    });
  }
};
```

## ✅ Testing Checklist

- [ ] Download CSV works correctly
- [ ] Download Excel works correctly
- [ ] First download generates from Google Sheets and creates backup
- [ ] Subsequent downloads use Google Drive backup
- [ ] Google Sheets data is cleared after first download
- [ ] Error handling works for network issues
- [ ] Error handling works for Google Drive issues
- [ ] UI shows appropriate success/warning messages
- [ ] No old backup UI elements remain
- [ ] Files are properly organized in agency folders on Google Drive

## 🚀 Deployment

1. **Update frontend code** with new implementation
2. **Test thoroughly** in development environment
3. **Deploy frontend** to production
4. **Verify integration** with production backend
5. **Monitor logs** for any issues

## 📞 Support

If you encounter any issues:
1. Check browser console for errors
2. Check backend logs for Google Drive errors
3. Verify environment variables are set correctly
4. Contact backend team for Google Drive configuration issues