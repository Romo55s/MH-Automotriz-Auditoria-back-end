# 🚗 Car Inventory Backend

A robust Node.js backend API for managing monthly car inventory with QR code generation, Google Sheets integration, and comprehensive security features.

## ✨ Features

- **Monthly Inventory Management**: Each location can have multiple inventories per month
- **QR Code Generation**: Generate QR codes from CSV files with car data (serie, marca, color, ubicaciones)
- **QR Code Scanning**: Scan generated QR codes to update inventory
- **Google Sheets Integration**: Automatic data storage and retrieval
- **Multi-Location Support**: Support for both Agencies and Bodegas
- **Session Management**: Complete inventory session lifecycle
- **CSV Processing**: Upload and process CSV files with car inventory data
- **Input Validation**: Comprehensive data validation and sanitization
- **Security Features**: Rate limiting, CORS, Helmet security headers
- **Logging & Monitoring**: Request logging and error tracking
- **Error Handling**: Graceful error handling with meaningful messages

## 🏗️ Project Structure

```
backend/
├── package.json
├── .env
├── src/
│   ├── index.js              # Main server file
│   ├── routes/
│   │   ├── api.js            # Main API routes
│   │   ├── inventoryRoutes.js # Inventory management routes
│   │   ├── qrRoutes.js       # QR code generation & scanning routes
│   │   ├── downloadRoutes.js # File download routes
│   │   └── validationRoutes.js # Data validation routes
│   ├── services/
│   │   ├── googleSheets.js   # Google Sheets service
│   │   ├── inventoryService.js # Inventory business logic
│   │   ├── qrService.js      # QR code generation & processing
│   │   └── downloadService.js # File generation service
│   ├── middleware/
│   │   ├── auth.js           # Authentication middleware (optional)
│   │   └── errorHandler.js   # Comprehensive error handling
│   └── utils/
│       └── validation.js     # Enhanced validation utilities
├── credentials/
│   └── google-credentials.json # Google service account credentials
├── docs/                     # 📚 Complete documentation library
│   ├── README.md            # Documentation index and navigation
│   ├── QR_IMPLEMENTATION_GUIDE.md # Frontend integration guide
│   ├── CHANGELOG.md         # Version history and features
│   ├── IMPLEMENTATION_SUMMARY.md # Executive summary
│   ├── env.template         # Environment configuration template
│   └── [deployment guides] # Production deployment documentation
├── temp/                     # Temporary files for QR codes and downloads
├── test_inventory.csv        # Sample CSV file for testing
└── README.md                 # Main project documentation
```

## 🚀 Quick Start

### 1. **Install Dependencies**
```bash
npm install
```

### 2. **Environment Setup**
```bash
cp env.example .env
```

Edit `.env` with your configuration:
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Google Sheets Configuration
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/google-credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000
```

### 3. **Google Sheets Setup**
1. **Enable Google Sheets API**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Sheets API
   - Create a Service Account
   - Download the JSON credentials file

2. **Share Google Sheets**:
   - Share your Google Sheets with the service account email
   - Give "Editor" permissions

3. **Setup Credentials**:
   ```bash
   # Your credentials are already configured in credentials/google-credentials.json
   # Just make sure to set your Google Sheets ID in .env
   ```

### 4. **Start the Server**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:5000`

## 📖 Quick Documentation Links

- **🔲 [QR Implementation Guide](docs/QR_IMPLEMENTATION_GUIDE.md)** - Frontend team start here!
- **🚀 [Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md)** - Executive overview
- **📋 [Complete Documentation](docs/README.md)** - All guides organized
- **🔧 [Troubleshooting](docs/GOOGLE_SHEETS_TROUBLESHOOTING.md)** - Common issues

## 🔄 Inventory Workflow

### **New QR Code Process (Recommended)**

