# 🚀 Render Deployment Guide

This guide will help you deploy your Car Inventory Backend to Render for free!

## 📋 Prerequisites

- GitHub repository with your backend code
- Render account (free)
- Google Sheets API credentials
- Auth0 account (optional)

## 🔧 Step-by-Step Deployment

### 1. Create Render Account

1. **Go to [render.com](https://render.com)**
2. **Sign up with GitHub** (recommended)
3. **Connect your GitHub account**

### 2. Deploy Your Backend

1. **Click "New +" → "Web Service"**
2. **Connect your repository**:
   - Select your `car-inventory-back-end` repository
   - Choose the main branch

3. **Configure the service**:
   ```
   Name: car-inventory-backend
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   ```

4. **Set Environment Variables**:
   ```
   NODE_ENV=production
   PORT=10000
   GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
   AUTH0_DOMAIN=your-domain.auth0.com
   AUTH0_AUDIENCE=your-api-identifier
   AUTH0_ISSUER=https://your-domain.auth0.com/
   RATE_LIMIT_MAX_REQUESTS=100
   CORS_ORIGIN=https://your-frontend-domain.com
   LOG_LEVEL=info
   ```

5. **Add Google Credentials**:
   - Create a file called `google-credentials.json` in your repo
   - Add your Google service account JSON content
   - **Important**: Add `credentials/` to `.gitignore` for security

### 3. Alternative: Secure Credentials Setup

**For better security, use Render's environment variables:**

1. **Convert your Google credentials to base64**:
   ```bash
   # On your local machine
   base64 -i credentials/google-credentials.json
   ```

2. **Add to Render environment variables**:
   ```
   GOOGLE_CREDENTIALS_BASE64=your_base64_encoded_credentials
   ```

3. **Update your code to use base64 credentials** (optional)

## 🔒 Security Best Practices

### 1. Environment Variables
- ✅ Never commit `.env` files
- ✅ Use Render's environment variable system
- ✅ Keep sensitive data in Render's secure storage

### 2. Google Credentials
- ✅ Use environment variables for credentials
- ✅ Add `credentials/` to `.gitignore`
- ✅ Use service account with minimal permissions

### 3. CORS Configuration
- ✅ Set `CORS_ORIGIN` to your frontend domain
- ✅ Use HTTPS in production
- ✅ Avoid using `*` for CORS in production

## 📊 Render Features You'll Get

### ✅ Free Tier Benefits:
- **750 hours/month** (24/7 operation)
- **Automatic HTTPS** with SSL certificates
- **Custom domains** support
- **Health checks** and monitoring
- **Automatic deployments** on git push
- **Built-in logging** and error tracking
- **Zero-downtime deployments**

### ✅ Monitoring & Logs:
- **Real-time logs** in Render dashboard
- **Health check monitoring** at `/health`
- **Performance metrics** and uptime tracking
- **Error alerts** and notifications

## 🔄 Automatic Deployment

### GitHub Integration:
1. **Push to main branch** → Automatic deployment
2. **Pull request** → Preview deployment (optional)
3. **Rollback** → Easy rollback to previous versions

### Deployment Process:
```
Git Push → Render Build → Deploy → Health Check → Live
```

## 🧪 Testing Your Deployment

### 1. Health Check
```bash
curl https://your-app-name.onrender.com/health
```

### 2. API Endpoints
```bash
# Test inventory endpoint
curl https://your-app-name.onrender.com/api/inventory/monthly-inventory/TestAgency/01/2025
```

### 3. Monitor Logs
- Go to Render dashboard
- Click on your service
- View "Logs" tab for real-time logs

## 🚨 Troubleshooting

### Common Issues:

1. **Build Failures**:
   - Check `package.json` scripts
   - Verify all dependencies are listed
   - Check build logs in Render dashboard

2. **Runtime Errors**:
   - Check environment variables
   - Verify Google credentials
   - Check application logs

3. **Health Check Failures**:
   - Ensure `/health` endpoint is working
   - Check if application is binding to correct port
   - Verify all required environment variables

### Debug Commands:
```bash
# Check if app is running
curl https://your-app-name.onrender.com/health

# Check detailed health
curl https://your-app-name.onrender.com/health/detailed

# View logs in Render dashboard
```

## 📈 Scaling Options

### Free Tier Limits:
- **750 hours/month** (usually enough for 24/7)
- **512MB RAM** (sufficient for your backend)
- **Sleep after 15 minutes** of inactivity (wakes up on request)

### Upgrade Options:
- **Starter Plan ($7/month)**: No sleep, better performance
- **Professional ($25/month)**: More resources, better scaling

## 🔄 Migration from Other Platforms

### From Heroku:
1. Export environment variables
2. Update build/start commands
3. Deploy to Render
4. Update DNS/domain settings

### From Railway:
1. Export environment variables
2. Update configuration
3. Deploy to Render
4. Update DNS/domain settings

## 💡 Pro Tips

### 1. Performance Optimization:
- Use `npm ci` instead of `npm install` in production
- Enable gzip compression
- Use connection pooling for databases

### 2. Monitoring:
- Set up health check alerts
- Monitor memory usage
- Track response times

### 3. Security:
- Use HTTPS everywhere
- Implement proper CORS
- Regular security updates

## 🎉 Success Checklist

- [ ] Render account created
- [ ] Repository connected
- [ ] Environment variables set
- [ ] Google credentials configured
- [ ] Health check passing
- [ ] API endpoints working
- [ ] Custom domain configured (optional)
- [ ] Monitoring set up

---

**🎉 Congratulations! Your Car Inventory Backend is now deployed on Render!**

### Your App URL:
```
https://your-app-name.onrender.com
```

### Health Check:
```
https://your-app-name.onrender.com/health
```

### API Base URL:
```
https://your-app-name.onrender.com/api
```
