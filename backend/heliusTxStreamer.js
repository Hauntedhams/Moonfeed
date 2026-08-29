/**
 * HeliusTxStreamer
 *
 * Maintains ONE persistent logsSubscribe WebSocket per token.
 * Uses public Solana RPC as primary — no API key required.
 * Falls back to Helius if configured via HELIUS_API_KEY env var.
 *
 * Flow:
 *   Frontend WS → backend → Public Solana RPC logsSubscribe WS (one per token)
 *   RPC emits signature → backend batches + parses via getTransaction RPC
 *   Parsed swaps → broadcast to all subscribed frontend clients as `tx-new`
 */

const WebSocket = require('ws');
const axios = require('axios');
const solanaTransactionService = require('./solanaTransactionService');
const { decodeSwapFromLogs } = require('./swapLogDecoder');
const { HELIUS_WS_URL, HELIUS_RPC_URL, PUBLIC_WS_URL, PUBLIC_RPC_URL } = require('./solanaRpcConfig');

// Helius is primary (public mainnet-beta 429s hard and drops logsSubscribe).
const FLUSH_DEBOUNCE_MS = 250;   // Batch signatures for 250ms of inactivity before parsing
const MAX_WAIT_MS = 600;         // Force a flush at least this often during a continuous burst
const MAX_BATCH_SIZE = 20;     // Max signatures per Helius Enhanced API call
const PING_INTERVAL_MS = 30_000; // Send ping every 30s to keep Helius WS alive

class HeliusTxStreamer {
  constructor() {
    // mintAddress -> { ws, subscriptionId, clients: Set<ws>, parseClients: Set<ws>, sigQueue: [], flushTimer }
    this.streams = new Map();
    this.solPriceGetter = null; // set via setSolPriceGetter() to price each swap in USD
    this.referencePriceGetter = null; // set via setReferencePriceGetter() — last known USD price per mint
    this.heliusWsDownUntil = 0; // after a Helius WS 429, prefer public RPC for new streams for a while
  }

  /** Wire up a function returning the current cached SOL/USD price (no extra API calls). */
  setSolPriceGetter(fn) {
    this.solPriceGetter = fn;
  }

  /** Wire up a function (mint) => last known USD price, used to sanity-band unverified log ticks. */
  setReferencePriceGetter(fn) {
    this.referencePriceGetter = fn;
  }

  /**
   * Register a frontend WS client for live tx updates on a token.
   * Opens a Helius WS if this is the first subscriber.
   * opts.ticksOnly: client only wants instant log-decoded price ticks — skips the
   * per-signature getTransaction parsing entirely (zero credits) unless another
   * client on the same mint wants full transactions.
   */
  subscribe(mintAddress, clientWs, opts = {}) {
    let stream = this.streams.get(mintAddress);
    if (!stream) {
      stream = {
        ws: null,
        subscriptionId: null,
        clients: new Set(),
        parseClients: new Set(),
        sigQueue: [],
        retriedSigs: new Map(), // sig -> retry count (processed→confirmed lag)
        flushTimer: null,
        pingInterval: null,
        reconnectAttempts: 0,
        lastTickPriceUsd: 0,
      };
      this.streams.set(mintAddress, stream);
      // If Helius WS recently 429'd (credit/connection budget exhausted), start on
      // public RPC immediately instead of burning reconnect backoff per new coin.
      this._openStream(mintAddress, stream, Date.now() < this.heliusWsDownUntil);
    }
    stream.clients.add(clientWs);
    if (!opts.ticksOnly) stream.parseClients.add(clientWs);
    console.log(`[TxStreamer] Client subscribed to ${mintAddress.substring(0, 8)}${opts.ticksOnly ? ' (ticks-only)' : ''}. Total clients: ${stream.clients.size}`);
  }