1. **📊 Upload CSV**: Upload CSV file with car data (serie, marca, color, ubicaciones)
2. **🔲 Generate QR Codes**: System creates enhanced 5×5cm QR codes with car info
3. **📦 Download ZIP**: Get ZIP file containing all QR code images
4. **🖨️ Print & Distribute**: Print QR codes and attach to vehicles
5. **📱 Scan QR Codes**: During inventory, scan QR codes to update records
6. **✅ Complete Session**: Finish inventory session as usual

### **Legacy Barcode Process (Still Supported)**

1. **📱 Scan Barcodes**: Scan 8-digit REPUVE barcodes
2. **💾 Manual Entry**: Enter car details manually if needed
3. **✅ Complete Session**: Finish inventory session

### **Enhanced Data Storage**

All scans now store comprehensive car information:
- **Date**: When the item was scanned
- **Identifier**: Serie (17 chars) or Barcode (8 digits)
- **Scanned By**: User who performed the scan
- **Serie**: 17-character alphanumeric vehicle identifier
- **Marca**: Car brand/make
- **Color**: Vehicle color
- **Ubicaciones**: Vehicle location/position

## 📊 Google Sheets Structure

### 1. **Main Inventory Sheet**
Create a sheet named "Inventory" with these columns:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Timestamp | Agency | Month | Year | Barcode | User Email | User Name | Session ID |

### 2. **Monthly Summary Sheet**
Create a sheet named "MonthlySummary" with these columns:

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| Month | Year | Location | Status | Created At | Created By | User Name | Total Scans | Session ID | Completed At | Finished By |

### 3. **Location Sheets (Enhanced)**
Each location sheet now includes additional car data:

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Date | Identifier | Scanned By | Serie | Marca | Color | Ubicaciones |

## 🔌 API Endpoints

### **1. Save Scan**
**POST** `/api/inventory/save-scan`

Saves a scanned barcode or QR code to Google Sheets.

**Request Body:**
```json
{
  "agency": "string",        // Location name (e.g., "Suzuki", "Bodega Coyote")
  "code": "string",          // 8-digit barcode OR 17-character serie
  "timestamp": "string",     // ISO timestamp
  "user": "string",          // User email
  "userName": "string",      // User's display name
  "month": "string",         // Month in "MM" format (e.g., "01")
  "year": "number",          // Year (e.g., 2024)
  "carData": {               // Optional: Enhanced car data for QR scans
    "serie": "string",       // 17-character serie
    "marca": "string",       // Car brand
    "color": "string",       // Car color
    "ubicaciones": "string"  // Car location
  }
}
```

### **2. Finish Session**
**POST** `/api/finish-session`

Marks a monthly inventory session as completed.

**Request Body:**
```json
{
  "agency": "string",        // Agency name
  "user": "string",          // User email
  "userName": "string",      // User's display name
  "month": "string",         // Month in "MM" format
  "year": "number",          // Year
  "totalScans": "number"     // Total number of scans
}
```

### **3. Get Monthly Inventory**
**GET** `/api/inventory/monthly-inventory/:agency/:month/:year`

Retrieves data for a specific monthly inventory with enhanced car data.

**Response:**
```json
{
  "agency": "Bodega Coyote",
  "month": "September",
  "year": "2025",
  "totalScans": 5,
  "scans": [
    {
      "date": "Sep 18, 2025",
      "identifier": "1HGCM82633A001234",
      "scannedBy": "user@example.com",
      "serie": "1HGCM82633A001234",
      "marca": "Honda",
      "color": "Blanco",
      "ubicaciones": "Lote A-1",
      "barcode": "1HGCM82633A001234"
    }
  ]
}
```

### **4. Get Agency Inventories**
**GET** `/api/agency-inventories/:agency`

Retrieves all monthly inventories for a specific agency.

### **5. Check Monthly Inventory**
**GET** `/api/inventory/check-monthly-inventory/:agency/:month/:year`

Checks if a monthly inventory already exists.

### **6. Upload CSV and Generate QR Codes**
**POST** `/api/qr/upload-csv`

Upload a CSV file with car data and generate QR codes.

