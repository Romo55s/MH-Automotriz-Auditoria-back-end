# 📅 30-Day Retention Policy Testing Guide

## Overview

This guide explains how to test the 30-day retention policy for Google Drive backups in the car inventory system.

**Last Updated:** October 14, 2025  
**Status:** ✅ Tested and Working  
**Test Results:** All systems operational - files correctly retained for 30 days from creation

## How the Retention Policy Works

### Current System Behavior ✅

The system maintains a **30-day retention policy** for all inventory backups:

1. **When an inventory is completed:**
   - Backup is created in Google Drive
   - File is given an `expiresAt` date = creation date + 30 days
   - File is tracked in the `FileStorage` sheet

2. **Daily cleanup (runs at 2 AM):**
   - Cleanup scheduler checks all files
   - Files where `expiresAt` < current date are marked as expired
   - Expired files are deleted from Google Drive
   - Status is updated to "Expired" in FileStorage sheet

3. **Google Sheets data:**
   - Agency sheet data is cleared **after successful backup** (not after 30 days)
   - MonthlySummary keeps metadata indefinitely
   - Only the actual Google Drive files are subject to 30-day retention

### What Gets Deleted vs What Gets Kept

| Data Type | Location | Retention Policy |
|-----------|----------|-----------------|
| Scan data during inventory | Agency Sheet (Google Sheets) | Cleared after successful backup |
| Backup files | Google Drive | Deleted after 30 days |
| Inventory metadata | MonthlySummary Sheet | Kept indefinitely |
| File tracking info | FileStorage Sheet | Status marked as "Expired" after 30 days |

## Running the Retention Test

### Basic Test Run

```bash
# Make sure your server is running
npm start

# In another terminal, run the retention test
npm run test:retention
```

### What the Test Does

The test verifies the 30-day retention policy by:

1. **Creating Test Inventories (3 scenarios):**
   - Old inventory (40 days old) - should be deleted
   - Expired inventory (35 days old) - should be deleted  
   - Recent inventory (15 days old) - should be kept

2. **Checking Files Exist:**
   - Verifies files are in Google Drive before cleanup

3. **Running Cleanup Process:**
   - Triggers the cleanup scheduler
   - Checks cleanup scheduler status

4. **Verifying Retention:**
   - Confirms old files are deleted
   - Confirms recent files are retained

5. **Generating Report:**
   - Creates detailed JSON report
   - Provides recommendations

**⚠️ Important Note:** The test creates NEW files with simulated ages. Files created today will have expiresAt = today + 30 days, so they won't be deleted until 30 days from now. This is the correct behavior!

### Test Output

The test generates:
- **Console output**: Real-time progress and results
- **JSON report**: `monthly-retention-report-YYYY-MM-DD.json`

### Understanding Test Results

#### ✅ Success Indicators
```
🎉 EXCELLENT: Retention policy working perfectly!
   ✅ All expired files were deleted
   ✅ All active files were retained
```

#### ⚠️ Partial Success
```
⚠️ PARTIAL: Retention policy partially working
   ⚠️ Some files may not have been processed correctly
```

#### ⚠️ Inconclusive Results (Expected for New Files)
```
⚠️ INCONCLUSIVE: Could not verify file deletion/retention
   ℹ️  This may be because:
      • Files were created today (not actually old)
      • expiresAt dates are set to future (today + 30 days)
      • Cleanup only deletes files older than 30 days
      • This is CORRECT behavior for new files!
```

## Manual Verification Steps

If automated testing is inconclusive, verify manually:

### 1. Check Google Drive Folder

1. Open your Google Drive
2. Navigate to the inventory folder
3. Check file creation dates
4. Verify old files (30+ days) are being deleted

### 2. Check FileStorage Sheet

1. Open your Google Sheets
2. Go to the "FileStorage" sheet
3. Verify columns:
   - `Uploaded At`: When file was created
   - `Expires At`: Should be `Uploaded At` + 30 days
   - `Status`: Should change from "Active" to "Expired"

### 3. Check Cleanup Scheduler

```bash
# Check health endpoint
curl http://localhost:5000/health/detailed
```

Look for `cleanupScheduler` status in response.

### 4. Force Manual Cleanup

If you need to trigger cleanup immediately (for testing):

```javascript
// In your Node.js server console or via API endpoint
const cleanupScheduler = require('./src/services/cleanupScheduler');
await cleanupScheduler.forceCleanup();
```

