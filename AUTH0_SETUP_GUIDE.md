# 🔐 Auth0 Configuration Guide

This guide will help you set up Auth0 for both development and production environments for the Car Inventory Backend.

## 📋 Prerequisites

- Auth0 account (free tier available)
- Domain name for production
- Frontend application URL

## 🔧 Development Setup

### 1. Create Auth0 Application

1. **Login to Auth0 Dashboard**:
   - Go to [auth0.com](https://auth0.com)
   - Login to your account

2. **Create Application**:
   - Go to Applications → Create Application
   - Name: `Car Inventory Backend - Development`
   - Type: **Single Page Application**
   - Click "Create"

3. **Configure Application Settings**:
   ```
   Allowed Callback URLs: http://localhost:3000/callback
   Allowed Logout URLs: http://localhost:3000
   Allowed Web Origins: http://localhost:3000
   Allowed Origins (CORS): http://localhost:3000
   ```

### 2. Create API

1. **Create API**:
   - Go to APIs → Create API
   - Name: `Car Inventory API`
   - Identifier: `https://car-inventory-api`
   - Signing Algorithm: **RS256**
   - Click "Create"

2. **Configure API Settings**:
   - Go to APIs → Car Inventory API → Settings
   - Enable **RBAC**
   - Enable **Add Permissions in Access Token**
   - Save changes

### 3. Environment Variables (Development)

Add to your `.env` file:

```bash
# Auth0 Configuration (Development)
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=https://car-inventory-api
AUTH0_ISSUER=https://your-domain.auth0.com/
```

## 🚀 Production Setup

### 1. Create Production Application

1. **Create New Application**:
   - Go to Applications → Create Application
   - Name: `Car Inventory Backend - Production`
   - Type: **Single Page Application**
   - Click "Create"

2. **Configure Production Settings**:
   ```
   Allowed Callback URLs: https://your-frontend-domain.com/callback
   Allowed Logout URLs: https://your-frontend-domain.com
   Allowed Web Origins: https://your-frontend-domain.com
   Allowed Origins (CORS): https://your-frontend-domain.com
   ```

### 2. Production API Configuration

1. **Update API Settings**:
   - Go to APIs → Car Inventory API → Settings
   - Update Identifier if needed: `https://your-production-domain.com/api`
   - Ensure RBAC is enabled
   - Save changes

### 3. Environment Variables (Production)

Update your production `.env` file:

```bash
# Auth0 Configuration (Production)
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=https://your-production-domain.com/api
AUTH0_ISSUER=https://your-domain.auth0.com/
```

## 🔑 JWT Token Configuration

### 1. Token Settings

1. **Go to Applications** → Your App → Advanced Settings → Grant Types
2. **Enable**:
   - ✅ Authorization Code
   - ✅ Refresh Token
   - ✅ Implicit (if needed for your frontend)

### 2. Token Expiration

1. **Go to Applications** → Your App → Advanced Settings → OAuth
2. **Configure**:
   - Access Token Expiration: `1 hour` (recommended)
   - Refresh Token Expiration: `30 days`
   - Id Token Expiration: `1 hour`

## 👥 User Management

### 1. Create Test Users

1. **Go to User Management** → Users → Create User
2. **Fill in**:
   - Email: `test@example.com`
   - Password: `SecurePassword123!`
   - Email Verified: ✅

### 2. User Roles (Optional)

1. **Go to User Management** → Roles → Create Role
2. **Create roles**:
   - `admin` - Full access
   - `user` - Basic access
   - `viewer` - Read-only access

3. **Assign roles to users**:
   - Go to Users → Select User → Roles
   - Assign appropriate roles

## 🔒 Security Configuration

### 1. Password Policy

1. **Go to Security** → Attack Protection → Brute Force Protection
2. **Enable**:
   - ✅ Brute Force Protection
   - ✅ Suspicious IP Throttling

### 2. Multi-Factor Authentication (Optional)

1. **Go to Security** → Multi-factor Authentication
2. **Enable**:
   - ✅ SMS
   - ✅ Email
   - ✅ Google Authenticator

### 3. Anomaly Detection

1. **Go to Security** → Attack Protection → Anomaly Detection
2. **Enable**:
   - ✅ Breached Password Detection
   - ✅ Bot Detection

## 🧪 Testing Configuration

### 1. Test Authentication Flow

```javascript
// Test JWT token validation
const jwt = require('jsonwebtoken');

// Your Auth0 configuration
const auth0Config = {
  domain: 'your-domain.auth0.com',
  audience: 'https://car-inventory-api',
  issuer: 'https://your-domain.auth0.com/'
};

// Test token validation
function validateToken(token) {
  try {
    const decoded = jwt.verify(token, getPublicKey(), {
      audience: auth0Config.audience,
      issuer: auth0Config.issuer,
      algorithms: ['RS256']
    });
    return { valid: true, payload: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
```

### 2. Test API Endpoints

```bash
# Get access token (replace with your actual values)
curl -X POST https://your-domain.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "your-client-id",
    "client_secret": "your-client-secret",
    "audience": "https://car-inventory-api",
    "grant_type": "client_credentials"
  }'

# Test protected endpoint
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     http://localhost:5000/api/inventory/monthly-inventory/TestAgency/01/2025
```

## 📊 Monitoring & Analytics

### 1. Auth0 Dashboard

- **Monitor** user logins, signups, and errors
- **View** authentication logs
- **Track** API usage and performance

### 2. Custom Analytics

```javascript
// Track custom events
auth0.track('inventory_scan', {
  agency: 'Alfa Romeo',
  barcode: '12345678',
  user_id: user.sub
});
```

## 🚨 Troubleshooting

### Common Issues:

1. **Invalid Token**:
   - Check token expiration
   - Verify audience and issuer
   - Ensure proper algorithm (RS256)

2. **CORS Errors**:
   - Add your frontend domain to allowed origins
   - Check CORS configuration in Auth0 dashboard

3. **Permission Denied**:
   - Verify user has proper roles
   - Check API permissions configuration

4. **Token Not Found**:
   - Ensure token is sent in Authorization header
   - Check token format: `Bearer <token>`

### Debug Mode:

```bash
# Enable debug logging
DEBUG=auth0* npm start
```

## 🔄 Environment Migration

### Development → Production:

1. **Copy configuration** from development app
2. **Update URLs** to production domains
3. **Test thoroughly** before going live
4. **Monitor** for any issues

### Backup Configuration:

```bash
# Export Auth0 configuration (using Auth0 CLI)
auth0 apps export --format json > auth0-config-backup.json
```

## 📞 Support

- **Auth0 Documentation**: [auth0.com/docs](https://auth0.com/docs)
- **Community**: [community.auth0.com](https://community.auth0.com)
- **Support**: Available in paid plans

---

**Remember**: Always test your Auth0 configuration in a development environment before deploying to production!
