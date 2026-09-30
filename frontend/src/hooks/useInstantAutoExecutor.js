// Auto-executes the trading wallet's triggered soft orders while the app is
// open. The backend soft-order monitor stays the alert path for a closed app;
// this hook is what actually SELLS (or buys) when a take-profit / stop-loss
// hits: it watches the trading wallet's active orders (live-price cross) plus
// recently-triggered ones (backend flipped first), signs the swap locally, and
// cancels the surviving TP/SL sibling so a one-sided fill doesn't leave a
// stale trigger behind. Connected-wallet soft orders stay alert-only — we can
// only sign for the device-local trading wallet.
import { useEffect, useRef } from 'react';
import { loadTradingWallet, getPresets } from '../utils/instantTradeWallet';
import { fetchSoftOrders, cancelSoftOrder } from '../utils/softOrders';
import { executeInstantBuy, executeInstantSell } from '../utils/instantTrade';
import { initTradeNotifications, notifyAutoTradeExecuted } from '../utils/tradeNotifications';
import { addNotification } from '../utils/alertStorage';
import { recordOrderSwap } from '../utils/orderSwapLog';

const POLL_INTERVAL_MS = 20000;
// Only auto-execute backend-triggered orders this fresh — anything older is
// history the user already got an alert for (or predates this feature).
const TRIGGERED_MAX_AGE_MS = 15 * 60 * 1000;
const HANDLED_KEY = 'moonfeed_auto_exec_handled_v1';
const HANDLED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readHandled() {
  try {
    const map = JSON.parse(localStorage.getItem(HANDLED_KEY)) || {};
    const cutoff = Date.now() - HANDLED_MAX_AGE_MS;
    for (const id of Object.keys(map)) if (map[id] < cutoff) delete map[id];
    return map;
  } catch (_) {
    return {};
  }
}

function writeHandled(map) {
  try { localStorage.setItem(HANDLED_KEY, JSON.stringify(map)); } catch (_) { /* quota */ }
}

function orderCoin(o) {
  return {
    mintAddress: o.tokenMint,
    address: o.tokenMint,
    symbol: o.tokenSymbol || o.tokenMint.slice(0, 6),
    name: o.tokenName || o.tokenSymbol || '',
    image: o.tokenImage || null,
  };
}

// 'below' sells are stop losses, 'above' sells are take profits.
function orderKind(o) {
  if (o.type === 'buy') return 'buyTarget';
  return o.triggerCondition === 'below' ? 'stopLoss' : 'takeProfit';
}

function priceCrossed(o) {
  const current = Number(o.currentPriceUsd);
  const trigger = Number(o.triggerPriceUsd);
  if (!(current > 0) || !(trigger > 0)) return false;
  return o.triggerCondition === 'below' ? current <= trigger : current >= trigger;
}

