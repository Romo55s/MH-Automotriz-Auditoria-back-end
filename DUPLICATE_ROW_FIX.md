# Duplicate Row Fix - Root Cause Analysis and Solution

## Problem Description
When adding a new scan and the monthly summary is not created yet, the system was creating two rows instead of one in the MonthlySummary sheet.

**Example of duplicate rows:**
```
Month    Year    Agency   Status   Created At                    Created By              User Name              Total Scans   Session ID           Completed At
August   2025    Suzuki   Active   Friday, August 22, 2025 at 07:18 PM   tonyidol69@gmail.com   tonyidol69@gmail.com   1              sess_1755911926966   
August   2025    Suzuki   Active   Friday, August 22, 2025 at 07:18 PM   tonyidol69@gmail.com   tonyidol69@gmail.com   2              sess_1755911926966   
```

## Root Cause Analysis
The issue was caused by **two different methods both having the capability to create new rows** in the MonthlySummary sheet:

1. **`findOrCreateMonthlySummary()`** - Called from `saveScan()` method
2. **`updateMonthlySummary()`** - Also had logic to create new rows

### The Problem Flow:
1. `saveScan()` calls `findOrCreateMonthlySummary()` which creates a new row if none exists
2. Then `saveScan()` calls `updateMonthlySummaryScanCount()` to update the scan count
3. But somewhere in the process, `updateMonthlySummary()` was also being called
4. `updateMonthlySummary()` would also try to create a new row if it couldn't find an existing one
5. This resulted in **two rows being created** instead of one

## Solution Implemented

### 1. Separation of Responsibilities
- **`findOrCreateMonthlySummary()`** - **ONLY** responsible for creating new monthly summary rows
- **`updateMonthlySummary()`** - **ONLY** responsible for updating existing rows, never creates new ones

### 2. Improved `findOrCreateMonthlySummary()` Method
- Added retry logic with progressive delays to handle Google Sheets API delays
- Better error handling and logging
- More robust verification of row creation

### 3. Modified `updateMonthlySummary()` Method
- **Removed all row creation logic**
- Now throws an error if no existing row is found
- Only updates existing rows with incremented scan counts

### 4. Enhanced Duplicate Cleanup
- Added `cleanupSpecificDuplicates()` method to clean up duplicates for specific agency/month/year combinations
- Improved existing `cleanupDuplicateRows()` method
- Added new API endpoint: `POST /api/cleanup-specific-duplicates`

## Code Changes Made

### `src/services/inventoryService.js`
- **Line 107**: Updated comment to clarify atomic update method usage
- **Lines 380-420**: Enhanced `findOrCreateMonthlySummary()` with retry logic
- **Lines 412-536**: Completely refactored `updateMonthlySummary()` to only update existing rows
- **Lines 600-650**: Added new `cleanupSpecificDuplicates()` method

### `src/routes/api.js`
- **Lines 115-125**: Added new `POST /api/cleanup-specific-duplicates` endpoint

## How to Use the Fix

### 1. Clean Up Existing Duplicates
```bash
# Clean up all duplicates
POST /api/cleanup-duplicates

# Clean up specific duplicates for Suzuki August 2025
POST /api/cleanup-specific-duplicates
{
  "agency": "Suzuki",
  "month": "8",
  "year": "2025"
}
```

### 2. The Fix is Automatic
- New scans will now only create one row
- No more duplicate rows will be generated
- Existing duplicates can be cleaned up using the cleanup endpoints

## Prevention Measures

1. **Single Responsibility**: Only one method (`findOrCreateMonthlySummary`) can create new rows
2. **Atomic Operations**: Row creation and updates are handled separately
3. **Retry Logic**: Handles Google Sheets API delays gracefully
4. **Better Error Handling**: Clear error messages when operations fail
5. **Duplicate Detection**: Built-in cleanup methods for existing duplicates

## Testing the Fix

1. **Add a new scan** to an agency/month/year combination that doesn't have a monthly summary
2. **Verify only one row** is created in the MonthlySummary sheet
3. **Check scan count increments** properly without creating new rows
4. **Use cleanup endpoints** to remove any existing duplicates

## Benefits

- ✅ **No more duplicate rows** when adding new scans
- ✅ **Cleaner data structure** in MonthlySummary sheet
- ✅ **Better performance** (no unnecessary row creation)
- ✅ **Easier maintenance** with clear separation of concerns
- ✅ **Built-in cleanup tools** for existing duplicates

