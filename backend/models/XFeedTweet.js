const mongoose = require('mongoose');

const xFeedTweetSchema = new mongoose.Schema({
  tweetId: { type: String, required: true, unique: true, index: true },
  createdAtMs: { type: Number, required: true, index: true },
  doc: { type: mongoose.Schema.Types.Mixed, required: true },
  expireAt: { type: Date, required: true, index: { expires: 0 } },
}, { minimize: false });

module.exports = mongoose.model('XFeedTweet', xFeedTweetSchema);