  /**
   * Remove a frontend WS client from a token's live stream.
   * Closes the Helius WS if no clients remain.
   */
  unsubscribe(mintAddress, clientWs) {
    const stream = this.streams.get(mintAddress);
    if (!stream) return;

    stream.clients.delete(clientWs);
    stream.parseClients.delete(clientWs);
    console.log(`[TxStreamer] Client unsubscribed from ${mintAddress.substring(0, 8)}. Remaining: ${stream.clients.size}`);

    if (stream.clients.size === 0) {
      this._closeStream(mintAddress, stream);
      this.streams.delete(mintAddress);
    }
  }

  /**
   * Remove a client from ALL token streams (called on client disconnect).
   */
  removeClient(clientWs) {
    for (const [mintAddress] of this.streams.entries()) {
      const stream = this.streams.get(mintAddress);
      if (stream && stream.clients.has(clientWs)) {
        this.unsubscribe(mintAddress, clientWs);
      }
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  _openStream(mintAddress, stream, usePublicRpc = false) {
    const wsUrl = usePublicRpc ? PUBLIC_WS_URL : (HELIUS_WS_URL || PUBLIC_WS_URL);
    try {
      const ws = new WebSocket(wsUrl);
      stream.ws = ws;
      stream.usingPublicRpc = usePublicRpc;

      ws.on('open', () => {
        console.log(`[TxStreamer] ${usePublicRpc ? 'Public' : 'Helius'} WS open for ${mintAddress.substring(0, 8)}`);
        stream.reconnectAttempts = 0; // reset backoff on a successful connection
        // 'processed' = ~400ms after the trade lands (vs ~2-3s for 'confirmed').
        // Helius (Dev plan): transactionSubscribe pushes the FULL parsed tx per trade
        // — instant verified tick + table row for every DEX, zero getTransaction calls.
        // Public RPC fallback: standard logsSubscribe (sig queue + batched parse).
        if (usePublicRpc) {
          stream.subMethod = 'logs';
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'logsSubscribe',
            params: [{ mentions: [mintAddress] }, { commitment: 'processed' }],
          }));
        } else {
          stream.subMethod = 'transaction';
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'transactionSubscribe',
            params: [
              { accountInclude: [mintAddress], vote: false, failed: false },
              { commitment: 'processed', encoding: 'jsonParsed', transactionDetails: 'full', showRewards: false, maxSupportedTransactionVersion: 0 },
            ],
          }));
        }

