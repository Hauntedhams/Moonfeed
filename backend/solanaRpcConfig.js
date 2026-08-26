// Centralized Solana RPC endpoints.
//
// Prefer Helius over the public mainnet-beta RPC: the public endpoint heavily
// rate-limits (HTTP 429) and does not reliably support logsSubscribe/account
// WebSockets, which was causing a reconnect storm in the tx streamer + price monitor.
//
// SECURITY: set HELIUS_API_KEY via env in production. The literal fallback below
// mirrors the one already in chartDataService.js so local dev works without a .env;
// it should be rotated and moved to an env var since it is committed to the repo.
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || process.env.HELIUS_KEY || '05a97104-cba1-4284-aed6-e0ad21af8b33';

module.exports = {
  HELIUS_API_KEY,
  HELIUS_RPC_URL: `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
  HELIUS_WS_URL: `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
  PUBLIC_RPC_URL: 'https://api.mainnet-beta.solana.com',
  PUBLIC_WS_URL: 'wss://api.mainnet-beta.solana.com',
};
