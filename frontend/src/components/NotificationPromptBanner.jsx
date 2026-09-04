import React, { useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { initTradeNotifications, hasNotificationPermission } from '../utils/tradeNotifications';
import { initRemotePush } from '../utils/pushNotifications';
import './NotificationPromptBanner.css';

// Reminds the user that order fills can currently only be delivered via push
// notification, with a one-tap button to request permission.
export default function NotificationPromptBanner({ compact = false }) {
  const { walletAddress } = useWallet();
  const [enabled, setEnabled] = useState(true); // assume granted until checked, avoids flash
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hasNotificationPermission().then((granted) => {
      if (!cancelled) setEnabled(granted);
    });
    return () => { cancelled = true; };
  }, []);

  if (enabled) return null;

  const handleEnable = async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const granted = await initTradeNotifications();
      initRemotePush(walletAddress).catch(() => {});
      setEnabled(granted);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className={`notify-prompt-banner ${compact ? 'compact' : ''}`}>
      <div className="notify-prompt-content">
        <span className="notify-prompt-icon" role="img" aria-label="bell">🔔</span>
        <span className="notify-prompt-text">
          Right now we can only notify you when an order fills — turn on push notifications
        </span>
        <button
          type="button"
          className="notify-prompt-btn"
          onClick={handleEnable}
          disabled={requesting}
        >
          {requesting ? 'Enabling…' : 'Turn On'}
        </button>
      </div>
    </div>
  );
}
