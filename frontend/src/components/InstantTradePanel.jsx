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
  executeInstantBuy, executeInstantSell, getTradingWalletBalances, getTradingLimits, withdrawSol, withdrawToken, listTradingWalletTokens, SWAP_FEE_OVERHEAD_SOL,
} from '../utils/instantTrade';
import { getSolUsdPrice } from '../utils/orderFillTracking';
import { getCloudExecStatus, enrollCloudExecution, disenrollCloudExecution, syncCloudExecSettings } from '../utils/cloudExecution';
import InfoTip from './InfoTip';
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
  const [limits, setLimits] = useState(null); // { buyOverheadSol, sellOverheadSol, maxBuySol, exact }
  const [busy, setBusy] = useState(null); // 'buy' | 'sell25' | ... | 'withdraw' | 'create'
  const [result, setResult] = useState(null); // { ok, text, signature }
  const [view, setView] = useState('main'); // 'main' | 'import' | 'export' | 'withdraw'
  const [importValue, setImportValue] = useState('');
  const [withdrawDest, setWithdrawDest] = useState(connectedWallet || '');
  const [withdrawAmount, setWithdrawAmount] = useState(''); // '' = sweep everything
  const [walletTokens, setWalletTokens] = useState(null); // null = loading, [] = none
  const [copied, setCopied] = useState(false);
  const [solUsd, setSolUsd] = useState(0);
  const [secretVisible, setSecretVisible] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [cloud, setCloud] = useState(null); // null = loading; { configured, enrolled, ... }
  const [confirmCloud, setConfirmCloud] = useState(false);

  const mint = coin?.mintAddress || coin?.address;

  useEffect(() => { getSolUsdPrice().then(setSolUsd).catch(() => {}); }, []);

  useEffect(() => {
    // A failed withdraw must not linger under the Buy button (and vice versa).
    setResult(null);
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
      const [b, l] = await Promise.all([getTradingWalletBalances(mint), getTradingLimits(mint)]);
      setBalances(b);
      setLimits(l);
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

  useEffect(() => {
    if (!wallet) return undefined;
    let alive = true;
    getCloudExecStatus().then((s) => { if (alive) setCloud(s); }).catch(() => { if (alive) setCloud({ configured: false, enrolled: false }); });
    const onChange = (e) => { if (alive && e.detail) setCloud(e.detail); };
    window.addEventListener('moonfeed:cloud-exec-changed', onChange);
    return () => { alive = false; window.removeEventListener('moonfeed:cloud-exec-changed', onChange); };
  }, [wallet]);

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

  const updatePresets = (partial) => {
    const next = savePresets(partial);
    setPresets(next);
    // Keep the server-side executor on the same slippage the user trades with.
    if (partial.slippagePct != null && cloud?.enrolled) {
      syncCloudExecSettings({ slippagePct: next.slippagePct }).catch(() => {});
    }
  };

  const handleCloudEnable = () => runAction('cloud', async () => {
    const s = await enrollCloudExecution({ slippagePct: presets.slippagePct });
    setCloud(s);
    setConfirmCloud(false);
    return s;
  }, () => 'Cloud execution on — targets now execute even when the app is closed');

  const handleCloudDisable = () => runAction('cloud', async () => {
    const s = await disenrollCloudExecution();
    setCloud(s);
    return s;
  }, () => 'Cloud execution off — the server no longer holds a copy of this key');

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
    if (!out.confirmed) {
      return `Buy submitted — network is slow, confirming… Check the tx link; the wallet balance will update once it lands.`;
    }
    const alerts = [
      out.autoSellOrder && `+${presets.autoSellPct}%`,
      out.stopLossOrder && `−${presets.stopLossPct}%`,
    ].filter(Boolean);
    return `Bought ${fmtTokens(out.tokensReceived)} ${coin?.symbol} for ${fmtSol(out.solSpent)} SOL${alerts.length ? ` — sell targets at ${alerts.join(' / ')}` : ''}`;
  });

  const handleSell = (pct) => runAction(`sell${pct}`, () => executeInstantSell(coin, pct),
    (out) => (out.confirmed
      ? `Sold ${fmtTokens(out.tokensSold)} ${coin?.symbol} for ${fmtSol(out.solReceived)} SOL`
      : 'Sell submitted — network is slow, confirming… Check the tx link.'));

  const handleWithdraw = () => runAction('withdraw', () => withdrawSol(withdrawDest, withdrawAmount.trim() || null),
    (out) => (out.confirmed
      ? `Withdrew ${fmtSol(out.solWithdrawn)} SOL`
      : `Withdraw of ${fmtSol(out.solWithdrawn)} SOL submitted — confirming…`));

  const handleWithdrawToken = (token) => runAction(`wtoken-${token.mint}`, async () => {
    const out = await withdrawToken(token.mint, withdrawDest);
    loadWalletTokens();
    refreshBalances();
    return out;
  }, (out) => (out.confirmed ? `Sent ${fmtTokens(out.amount)} ${token.symbol || 'tokens'}` : `Transfer of ${fmtTokens(out.amount)} ${token.symbol || 'tokens'} submitted — confirming…`));

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(wallet.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  };

  const buyOverheadSol = limits?.buyOverheadSol ?? SWAP_FEE_OVERHEAD_SOL;
  const maxBuySol = limits?.maxBuySol ?? Math.max(0, Math.floor((balances.sol - SWAP_FEE_OVERHEAD_SOL) * 1e4) / 1e4);
  const canBuy = wallet && balances.sol >= Number(presets.buySol) + buyOverheadSol && !busy;
  const buyShortfall = wallet && !busy && Number(presets.buySol) > 0 && balances.sol < Number(presets.buySol) + buyOverheadSol;

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
            <InfoTip title="Your trading wallet">
              <p>This wallet is created on your device. Its private key is stored locally and is not held by Moonfeed's server; trades are signed on this device.</p>
              <p>Back up the key with Export. Anyone with it can control the funds, and losing both the device and backup can mean permanent loss. You can withdraw SOL and tokens to another wallet at any time.</p>
            </InfoTip>
          </span>
          {wallet && (
            <button
              type="button"
              className={`itp-mode-switch${presets.enabled ? ' on' : ''}`}
              role="switch"
              aria-checked={Boolean(presets.enabled)}
              onClick={() => updatePresets({ enabled: !presets.enabled })}
              title={presets.enabled
                ? 'Instant buy mode is ON — Buy / Sell buttons sit above the nav bar on every coin'
                : 'Turn on instant buy mode — one-tap Buy / Sell buttons above the nav bar'}
            >
              <span className="itp-mode-switch-text">
                <span className="itp-mode-switch-label">Instant buy mode</span>
                <span className="itp-mode-switch-state">{presets.enabled ? 'ON' : 'OFF'}</span>
              </span>
              <span className="itp-toggle itp-toggle--lg" aria-hidden="true"><span className="itp-toggle-knob" /></span>
            </button>
          )}
          {!embedded && <button type="button" className="itp-close" onClick={onClose} aria-label="Close">×</button>}
        </header>
        {wallet && presets.enabled && (
          <p className="itp-mode-banner">
            <strong>Instant buy mode is on.</strong> Big Buy {presets.buySol} SOL / Sell buttons appear above the nav bar on every coin — one tap trades immediately, no confirmation.
          </p>
        )}

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
            <div className="itp-preset-row">
              <span className="itp-preset-label">Amount (SOL)</span>
              <input
                className="itp-preset-input"
                inputMode="decimal"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder={`All (${fmtSol(balances.sol)})`}
              />
            </div>
            <p className="itp-copy itp-withdraw-tokens-hint">
              Leave blank to send everything (network fee ~0.000005 SOL comes out of the balance).
              A partial withdraw must leave at least ~{fmtSol(limits?.rentMinSol || 0.001)} SOL behind for rent.
            </p>
            <button type="button" className="itp-btn itp-btn--primary" disabled={!withdrawDest.trim() || busy || !(balances.sol > 0)} onClick={handleWithdraw}>
              {busy === 'withdraw'
                ? 'Withdrawing…'
                : withdrawAmount.trim()
                  ? `Withdraw ${withdrawAmount.trim()} SOL`
                  : `Withdraw all ${fmtSol(balances.sol)} SOL`}
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
            {buyShortfall && (
              <p className="itp-fund-hint">
                {maxBuySol >= 0.001
                  ? `Not enough SOL for ${presets.buySol} — fees and rent need ~${buyOverheadSol.toFixed(4)} SOL on top. Max buy: ${maxBuySol} SOL.`
                  : 'Not enough SOL to cover a buy plus fees — deposit more to trade.'}
              </p>
            )}

            <div className="itp-execution-info">
              <span>Buys and sells execute immediately</span>
              <InfoTip title="Instant buys and sells">
                <p>A buy spends the selected SOL amount from this trading wallet. A sell swaps the selected percentage of your token balance. Both submit a blockchain swap immediately rather than placing a limit order.</p>
                <p>Price impact, slippage, network fees, and the swap route affect the final result. Check the amount and wallet balance before trading; confirmed swaps generally cannot be reversed.</p>
              </InfoTip>
            </div>

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
                <button
                  type="button"
                  className={`itp-chip ${maxBuySol > 0 && Number(presets.buySol) === maxBuySol ? 'active' : ''}`}
                  disabled={!(maxBuySol >= 0.001)}
                  title="Spend everything except fees and rent"
                  onClick={() => { updatePresets({ buySol: maxBuySol }); setBuySolInput(String(maxBuySol)); }}
                >
                  Max
                </button>
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
                  <span className="itp-preset-label-title">
                    Auto-execute targets
                    <InfoTip title="Auto-execute targets">
                      <p>When enabled, Moonfeed checks your trading wallet's targets while the app is open and attempts a swap after a target is crossed.</p>
                      <p>With Cloud execution off, a target that hits while the app is closed is only an alert. Turn on Cloud execution below for 24/7 execution. Swap failure is possible because price and liquidity can move.</p>
                    </InfoTip>
                  </span>
                  <span className="itp-preset-sub">
                    {cloud?.enrolled
                      ? 'Targets execute on the server around the clock — the app does not need to be open'
                      : 'While the app is open, a hit target sells the position automatically; closed app sends an alert instead'}
                  </span>
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

              {cloud?.configured !== false && (
                <div className="itp-preset-row itp-toggle-row">
                  <span className="itp-preset-label">
                    <span className="itp-preset-label-title">
                      Cloud execution (24/7)
                      <InfoTip title="Cloud execution">
                        <p>Turning this on uploads a copy of this trading wallet's private key to Moonfeed's server, encrypted at rest, so the server can sell at your take-profit / stop-loss (or buy at a buy target) even when the app is closed or your phone is off.</p>
                        <p>This makes the trading wallet custodial while enabled: Moonfeed could technically move its funds. Keep only what you actively trade in it. Turn it off at any time — the server deletes its copy immediately. Your manual buys and sells still sign on this device.</p>
                        <p>Execution sells the whole position at your saved slippage, retries once if the price moves, and sends you a notification with the result. Execution can still fail if liquidity vanishes.</p>
                      </InfoTip>
                    </span>
                    <span className="itp-preset-sub">
                      {cloud === null
                        ? 'Checking…'
                        : cloud.enrolled
                          ? `On${cloud.executionCount ? ` · ${cloud.executionCount} executed` : ''}${cloud.failureStreak >= 5 ? ' · paused after repeated failures — toggle off and on to resume' : ''}`
                          : 'Server-side TP/SL even when the app is closed. Makes this wallet custodial while on.'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={`itp-toggle ${cloud?.enrolled ? 'on' : ''}`}
                    disabled={cloud === null || busy === 'cloud'}
                    onClick={() => (cloud?.enrolled ? handleCloudDisable() : setConfirmCloud(true))}
                    aria-pressed={Boolean(cloud?.enrolled)}
                    aria-label="Cloud execution"
                  >
                    <span className="itp-toggle-knob" />
                  </button>
                </div>
              )}
              {confirmCloud && !cloud?.enrolled && (
                <div className="itp-reveal-confirm">
                  <p className="itp-copy itp-copy--warn">
                    Your trading wallet's private key will be sent to and stored (encrypted) on Moonfeed's server so it can trade for you while the app is closed.
                    While this is on, Moonfeed holds a copy of the key. Only keep funds you actively trade in this wallet.
                  </p>
                  <div className="itp-reveal-actions">
                    <button type="button" className="itp-btn itp-btn--ghost" onClick={() => setConfirmCloud(false)}>Cancel</button>
                    <button type="button" className="itp-btn itp-btn--primary" disabled={busy === 'cloud'} onClick={handleCloudEnable}>
                      {busy === 'cloud' ? 'Enabling…' : 'I understand — enable'}
                    </button>
                  </div>
                </div>
              )}

            </div>

            <div className="itp-footer-actions">
              <button type="button" className="itp-link" onClick={() => setView('export')}>Export key</button>
              <button type="button" className="itp-link" onClick={() => { setWithdrawDest(connectedWallet || ''); setWithdrawAmount(''); setView('withdraw'); }}>Withdraw</button>
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