export default function useInstantAutoExecutor() {
  const runningRef = useRef(false);

  useEffect(() => {
    initTradeNotifications(); // passive — just syncs the permission flag

    const runOnce = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const wallet = await loadTradingWallet();
        if (!wallet) return;
        if (getPresets().autoExecute === false) return;

        const [actives, past] = await Promise.all([
          fetchSoftOrders(wallet.publicKey, 'active').catch(() => []),
          fetchSoftOrders(wallet.publicKey, 'past').catch(() => []),
        ]);

        const handled = readHandled();
        const now = Date.now();
        const candidates = [];

        // Backend flipped these to 'triggered' (its poll won the race) — catch up.
        for (const o of past) {
          if (o.status !== 'triggered') continue;
          const triggeredAt = o.triggeredAt ? Date.parse(o.triggeredAt) : 0;
          if (!(now - triggeredAt < TRIGGERED_MAX_AGE_MS)) continue;
          if (handled[o.orderId]) continue;
          candidates.push(o);
        }
        // Live-price cross on still-active orders (GET enriches currentPriceUsd).
        for (const o of actives) {
          if (handled[o.orderId] || !priceCrossed(o)) continue;
          candidates.push(o);
        }
        if (!candidates.length) return;

        for (const order of candidates) {
          // Mark handled BEFORE executing — a failed swap must alert, not retry-loop.
          handled[order.orderId] = now;
          writeHandled(handled);

          const coin = orderCoin(order);
          const kind = orderKind(order);
          let result = null;
          let error = null;
          try {
            result = order.type === 'buy'
              ? await executeInstantBuy(coin, { buySol: Number(order.amountSol) || undefined })
              // Sell the whole position: brackets are created per full buy, and a
              // partial-sell ledger across multiple brackets isn't worth the risk
              // of stranding dust below the sellable minimum.
              : await executeInstantSell(coin, 100);
          } catch (err) {
            error = err?.message || 'Swap failed';
          }

          // Housekeeping: clear the executed order if it was still active, and on
          // a successful full sell, cancel every other active sell for this mint
          // (OCO — the position is gone, the sibling trigger is now meaningless).
          const toCancel = actives.filter((a) =>
            a.orderId === order.orderId ||
            (!error && order.type === 'sell' && a.type === 'sell' && a.tokenMint === order.tokenMint)
          );
          for (const stale of toCancel) {
            handled[stale.orderId] = now;
            await cancelSoftOrder(stale.orderId, wallet.publicKey).catch(() => {});
          }
          writeHandled(handled);

          const solAmount = order.type === 'buy' ? result?.solSpent : result?.solReceived;
          recordOrderSwap({
            orderId: order.orderId,
            wallet: wallet.publicKey,
            mint: order.tokenMint,
            symbol: coin.symbol,
            image: coin.image,
            side: order.type,
            kind,
            solAmount: Number(solAmount) || 0,
            priceUsd: Number(order.triggeredPriceUsd || order.currentPriceUsd) || 0,
            signature: result?.signature || null,
            error,
          });
          notifyAutoTradeExecuted({
            mint: order.tokenMint,
            symbol: coin.symbol,
            side: order.type,
            kind,
            solAmount,
            image: coin.image,
            error,
          }).catch(() => {});

          const kindLabel = kind === 'stopLoss' ? 'stop loss' : kind === 'takeProfit' ? 'sell target' : 'buy target';
          addNotification({
            id: `auto-exec-${order.orderId}`,
            target: 'coins',
            mint: order.tokenMint,
            coin: { symbol: coin.symbol, name: coin.name, image: coin.image },
            level: error ? 'crash' : 'gain',
            price: Number(order.triggeredPriceUsd || order.currentPriceUsd) || 0,
            message: error
              ? `${coin.symbol} hit your ${kindLabel} but the auto-${order.type} failed: ${error}`
              : `${coin.symbol} hit your ${kindLabel} — auto-${order.type === 'buy' ? 'bought' : 'sold'} for ${(Number(solAmount) || 0).toFixed(4)} SOL`,
            timestamp: Date.now(),
          });

          window.dispatchEvent(new CustomEvent('moonfeed:auto-trade-executed', {
            detail: { orderId: order.orderId, mint: order.tokenMint, symbol: coin.symbol, side: order.type, kind, solAmount, error },
          }));
        }
      } catch (err) {
        console.warn('[auto-exec] cycle failed:', err?.message);
      } finally {
        runningRef.current = false;
      }
    };

    runOnce();
    const timer = setInterval(runOnce, POLL_INTERVAL_MS);

    // React immediately when a trigger push lands while the app is open, when a
    // new instant buy creates a bracket, or when the app returns to foreground.
    const onPushAction = (e) => { if (e.detail?.type === 'softOrderTriggered') runOnce(); };
    const onVisible = () => { if (document.visibilityState === 'visible') runOnce(); };
    window.addEventListener('moonfeed:push-action', onPushAction);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(timer);
      window.removeEventListener('moonfeed:push-action', onPushAction);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);
}
