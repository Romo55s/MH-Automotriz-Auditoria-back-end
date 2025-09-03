# Google Sheets Access Troubleshooting Guide

## Problem: Some Users Can Access Inventory, Others Cannot

This guide helps you diagnose and fix Google Sheets API access issues where some users can see the inventory while others get "failed" errors.

## Common Causes and Solutions

### 1. **Service Account Permissions** (Most Common Issue)

**Problem**: The Google Service Account doesn't have proper permissions to access the spreadsheet.

**Solution**:
1. Go to your Google Spreadsheet
2. Click "Share" button (top right)
3. Add your service account email (found in your credentials JSON file)
4. Give it "Editor" permissions
5. Make sure "Notify people" is unchecked (since it's a service account)

**How to find your service account email**:
- Look in your `google-credentials.json` file
- Find the `client_email` field
- It looks like: `your-service-account@your-project.iam.gserviceaccount.com`

### 2. **Spreadsheet Sharing Settings**

**Problem**: The spreadsheet is not shared with the service account.

**Check**:
- Is the spreadsheet shared with the service account email?
- Is the sharing permission set to "Editor" or "Viewer"?
- Is the spreadsheet set to "Anyone with the link can view" (this might not work with service accounts)?

### 3. **Credentials Configuration Issues**

**Problem**: The credentials are not properly configured in your deployment.

**Check**:
- Is `GOOGLE_CREDENTIALS_BASE64` environment variable set correctly?
- Is the base64 string complete and valid?
- Are you using the correct credentials file?

**Test**: Use the new diagnostic endpoint: `GET /api/inventory/diagnose-google-sheets`

### 4. **Google Sheets API Quotas**

**Problem**: You've exceeded Google Sheets API quotas.

**Signs**:
- Error messages about "quota exceeded"
- Some requests work, others fail randomly
- Errors increase during peak usage

**Solution**:
- Wait for quota to reset (usually 1 minute for read requests)
- Implement better caching (already done in the code)
- Consider upgrading your Google Cloud project

### 5. **Network/Firewall Issues**

**Problem**: Some users' networks block Google APIs.

**Signs**:
- Works for some users, not others
- Works on some networks, not others
- Timeout errors

**Solution**:
- Check if your hosting provider blocks Google APIs
- Ensure proper firewall rules
- Test from different networks

## Diagnostic Steps

### Step 1: Use the Diagnostic Endpoint

Call this endpoint to test your Google Sheets setup:
```
GET /api/inventory/diagnose-google-sheets
```

This will tell you:
- If the service is initialized
- If credentials are configured
- If the spreadsheet is accessible
- If sheets can be created/read

### Step 2: Check Server Logs

Look for these error patterns in your server logs:

```
❌ Failed to initialize Google Sheets service
❌ Access denied to Google Sheets
❌ Google Sheets document not found
❌ Permission denied
```

### Step 3: Test Credentials

1. **Local Testing**: Make sure it works locally first
2. **Production Testing**: Test the diagnostic endpoint in production
3. **Compare Results**: See what's different between working and non-working environments

## Environment-Specific Issues

### Render.com Deployment

**Common Issues**:
- Base64 credentials truncated
- Environment variables not set
- Service account not shared with spreadsheet

**Solution**:
1. Check if `GOOGLE_CREDENTIALS_BASE64` is complete (should be ~2000+ characters)
2. Verify `GOOGLE_SHEETS_SPREADSHEET_ID` is set
3. Ensure service account has spreadsheet access

### Local Development

**Common Issues**:
- Credentials file path incorrect
- Service account not shared
- Different spreadsheet ID

**Solution**:
1. Check `GOOGLE_SHEETS_CREDENTIALS_PATH` points to correct file
2. Verify the credentials file is valid JSON
3. Test with the diagnostic endpoint

## Quick Fix Checklist

- [ ] Service account email is shared with the Google Spreadsheet
- [ ] Service account has "Editor" permissions on the spreadsheet
- [ ] `GOOGLE_SHEETS_SPREADSHEET_ID` environment variable is set correctly
- [ ] `GOOGLE_CREDENTIALS_BASE64` is complete and valid (2000+ characters)
- [ ] Google Sheets API is enabled in your Google Cloud project
- [ ] No firewall blocking Google APIs
- [ ] Diagnostic endpoint returns success

## Error Messages and Solutions

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Access denied to Google Sheets" | Service account not shared | Share spreadsheet with service account email |
| "Google Sheets document not found" | Wrong spreadsheet ID | Check `GOOGLE_SHEETS_SPREADSHEET_ID` |
| "Permission denied" | Insufficient permissions | Give service account "Editor" access |
| "Quota exceeded" | API limits reached | Wait or upgrade Google Cloud project |
| "Failed to initialize" | Invalid credentials | Check credentials configuration |

## Testing Your Fix

1. **Run Diagnostic**: `GET /api/inventory/diagnose-google-sheets`
2. **Test Inventory Access**: Try accessing inventory from different browsers/users
3. **Check Logs**: Monitor server logs for any remaining errors
4. **Verify Permissions**: Confirm service account has proper access

## Still Having Issues?

If the problem persists:

1. **Check Google Cloud Console**: Ensure the service account exists and has proper roles
2. **Verify API Enablement**: Make sure Google Sheets API is enabled
3. **Test with Different Users**: See if it's user-specific or system-wide
4. **Contact Support**: Provide diagnostic endpoint results and error logs

## Prevention

To prevent future issues:

1. **Document Your Setup**: Keep track of service account emails and spreadsheet IDs
2. **Regular Testing**: Use the diagnostic endpoint regularly
3. **Monitor Quotas**: Keep an eye on Google API usage
4. **Backup Credentials**: Keep credentials in a secure location
5. **Test After Changes**: Always test after making configuration changes
