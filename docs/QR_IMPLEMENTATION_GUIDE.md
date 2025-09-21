# 🚗 QR Code Implementation Guide

This guide explains the new QR code-based inventory process and how to integrate it with the frontend.

## 📋 Process Overview

The new process replaces REPUVE barcode scanning with enhanced QR code generation and scanning:

1. **Upload CSV**: User uploads a CSV file with car data (serie, marca, color, ubicaciones)
2. **Generate Enhanced QR Codes**: System generates 5×5cm QR codes with embedded car information text
3. **Download QR Codes ZIP**: User downloads a ZIP file containing all QR code images + info file
4. **Print/Distribute**: Enhanced QR codes are printed and attached to cars
5. **Scan QR Codes**: During inventory, users scan QR codes to automatically update records with full car data
6. **Complete Inventory**: Session is completed with comprehensive car data stored

## 🔄 New vs Old Process

| Old Process | New Process |
|-------------|-------------|
| Scan REPUVE barcode (8 digits) | Scan enhanced QR code (JSON + visual text) |
| Manual entry of car details | Car details embedded in QR code + visible on image |
| Agency-based locations only | Support for Agencies + Bodegas |
| Single inventory per month | Multiple inventories per month |
| "Agency" terminology | "Location" terminology |
| Basic CSV exports (3 columns) | Enhanced exports (7 columns with car data) |
| Small QR codes (if any) | Large 5×5cm print-ready QR codes |

## 🏗️ Frontend Implementation

### 1. CSV Upload Page

Create a page for uploading CSV files and generating QR codes:

```javascript
// Example implementation
const uploadCSV = async (file, location, user, userName) => {
  const formData = new FormData();
  formData.append('csvFile', file);
  formData.append('location', location);
  formData.append('user', user);
  formData.append('userName', userName);

  const response = await fetch('/api/qr/upload-csv', {
    method: 'POST',
    body: formData
  });

  return await response.json();
};
```

### 2. Location Selection

Get available locations (agencies + bodegas):

```javascript
const getLocations = async () => {
  const response = await fetch('/api/qr/locations');
  const data = await response.json();
  
  return data.locations; // Array of {id, name, type}
};
```

### 3. QR Code Generation UI

```jsx
function QRGenerationPage() {
  const [csvFile, setCsvFile] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await uploadCSV(
        csvFile, 
        selectedLocation, 
        user.email, 
        user.name
      );
      setResult(result);
    } catch (error) {
      console.error('QR generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    window.open(result.result.downloadInfo.downloadUrl, '_blank');
  };

  return (
    <div>
      <h2>Generate QR Codes</h2>
      
      {/* CSV File Upload */}
      <input 
        type="file" 
        accept=".csv,.xlsx" 
        onChange={(e) => setCsvFile(e.target.files[0])} 
      />
      
      {/* Location Selection */}
      <select 
        value={selectedLocation} 
        onChange={(e) => setSelectedLocation(e.target.value)}
      >
        <option value="">Select Location</option>
        {locations.map(loc => (
          <option key={loc.id} value={loc.id}>
            {loc.name} ({loc.type})
          </option>
        ))}
      </select>
      
      {/* Generate Button */}
      <button 
        onClick={handleGenerate} 
        disabled={!csvFile || !selectedLocation || isGenerating}
      >
        {isGenerating ? 'Generating...' : 'Generate QR Codes'}
      </button>
      
      {/* Results */}
      {result && (
        <div>
          <p>✅ Generated {result.result.totalGenerated} QR codes</p>
          <button onClick={handleDownload}>Download ZIP</button>
        </div>
      )}
    </div>
  );
}
```

### 4. QR Code Scanning

Update your existing barcode scanner to handle QR codes:

