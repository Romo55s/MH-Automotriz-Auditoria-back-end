# 📚 Car Inventory Backend - Documentation

Welcome to the comprehensive documentation for the Car Inventory Backend system.

## 📋 **Quick Navigation**

### 🚀 **Getting Started**
- **[Main README](../README.md)** - Project overview, setup, and API documentation
- **[Environment Template](env.template)** - Environment variables configuration
- **[Project Structure](PROJECT_STRUCTURE.md)** - Detailed project organization

### 🔲 **QR Code System**
- **[QR Implementation Guide](QR_IMPLEMENTATION_GUIDE.md)** - Complete frontend integration guide
- **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** - Executive summary of QR features
- **[Changelog](CHANGELOG.md)** - Version history and new features

### 🚀 **Deployment & Production**
- **[Production Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)** - Production setup
- **[Render Deployment Guide](RENDER_DEPLOYMENT_GUIDE.md)** - Render.com specific deployment
- **[Google Sheets Troubleshooting](GOOGLE_SHEETS_TROUBLESHOOTING.md)** - Common issues and solutions
- **[Quota Management](QUOTA_MANAGEMENT.md)** - API quota and rate limiting

### 🔐 **Authentication & Security**
- **[Auth0 Setup Guide](AUTH0_SETUP_GUIDE.md)** - Authentication configuration
- **[Frontend Implementation Guide](FRONTEND_IMPLEMENTATION_GUIDE.md)** - Frontend security integration

## 🎯 **Documentation Overview**

### **Core Features**
- ✅ **QR Code Generation**: CSV upload → Enhanced QR codes with car data
- ✅ **Multi-Location Support**: Agencies + Bodegas (12 total locations)
- ✅ **Enhanced Data Storage**: 7-field car data tracking
- ✅ **Backward Compatibility**: Legacy barcode scanning preserved
- ✅ **Professional QR Codes**: 5×5cm print-ready with embedded text

### **Technical Stack**
- **Backend**: Node.js + Express
- **Database**: Google Sheets integration
- **QR Generation**: qrcode + canvas for enhanced images
- **File Processing**: CSV parsing + ZIP creation
- **Security**: CORS, Helmet, Rate limiting

### **API Endpoints**
- **QR Workflow**: `/api/qr/*` - Complete QR code lifecycle
- **Inventory Management**: `/api/inventory/*` - Enhanced with car data
- **File Downloads**: `/api/download/*` - Enhanced CSV/Excel exports
- **Validation**: `/api/validation/*` - Data integrity checks

## 🔄 **Process Flow**

### **New QR Code Process:**
1. **Upload CSV** → Car data (serie, marca, color, ubicaciones)
2. **Generate QR Codes** → Enhanced 5×5cm images with text
3. **Download ZIP** → All QR codes + metadata
4. **Print & Distribute** → Attach to vehicles
5. **Scan QR Codes** → Automatic inventory updates
6. **Complete Session** → Comprehensive data export

### **Legacy Barcode Process:**
1. **Scan Barcodes** → 8-digit REPUVE codes
2. **Manual Entry** → Add car details if needed
3. **Complete Session** → Standard export

## 📊 **Data Structure**

### **Enhanced Storage:**
```
Location Sheets: Date | Identifier | Scanned By | Serie | Marca | Color | Ubicaciones
Monthly Summary: Month | Year | Location | Status | Created At | ... | Finished By
```

### **QR Code Format:**
```json
{
  "serie": "1HGCM82633A001234",
  "marca": "Honda",
  "color": "Blanco", 
  "ubicaciones": "Lote A-1",
  "location": "Bodega Coyote",
  "timestamp": "2024-01-15T10:30:00Z",
  "type": "car_inventory"
}
```

## 🎯 **For Developers**

### **Frontend Integration:**
1. Read **[QR Implementation Guide](QR_IMPLEMENTATION_GUIDE.md)** for complete integration steps
2. Use **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** for quick reference
3. Check **[Changelog](CHANGELOG.md)** for latest updates

### **Backend Development:**
1. Follow **[Project Structure](PROJECT_STRUCTURE.md)** for code organization
2. Use **[Environment Template](env.template)** for configuration
3. Reference **[Main README](../README.md)** for API documentation

### **Deployment:**
1. **Development**: Use local Google Sheets credentials
2. **Production**: Follow **[Production Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)**
3. **Render.com**: Use **[Render Deployment Guide](RENDER_DEPLOYMENT_GUIDE.md)**

## 🆘 **Support & Troubleshooting**

- **Google Sheets Issues**: [Google Sheets Troubleshooting](GOOGLE_SHEETS_TROUBLESHOOTING.md)
- **API Quotas**: [Quota Management](QUOTA_MANAGEMENT.md)
- **Authentication**: [Auth0 Setup Guide](AUTH0_SETUP_GUIDE.md)
- **General Issues**: Check the main [README](../README.md) troubleshooting section

---

**📖 All documentation is organized and up-to-date with the latest QR code features!** 🚀