        // Keepalive ping every 30s to prevent idle disconnect
        if (stream.pingInterval) clearInterval(stream.pingInterval);
        stream.pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
          }
        }, PING_INTERVAL_MS);
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          // Subscription confirmation
          if (msg.result && typeof msg.result === 'number') {
            stream.subscriptionId = msg.result;
            return;
          }

          // transactionSubscribe notification — full parsed tx pushed per trade.
          if (msg.params?.result?.transaction) {
            this._handleTxNotification(mintAddress, stream, msg.params.result);
            return;
          }

          // logsSubscribe notification (public RPC fallback) — instant price tick
          // from the logs, then queue the signature for the batched full-tx parse.
          if (msg.params?.result?.value) {
            const { signature, err, logs } = msg.params.result.value;
            if (err || !signature) return; // Skip failed txs

            // ⚡ Instant per-trade price tick — decoded straight from the pushed
            // logs (pump.fun / PumpSwap events). No RPC call, no batching.
            this._broadcastTickFromLogs(mintAddress, stream, logs);

            // Full-tx parsing costs a getTransaction per signature — only do it
            // when someone actually wants the trade table.
            if (stream.parseClients.size === 0) return;

            stream.sigQueue.push(signature);

            // Debounce: flush after a short quiet period, but never let a continuous
            // burst of trades delay the flush past MAX_WAIT_MS.
            if (stream.flushTimer) clearTimeout(stream.flushTimer);
            stream.flushTimer = setTimeout(
              () => this._flushQueue(mintAddress, stream),
              FLUSH_DEBOUNCE_MS
            );
            if (!stream.maxWaitTimer) {
              stream.maxWaitTimer = setTimeout(
                () => this._flushQueue(mintAddress, stream),
                MAX_WAIT_MS
              );
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      ws.on('error', (e) => {
        console.warn(`[TxStreamer] WS error for ${mintAddress.substring(0, 8)} (${usePublicRpc ? 'public' : 'helius'}):`, e.message);
        if (!usePublicRpc && /429/.test(e.message)) {
          this.heliusWsDownUntil = Date.now() + 10 * 60 * 1000;
        }
        // Flip transport on the next reconnect
        stream.usePublicRpcOnReconnect = true;
      });

      ws.on('close', () => {
        console.log(`[TxStreamer] WS closed for ${mintAddress.substring(0, 8)} (${usePublicRpc ? 'public' : 'helius'})`);
        stream.ws = null;
        if (stream.pingInterval) {
          clearInterval(stream.pingInterval);
          stream.pingInterval = null;
        }

        // Reconnect if clients still subscribed. Back off exponentially (capped) so a
        // rate-limited (429) connection doesn't get hammered every few seconds.
        if (this.streams.has(mintAddress) && stream.clients.size > 0) {
          // On error (e.g. Helius 429 when the key's WS budget is exhausted by prod),
          // flip transport: Helius ⇄ public RPC. Clean closes keep the same transport.
          const nextPublic = stream.usePublicRpcOnReconnect ? !usePublicRpc : usePublicRpc;
          stream.usePublicRpcOnReconnect = false;
          const attempt = stream.reconnectAttempts || 0;
          const delay = Math.min(30000, (nextPublic !== usePublicRpc ? 1000 : 3000) * Math.pow(2, attempt));
          stream.reconnectAttempts = attempt + 1;
          console.log(`[TxStreamer] Reconnecting ${mintAddress.substring(0, 8)} in ${delay}ms (${nextPublic ? 'public' : 'Helius'} RPC, attempt ${attempt + 1})...`);
          setTimeout(() => {
            if (this.streams.has(mintAddress) && stream.clients.size > 0) {
              this._openStream(mintAddress, stream, nextPublic);
            }
          }, delay);
        }
      });
    } catch (e) {
      console.error(`[TxStreamer] Failed to open Helius WS:`, e.message);
    }
  }

  async _flushQueue(mintAddress, stream) {
    if (stream.flushTimer) clearTimeout(stream.flushTimer);
    if (stream.maxWaitTimer) clearTimeout(stream.maxWaitTimer);
    stream.flushTimer = null;
    stream.maxWaitTimer = null;
    const sigs = stream.sigQueue.splice(0, MAX_BATCH_SIZE);
    if (!sigs.length || !stream.parseClients.size) return;

    let swaps = [];

    // Strategy 1: Helius RPC getTransaction; on quota exhaustion ("max usage
    // reached" 429s) fall back to the public RPC for the stream's lifetime.
    if (sigs.length > 0) {
      try {
        const rpcUrl = stream.heliusExhausted
          ? PUBLIC_RPC_URL
          : (HELIUS_RPC_URL || PUBLIC_RPC_URL);
        const results = await Promise.allSettled(
          sigs.map(sig =>
            axios.post(rpcUrl, {
              jsonrpc: '2.0', id: 1,
              method: 'getTransaction',
              params: [sig, { maxSupportedTransactionVersion: 0, encoding: 'jsonParsed', commitment: 'confirmed' }],
            }, { timeout: 6000 })
          )
        );
        const dbg = { rejected: 0, nullTx: 0, errTx: 0, noSwap: 0, ok: 0 };
        const requeue = (sig) => {
          const tries = stream.retriedSigs.get(sig) || 0;
          if (tries >= 4) { stream.retriedSigs.delete(sig); return; }
          if (stream.retriedSigs.size > 300) stream.retriedSigs.clear();
          stream.retriedSigs.set(sig, tries + 1);
          stream.sigQueue.push(sig);
          if (!stream.flushTimer) {
            stream.flushTimer = setTimeout(() => this._flushQueue(mintAddress, stream), 1000);
          }
        };
        for (let i = 0; i < results.length; i++) {
          if (results[i].status !== 'fulfilled') {
            dbg.rejected++;
            const status = results[i].reason?.response?.status;
            if (status === 429 && !stream.heliusExhausted && rpcUrl !== PUBLIC_RPC_URL) {
              stream.heliusExhausted = true;
              console.warn(`[TxStreamer] Helius getTransaction quota hit — falling back to public RPC for ${mintAddress.substring(0, 8)}`);
            }
            requeue(sigs[i]); // transient rate limit either way — retry
            continue;
          }
          const tx = results[i].value?.data?.result;
          if (!tx || !tx.meta) {
            dbg.nullTx++;
            // Subscribed at 'processed' — confirmation lags ~2-3s. Retry a few times.
            if (!tx) requeue(sigs[i]);
            continue;
          }
          stream.retriedSigs.delete(sigs[i]);
          if (tx.meta.err) { dbg.errTx++; continue; }
          const swap = solanaTransactionService.extractSwapFromRpc(tx, sigs[i], mintAddress);
          if (swap) { dbg.ok++; swaps.push(swap); } else { dbg.noSwap++; }
        }
        if (!swaps.length) {
          console.log(`[TxStreamer] Flush ${sigs.length} sigs → 0 swaps for ${mintAddress.substring(0, 8)}:`, JSON.stringify(dbg));
        }
      } catch (e) {
        console.warn(`[TxStreamer] RPC flush failed:`, e.message);
      }
    }

    if (!swaps.length) return;

    // Price each swap in USD from its own SOL/token ratio (per-trade price, not
    // a periodic poll) so the frontend can tick the live price on every trade.
    const solPrice = this.solPriceGetter?.();
    if (solPrice > 0) {
      for (const swap of swaps) {
        if (swap.tokenAmount > 0 && swap.solAmount > 0) {
          swap.priceUsd = (swap.solAmount / swap.tokenAmount) * solPrice;
        }
      }
      // Mint-verified prices also (re)seed the sanity reference for log ticks.
      const lastPriced = [...swaps].reverse().find(s => s.priceUsd > 0);
      if (lastPriced) stream.lastTickPriceUsd = lastPriced.priceUsd;
    }

    console.log(`[TxStreamer] Broadcasting ${swaps.length} new swaps for ${mintAddress.substring(0, 8)}`);

    const payload = JSON.stringify({
      type: 'tx-new',
      token: mintAddress,
      transactions: swaps,
    });

    for (const clientWs of stream.parseClients) {
      if (clientWs.readyState === 1 /* OPEN */) {
        clientWs.send(payload, { compress: false });
      }
    }
  }

  /**
   * Helius transactionSubscribe push: full parsed tx per trade at 'processed'.
   * Parses + broadcasts BOTH the instant price tick and the trade-table row
   * immediately — no batching, no getTransaction, works for every DEX.
   */
  _handleTxNotification(mintAddress, stream, result) {
    if (!stream.clients.size) return;
    try {
      const inner = result.transaction; // { transaction, meta, version }
      if (!inner?.meta || inner.meta.err) return;

      const txObj = {
        transaction: inner.transaction,
        meta: inner.meta,
        blockTime: Math.floor(Date.now() / 1000),
      };
      const swap = solanaTransactionService.extractSwapFromRpc(txObj, result.signature, mintAddress);

      const solPrice = this.solPriceGetter?.();

      // Price: prefer the pump.fun curve price from logs (exact, mint-verified),
      // else the parsed swap's own SOL/token ratio (mint-verified via balances).
      let priceUsd = 0;
      let isBuy = swap ? swap.side === 'buy' : undefined;
      try {
        const logTick = decodeSwapFromLogs(inner.meta.logMessages, mintAddress);
        if (logTick?.verified && logTick.priceSol > 0 && solPrice > 0) {
          priceUsd = logTick.priceSol * solPrice;
          if (isBuy === undefined) isBuy = logTick.isBuy;
        }
      } catch { /* log decode is best-effort */ }
      if (!(priceUsd > 0) && swap && swap.tokenAmount > 0 && swap.solAmount > 0 && solPrice > 0) {
        priceUsd = (swap.solAmount / swap.tokenAmount) * solPrice;
      }

      if (priceUsd > 0) {
        stream.lastTickPriceUsd = priceUsd;
        const tickPayload = JSON.stringify({
          type: 'price-update',
          token: mintAddress,
          price: priceUsd,
          timestamp: Date.now(),
          source: 'trade-stream',
          isBuy,
          solAmount: swap?.solAmount,
        });
        for (const clientWs of stream.clients) {
          if (clientWs.readyState === 1) clientWs.send(tickPayload, { compress: false });
        }
      }

      // Trade-table row — pushed instantly, one per trade.
      if (swap && stream.parseClients.size) {
        if (priceUsd > 0) swap.priceUsd = priceUsd;
        const txPayload = JSON.stringify({
          type: 'tx-new',
          token: mintAddress,
          transactions: [swap],
        });
        for (const clientWs of stream.parseClients) {
          if (clientWs.readyState === 1) clientWs.send(txPayload, { compress: false });
        }
      }
    } catch (e) {
      // Never let a malformed push kill the WS handler
    }
  }

  /**
   * Decode a swap price straight from a logsSubscribe push and broadcast it to
   * every client of this mint as a `price-update` — the pump.fun-speed tick path.
   */
  _broadcastTickFromLogs(mintAddress, stream, logs) {
    if (!stream.clients.size) return;
    let tick;
    try {
      tick = decodeSwapFromLogs(logs, mintAddress);
    } catch {
      return;
    }
    if (!tick || !(tick.priceSol > 0)) return;

    const solPrice = this.solPriceGetter?.();
    if (!(solPrice > 0)) return;
    const priceUsd = tick.priceSol * solPrice;

    // Unverified events (PumpSwap has no mint in the event) can belong to a foreign
    // pool leg of a multi-hop route, or a non-canonical pool with different decimals.
    // Only trust them within a band of the last known-good price for this mint.
    if (!tick.verified) {
      let ref = stream.lastTickPriceUsd;
      if (!(ref > 0)) {
        ref = this.referencePriceGetter?.(mintAddress) || 0;
      }
      if (!(ref > 0) || priceUsd > ref * 5 || priceUsd < ref / 5) return;
    }

    stream.lastTickPriceUsd = priceUsd;

    const payload = JSON.stringify({
      type: 'price-update',
      token: mintAddress,
      price: priceUsd,
      timestamp: Date.now(),
      source: `trade-${tick.source}`,
      isBuy: tick.isBuy,
      solAmount: tick.solAmount,
    });

    for (const clientWs of stream.clients) {
      if (clientWs.readyState === 1 /* OPEN */) {
        clientWs.send(payload, { compress: false });
      }
    }
  }

  _closeStream(mintAddress, stream) {
    if (stream.flushTimer) {
      clearTimeout(stream.flushTimer);
      stream.flushTimer = null;
    }
    if (stream.maxWaitTimer) {
      clearTimeout(stream.maxWaitTimer);
      stream.maxWaitTimer = null;
    }
    if (stream.pingInterval) {
      clearInterval(stream.pingInterval);
      stream.pingInterval = null;
    }
    if (!stream.ws) return;
    try {
      if (stream.subscriptionId !== null && stream.ws.readyState === WebSocket.OPEN) {
        stream.ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: stream.subMethod === 'transaction' ? 'transactionUnsubscribe' : 'logsUnsubscribe',
          params: [stream.subscriptionId],
        }));
      }
      stream.ws.close();
    } catch (e) {
      // Ignore close errors
    }
    stream.ws = null;
    console.log(`[TxStreamer] Closed Helius WS for ${mintAddress.substring(0, 8)}`);
  }
}

module.exports = new HeliusTxStreamer();