```javascript
const scanQRCode = async (qrData, user, userName) => {
  const response = await fetch('/api/qr/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      qrData,
      user,
      userName
    })
  });

  return await response.json();
};

// In your scanner component
const handleScan = async (scanResult) => {
  try {
    // Try to parse as QR code first
    const qrData = JSON.parse(scanResult);
    if (qrData.type === 'car_inventory') {
      // Handle QR code scan
      const result = await scanQRCode(
        scanResult, 
        user.email, 
        user.name
      );
      
      // Show success with car details
      showSuccess(`Scanned: ${qrData.serie} - ${qrData.marca} (${qrData.color})`);
      
      return result;
    }
  } catch (e) {
    // Not a QR code, try legacy barcode scanning
    if (/^\d{8}$/.test(scanResult)) {
      return await legacyScanBarcode(scanResult);
    } else {
      throw new Error('Invalid scan format');
    }
  }
};
```

### 5. Enhanced Inventory Display

Update inventory display to show additional car data:

```jsx
function InventoryItem({ scan }) {
  const isQRScan = scan.serie && scan.serie.length === 17;
  const isLegacyScan = scan.barcode && scan.barcode.length === 8;

  return (
    <div className="inventory-item">
      <div className="scan-header">
        <div className="scan-date">{scan.date}</div>
        <div className="scan-type">
          {isQRScan ? '🔲 QR Scan' : '📱 Barcode Scan'}
        </div>
      </div>
      
      <div className="identifier">{scan.identifier}</div>
      
      {/* Enhanced car data for QR scans */}
      {isQRScan && (
        <div className="car-details">
          <div className="car-info-grid">
            <span className="label">Serie:</span>
            <span className="value">{scan.serie}</span>
            <span className="label">Marca:</span>
            <span className="value">{scan.marca}</span>
            <span className="label">Color:</span>
            <span className="value">{scan.color}</span>
            <span className="label">Ubicación:</span>
            <span className="value">{scan.ubicaciones}</span>
          </div>
        </div>
      )}
      
      {/* Legacy barcode display */}
      {isLegacyScan && (
        <div className="legacy-scan">
          <span className="barcode-label">Barcode: {scan.barcode}</span>
        </div>
      )}
      
      <div className="scanned-by">Scanned by: {scan.scannedBy}</div>
    </div>
  );
}
```

### 6. Enhanced Download Files

Downloaded CSV/Excel files now include comprehensive car data:

```
Date,Identifier,Scanned By,Serie,Marca,Color,Ubicaciones
Sep 18 2025,1HGCM82633A001234,user@example.com,1HGCM82633A001234,Honda,Blanco,Lote A-1
Sep 18 2025,2T1BURHE0JC002345,user@example.com,2T1BURHE0JC002345,Toyota,Negro,Lote A-2
```

## 📊 CSV File Format

The CSV file must have these exact columns (case-insensitive):

```csv
serie,marca,color,ubicaciones
1HGCM82633A123456,Toyota,Red,Lot A
2HGCM82633A789012,Honda,Blue,Lot B
3HGCM82633A345678,Nissan,White,Lot C
```

**Required Columns:**
- `serie`: Car serial number (unique identifier) - **Must be exactly 17 alphanumeric characters**
- `marca`: Car brand/make
- `color`: Car color
- `ubicaciones`: Car location/position

**⚠️ Serie Validation:**
- Must be exactly 17 characters long
- Can contain letters (A-Z) and numbers (0-9) only
- Case-insensitive (ABC123 = abc123)
- Examples: `1HGCM82633A123456`, `JH4NA1157MT123456`, `WVWZZZ3BZWE123456`

## 🔄 Migration Strategy

### Phase 1: Parallel Support
- Keep existing barcode scanning functional
- Add QR code functionality alongside
- Allow users to choose between methods

### Phase 2: QR Code Primary
- Make QR codes the primary method
- Keep barcode as fallback
- Update UI to emphasize QR codes

### Phase 3: QR Code Only (Optional)
- Remove barcode scanning if desired
- Fully QR code-based workflow

## 🏢 Location Management

### Available Locations

**Agencies:**
- Suzuki, Nissan, Honda, Toyota, Mazda
- Hyundai, Kia, Volkswagen, Chevrolet, Ford

