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

// Data integrity and conflict prevention
GET /api/inventory/check-completion-by-other/:agency/:month/:year/:currentUserId
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

### 5. Backend-Handled Multiple Inventories (NEW)

**✅ Smart Backend Solution:**

The backend now intelligently handles multiple inventories per location with different download strategies.

**Frontend Implementation:**

**Step 1: Get Available Inventories**
```javascript
const getLocationInventories = async (agency, month, year) => {
  try {
    const response = await apiRequest(`/api/inventory/location/${agency}/${month}/${year}`);
    return response.inventories; // Array of available inventories
  } catch (error) {
    console.error('Failed to get location inventories:', error);
    throw error;
  }
};
```

**Step 2: Smart Download with Strategy**
```javascript
const downloadLocationInventory = async (agency, month, year, strategy = 'date_based') => {
  try {
    // Backend handles the selection logic
    const response = await apiRequest(`/api/download/inventory/${agency}/${month}/${year}/csv/location?strategy=${strategy}`);
    return response;
  } catch (error) {
    console.error('Location inventory download failed:', error);
    throw error;
  }
};
```

**Step 3: User-Friendly Inventory Selection Component**
```javascript
const InventoryManager = ({ agency, month, year }) => {
  const [inventories, setInventories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInventories();
  }, [agency, month, year]);

  const loadInventories = async () => {
    setLoading(true);
    try {
      const data = await getLocationInventories(agency, month, year);
      setInventories(data);
    } catch (error) {
      console.error('Failed to load inventories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSpecific = async (inventoryId) => {
    try {
      const response = await apiRequest(`/api/download/inventory/${agency}/${month}/${year}/csv/${inventoryId}`);
      return response;
    } catch (error) {
      console.error('Specific download failed:', error);
      throw error;
    }
  };

  if (loading) return <div>Loading inventories...</div>;

  return (
    <div className="inventory-manager">
      <h3>Inventories for {agency} - {month}/{year}</h3>
      
      {/* Inventory Selection */}
      {inventories.length > 0 ? (
        <div className="inventory-selection">
          <h4>Choose an Inventory to Download ({inventories.length} available)</h4>
          <div className="inventory-grid">
            {inventories.map((inventory) => (
              <div key={inventory.inventoryId} className="inventory-card">
                <div className="inventory-header">
                  <h5>{inventory.displayName}</h5>
                  <span className="inventory-number">#{inventory.inventoryNumber}</span>
                </div>
                
                <div className="inventory-details">
                  <p><strong>📅 Created:</strong> {inventory.creationDate}</p>
                  <p><strong>📊 Size:</strong> {(inventory.size / 1024).toFixed(1)} KB</p>
                  <p><strong>🆔 ID:</strong> {inventory.inventoryId}</p>
                </div>
                
                <button 
                  onClick={() => handleDownloadSpecific(inventory.inventoryId)}
                  className="download-btn primary"
                >
                  📥 Download This Inventory
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="no-inventories">
          <p>No inventories found for this location and period.</p>
          <button onClick={() => loadInventories()}>
            🔄 Refresh
          </button>
        </div>
      )}
    </div>
  );
};
```

**✅ Backend Features:**
- **Smart Selection**: Backend handles inventory selection logic
- **Multiple Strategies**: first, last, most_recent, date_based
- **Automatic Fallback**: Generates from Google Sheets if no backups
- **Google Drive Integration**: Automatic backup and download from cloud storage
- **User-Friendly Interface**: Clear inventory selection with creation dates
- **Universal Access**: Any user can download from any location
- **Data Integrity**: Prevents conflicts when multiple users work on same inventory
- **No Frontend Complexity**: Backend manages all the logic

### 7. Data Integrity and Conflict Prevention

**New Endpoint for Conflict Detection:**
```javascript
// Check if inventory was completed by another user
const checkCompletionByOther = async (agency, month, year, currentUserId) => {
  try {
    const response = await apiRequest(
      `/api/inventory/check-completion-by-other/${agency}/${month}/${year}/${currentUserId}`
    );
    return response;
  } catch (error) {
    console.error('Failed to check completion by other:', error);
    throw error;
  }
};

// Usage example
const completionInfo = await checkCompletionByOther('Jac', '09', '2025', 'tony@example.com');

if (completionInfo.completed) {
  // Show warning: "Inventory was completed by John Doe at 2025-01-15T10:30:00Z"
  showWarning(`Inventory was completed by ${completionInfo.completedBy} at ${completionInfo.completedAt}`);
} else {
  // Safe to continue or show current status
  console.log(completionInfo.message);
}
```

**Response Format:**
```javascript
{
  "completed": true,
  "completedBy": "John Doe",
  "completedAt": "2025-01-15T10:30:00Z",
  "message": "Inventory was completed by John Doe"
}
```

**Use Cases:**
- **Before starting scan**: Check if the current active session was completed by someone else
- **During scanning**: Periodically check if the active session was completed by others
- **Before finishing**: Verify no one else finished the current active session first
- **Conflict resolution**: Show who completed the current session and when

**Important Notes:**
- ✅ **Only checks the current active session** - not completed inventories from the same month
- ✅ **Allows multiple users** to join the same active session for collaborative scanning
- ✅ **Prevents conflicts** only when the active session itself is completed by someone else
- ✅ **Supports 2 inventories per month** - each can have its own active session

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