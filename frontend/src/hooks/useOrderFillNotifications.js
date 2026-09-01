// Background poller: watches the connected wallet's limit-order history and fires a
// local push notification the moment an order fills, regardless of which screen is open.
import { useEffect, useRef } from 'react';
import { useWallet } from '@jup-ag/wallet-adapter';
import { getFullApiUrl } from '../config/api';
import { getTransactions } from '../utils/transactionStorage';
import { initTradeNotifications } from '../utils/tradeNotifications';
import { checkAndNotifyFilledOrders } from '../utils/orderFillTracking';
import { fetchTriggerOrdersV2 } from '../utils/triggerOrdersV2';

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
        const result = res.ok ? await res.json() : null;
        const v1Orders = result?.success ? result.orders || [] : [];

        // V2 fills — only when a JWT is already cached (never prompts the wallet)
        let v2Orders = [];
        try {
          const list = await fetchTriggerOrdersV2({
            walletAddress,
            state: 'past',
            interactive: false,
          });
          if (Array.isArray(list)) v2Orders = list;
        } catch (_) { /* silent */ }

        const allOrders = [...v2Orders, ...v1Orders];
        if (!allOrders.length) return;

        const transactions = getTransactions(walletAddress);
        await checkAndNotifyFilledOrders(walletAddress, allOrders, transactions);
      } catch (_) {
        // silent — this is a best-effort background check
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [connected, publicKey]);
}
