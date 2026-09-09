import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getFullApiUrl } from '../config/api';
import './XTrackerPanel.css';

const timeAgo = (ts) => {
  if (!ts) return '';
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
};

const formatMc = (mc) => {
  if (!mc) return '';
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(1)}M`;
  if (mc >= 1e3) return `$${(mc / 1e3).toFixed(0)}K`;
  return `$${Math.round(mc)}`;
};

const XTrackerPanel = ({ onClose }) => {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [showMomentumInfo, setShowMomentumInfo] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const bodyRef = useRef(null);
  const touchStartY = useRef(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(getFullApiUrl('/api/x-trends'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setState({ loading: false, error: null, data: json });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTouchStart = (e) => {
    if (e.target.closest('button') || bodyRef.current?.scrollTop > 0) return;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (touchStartY.current === null) return;
    const offset = e.touches[0].clientY - touchStartY.current;
    if (offset <= 0) return;
    e.preventDefault();
    setIsDragging(true);
    setDragOffset(Math.min(offset, 240));
  };

  const handleTouchEnd = () => {
    if (touchStartY.current === null) return;
    const shouldClose = dragOffset > 110;
    touchStartY.current = null;
    setIsDragging(false);
    setDragOffset(0);
    if (shouldClose) onClose();
  };

  const openCoin = (coin) => {
    onClose();
    window.dispatchEvent(new CustomEvent('moonfeed:open-coin', {
      detail: {
        mintAddress: coin.mintAddress,
        tokenAddress: coin.mintAddress,
        address: coin.mintAddress,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.image,
        banner: coin.banner,
        pairAddress: coin.pairAddress,
        price_usd: coin.price_usd,
        market_cap_usd: coin.market_cap_usd,
      },
    }));
  };

  const { data } = state;
  const trends = data?.trends || [];

  return createPortal(
    <div className="menu-panel-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className={`menu-panel xtracker-panel ${isDragging ? 'xtracker-panel--dragging' : ''}`}
        style={dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div className="menu-panel-header">
          <h3 className="menu-panel-title xtracker-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            X Tracker
          </h3>
          <div className="xtracker-header-actions">
            {data?.updatedAt > 0 && (
              <span className="xtracker-updated">{timeAgo(data.updatedAt)}</span>
            )}
            <button
              className="xtracker-refresh-btn"
              onClick={load}
              disabled={state.loading}
              aria-label="Refresh trends"
              title="Refresh"
            >
              ⟳
            </button>
            <button className="menu-panel-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div ref={bodyRef} className="menu-panel-body xtracker-body">
          <p className="xtracker-intro">
            What's trending on X right now — and the coins riding each wave.
          </p>

          {state.loading && !trends.length && (
            <div className="xtracker-status" role="status" aria-live="polite">
              <span className="xtracker-loader" aria-hidden="true">
                <span className="xtracker-loader-ring" />
                <span className="xtracker-loader-scan" />
                <span className="xtracker-loader-mark">X</span>
              </span>
              Scanning X for trending events…
            </div>
          )}

          {!state.loading && data && data.enabled === false && (
            <div className="xtracker-status">
              X tracking isn't configured on the server yet.
            </div>
          )}

          {!state.loading && (state.error || (data?.enabled && !trends.length)) && (
            <div className="xtracker-status">
              Couldn't load trends right now.
              <button className="xtracker-retry-btn" onClick={load}>Try again</button>
            </div>
          )}

          {trends.map((trend) => (
            <article key={trend.id || trend.topic} className="xtracker-card">
              <div className="xtracker-card-top">
                <div className="xtracker-card-labels">
                  {trend.alertWorthy && <span className="xtracker-breaking">Breaking</span>}
                  <span className="xtracker-category">{trend.category}</span>
                </div>
                <button
                  type="button"
                  className="xtracker-momentum"
                  onClick={() => setShowMomentumInfo(true)}
                  aria-label="What does the momentum score mean?"
                >
                  <span className="xtracker-momentum-track">
                    <span
                      className="xtracker-momentum-fill"
                      style={{ width: `${trend.momentum}%` }}
                    />
                  </span>
                  {trend.momentum}
                </button>
              </div>

              <h4 className="xtracker-headline">{trend.headline}</h4>
              {trend.eventTime && (
                <span className="xtracker-event-time">{trend.eventTime}</span>
              )}
              <p className="xtracker-summary">{trend.summary}</p>
              {trend.sourceUrl && (
                <a className="xtracker-source-link" href={trend.sourceUrl} target="_blank" rel="noopener noreferrer">
                  View source on X &#8599;
                </a>
              )}

              {trend.hashtags?.length > 0 && (
                <div className="xtracker-hashtags">
                  {trend.hashtags.map((h) => (
                    <span key={h} className="xtracker-hashtag">#{h}</span>
                  ))}
                </div>
              )}

              {trend.coins?.length > 0 ? (
                <div className="xtracker-coins">
                  <span className="xtracker-coins-label">Related coins</span>
                  <div className="xtracker-coin-row">
                    {trend.coins.map((coin) => {
                      const chg = Number(coin.priceChange24h) || 0;
                      return (
                        <button
                          key={coin.mintAddress}
                          className="xtracker-coin-chip"
                          onClick={() => openCoin(coin)}
                          title={`${coin.name} — matched: ${(coin.matchedTerms || []).join(', ')}`}
                        >
                          {coin.image ? (
                            <img src={coin.image} alt="" className="xtracker-coin-img" loading="lazy" />
                          ) : (
                            <span className="xtracker-coin-img xtracker-coin-img--fallback">
                              {(coin.symbol || '?')[0]}
                            </span>
                          )}
                          <span className="xtracker-coin-meta">
                            <span className="xtracker-coin-symbol">{coin.symbol}</span>
                            <span className="xtracker-coin-sub">
                              {formatMc(coin.market_cap_usd)}
                              <span className={`xtracker-coin-chg ${chg >= 0 ? 'up' : 'down'}`}>
                                {chg >= 0 ? '+' : ''}{chg.toFixed(1)}%
                              </span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="xtracker-no-coins">No matching coins in the feeds yet — they usually appear within minutes of an event.</p>
              )}
            </article>
          ))}
        </div>

        {showMomentumInfo && (
          <div className="xtracker-info-overlay" onClick={() => setShowMomentumInfo(false)}>
            <div className="xtracker-info-card" onClick={(e) => e.stopPropagation()}>
              <div className="xtracker-info-header">
                <strong>Momentum score</strong>
                <button className="menu-panel-close" onClick={() => setShowMomentumInfo(false)} aria-label="Close">✕</button>
              </div>
              <p>
                A 1-100 score for how fast a topic is trending on X <em>right now</em>,
                based on post volume and engagement found in live search — not how
                important the event is overall. A higher bar means it's spreading
                faster at this moment; a lower bar means it's still trending, just
                more slowly.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default XTrackerPanel;
