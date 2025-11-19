#!/bin/bash

echo "🔧 MongoDB Configuration Helper"
echo "================================"
echo ""

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
  echo "❌ Error: backend/.env file not found!"
  echo "   Please run this script from the project root directory."
  exit 1
fi

echo "📝 Enter your MongoDB connection string:"
echo "   (Format: mongodb+srv://username:password@cluster.mongodb.net/moonfeed?retryWrites=true&w=majority)"
echo ""
read -p "Connection String: " MONGODB_URI

# Validate the connection string
if [[ ! $MONGODB_URI =~ ^mongodb ]]; then
  echo "❌ Invalid connection string. Must start with 'mongodb://' or 'mongodb+srv://'"
  exit 1
fi

# Check if connection string includes database name
if [[ ! $MONGODB_URI =~ /moonfeed ]]; then
  echo "⚠️  Warning: Connection string should include '/moonfeed' database name"
  echo "   Example: mongodb+srv://user:pass@cluster.net/moonfeed?options"
  read -p "Continue anyway? (y/n): " continue_anyway
  if [[ $continue_anyway != "y" ]]; then
    exit 1
  fi
fi

# Backup existing .env
cp backend/.env backend/.env.backup
echo "✅ Backed up existing .env to .env.backup"

# Update MONGODB_URI in .env
if grep -q "^MONGODB_URI=" backend/.env; then
  # Replace existing MONGODB_URI
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|^MONGODB_URI=.*|MONGODB_URI=$MONGODB_URI|" backend/.env
  else
    # Linux
    sed -i "s|^MONGODB_URI=.*|MONGODB_URI=$MONGODB_URI|" backend/.env
  fi
  echo "✅ Updated MONGODB_URI in backend/.env"
else
  # Add MONGODB_URI
  echo "" >> backend/.env
  echo "# MongoDB Configuration (for comments feature)" >> backend/.env
  echo "MONGODB_URI=$MONGODB_URI" >> backend/.env
  echo "✅ Added MONGODB_URI to backend/.env"
fi

echo ""
echo "✅ Configuration complete!"
echo ""
echo "🧪 Testing connection..."
echo ""

# Test the connection using Node.js
cat > test-mongodb-connection.js << 'EOF'
const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env');
  process.exit(1);
}

console.log('🔌 Attempting to connect to MongoDB...');
console.log('   URI:', MONGODB_URI.replace(/:[^:]*@/, ':****@')); // Hide password

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => {
  console.log('✅ Successfully connected to MongoDB!');
  console.log('   Database:', mongoose.connection.name);
  console.log('   Host:', mongoose.connection.host);
  mongoose.connection.close();
  process.exit(0);
})
.catch((error) => {
  console.error('❌ Failed to connect to MongoDB');
  console.error('   Error:', error.message);
  console.error('');
  console.error('Common issues:');
  console.error('  • Check username and password are correct');
  console.error('  • Verify IP address is whitelisted (0.0.0.0/0 for all)');
  console.error('  • Ensure database user has read/write permissions');
  console.error('  • Check connection string format');
  process.exit(1);
});
EOF

# Run the test
node test-mongodb-connection.js

# Clean up test file
rm test-mongodb-connection.js

echo ""
echo "================================"
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "  1. Restart your backend: cd backend && npm run dev"
echo "  2. Look for '✅ MongoDB connected successfully' in logs"
echo "  3. Test commenting in your app"
echo ""
echo "Comments will now be stored permanently in MongoDB!"
echo "================================"