**Request:** Multipart form data
- `csvFile`: CSV file with columns: serie (17 alphanumeric chars), marca, color, ubicaciones
- `location`: Location name (agency or bodega)
- `user`: User email
- `userName`: User display name (optional)

**Response:**
```json
{
  "success": true,
  "message": "Successfully generated 150 QR codes",
  "result": {
    "sessionId": "qr_1234567890",
    "totalGenerated": 150,
    "location": "Bodega Coyote",
    "generatedBy": "John Doe",
    "generatedAt": "2024-01-15T10:30:00Z",
    "downloadInfo": {
      "filename": "QR_Codes_Bodega_Coyote_2024-01-15.zip",
      "size": 2048576,
      "downloadUrl": "/api/qr/download/qr_1234567890"
    }
  }
}
```

### **7. Download QR Codes**
**GET** `/api/qr/download/:sessionId`

Download generated QR codes as ZIP file.

### **8. Scan QR Code**
**POST** `/api/qr/scan`

Process a scanned QR code and update inventory.

**Request Body:**
```json
{
  "qrData": "{\"serie\":\"1HGCM82633A123456\",\"marca\":\"Toyota\",\"color\":\"Red\",\"ubicaciones\":\"Lot A\",\"location\":\"Bodega Coyote\",\"timestamp\":\"2024-01-15T10:30:00Z\",\"type\":\"car_inventory\"}",
  "user": "user@example.com",
  "userName": "John Doe"
}
```

### **9. Get Available Locations**
**GET** `/api/qr/locations`

Get list of available locations (agencies and bodegas).

**Response:**
```json
{
  "success": true,
  "locations": [
    {"id": "suzuki", "name": "Suzuki", "type": "agency"},
    {"id": "bodega_coyote", "name": "Bodega Coyote", "type": "bodega"}
  ],
  "totalLocations": 12,
  "agencies": 10,
  "bodegas": 2
}
```

## 🧪 Testing

### **Test Health Check**
```bash
curl http://localhost:5000/health
```

### **Test QR Code Generation (Upload CSV)**
```bash
# Upload test CSV file to generate QR codes
curl -X POST http://localhost:5000/api/qr/upload-csv \
  -F "csvFile=@test_inventory.csv" \
  -F "location=Bodega Coyote" \
  -F "user=test@example.com" \
  -F "userName=Test User"
```

### **Test QR Code Scan**
```bash
curl -X POST http://localhost:5000/api/qr/scan \
  -H "Content-Type: application/json" \
  -d '{
    "qrData": "{\"serie\":\"1HGCM82633A001234\",\"marca\":\"Honda\",\"color\":\"Blanco\",\"ubicaciones\":\"Lote A-1\",\"location\":\"Bodega Coyote\",\"timestamp\":\"2024-01-15T10:30:00Z\",\"type\":\"car_inventory\"}",
    "user": "user@example.com",
    "userName": "John Doe"
  }'
```

### **Test Get Available Locations**
```bash
curl http://localhost:5000/api/qr/locations
```

### **Test Enhanced Save Scan (With Car Data)**
```bash
curl -X POST http://localhost:5000/api/inventory/save-scan \
  -H "Content-Type: application/json" \
  -d '{
    "agency": "Bodega Coyote",
    "code": "1HGCM82633A001234",
    "user": "user@example.com",
    "userName": "John Doe",
    "month": "09",
    "year": 2025,
    "carData": {
      "serie": "1HGCM82633A001234",
      "marca": "Honda",
      "color": "Blanco",
      "ubicaciones": "Lote A-1"
    }
  }'
```

### **Test Legacy Save Scan (Backward Compatibility)**
```bash
curl -X POST http://localhost:5000/api/inventory/save-scan \
  -H "Content-Type: application/json" \
  -d '{
    "agency": "Suzuki",
    "code": "12345678",
    "user": "user@example.com",
    "userName": "John Doe",
    "month": "09",
    "year": 2025
  }'
```

