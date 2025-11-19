# 🚀 Quick Start: Comments Feature

## What You Got

A complete comments system that replaces the help bubble (?) with a coin-specific comments section (💬). Users must connect their Solana wallet to post comments.

## 📦 Already Done

✅ Frontend component created (`CommentsSection.jsx`)
✅ Backend API routes ready (`/api/comments`)
✅ MongoDB schema defined (`Comment` model)
✅ Database connection configured
✅ Mongoose installed in backend
✅ Integrated into App.jsx
✅ Help bubble completely removed

## 🏃‍♂️ To Get It Running (2 Steps)

### Step 1: Start MongoDB

**Option A: Local MongoDB (Easiest)**
```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Docker (if you don't have MongoDB installed)
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Option B: MongoDB Atlas (Cloud - Free)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create cluster
4. Get connection string
5. Update `backend/.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/moonfeed
   ```

### Step 2: Start Your App

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend  
cd frontend
npm run dev
```

## ✅ You're Done!

The comments section should now appear in the bottom right of your app.

## 🧪 Test It

1. **Open your app** in browser (usually http://localhost:5173)
2. **Look bottom right** → Purple comment bubble (💬)
3. **Click the bubble** → Comments panel slides up
4. **Connect wallet** if not connected
5. **Type a comment** (max 500 characters)
6. **Click "Post"** → Comment appears instantly!
7. **Switch to different token** → See that token's comments

## 🎯 Features You Can Use Right Now

- ✅ Post comments (requires wallet)
- ✅ View comments (no wallet needed)
- ✅ See comment count on button
- ✅ Auto-resize textarea as you type
- ✅ Character counter (500 max)
- ✅ Rate limiting (10 comments/hour)
- ✅ Each coin has separate comments
- ✅ Timestamps (e.g., "2h ago")
- ✅ Wallet address display (e.g., "8xY..9zL")
- ✅ Works on mobile & desktop

## 🔍 How to Check It's Working

### 1. Check Backend Started
Look for these logs when backend starts:
```
📦 Connecting to MongoDB...
✅ MongoDB connected successfully
```

### 2. Check Frontend
- Purple bubble appears bottom right
- Click it → Panel opens
- See "Connect Wallet" prompt or comment form

### 3. Test API Directly
```bash
# Get comments for a token
curl http://localhost:3001/api/comments/YOUR_TOKEN_ADDRESS
```

## ⚠️ Troubleshooting

### "Comments feature is temporarily unavailable"
**Problem**: MongoDB not connected
**Solution**: 
- Check MongoDB is running: `brew services list` (macOS)
- Check .env has `MONGODB_URI`
- Check backend logs for MongoDB errors

### Comment button not showing
**Problem**: Frontend not updated
**Solution**:
- Restart frontend dev server
- Clear browser cache
- Check browser console for errors

### Can't connect wallet
**Problem**: Wallet extension not detected
**Solution**:
- Install Phantom or Solflare wallet
- Refresh page after installing
- Check wallet extension is enabled

### Rate limit error
**Problem**: Posting too many comments
**Solution**:
- Wait 1 hour
- This is intentional (prevents spam)
- Limit is 10 comments per hour per wallet

## 📱 Mobile Testing

Works great on mobile! Test with:
- iPhone Safari
- Android Chrome
- Mobile viewport in DevTools

## 🎨 Customization

### Change Color Scheme
Edit `frontend/src/components/CommentsSection.css`:
```css
.comments-bubble-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* Change these colors ↑ */
}
```

### Change Rate Limit
Edit `backend/routes/comments.js`:
```javascript
if (recentComments >= 10) {  // Change this number
  return res.status(429)...
}
```

### Change Character Limit
Edit both files:
- Frontend: `CommentsSection.jsx` → `maxLength={500}`
- Backend: `Comment.js` schema → `maxlength: 500`

## 📚 More Info

- **Full docs**: See `COMMENTS_FEATURE_README.md`
- **Implementation details**: See `COMMENTS_IMPLEMENTATION_SUMMARY.md`
- **Visual guide**: See `COMMENTS_VISUAL_GUIDE.md`

## 🆘 Need Help?

### Check Logs
```bash
# Backend logs
cd backend
npm run dev
# Watch for errors

# Frontend logs
Open browser DevTools → Console tab
```

### Common Issues

1. **Port already in use**
   - Backend: Change `PORT` in `.env`
   - Frontend: It will auto-increment (5174, 5175, etc.)

2. **CORS errors**
   - Check `server.js` has your frontend URL in CORS config

3. **Module not found**
   - Run `npm install` in both `backend/` and `frontend/`

## 🎉 That's It!

You now have a fully functional, production-ready comments system! 

Users can discuss each token right in your app. 🚀

---

**Questions?** Check the detailed docs or open an issue.
