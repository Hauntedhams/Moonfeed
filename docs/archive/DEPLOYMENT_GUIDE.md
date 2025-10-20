# 🚀 Continuous Deployment Setup Guide

## Overview
This project uses **Git-based CI/CD** with automatic deployment:
- **Frontend**: Deployed to Vercel (moonfeed.app)
- **Backend**: Deployed to Render (moonfeed-backend.onrender.com)
- **Sync**: Push to `main` branch automatically syncs localhost with production

## 🔧 Deployment Services

### Frontend (Vercel)
- **URL**: https://moonfeed.app
- **Auto-deploys** from: `main` branch
- **Build Command**: `cd frontend && npm install && npm run build`
- **Output Directory**: `frontend/dist`

### Backend (Render)
- **URL**: https://moonfeed-backend.onrender.com
- **Auto-deploys** from: `main` branch  
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && npm start`

## 🌍 Environment Configuration

### Local Development
```bash
# Frontend uses: http://localhost:3001
# Backend runs on: localhost:3001
```

### Production
```bash
# Frontend uses: https://moonfeed-backend.onrender.com
# Backend runs on: https://moonfeed-backend.onrender.com
```

## 📝 Setup Instructions

### 1. Connect GitHub to Vercel (Frontend)
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set **Root Directory**: `frontend`
4. Deploy

### 2. Connect GitHub to Render (Backend)
1. Go to [render.com](https://render.com)
2. Create new **Web Service**
3. Connect your GitHub repository
4. Render will use the `render.yaml` configuration
5. Deploy

### 3. Enable Auto-Deployment
Both services automatically deploy when you:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

## 🔄 Development Workflow

1. **Local Development**
   ```bash
   # Terminal 1: Start backend
   cd backend && npm run dev
   
   # Terminal 2: Start frontend  
   cd frontend && npm run dev
   ```

2. **Deploy Changes**
   ```bash
   git add .
   git commit -m "Add new feature"
   git push origin main
   # 🚀 Automatically deploys to both Vercel and Render
   ```

3. **Test Production**
   - Visit https://moonfeed.app
   - Should work exactly like localhost

## 🔍 Environment Detection

The app automatically detects the environment:

```javascript
// Development (localhost)
API_BASE_URL = 'http://localhost:3001'

// Production (moonfeed.app)  
API_BASE_URL = 'https://moonfeed-backend.onrender.com'
```

## 🛠 File Structure

```
├── .github/workflows/deploy.yml    # GitHub Actions (optional)
├── render.yaml                     # Render deployment config
├── vercel.json                     # Vercel deployment config
├── frontend/
│   ├── .env.local                 # Local environment variables
│   ├── .env.production            # Production environment variables
│   └── src/config/api.js          # API configuration
└── backend/
    ├── package.json               # Added build/test scripts
    └── server.js                  # Updated CORS for production
```

## ✅ What This Achieves

- ✅ **Localhost testing** matches **production** exactly
- ✅ **Push to main** = **automatic deployment**
- ✅ **No manual deployment** steps needed
- ✅ **Environment-specific** configurations
- ✅ **CORS properly configured** for both environments

## 🎯 How to Talk About It

> "We're using Git-based CI/CD with automatic deployment to Vercel (frontend) and Render (backend). Pushing to main automatically syncs localhost with production — it's Continuous Deployment."

## 🔮 Future Enhancements

- Add **staging branch** for testing before production
- Add **GitHub Actions** for automated testing
- Add **environment-specific** database configurations
- Add **health checks** and monitoring
