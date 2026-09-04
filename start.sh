#!/bin/bash
# Render deployment start script

echo "🚀 Starting Moonfeed Backend..."
echo "📁 Current directory: $(pwd)"
echo "📋 Files in directory:"
ls -la

# Navigate to backend directory
cd backend || exit 1

echo "📁 Backend directory: $(pwd)"
echo "📋 Files in backend:"
ls -la

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Start the server
echo "🔥 Starting server..."
# Heap sized for the Pro container (4GB RAM); leaves ~1GB headroom for
# non-heap (buffers, native, WS/RPC connections) before the OOM ceiling.
exec node --max-old-space-size=3072 server.js
