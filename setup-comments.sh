#!/bin/bash

echo "🚀 Setting up Comments Feature for MoonFeed"
echo "==========================================="
echo ""

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
  echo "❌ Error: Please run this script from the project root directory"
  exit 1
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install mongoose
if [ $? -eq 0 ]; then
  echo "✅ Backend dependencies installed successfully"
else
  echo "❌ Failed to install backend dependencies"
  exit 1
fi
cd ..

# Check if .env exists
echo ""
echo "🔍 Checking environment configuration..."
if [ -f "backend/.env" ]; then
  echo "✅ .env file found"
  
  # Check if MONGODB_URI is set
  if grep -q "MONGODB_URI" backend/.env; then
    echo "✅ MONGODB_URI is configured"
  else
    echo "⚠️  MONGODB_URI not found in .env"
    echo ""
    echo "Please add one of the following to your backend/.env file:"
    echo ""
    echo "For local MongoDB:"
    echo "MONGODB_URI=mongodb://localhost:27017/moonfeed"
    echo ""
    echo "For MongoDB Atlas:"
    echo "MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/moonfeed"
  fi
else
  echo "⚠️  .env file not found"
  echo "Creating .env file with MongoDB configuration..."
  echo "MONGODB_URI=mongodb://localhost:27017/moonfeed" > backend/.env
  echo "✅ Created backend/.env with local MongoDB configuration"
fi

# Check if MongoDB is running locally
echo ""
echo "🔍 Checking if MongoDB is running locally..."
if command -v mongod &> /dev/null; then
  if pgrep -x "mongod" > /dev/null; then
    echo "✅ MongoDB is running"
  else
    echo "⚠️  MongoDB is installed but not running"
    echo ""
    echo "To start MongoDB:"
    echo "  macOS (Homebrew): brew services start mongodb-community"
    echo "  Linux: sudo systemctl start mongod"
    echo "  Docker: docker run -d -p 27017:27017 --name mongodb mongo:latest"
  fi
else
  echo "⚠️  MongoDB not found on this system"
  echo ""
  echo "Install MongoDB:"
  echo "  macOS (Homebrew): brew install mongodb-community"
  echo "  Linux (Ubuntu): sudo apt install mongodb"
  echo "  Docker: docker run -d -p 27017:27017 --name mongodb mongo:latest"
  echo ""
  echo "Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas"
fi

echo ""
echo "==========================================="
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Make sure MongoDB is running (see above)"
echo "2. Start the backend: cd backend && npm run dev"
echo "3. Start the frontend: cd frontend && npm run dev"
echo "4. Connect your wallet and start commenting!"
echo ""
echo "📖 For more info, see COMMENTS_FEATURE_README.md"
echo "==========================================="
