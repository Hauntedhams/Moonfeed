// Instant Trade panel — companion to the in-app trading wallet. Opened from
// the ⚡ button on a coin card. Setup (create/import key), fund, presets
// (buy size / slippage / auto-sell), one-tap buy, percentage sells, export,
// withdraw. Sits alongside the existing Jupiter Plugin modal, not replacing it.
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  loadTradingWallet, createTradingWallet, importTradingWallet,
  getPresets, savePresets,
} from '../utils/instantTradeWallet';
import {
  executeInstantBuy, executeInstantSell, getTradingWalletBalances, withdrawSol, withdrawToken, listTradingWalletTokens, SWAP_FEE_OVERHEAD_SOL,
} from '../utils/instantTrade';
import { getSolUsdPrice } from '../utils/orderFillTracking';
import './InstantTradePanel.css';

const BUY_CHIPS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
const SLIPPAGE_CHIPS = [1, 3, 5, 10];
const AUTO_SELL_CHIPS = [0, 25, 50, 100];
const STOP_LOSS_CHIPS = [0, 10, 25, 50];
const SELL_PCTS = [25, 50, 75, 100];
const CUSTOM_SELL_CHIPS = [10, 25, 50, 75];

const shortAddr = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '');
const fmtSol = (n) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
const fmtTokens = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const InstantTradePanel = ({ coin, onClose, connectedWallet, embedded = false }) => {
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [presets, setPresets] = useState(() => getPresets());
  const [buySolInput, setBuySolInput] = useState(() => String(getPresets().buySol));
  const [balances, setBalances] = useState({ sol: 0, tokens: 0 });
  const [busy, setBusy] = useState(null); // 'buy' | 'sell25' | ... | 'withdraw' | 'create'
  const [result, setResult] = useState(null); // { ok, text, signature }
  const [view, setView] = useState('main'); // 'main' | 'import' | 'export' | 'withdraw'
  const [importValue, setImportValue] = useState('');
  const [withdrawDest, setWithdrawDest] = useState(connectedWallet || '');
  const [walletTokens, setWalletTokens] = useState(null); // null = loading, [] = none
  const [copied, setCopied] = useState(false);
  const [solUsd, setSolUsd] = useState(0);
  const [secretVisible, setSecretVisible] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);

  const mint = coin?.mintAddress || coin?.address;

  useEffect(() => { getSolUsdPrice().then(setSolUsd).catch(() => {}); }, []);

  useEffect(() => {
    if (view !== 'export') {
      setSecretVisible(false);
      setConfirmReveal(false);
    }
  }, [view]);

  useEffect(() => {
    const hideSecret = () => {
      if (document.hidden) {
        setSecretVisible(false);
        setConfirmReveal(false);
      }
    };
    document.addEventListener('visibilitychange', hideSecret);
    return () => document.removeEventListener('visibilitychange', hideSecret);
  }, []);

  const refreshBalances = useCallback(async () => {
    try {
      setBalances(await getTradingWalletBalances(mint));
    } catch { /* transient */ }
  }, [mint]);

  useEffect(() => {
    let alive = true;
    loadTradingWallet().then((w) => {
      if (!alive) return;
      setWallet(w);
      setWalletLoading(false);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (wallet) refreshBalances();
  }, [wallet, refreshBalances]);

  // The withdraw view lists every coin in the wallet (not just the open card's).
  const loadWalletTokens = useCallback(async () => {
    setWalletTokens(null);
    try {
      const tokens = await listTradingWalletTokens();
      let withSymbols = tokens;
      if (tokens.length) {
        try {
          const mints = tokens.map((t) => t.mint).slice(0, 30).join(',');
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints}`);
          const data = res.ok ? await res.json() : null;
          const symbolByMint = new Map();
          (data?.pairs || []).forEach((p) => {
            if (p.baseToken?.address && !symbolByMint.has(p.baseToken.address)) {
              symbolByMint.set(p.baseToken.address, p.baseToken.symbol);
            }
          });
          withSymbols = tokens.map((t) => ({ ...t, symbol: symbolByMint.get(t.mint) || null }));
        } catch { /* symbols are cosmetic */ }
      }
      setWalletTokens(withSymbols);
    } catch {
      setWalletTokens([]);
    }
  }, []);

  useEffect(() => {
    if (view === 'withdraw' && wallet) loadWalletTokens();
  }, [view, wallet, loadWalletTokens]);

  const updatePresets = (partial) => setPresets(savePresets(partial));

  const commitBuySol = () => {
    const v = parseFloat(buySolInput);
    if (Number.isFinite(v) && v > 0) updatePresets({ buySol: Math.min(100, v) });
    else setBuySolInput(String(presets.buySol));
  };

  const runAction = async (key, fn, okText) => {
    if (busy) return;
    setBusy(key);
    setResult(null);
    try {
      const out = await fn();
      setResult({ ok: true, text: okText(out), signature: out?.signature });
      refreshBalances();
    } catch (err) {
      setResult({ ok: false, text: err?.message || 'Something went wrong' });
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = () => runAction('create', async () => {
    const w = await createTradingWallet();
    setWallet(w);
    return w;
  }, () => 'Trading wallet created — deposit SOL to start');

  const handleImport = () => runAction('import', async () => {
    const w = await importTradingWallet(importValue);
    setWallet(w);
    setImportValue('');
    setView('main');
    return w;
  }, (w) => `Imported ${shortAddr(w.publicKey)}`);

  const handleBuy = () => runAction('buy', () => executeInstantBuy(coin), (out) => {
    const alerts = [
      out.autoSellOrder && `+${presets.autoSellPct}%`,
      out.stopLossOrder && `−${presets.stopLossPct}%`,
    ].filter(Boolean);
    return `Bought ${fmtTokens(out.tokensReceived)} ${coin?.symbol} for ${fmtSol(out.solSpent)} SOL${alerts.length ? ` — sell targets at ${alerts.join(' / ')}` : ''}`;
  });

  const handleSell = (pct) => runAction(`sell${pct}`, () => executeInstantSell(coin, pct),
    (out) => `Sold ${fmtTokens(out.tokensSold)} ${coin?.symbol} for ${fmtSol(out.solReceived)} SOL`);

  const handleWithdraw = () => runAction('withdraw', () => withdrawSol(withdrawDest),
    (out) => `Withdrew ${fmtSol(out.solWithdrawn)} SOL`);

  const handleWithdrawToken = (token) => runAction(`wtoken-${token.mint}`, async () => {
    const out = await withdrawToken(token.mint, withdrawDest);
    loadWalletTokens();
    refreshBalances();
    return out;
  }, (out) => `Sent ${fmtTokens(out.amount)} ${token.symbol || 'tokens'}`);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(wallet.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  };

  const canBuy = wallet && balances.sol >= Number(presets.buySol) + SWAP_FEE_OVERHEAD_SOL && !busy;

  const content = (
    <div className={embedded ? 'itp-embedded-host' : 'itp-backdrop'} onClick={embedded ? undefined : onClose}>
      <div className={`itp-sheet${embedded ? ' itp-sheet--embedded' : ''}`} onClick={(e) => e.stopPropagation()}>
        {!embedded && <div className="itp-handle" />}
        <header className="itp-header">
          <span className="itp-title">
            <svg className="itp-bolt" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" />
            </svg>
            Instant Trade
          </span>
          {!embedded && <button type="button" className="itp-close" onClick={onClose} aria-label="Close">×</button>}
        </header>

        {walletLoading ? (
          <div className="itp-empty">Loading…</div>
        ) : !wallet ? (
          view === 'import' ? (
            <div className="itp-setup">
              <p className="itp-copy">Paste a base58 secret key (Phantom/Solflare export format).</p>
              <textarea
                className="itp-import-input"
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                placeholder="Secret key"
                rows={3}
                autoCorrect="off" autoCapitalize="off" spellCheck={false}
              />
              <button type="button" className="itp-btn itp-btn--primary" disabled={!importValue.trim() || busy} onClick={handleImport}>
                {busy === 'import' ? 'Importing…' : 'Import wallet'}
              </button>
              <button type="button" className="itp-btn itp-btn--ghost" onClick={() => setView('main')}>Back</button>
            </div>
          ) : (
            <div className="itp-setup">
              <p className="itp-copy">
                A dedicated trading wallet lives on this device and signs trades instantly —
                no wallet popups. Deposit a small amount of SOL, set your buy size, and
                one tap buys in.
              </p>
              <button type="button" className="itp-btn itp-btn--primary" disabled={busy === 'create'} onClick={handleCreate}>
                {busy === 'create' ? 'Creating…' : 'Create trading wallet'}
              </button>
              <button type="button" className="itp-btn itp-btn--ghost" onClick={() => setView('import')}>Import existing key</button>
              <p className="itp-fineprint">The key never leaves your device. Back it up after creating it — losing the device without a backup loses the funds.</p>
            </div>
          )
        ) : view === 'export' ? (
          <div className="itp-setup">
            <p className="itp-copy itp-copy--warn">Anyone with this key controls the wallet's funds. Never share it or paste it into websites.</p>
            <div className="itp-secret-row">
              <div className={`itp-secret${secretVisible ? '' : ' itp-secret--hidden'}`}>
                {secretVisible ? wallet.secretKey : 'Key hidden'}
              </div>
              <button type="button" className="itp-btn itp-btn--ghost" onClick={() => navigator.clipboard.writeText(wallet.secretKey).catch(() => {})} title="Copy secret key to clipboard">
                Copy
              </button>
            </div>
            {confirmReveal ? (
              <div className="itp-reveal-confirm">
                <p className="itp-copy itp-copy--warn">Are you sure you want to reveal your secret key? Anyone watching your screen can take your funds.</p>
                <div className="itp-reveal-actions">
                  <button type="button" className="itp-btn itp-btn--ghost" onClick={() => setConfirmReveal(false)}>Cancel</button>
                  <button type="button" className="itp-btn itp-btn--danger" onClick={() => { setSecretVisible(true); setConfirmReveal(false); }}>Reveal key</button>
                </div>
              </div>
            ) : (
              <button type="button" className="itp-btn itp-btn--ghost" onClick={() => { setSecretVisible(false); setConfirmReveal(!secretVisible); }}>
                {secretVisible ? 'Hide key' : 'Reveal key'}
              </button>
            )}
            <button type="button" className="itp-btn itp-btn--ghost" onClick={() => setView('main')}>Done</button>
          </div>
        ) : view === 'withdraw' ? (
          <div className="itp-setup">
            <p className="itp-copy">Withdraw from the trading wallet to:</p>
            <input
              className="itp-import-input itp-import-input--single"
              value={withdrawDest}
              onChange={(e) => setWithdrawDest(e.target.value)}
              placeholder="Destination wallet address"
              autoCorrect="off" autoCapitalize="off" spellCheck={false}
            />
            <button type="button" className="itp-btn itp-btn--primary" disabled={!withdrawDest.trim() || busy} onClick={handleWithdraw}>
              {busy === 'withdraw' ? 'Withdrawing…' : `Withdraw ${fmtSol(balances.sol)} SOL`}
            </button>
            {walletTokens === null ? (
              <p className="itp-copy itp-withdraw-tokens-hint">Checking for coins in this wallet…</p>
            ) : walletTokens.length > 0 ? (
              <>
                <p className="itp-copy itp-withdraw-tokens-hint">Coins in this wallet:</p>
                {walletTokens.map((token) => (
                  <div className="itp-withdraw-token-row" key={token.mint}>
                    <span className="itp-withdraw-token-info">
                      <span className="itp-withdraw-token-symbol">{token.symbol || `${token.mint.slice(0, 4)}…${token.mint.slice(-4)}`}</span>
                      <span className="itp-withdraw-token-amount">{fmtTokens(token.amount)}</span>
                    </span>
                    <button
                      type="button"
                      className="itp-btn itp-btn--ghost itp-withdraw-token-btn"
                      disabled={!withdrawDest.trim() || !!busy}
                      onClick={() => handleWithdrawToken(token)}
                    >
                      {busy === `wtoken-${token.mint}` ? 'Sending…' : 'Withdraw'}
                    </button>
                  </div>
                ))}
              </>
            ) : null}
            {result && view === 'withdraw' && (
              <div className={`itp-result ${result.ok ? 'itp-result--ok' : 'itp-result--err'}`}>
                {result.text}
                {result.signature && (
                  <a href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noopener noreferrer"> View tx ↗</a>
                )}
              </div>
            )}
            <button type="button" className="itp-btn itp-btn--ghost" onClick={() => setView('main')}>Back</button>
          </div>
        ) : (
          <>
            <div className="itp-wallet-row">
              <button type="button" className="itp-address" onClick={copyAddress} title="Copy deposit address">
                {shortAddr(wallet.publicKey)} {copied ? '✓' : '⧉'}
              </button>
              <span className="itp-balance">{fmtSol(balances.sol)} SOL</span>
            </div>
            {balances.sol < 0.01 && (
              <p className="itp-fund-hint">Send SOL to the address above from any wallet to fund instant trades.</p>
            )}

            <button type="button" className="itp-buy-btn" disabled={!canBuy} onClick={handleBuy}>
              {busy === 'buy'
                ? 'Buying…'
                : `Buy ${presets.buySol} SOL of ${coin?.symbol || 'this coin'}`}
            </button>

            <div className="itp-sell-row">
              <span className="itp-sell-label">
                Sell {balances.tokens > 0 ? `(${fmtTokens(balances.tokens)} ${coin?.symbol})` : '— no holdings'}
                {(() => {
                  const price = Number(coin?.price_usd) || 0;
                  if (!(balances.tokens > 0 && price > 0)) return null;
                  const usd = balances.tokens * price;
                  const sol = solUsd > 0 ? usd / solUsd : 0;
                  return (
                    <span className="itp-sell-worth">
                      ≈ ${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}{sol > 0 ? ` (${fmtSol(sol)} SOL)` : ''}
                    </span>
                  );
                })()}
              </span>
              <div className="itp-sell-btns">
                {SELL_PCTS.map((pct) => (
                  <button
                    key={pct} type="button" className="itp-chip itp-chip--sell"
                    disabled={!(balances.tokens > 0) || !!busy}
                    onClick={() => handleSell(pct)}
                  >
                    {busy === `sell${pct}` ? '…' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {result && (
              <div className={`itp-result ${result.ok ? 'itp-result--ok' : 'itp-result--err'}`}>
                {result.text}
                {result.signature && (
                  <a href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noopener noreferrer"> View tx ↗</a>
                )}
              </div>
            )}

            <div className="itp-section">
              <div className="itp-preset-row">
                <span className="itp-preset-label">Buy size (SOL)</span>
                <input
                  className="itp-preset-input"
                  inputMode="decimal"
                  value={buySolInput}
                  onChange={(e) => setBuySolInput(e.target.value)}
                  onBlur={commitBuySol}
                />
              </div>
              <div className="itp-chip-row">
                {BUY_CHIPS.map((v) => (
                  <button
                    key={v} type="button"
                    className={`itp-chip ${Number(presets.buySol) === v ? 'active' : ''}`}
                    onClick={() => { updatePresets({ buySol: v }); setBuySolInput(String(v)); }}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <div className="itp-preset-row">
                <span className="itp-preset-label">Max slippage</span>
                <div className="itp-chip-row itp-chip-row--inline">
                  {SLIPPAGE_CHIPS.map((v) => (
                    <button
                      key={v} type="button"
                      className={`itp-chip ${Number(presets.slippagePct) === v ? 'active' : ''}`}
                      onClick={() => updatePresets({ slippagePct: v })}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="itp-preset-row">
                <span className="itp-preset-label" title="After each instant buy, a take-profit target is set at this gain — auto-sold while the app is open, alert when closed">Auto sell-at</span>
                <div className="itp-chip-row itp-chip-row--inline">
                  {AUTO_SELL_CHIPS.map((v) => (
                    <button
                      key={v} type="button"
                      className={`itp-chip ${Number(presets.autoSellPct) === v ? 'active' : ''}`}
                      onClick={() => updatePresets({ autoSellPct: v })}
                    >
                      {v === 0 ? 'Off' : `+${v}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="itp-preset-row">
                <span className="itp-preset-label" title="After each instant buy, a stop-loss target is set at this loss — auto-sold while the app is open, alert when closed">Stop loss</span>
                <div className="itp-chip-row itp-chip-row--inline">
                  {STOP_LOSS_CHIPS.map((v) => (
                    <button
                      key={v} type="button"
                      className={`itp-chip ${Number(presets.stopLossPct) === v ? 'active' : ''}`}
                      onClick={() => updatePresets({ stopLossPct: v })}
                    >
                      {v === 0 ? 'Off' : `−${v}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="itp-preset-row itp-toggle-row">
                <span className="itp-preset-label">
                  Custom sell amount
                  <span className="itp-preset-sub">The coin card's Sell button sells this much of the position (off = 100%)</span>
                </span>
                <button
                  type="button"
                  className={`itp-toggle ${Number(presets.sellPct) > 0 && Number(presets.sellPct) < 100 ? 'on' : ''}`}
                  role="switch"
                  aria-checked={Number(presets.sellPct) > 0 && Number(presets.sellPct) < 100}
                  aria-label="Custom instant-sell amount"
                  onClick={() => updatePresets({ sellPct: Number(presets.sellPct) < 100 && Number(presets.sellPct) > 0 ? 100 : 50 })}
                >
                  <span className="itp-toggle-knob" />
                </button>
              </div>
              {Number(presets.sellPct) > 0 && Number(presets.sellPct) < 100 && (
                <div className="itp-chip-row">
                  {CUSTOM_SELL_CHIPS.map((v) => (
                    <button
                      key={v} type="button"
                      className={`itp-chip ${Number(presets.sellPct) === v ? 'active' : ''}`}
                      onClick={() => updatePresets({ sellPct: v })}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              )}

              <div className="itp-preset-row itp-toggle-row">
                <span className="itp-preset-label">
                  Auto-execute targets
                  <span className="itp-preset-sub">While the app is open, a hit target sells the position automatically; closed app sends an alert instead</span>
                </span>
                <button
                  type="button"
                  className={`itp-toggle ${presets.autoExecute !== false ? 'on' : ''}`}
                  onClick={() => updatePresets({ autoExecute: presets.autoExecute === false })}
                  aria-pressed={presets.autoExecute !== false}
                >
                  <span className="itp-toggle-knob" />
                </button>
              </div>

              <div className="itp-preset-row itp-toggle-row">
                <span className="itp-preset-label">
                  One-tap mode
                  <span className="itp-preset-sub">Bolt button on a coin buys instantly, no panel</span>
                </span>
                <button
                  type="button"
                  className={`itp-toggle ${presets.enabled ? 'on' : ''}`}
                  onClick={() => updatePresets({ enabled: !presets.enabled })}
                  aria-pressed={presets.enabled}
                >
                  <span className="itp-toggle-knob" />
                </button>
              </div>
            </div>

            <div className="itp-footer-actions">
              <button type="button" className="itp-link" onClick={() => setView('export')}>Export key</button>
              <button type="button" className="itp-link" onClick={() => { setWithdrawDest(connectedWallet || ''); setView('withdraw'); }}>Withdraw</button>
              <button type="button" className="itp-link" onClick={refreshBalances}>Refresh</button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return embedded ? content : createPortal(content, document.body);
};

export default InstantTradePanel;