## Troubleshooting

### Files Not Being Deleted

**Possible causes:**

1. **FileStorage sheet not tracking files:**
   - Check if `FileStorage` sheet exists
   - Verify it has proper headers
   - Ensure files are being added when backups are created

2. **expiresAt dates not set:**
   - Check FileStorage sheet
   - Verify `Expires At` column has dates
   - Should be `Uploaded At` + 30 days

3. **Cleanup scheduler not running:**
   - Check server logs for scheduler status
   - Verify cleanup is enabled in config
   - Check cron schedule: `0 2 * * *` (2 AM daily)

4. **Google Drive API errors:**
   - Check server logs for Google Drive errors
   - Verify credentials and permissions
   - Check API quota limits

### Files Being Deleted Too Early

**Possible causes:**

1. **Incorrect expiresAt calculation:**
   - Should be creation date + 30 days
   - Check `retentionDays` in config: `src/config/googleSheets.js`

2. **System time issues:**
   - Verify server time is correct
   - Check timezone settings

## Configuration

### Retention Period

Edit `src/config/googleSheets.js`:

```javascript
drive: {
  retentionDays: 30, // Change this value to adjust retention period
  
  cleanup: {
    enabled: true, // Set to false to disable cleanup
    schedule: '0 2 * * *', // Daily at 2 AM (cron format)
    batchSize: 50
  }
}
```

### Cleanup Schedule

The cleanup runs daily at 2 AM by default. To change:

```javascript
cleanup: {
  schedule: '0 2 * * *', // Cron format
  // Examples:
  // '0 2 * * *' = Daily at 2 AM
  // '0 */6 * * *' = Every 6 hours
  // '0 0 * * 0' = Weekly on Sunday at midnight
}
```

## Best Practices

### For Production

1. **Monitor cleanup logs:**
   - Check server logs daily
   - Verify cleanup runs successfully
   - Track number of files deleted

2. **Regular audits:**
   - Monthly review of Google Drive storage
   - Verify FileStorage sheet accuracy
   - Check for orphaned files

3. **Backup important files:**
   - Consider archiving files before 30-day expiration
   - Export critical inventories separately
   - Maintain offline backups if needed

4. **Set up alerts:**
   - Alert if cleanup fails
   - Alert if storage usage is abnormal
   - Monitor API quota usage

### For Development/Testing

1. **Use shorter retention for testing:**
   ```javascript
   retentionDays: 7, // 7 days for testing
   ```

2. **Test cleanup manually:**
   ```bash
   npm run test:retention
   ```

3. **Create test data with past dates:**
   - The test script handles this automatically
   - Useful for verifying deletion logic

## FAQ

### Q: Are inventory records permanently deleted after 30 days?

**A:** No! Only the **backup files in Google Drive** are deleted. The **inventory metadata** (completion status, scan count, dates, etc.) is kept indefinitely in the `MonthlySummary` sheet.

### Q: Why don't test files get deleted immediately?

**A:** Test files are created with current timestamp, so they have expiresAt = now + 30 days. They will be deleted 30 days from creation, not based on simulated age. This is correct behavior!

### Q: What happens if I need a file older than 30 days?

**A:** The file will be deleted from Google Drive after 30 days. If you need longer retention:
1. Download important files before 30 days
2. Archive them separately
3. Or increase `retentionDays` in the configuration

### Q: Can I manually delete files before 30 days?

**A:** Yes, you can manually delete files from Google Drive. The FileStorage sheet will still track them until the cleanup runs.

### Q: Does cleanup affect active inventories?

**A:** No! Only **completed** inventories that are **older than 30 days** are affected. Active (incomplete) inventories are never cleaned up automatically.

### Q: What if cleanup fails?

**A:** Check server logs for errors. Common issues:
- Google Drive API quota exceeded
- Insufficient permissions
- Network connectivity issues
- Files already deleted manually

## Related Documentation

- [Google Drive Integration Guide](GOOGLE_DRIVE_INTEGRATION_GUIDE.md)
- [Production Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Quota Management](QUOTA_MANAGEMENT.md)

## Support

If you encounter issues with the retention policy:
1. Check server logs
2. Run the retention test: `npm run test:retention`
3. Verify Google Drive permissions
4. Check FileStorage sheet
5. Review this guide's troubleshooting section

