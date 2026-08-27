// Background poller: watches the connected wallet's limit-order history and fires a
// local push notification the moment an order fills, regardless of which screen is open.
import { useEffect, useRef } from 'react';
import { useWallet } from '@jup-ag/wallet-adapter';
import { getFullApiUrl } from '../config/api';
import { getTransactions } from '../utils/transactionStorage';
import { initTradeNotifications } from '../utils/tradeNotifications';
import { checkAndNotifyFilledOrders } from '../utils/orderFillTracking';

const POLL_INTERVAL_MS = 45000;

export default function useOrderFillNotifications() {
  const { publicKey, connected } = useWallet();
  const pollRef = useRef(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      clearInterval(pollRef.current);
      return;
    }

    const walletAddress = publicKey.toString();
    initTradeNotifications();

    const poll = async () => {
      try {
        const url = getFullApiUrl(`/api/trigger/orders?wallet=${walletAddress}&status=history&limit=10`);
        const res = await fetch(url);
        if (!res.ok) return;
        const result = await res.json();
        if (!result.success || !result.orders?.length) return;

        const transactions = getTransactions(walletAddress);
        await checkAndNotifyFilledOrders(walletAddress, result.orders, transactions);
      } catch (_) {
        // silent — this is a best-effort background check
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [connected, publicKey]);
}
