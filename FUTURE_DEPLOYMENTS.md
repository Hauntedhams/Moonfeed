# 🚀 Quick Deployment Guide - Future Updates

## ✅ Your App is Live!

- **Frontend:** https://www.moonfeed.app (Vercel)
- **Backend:** https://api.moonfeed.app (Render)

---

## For Future Updates

### Step 1: Make Your Code Changes
Edit your files as needed in VS Code.

### Step 2: Deploy Changes

Copy and paste these commands **exactly as shown**:

```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3

# Add all changes
git add .

# Commit with a message (change the message to describe your update)
git commit -m "update: describe your changes here"

# Push to GitHub (this triggers auto-deployment)
git push origin main
```

**That's it!** Both frontend and backend will automatically deploy.

---

## What Happens After Push

### Automatic Deployments

1. **Vercel (Frontend)** - Starts immediately
   - Build time: ~1-2 minutes
   - URL: https://www.moonfeed.app
   - Status: Check https://vercel.com/

2. **Render (Backend)** - Starts immediately  
   - Build time: ~2-3 minutes
   - URL: https://api.moonfeed.app
   - Status: Check https://dashboard.render.com/

### Timeline
- **0-2 min:** Vercel builds frontend
- **0-3 min:** Render builds backend
- **3-5 min:** Both deployed
- **5-10 min:** CDN cache clears globally

---

## Quick Deploy Commands (One-Liners)

### Deploy Everything (Most Common)
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3 && git add . && git commit -m "update: describe changes" && git push origin main
```

### Deploy with Detailed Message
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3 && git add . && git commit -m "feat: add new feature

- Added feature X
- Fixed bug Y
- Updated component Z" && git push origin main
```

### Check Status Before Pushing
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3 && git status
```

### See What Changed
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3 && git diff
```

---

## Testing Before Deployment

### Test Locally First

**Backend (Terminal 1):**
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3/backend && npm run dev
```

**Frontend (Terminal 2):**
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3/frontend && npm run dev
```

Open: http://localhost:5173

**If it works locally, it will work in production!**

---

## Common Deployment Scenarios

### 1. Updated Frontend Only (React Components, Styles, etc.)
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3
git add frontend/
git commit -m "update: frontend UI improvements"
git push origin main
```
✅ Only Vercel rebuilds (faster!)

### 2. Updated Backend Only (API, Server Logic)
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3
git add backend/
git commit -m "update: backend API enhancements"
git push origin main
```
✅ Only Render rebuilds (faster!)

### 3. Updated Both
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3
git add .
git commit -m "update: full stack changes"
git push origin main
```
✅ Both rebuild

### 4. Added New Dependencies

**Frontend added package:**
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3/frontend
npm install package-name
cd ..
git add frontend/package.json frontend/package-lock.json
git commit -m "deps: add package-name to frontend"
git push origin main
```

**Backend added package:**
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3/backend
npm install package-name
cd ..
git add backend/package.json backend/package-lock.json
git commit -m "deps: add package-name to backend"
git push origin main
```

---

## Verification After Deployment

### Quick Check (All-in-One)
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3 && ./comprehensive-check.sh
```

### Manual Check

**Backend:**
```bash
curl -s https://api.moonfeed.app/health | head -20
```
Expected: `{"status":"ok"}`

**Frontend:**
```bash
curl -s https://www.moonfeed.app | grep -o "<title>[^<]*</title>"
```
Expected: `<title>Moonfeed</title>`

**API Connection:**
```bash
curl -s 'https://api.moonfeed.app/api/coins/trending?limit=1' | grep -o '"success":true'
```
Expected: `"success":true`

---

## If Something Goes Wrong

### Frontend Issues

**Check Vercel logs:**
1. Go to: https://vercel.com/
2. Click on your project
3. Click "Deployments"
4. Click the latest deployment
5. Check "Build Logs" tab

**Rollback:**
1. Find previous working deployment
2. Click "..." → "Redeploy"

### Backend Issues

**Check Render logs:**
1. Go to: https://dashboard.render.com/
2. Click your backend service
3. Click "Logs" tab
4. Look for errors

**Restart:**
1. Click "Manual Deploy" → "Deploy latest commit"

### Emergency Rollback

**Undo last commit (locally):**
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3
git reset --soft HEAD~1
```

**Rollback to specific commit:**
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3
git log --oneline  # Find the commit hash you want
git reset --hard COMMIT_HASH
git push origin main --force  # ⚠️ Use with caution!
```

---

## Best Practices

### Before Every Deploy

1. **Test locally** - Run both frontend and backend
2. **Check git status** - See what you're committing
3. **Write clear commit message** - Describe what changed
4. **Push during off-peak hours** - If possible

### Commit Message Format

```
type: brief description

- Detail 1
- Detail 2
- Detail 3
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `update:` - General update
- `style:` - UI/styling changes
- `refactor:` - Code restructuring
- `docs:` - Documentation
- `deps:` - Dependency updates

**Examples:**
```bash
git commit -m "feat: add favorite coins feature"
git commit -m "fix: resolve price display bug"
git commit -m "update: improve chart performance"
git commit -m "style: redesign trending page"
```

---

## Environment Variables

### Updating Environment Variables

**Vercel (Frontend):**
1. Go to: https://vercel.com/[your-project]/settings/environment-variables
2. Add/Edit variables
3. **Must redeploy** after changing variables:
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3
git commit --allow-empty -m "chore: trigger redeploy for env vars"
git push origin main
```

**Render (Backend):**
1. Go to: https://dashboard.render.com/
2. Click your service → Environment
3. Add/Edit variables
4. **Auto-redeploys** after saving

### Current Environment Variables

**Frontend (Vercel):**
- `VITE_API_URL=https://api.moonfeed.app`
- `VITE_ENV=production`

**Backend (Render):**
- `PORT=3001` (or Render assigns)
- `SOLANA_TRACKER_API_KEY=[your key]`
- `NODE_ENV=production`

---

## Daily Workflow

### Morning Check
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3
git pull origin main  # Get latest changes
```

### Making Changes
1. Edit files in VS Code
2. Test locally (npm run dev)
3. Commit and push (commands above)
4. Wait for deployment
5. Test live site

### End of Day
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3
git status  # Make sure everything is committed
git log --oneline -5  # Review today's commits
```

---

## Quick Reference Card

**Save this for copy-paste:**

```bash
# Navigate to project
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3

# Deploy everything
git add . && git commit -m "update: your message" && git push origin main

# Check status
git status

# View changes
git diff

# Test backend locally
cd backend && npm run dev

# Test frontend locally  
cd frontend && npm run dev

# Verify live deployment
./comprehensive-check.sh

# Check backend health
curl -s https://api.moonfeed.app/health

# Check trending API
curl -s 'https://api.moonfeed.app/api/coins/trending?limit=1'
```

---

## Support Resources

- **Vercel Dashboard:** https://vercel.com/
- **Render Dashboard:** https://dashboard.render.com/
- **GitHub Repo:** https://github.com/Hauntedhams/Moonfeed
- **Live Site:** https://www.moonfeed.app
- **API:** https://api.moonfeed.app

---

## TL;DR - The Essential Commands

**Deploy changes:**
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3 && git add . && git commit -m "update: describe changes" && git push origin main
```

**Check if it worked:**
```bash
cd /Users/victor/Desktop/Desktop/moonfeed\ alpha\ copy\ 3 && ./comprehensive-check.sh
```

**That's it!** 🚀

Your deployments are fully automated. Push to GitHub = automatic deployment to both Vercel and Render.
