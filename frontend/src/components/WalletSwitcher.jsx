// Instagram-style wallet switcher: pill showing the active viewing wallet,
// tap to flip between the connected wallet and the ⚡ trading wallet.
import React, { useState, useRef, useEffect } from 'react';
import './WalletSwitcher.css';

const shortAddr = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '');

const BoltIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" />
  </svg>
);

const WalletIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M16 12.5h2.5" strokeLinecap="round" />
    <path d="M3 9h18" />
  </svg>
);

const WalletSwitcher = ({ mode, onChange, mainAddress, instantAddress }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open]);

  if (!instantAddress) return null; // nothing to switch until a trading wallet exists

  const viewingInstant = mode === 'instant';
  const options = [
    { id: 'main', label: 'Main wallet', address: mainAddress, Icon: WalletIcon, disabled: !mainAddress },
    { id: 'instant', label: 'Trading wallet', address: instantAddress, Icon: BoltIcon },
  ];

  return (
    <div className="wallet-switcher" ref={rootRef}>
      <button type="button" className="wallet-switcher-pill" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={`wallet-switcher-icon${viewingInstant ? ' bolt' : ''}`}>
          {viewingInstant ? <BoltIcon /> : <WalletIcon />}
        </span>
        <span className="wallet-switcher-label">
          {viewingInstant ? 'Trading wallet' : 'Main wallet'}
          <span className="wallet-switcher-addr">{shortAddr(viewingInstant ? instantAddress : mainAddress)}</span>
        </span>
        <svg className={`wallet-switcher-chevron${open ? ' open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="wallet-switcher-menu" role="menu">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="menuitemradio"
              aria-checked={mode === opt.id}
              className={`wallet-switcher-item${mode === opt.id ? ' active' : ''}`}
              disabled={opt.disabled}
              onClick={() => { onChange(opt.id); setOpen(false); }}
            >
              <span className={`wallet-switcher-icon${opt.id === 'instant' ? ' bolt' : ''}`}><opt.Icon /></span>
              <span className="wallet-switcher-item-text">
                {opt.label}
                <span className="wallet-switcher-addr">{opt.disabled ? 'Not connected' : shortAddr(opt.address)}</span>
              </span>
              {mode === opt.id && <span className="wallet-switcher-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default WalletSwitcher;
