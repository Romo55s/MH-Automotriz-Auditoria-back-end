# 🚗 Car Inventory Backend

A robust Node.js backend API for managing monthly car inventory with Google Sheets integration and comprehensive security features.

## ✨ Features

- **Monthly Inventory Management**: Each agency can have one inventory per month
- **Google Sheets Integration**: Automatic data storage and retrieval
- **Session Management**: Complete inventory session lifecycle
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
│   │   └── api.js            # API routes
│   ├── services/
│   │   ├── googleSheets.js   # Google Sheets service
│   │   └── inventoryService.js # Inventory business logic
│   ├── middleware/
│   │   ├── auth.js           # Authentication middleware (optional)
│   │   └── errorHandler.js   # Comprehensive error handling
│   └── utils/
│       └── validation.js     # Validation utilities
├── credentials/
│   └── google-credentials.json # Google service account credentials
└── README.md
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

## 📊 Google Sheets Structure

### 1. **Main Inventory Sheet**
Create a sheet named "Inventory" with these columns:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Timestamp | Agency | Month | Year | Barcode | User Email | User Name | Session ID |

### 2. **Monthly Summary Sheet**
Create a sheet named "MonthlySummary" with these columns:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| Month | Year | Agency | Status | Created At | Created By | User Name | Total Scans | Session ID | Completed At |

## 🔌 API Endpoints

### **1. Save Scan**
**POST** `/api/save-scan`

Saves a scanned barcode to Google Sheets.

**Request Body:**
```json
{
  "agency": "string",        // Agency name (e.g., "Suzuki")
  "code": "string",          // 8-digit barcode
  "timestamp": "string",     // ISO timestamp
  "user": "string",          // User email
  "userName": "string",      // User's display name
  "month": "string",         // Month in "MM" format (e.g., "01")
  "year": "number"           // Year (e.g., 2024)
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
**GET** `/api/monthly-inventory/:agency/:month/:year`

Retrieves data for a specific monthly inventory.

### **4. Get Agency Inventories**
**GET** `/api/agency-inventories/:agency`

Retrieves all monthly inventories for a specific agency.

### **5. Check Monthly Inventory**
**GET** `/api/check-monthly-inventory/:agency/:month/:year`

Checks if a monthly inventory already exists.

## 🧪 Testing

### **Test Health Check**
```bash
curl http://localhost:5000/health
```

### **Test Save Scan**
```bash
curl -X POST http://localhost:5000/api/save-scan \
  -H "Content-Type: application/json" \
  -d '{
    "agency": "Suzuki",
    "code": "12345678",
    "timestamp": "2024-01-15T10:30:00Z",
    "user": "user@example.com",
    "userName": "John Doe",
    "month": "01",
    "year": 2024
  }'
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

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**Built with ❤️ for efficient car inventory management**
