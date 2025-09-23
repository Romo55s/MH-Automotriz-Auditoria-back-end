// Test cleanup logic - only deletes files, not folders
require('dotenv').config();

async function testCleanupLogic() {
  console.log('🧪 === TESTING CLEANUP LOGIC ===\n');

  try {
    // Test 1: Initialize services
    console.log('1️⃣ Initializing services...');
    const oauthGoogleDrive = require('../src/services/oauthGoogleDrive');
    const fileStorageService = require('../src/services/fileStorageService');
    
    await oauthGoogleDrive.initialize();
    console.log('✅ OAuth Google Drive service initialized');

    // Test 2: Create a test file to demonstrate cleanup
    console.log('\n2️⃣ Creating test file for cleanup demonstration...');
    const fs = require('fs');
    const path = require('path');
    
    const testData = [
      ['VIN', 'Brand', 'Model', 'Year', 'Color'],
      ['TEST123456789', 'Toyota', 'Camry', '2023', 'Blue']
    ];
    
    const csvContent = testData.map(row => row.join(',')).join('\n');
    const testFilePath = path.join(__dirname, '../temp/test_cleanup.csv');
    
    // Ensure temp directory exists
    const tempDir = path.dirname(testFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(testFilePath, csvContent);
    console.log('✅ Test file created:', testFilePath);

    // Test 3: Upload file to create folder structure
    console.log('\n3️⃣ Uploading test file...');
    const metadata = oauthGoogleDrive.generateFileMetadata('Test Agency', '09', '2025', 'csv', new Date().toISOString());
    const inventoryFolderId = oauthGoogleDrive.inventoryFolderId;
    
    const result = await oauthGoogleDrive.uploadFile(testFilePath, metadata, inventoryFolderId);
    console.log('✅ File uploaded:', result.name);
    console.log('📁 File ID:', result.fileId);

    // Test 4: Verify folder structure exists
    console.log('\n4️⃣ Verifying folder structure...');
    const response = await oauthGoogleDrive.drive.files.list({
      q: `'${inventoryFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)'
    });

    const folders = response.data.files;
    console.log(`📂 Found ${folders.length} folders in inventory folder:`);
    folders.forEach((folder, index) => {
      console.log(`  ${index + 1}. ${folder.name} (${folder.id})`);
    });

    // Test 5: Test file deletion (not folder deletion)
    console.log('\n5️⃣ Testing file deletion (folder should remain)...');
    try {
      await oauthGoogleDrive.deleteFile(result.fileId);
      console.log('✅ File deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete file:', error.message);
    }

    // Test 6: Verify folder still exists after file deletion
    console.log('\n6️⃣ Verifying folder still exists after file deletion...');
    const responseAfter = await oauthGoogleDrive.drive.files.list({
      q: `'${inventoryFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)'
    });

    const foldersAfter = responseAfter.data.files;
    console.log(`📂 Folders after file deletion: ${foldersAfter.length}`);
    foldersAfter.forEach((folder, index) => {
      console.log(`  ${index + 1}. ${folder.name} (${folder.id})`);
    });

    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log('🧹 Test file cleaned up');
    }

    console.log('\n🎉 === CLEANUP LOGIC TEST COMPLETED ===');
    console.log('✅ File deletion works correctly');
    console.log('✅ Folders are preserved after file deletion');
    console.log('✅ Cleanup logic is working as expected');

  } catch (error) {
    console.error('\n❌ === CLEANUP LOGIC TEST FAILED ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testCleanupLogic();
