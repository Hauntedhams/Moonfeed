# Meme Coin Discovery App

A fullstack app for discovering trending meme coins with a TikTok-style vertical scroll interface.

## Tech Stack
- **Frontend:** Vite + React (`/frontend`)
- **Backend:** Express.js (`/backend`)

## Features
- Infinite vertical scroll feed of meme coins
- Live data from Dexscreener, Pump.fun, and Solana RPC
- Coin stats, chart, socials, and buy/sell (Jupiter API)
- 0.5% transaction fee (non-custodial)
- Modular, dark-themed UI

## Getting Started

### 1. Install dependencies
```sh
cd frontend && npm install
cd ../backend && npm install
```

### 2. Set up environment variables
Copy `.env.example` in `/backend` to `.env` and fill in your API keys.

### 3. Run the app
- **Frontend:**
  ```sh
  cd frontend
  npm run dev
  ```
- **Backend:**
  ```sh
  cd backend
  npm run dev
  ```

## Project Structure
- `/frontend` — Vite React app
- `/backend` — Express.js API server
- `.github/copilot-instructions.md` — Copilot workspace instructions

## Customization
- Edit `/frontend/src/components/TokenScroller.jsx` for the scroll UI
- Edit `/backend/server.js` for API logic

---

Replace placeholder assets and API keys as needed.
