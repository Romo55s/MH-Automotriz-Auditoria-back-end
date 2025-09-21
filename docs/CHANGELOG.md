# 📋 Car Inventory Backend - Changelog

## 🚀 Version 2.0.0 - QR Code Revolution (September 2025)

### 🎉 **Major New Features**

#### **🔲 QR Code System**
- **CSV Upload & QR Generation**: Upload CSV files with car data and generate enhanced QR codes
- **Enhanced QR Codes**: 5×5cm (590×590px) QR codes with embedded car information text
- **Batch Processing**: Generate hundreds of QR codes in seconds
- **ZIP Download**: Download all QR codes as organized ZIP file

#### **🏢 Multi-Location Support**
- **New Bodegas**: Added "Bodega Coyote" and "Bodega Goyo"
- **Location Types**: Support for both Agencies and Bodegas
- **Terminology Update**: Changed "Agency" to "Location" in Monthly Summary

#### **📊 Enhanced Data Structure**
- **Car Data Fields**: serie, marca, color, ubicaciones
- **17-Character Serie**: Alphanumeric vehicle identification numbers
- **Enhanced Storage**: Location sheets now store 7 fields instead of 3
- **Backward Compatibility**: Legacy barcode scanning still works

### 🔧 **Technical Improvements**

#### **New Services**
- **QR Service** (`src/services/qrService.js`): Complete QR code lifecycle management
- **Enhanced Download Service**: CSV/Excel exports include all car data
- **Enhanced Validation**: Support for both barcodes and series

#### **New API Endpoints**
- `POST /api/qr/upload-csv` - Upload CSV and generate QR codes
- `GET /api/qr/download/:sessionId` - Download QR codes ZIP
- `POST /api/qr/scan` - Process scanned QR codes
- `GET /api/qr/locations` - Get available locations

#### **Enhanced Existing Endpoints**
- Enhanced `GET /api/inventory/monthly-inventory/:agency/:month/:year` responses
- Enhanced CSV/Excel downloads with car data
- Updated validation for new data types

### 📊 **Data Structure Changes**

#### **Google Sheets Updates**
```
Monthly Summary Sheet:
OLD: | Month | Year | Agency | Status | ... |
NEW: | Month | Year | Location | Status | ... |

Location Sheets:
OLD: | Date | Barcode | Scanned By |
NEW: | Date | Identifier | Scanned By | Serie | Marca | Color | Ubicaciones |
```

#### **API Response Updates**
```json
// Enhanced scan data
{
  "date": "Sep 18, 2025",
  "identifier": "1HGCM82633A001234",
  "scannedBy": "user@example.com",
  "serie": "1HGCM82633A001234",      // NEW
  "marca": "Honda",                   // NEW
  "color": "Blanco",                  // NEW
  "ubicaciones": "Lote A-1",          // NEW
  "barcode": "1HGCM82633A001234"      // Legacy compatibility
}
```

### 🔍 **Validation Enhancements**

#### **New Validation Functions**
- `validateSerie()`: 17-character alphanumeric validation
- `validateQRData()`: Comprehensive QR code data validation
- `validateCSVRowData()`: CSV row validation
- Enhanced `validateScanData()`: Supports both barcodes and QR data

#### **Serie Format Requirements**
- **Length**: Exactly 17 characters
- **Characters**: A-Z and 0-9 only (case-insensitive)
- **Examples**: `1HGCM82633A001234`, `JH4NA1157MT016789`

### 🏢 **Available Locations**

#### **Agencies (10)**
- Suzuki, Nissan, Honda, Toyota, Mazda
- Hyundai, Kia, Volkswagen, Chevrolet, Ford

#### **Bodegas (2)**
- Bodega Coyote
- Bodega Goyo

### 📦 **New Dependencies**

#### **Production Dependencies Added**
- `qrcode`: QR code generation
- `csv-parse`: CSV file parsing
- `multer`: File upload handling
- `archiver`: ZIP file creation
- `canvas`: Image manipulation for enhanced QR codes

### 🔄 **Migration Guide**

#### **For Existing Users**
1. **No Action Required**: Legacy barcode scanning continues to work
2. **Enhanced Downloads**: CSV/Excel exports now include more data
3. **New Locations**: Bodega Coyote and Bodega Goyo are available

#### **For New QR Code Users**
1. **Prepare CSV**: Create CSV with serie, marca, color, ubicaciones columns
2. **Upload & Generate**: Use `/api/qr/upload-csv` endpoint
3. **Download & Print**: Get ZIP file with enhanced QR codes
4. **Scan & Inventory**: Use QR scanner to update inventory

### 🎯 **Breaking Changes**

#### **Google Sheets Structure**
- **Monthly Summary**: "Agency" column renamed to "Location"
- **Location Sheets**: Expanded from 3 to 7 columns
- **New Headers**: Added Serie, Marca, Color, Ubicaciones columns

#### **API Response Changes**
- Enhanced scan data includes new car data fields
- Download files (CSV/Excel) include additional columns
- Backward compatibility maintained with legacy field names

### 🔒 **Security & Performance**

#### **File Upload Security**
- 10MB file size limit
- CSV/Excel file type validation
- Temporary file cleanup after processing
- Automatic old file cleanup (1 hour)

#### **QR Code Security**
- JSON format validation
- Car data field validation
- Serie format validation
- Location validation

### 📚 **Documentation Updates**

#### **New Documentation**
- `QR_IMPLEMENTATION_GUIDE.md`: Complete frontend implementation guide
- `CHANGELOG.md`: This comprehensive changelog
- Enhanced `README.md`: Updated with all new features

#### **Updated Examples**
- `test_inventory.csv`: 20-vehicle test dataset
- `example_inventory.csv`: Simple 10-vehicle example
- Enhanced API documentation with car data examples

### 🎉 **What's Next**

#### **Frontend Integration**
1. Implement CSV upload UI
2. Add QR code generation workflow
3. Update scanner to handle QR codes
4. Enhance inventory display with car data
5. Add location selection (agencies + bodegas)

#### **Future Enhancements**
- QR code customization options
- Bulk QR code regeneration
- Advanced car data analytics
- Multi-language support for QR text
- Custom QR code templates

---

**🚀 This major update transforms the car inventory system from simple barcode scanning to a comprehensive QR code-based solution with enhanced car data tracking!**

