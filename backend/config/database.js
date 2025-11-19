const mongoose = require('mongoose');

// MongoDB connection URI - use environment variable or default to local
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/moonfeed';

// Connection options
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
};

// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, options);
    console.log('✅ MongoDB connected successfully');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.warn('⚠️  Comments feature will not be available');
    // Don't exit the process - allow app to run without MongoDB
    // process.exit(1);
  }
};

// Graceful shutdown
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('📦 MongoDB connection closed');
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  }
};

// Export connection functions
module.exports = {
  connectDB,
  disconnectDB,
  isConnected: () => mongoose.connection.readyState === 1
};
