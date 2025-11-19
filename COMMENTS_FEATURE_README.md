# Comments Section Feature

## Overview
The Comments Section replaces the Help Bubble and provides a coin-specific comment system where users can share their thoughts about each token. Users must connect their Solana wallet to post comments.

## Features

### Frontend
- **Wallet-gated commenting**: Users must connect their wallet to post
- **Coin-specific comments**: Each token has its own comment section
- **Real-time updates**: Comments refresh automatically
- **Character limit**: 500 characters per comment
- **Responsive design**: Works on both desktop and mobile
- **Auto-resizing textarea**: Expands as you type
- **Comment count badge**: Shows number of comments on the button
- **Elegant UI**: Modern gradient design matching the app theme

### Backend
- **MongoDB storage**: Comments stored in database
- **Rate limiting**: Max 10 comments per wallet per coin per hour
- **Spam prevention**: Duplicate comment detection within 1 minute
- **Validation**: Input sanitization and length checks
- **Efficient queries**: Indexed for fast retrieval
- **Graceful degradation**: App works even if MongoDB is unavailable

## Setup

### 1. Install MongoDB Dependencies

```bash
cd backend
npm install mongoose
```

### 2. Configure MongoDB

Add to your `.env` file:

```env
MONGODB_URI=mongodb://localhost:27017/moonfeed
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/moonfeed?retryWrites=true&w=majority
```

### 3. Start MongoDB Locally (if not using Atlas)

**macOS (with Homebrew):**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

**Windows:**
```bash
net start MongoDB
```

**Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 4. Start the Backend

```bash
cd backend
npm run dev
```

The backend will automatically connect to MongoDB on startup.

## API Endpoints

### GET /api/comments/:coinAddress
Get all comments for a specific coin.

**Response:**
```json
{
  "success": true,
  "comments": [
    {
      "_id": "...",
      "coinAddress": "...",
      "coinSymbol": "MOON",
      "walletAddress": "...",
      "comment": "Great project!",
      "timestamp": "2025-11-18T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

### POST /api/comments
Post a new comment (requires wallet connection).

**Request Body:**
```json
{
  "coinAddress": "FeqAiLPejhkTJ2nEiCCL7JdtJkZdPNTYSm8vAjrZmoon",
  "coinSymbol": "MOO",
  "walletAddress": "8xY...",
  "comment": "To the moon! 🚀"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Comment posted successfully",
  "comment": { ... }
}
```

### DELETE /api/comments/:commentId
Delete a comment (only by original poster).

**Request Body:**
```json
{
  "walletAddress": "8xY..."
}
```

### GET /api/comments/stats/:coinAddress
Get comment statistics for a coin.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalComments": 42,
    "uniqueCommenters": 15
  }
}
```

## Rate Limiting

- **Per wallet per coin**: 10 comments per hour
- **Duplicate prevention**: Same comment within 1 minute blocked
- **Character limit**: 500 characters maximum

## Database Schema

### Comment Model

```javascript
{
  coinAddress: String,      // Required, indexed
  coinSymbol: String,       // Required
  walletAddress: String,    // Required, indexed
  comment: String,          // Required, max 500 chars
  timestamp: Date,          // Required, indexed
  edited: Boolean,          // Default false
  editedAt: Date,
  likes: Number,            // Default 0 (future feature)
  likedBy: [String],        // Array of wallet addresses
  reported: Boolean,        // Default false (future moderation)
  reportCount: Number       // Default 0
}
```

### Indexes

- `coinAddress + timestamp` (compound, descending)
- `walletAddress + timestamp` (compound, descending)
- `coinAddress` (single)
- `walletAddress` (single)
- `timestamp` (single)

## Frontend Integration

The CommentsSection component automatically:
1. Detects the currently viewed coin from App.jsx
2. Fetches comments for that specific coin
3. Displays wallet connection prompt if user is not connected
4. Handles posting, error states, and rate limiting

### Usage in App.jsx

```jsx
import CommentsSection from './components/CommentsSection'

// In your component:
<CommentsSection 
  coinAddress={currentViewedCoin?.mintAddress || currentViewedCoin?.address}
  coinSymbol={currentViewedCoin?.symbol || currentViewedCoin?.ticker}
/>
```

## Future Enhancements

- [ ] Comment editing (within 5 minutes of posting)
- [ ] Like/upvote system
- [ ] Reply threads
- [ ] Moderation tools (report/flag)
- [ ] Admin dashboard for moderation
- [ ] Emoji reactions
- [ ] Mention notifications
- [ ] Sort options (newest, popular, controversial)
- [ ] User reputation system
- [ ] Comment search/filter

## Troubleshooting

### MongoDB Connection Failed
If MongoDB is not available, the app will still work but comments feature will be disabled. Users will see:
```
"Comments feature is temporarily unavailable. Please try again later."
```

### Rate Limit Exceeded
Users who post too frequently will see:
```
"Rate limit exceeded. Please wait before posting more comments."
```

### Wallet Not Connected
Users who try to comment without wallet connection will see a prompt to connect their wallet.

## Security Considerations

1. **No authentication tokens**: Uses wallet signatures as proof of ownership
2. **Rate limiting**: Prevents spam and abuse
3. **Input validation**: All inputs sanitized and validated
4. **Character limits**: Prevents database bloat
5. **Indexed queries**: Fast and efficient lookups
6. **Error handling**: Graceful degradation if DB unavailable

## Performance

- Comments are fetched only when the panel is opened
- Limited to 100 most recent comments per coin
- Indexed queries for fast retrieval
- Automatic cleanup of old comments (future feature)

## Testing

### Test Comment Posting
1. Connect your Solana wallet
2. Navigate to any coin
3. Click the purple comment bubble in bottom right
4. Type a comment and click "Post"
5. Comment should appear immediately

### Test Rate Limiting
Try posting 11 comments quickly - the 11th should be blocked.

### Test Without Wallet
Try to comment without connecting wallet - should see connection prompt.

---

**Built with ❤️ for the MoonFeed community**
