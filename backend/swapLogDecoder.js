/**
 * swapLogDecoder
 *
 * Decodes per-trade prices DIRECTLY from the raw program logs that arrive in a
 * logsSubscribe notification — no getTransaction round trip, no extra credits.
 * This is what makes the chart tick within ~0.5s of every buy/sell (pump.fun-style).
 *
 * Supported programs:
 *  - pump.fun bonding curve (6EF8rre…): anchor `TradeEvent` — carries the mint,
 *    trade amounts AND post-trade virtual reserves → exact price, mint-verified.
 *  - PumpSwap AMM (pAMMBay6…): anchor `BuyEvent`/`SellEvent` — carries post-trade
 *    pool reserves (base=token 6dp, quote=WSOL 9dp on canonical pools) but NOT the
 *    mint, so callers must sanity-band the price against a known reference.
 */

const { PublicKey } = require('@solana/web3.js');

// Anchor event discriminators = sha256("event:<Name>")[0..8]
const DISC_PUMP_TRADE = Buffer.from([189, 219, 127, 211, 78, 230, 97, 238]); // pump TradeEvent
const DISC_AMM_BUY = Buffer.from([103, 244, 82, 31, 44, 245, 119, 119]);     // pump_amm BuyEvent
const DISC_AMM_SELL = Buffer.from([62, 47, 55, 10, 165, 3, 220, 42]);        // pump_amm SellEvent

const PROGRAM_DATA_PREFIX = 'Program data: ';

// mint (base58) -> 32-byte buffer, cached
const mintBufCache = new Map();
function mintToBuffer(mintAddress) {
  let buf = mintBufCache.get(mintAddress);
  if (!buf) {
    try {
      buf = new PublicKey(mintAddress).toBuffer();
    } catch {
      return null;
    }
    if (mintBufCache.size > 500) mintBufCache.clear();
    mintBufCache.set(mintAddress, buf);
  }
  return buf;
}

function u64(buf, off) {
  return Number(buf.readBigUInt64LE(off));
}

/**
 * Scan a notification's log lines for swap events involving `mintAddress`.
 * Returns the LAST decodable swap (post-trade price = most recent state) or null.
 *
 * Result: { priceSol, isBuy, solAmount, tokenAmount, source, verified }
 *  - verified=true  → the event itself named our mint (pump.fun TradeEvent)
 *  - verified=false → pool-level event without a mint (PumpSwap); caller must
 *    sanity-check priceSol against a reference before trusting it.
 */
function decodeSwapFromLogs(logs, mintAddress) {
  if (!Array.isArray(logs) || logs.length === 0) return null;
  const mintBuf = mintToBuffer(mintAddress);
  if (!mintBuf) return null;

  let result = null;

  for (const line of logs) {
    if (typeof line !== 'string' || !line.startsWith(PROGRAM_DATA_PREFIX)) continue;
    let buf;
    try {
      buf = Buffer.from(line.slice(PROGRAM_DATA_PREFIX.length), 'base64');
    } catch {
      continue;
    }
    if (buf.length < 8) continue;
    const disc = buf.subarray(0, 8);
    const ev = buf.subarray(8);

    // pump.fun bonding curve TradeEvent:
    // mint(32) solAmount(u64) tokenAmount(u64) isBuy(1) user(32) timestamp(i64)
    // virtualSolReserves(u64)@89 virtualTokenReserves(u64)@97 [+ trailing fields]
    if (disc.equals(DISC_PUMP_TRADE) && ev.length >= 105) {
      if (!ev.subarray(0, 32).equals(mintBuf)) continue; // trade for a different mint (multi-hop route)
      const vSol = u64(ev, 89) / 1e9;
      const vTok = u64(ev, 97) / 1e6; // pump.fun tokens are always 6 decimals
      if (!(vSol > 0) || !(vTok > 0)) continue;
      result = {
        priceSol: vSol / vTok,
        isBuy: ev[48] === 1,
        solAmount: u64(ev, 32) / 1e9,
        tokenAmount: u64(ev, 40) / 1e6,
        source: 'pumpfun',
        verified: true,
      };
      continue;
    }

    // PumpSwap BuyEvent/SellEvent — identical reserve layout:
    // timestamp(i64) arg1(u64) arg2(u64) userBase(u64) userQuote(u64)
    // poolBaseReserves(u64)@40 poolQuoteReserves(u64)@48 quoteAmount(u64)@56 …
    const isAmmBuy = disc.equals(DISC_AMM_BUY);
    const isAmmSell = !isAmmBuy && disc.equals(DISC_AMM_SELL);
    if ((isAmmBuy || isAmmSell) && ev.length >= 64) {
      const poolBase = u64(ev, 40) / 1e6;  // token side (canonical pump pools: 6 dp)
      const poolQuote = u64(ev, 48) / 1e9; // WSOL side
      if (!(poolBase > 0) || !(poolQuote > 0)) continue;
      // Don't overwrite a verified pump.fun result with an unverified pool event
      if (result?.verified) continue;
      result = {
        priceSol: poolQuote / poolBase,
        isBuy: isAmmBuy,
        solAmount: u64(ev, 56) / 1e9,
        tokenAmount: (isAmmBuy ? u64(ev, 8) : u64(ev, 8)) / 1e6, // base_amount_out / base_amount_in
        source: 'pumpswap',
        verified: false,
      };
    }
  }

  return result;
}

module.exports = { decodeSwapFromLogs };