### **Test Enhanced Monthly Inventory**
```bash
curl http://localhost:5000/api/inventory/monthly-inventory/Bodega%20Coyote/09/2025
```

## 🔒 Security Features

- **Rate Limiting**: Prevents API abuse (100 requests per 15 minutes)
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet Security**: Security headers for protection
- **Input Validation**: Comprehensive data validation
- **Error Handling**: Secure error messages without information leakage

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `GOOGLE_SHEETS_CREDENTIALS_PATH` | Path to service account JSON | `./credentials/google-credentials.json` |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Google Sheets spreadsheet ID | Required |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |

## 🚀 Deployment

### **Production Environment**
```bash
# Set production environment
NODE_ENV=production
PORT=5000

# Use production Google Sheets credentials
GOOGLE_SHEETS_CREDENTIALS_PATH=/path/to/production/credentials.json
```

### **Docker (Optional)**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### **Common Issues**

1. **Google Sheets API errors**: Check credentials and permissions
2. **Rate limiting**: Adjust rate limit settings in .env
3. **CORS errors**: Check FRONTEND_URL configuration

### **Monitoring**
- Add logging for all API calls
- Monitor Google Sheets API quotas
- Track response times and errors
- Set up health checks and alerts

## 📚 Dependencies

### **Production Dependencies**
- `express`: Web framework
- `cors`: Cross-origin resource sharing
- `dotenv`: Environment variable management
- `googleapis`: Google Sheets API client
- `express-rate-limit`: Rate limiting
- `helmet`: Security headers
- `morgan`: HTTP request logging
- `qrcode`: QR code generation
- `csv-parse`: CSV file parsing
- `multer`: File upload handling
- `archiver`: ZIP file creation
- `csv-writer`: CSV file generation
- `xlsx`: Excel file handling

### **Development Dependencies**
- `nodemon`: Auto-restart on file changes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📚 Documentation

### **📖 Complete Documentation Library**
All comprehensive documentation is organized in the [`docs/`](docs/) folder:

#### **🚀 Getting Started**
- **[Project Structure](docs/PROJECT_STRUCTURE.md)** - Detailed project organization
- **[Environment Configuration](docs/env.template)** - Environment variables setup

#### **🔲 QR Code System** 
- **[QR Implementation Guide](docs/QR_IMPLEMENTATION_GUIDE.md)** - Complete frontend integration guide
- **[Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md)** - Executive summary of QR features
- **[Changelog](docs/CHANGELOG.md)** - Version history and new features

#### **🚀 Deployment & Production**
- **[Production Deployment](docs/PRODUCTION_DEPLOYMENT_GUIDE.md)** - Production setup guide
- **[Render Deployment](docs/RENDER_DEPLOYMENT_GUIDE.md)** - Render.com specific deployment
- **[Google Sheets Troubleshooting](docs/GOOGLE_SHEETS_TROUBLESHOOTING.md)** - Common issues and solutions
- **[Quota Management](docs/QUOTA_MANAGEMENT.md)** - API quota and rate limiting

#### **🔐 Authentication & Security**
- **[Auth0 Setup](docs/AUTH0_SETUP_GUIDE.md)** - Authentication configuration
- **[Frontend Implementation](docs/FRONTEND_IMPLEMENTATION_GUIDE.md)** - Frontend security integration

#### **📋 Documentation Index**
- **[Complete Documentation Index](docs/README.md)** - Navigate all documentation

## 🆘 Support

For support and questions:
- **📖 Check the [documentation](docs/)** for comprehensive guides
- **🔧 Review [troubleshooting guides](docs/GOOGLE_SHEETS_TROUBLESHOOTING.md)**
- **📋 Check the [API documentation](#-api-endpoints)** above
- **🐛 Create an issue** in the repository for bugs
- **💡 Check [implementation guides](docs/QR_IMPLEMENTATION_GUIDE.md)** for integration help

---

**Built with ❤️ for efficient car inventory management with enhanced QR code technology** 🚗📱
