# Render Deployment Fix Guide
**Date**: October 23, 2025  
**Issue**: Backend stuck looping on "deploying"

---

## 🐛 Problem

Render deployment was stuck in infinite "deploying" loop because:

1. **Health check timing out** - Initial delay too short (10s)
2. **Build command issues** - Directory navigation problems
3. **Cold start delays** - Free tier takes 30-60s to start

---

## ✅ Fixes Applied

### 1. Increased Health Check Timeouts

**File**: `render.yaml`

```yaml
# Before
initialDelaySeconds: 10

# After
initialDelaySeconds: 60      # Wait 60s before first health check
healthCheckInterval: 30       # Check every 30s
healthCheckTimeout: 10        # 10s timeout per check
```

### 2. Created Start Script

**File**: `start.sh`

A bash script that:
- Logs current directory
- Navigates to backend folder
- Installs dependencies if missing
- Starts the server

### 3. Simplified Build/Start Commands

**File**: `render.yaml`

```yaml
buildCommand: npm install --prefix backend
startCommand: ./start.sh
```

---

## 📋 Deployment Checklist

### Before Deploying

- [ ] Health endpoint responds at `/api/health`
- [ ] `start.sh` is executable (`chmod +x start.sh`)
- [ ] Backend dependencies in `package.json` are correct
- [ ] PORT environment variable is set to 10000

### After Deploying

1. **Watch Render Logs** - Look for:
   ```
   🚀 Starting Moonfeed Backend...
   📁 Current directory: /opt/render/project/src
   🔥 Starting server...
   🚀 Moonfeed Backend Server started on port 10000
   ```

2. **Wait for Health Check** (60 seconds)
   - Render will call `/api/health` after 60s
   - Should return `{"status": "ok", "timestamp": "..."}`

3. **Check Service Status**
   - Should change from "Deploying" → "Live"
   - Health checks should show as passing

### If Still Failing

1. **Check Build Logs**
   ```
   npm install --prefix backend
   ```
   - Look for dependency errors
   - Check for missing packages

2. **Check Runtime Logs**
   ```
   ./start.sh
   ```
   - Look for server startup errors
   - Check if port 10000 is binding correctly

3. **Manual Health Check**
   ```bash
   curl https://your-app.onrender.com/api/health
   ```
   - Should return 200 OK
   - Response: `{"status":"ok","timestamp":"..."}`

---

## 🔧 Troubleshooting

### Issue: "Health check failed"

**Cause**: Server not responding fast enough

**Fix**: Increase `initialDelaySeconds` to 90 or 120

```yaml
initialDelaySeconds: 90
```

### Issue: "Build failed"

**Cause**: npm install errors

**Fix**: Check package.json dependencies, ensure all are available

```bash
cd backend && npm install
```

### Issue: "Start command failed"

**Cause**: Directory or permission issues

**Fix**: 
1. Ensure `start.sh` is executable
2. Check file exists in repo root
3. Try direct command: `node backend/server.js`

---

## 🚀 Alternative Deployment (If Above Fails)

If the script approach doesn't work, use direct commands:

```yaml
buildCommand: npm install --prefix backend
startCommand: node backend/server.js
```

And increase health check delay:

```yaml
initialDelaySeconds: 90
healthCheckInterval: 30
healthCheckTimeout: 15
```

---

## 📊 Expected Timeline

1. **Build Phase**: 1-3 minutes
   - Installing dependencies
   - Setting up environment

2. **Start Phase**: 30-60 seconds
   - Server initialization
   - Loading data feeds

3. **Health Check**: +60 seconds
   - First health check after initial delay
   - Should pass and show "Live"

**Total**: ~3-5 minutes for first deployment

---

## ✅ Success Indicators

✅ Build logs show: `npm install complete`  
✅ Runtime logs show: `Server started on port 10000`  
✅ Health check passes: `200 OK`  
✅ Service status: `Live` (green)  
✅ Public URL accessible  

---

## 📝 Files Changed

1. **render.yaml** - Updated health check settings
2. **start.sh** - Created deployment start script

---

## 🔗 Render Dashboard

Check deployment status at:
`https://dashboard.render.com/web/[your-service-id]`

Monitor:
- Build logs
- Deploy logs  
- Health checks
- Service events