**Bodegas (New):**
- Bodega Coyote
- Bodega Goyo

### Location Selection UI

```jsx
function LocationSelector({ value, onChange, locations }) {
  const agencies = locations.filter(loc => loc.type === 'agency');
  const bodegas = locations.filter(loc => loc.type === 'bodega');

  return (
    <select value={value} onChange={onChange}>
      <option value="">Select Location</option>
      
      <optgroup label="Agencies">
        {agencies.map(loc => (
          <option key={loc.id} value={loc.id}>{loc.name}</option>
        ))}
      </optgroup>
      
      <optgroup label="Bodegas">
        {bodegas.map(loc => (
          <option key={loc.id} value={loc.id}>{loc.name}</option>
        ))}
      </optgroup>
    </select>
  );
}
```

## 🔍 QR Code Data Structure

Each QR code contains JSON data:

```json
{
  "serie": "1HGCM82633A123456",
  "marca": "Toyota", 
  "color": "Red",
  "ubicaciones": "Lot A",
  "location": "Bodega Coyote",
  "timestamp": "2024-01-15T10:30:00Z",
  "type": "car_inventory"
}
```

**⚠️ Serie Field:**
- Always 17 alphanumeric characters
- Used as the unique identifier for the car
- Validated on both CSV upload and QR scanning

## ⚡ API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/qr/upload-csv` | POST | Upload CSV and generate QR codes |
| `/api/qr/download/:sessionId` | GET | Download QR codes ZIP |
| `/api/qr/scan` | POST | Process scanned QR code |
| `/api/qr/locations` | GET | Get available locations |
| `/api/qr/cleanup-temp-files` | POST | Clean temporary files |

## 🚨 Error Handling

```javascript
const handleQRError = (error) => {
  if (error.message.includes('Missing required columns')) {
    showError('CSV file is missing required columns: serie, marca, color, ubicaciones');
  } else if (error.message.includes('Serie must be exactly 17 alphanumeric characters')) {
    showError('Invalid serie format. Serie must be exactly 17 alphanumeric characters (A-Z, 0-9).');
  } else if (error.message.includes('validation failed')) {
    showError(`Data validation failed: ${error.message}`);
  } else if (error.message.includes('Invalid QR code')) {
    showError('Invalid QR code format. Please scan a valid inventory QR code.');
  } else if (error.message.includes('already been scanned')) {
    showWarning('This item has already been scanned in this inventory session.');
  } else {
    showError('An error occurred. Please try again.');
  }
};
```

## 🔧 Testing

Use the provided `example_inventory.csv` file for testing:

1. Upload the CSV file
2. Select a location (e.g., "Bodega Coyote")
3. Generate QR codes
4. Download and extract ZIP file
5. Use a QR scanner app to test scanning
6. Copy QR data and test with `/api/qr/scan` endpoint

## 📱 Mobile Considerations

For mobile scanning apps:
- Ensure QR scanner can read JSON format
- Handle large QR codes (may need higher resolution)
- Test with various lighting conditions
- Consider offline scanning capability

## 🔒 Security Notes

- QR codes contain readable car data (not encrypted)
- Validate all uploaded CSV files
- Limit file upload sizes (current: 10MB)
- Clean up temporary files regularly
- Rate limit QR generation requests

## 🎯 Next Steps

1. **Implement CSV upload UI** - File selection and validation
2. **Add QR generation workflow** - Progress indicators and download
3. **Update scanner component** - Support both QR and barcode
4. **Enhance inventory display** - Show additional car data
5. **Add location management** - Handle agencies and bodegas
6. **Test thoroughly** - Both QR and legacy workflows
7. **Deploy and monitor** - Watch for any issues

## 📞 Backend Support

The backend is fully implemented and ready. Contact the backend team if you need:
- Additional API endpoints
- Changes to QR data structure
- New location types
- Custom validation rules
- Performance optimizations

---

**Happy coding! 🚀**
