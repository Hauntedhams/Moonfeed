import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getFullApiUrl } from '../config/api';
import { getArtworkCandidates } from '../utils/coinArtwork';
import './XTrackerPanel.css';

const timeAgo = (ts) => {
  if (!ts) return '';
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
};

const formatMc = (mc) => {
  if (!mc) return '';
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(1)}M`;
  if (mc >= 1e3) return `$${(mc / 1e3).toFixed(0)}K`;
  return `$${Math.round(mc)}`;
};

const formatDelay = (secs) => {
  if (!Number.isFinite(secs)) return '';
  const sign = secs < 0 ? '-' : '+';
  const abs = Math.abs(secs);
  return abs < 60 ? `${sign}${abs}s` : `${sign}${Math.round(abs / 60)}m`;
};

const VERIFICATION_LABEL = {
  ca: 'CA in tweet',
  linked: 'Links this tweet',
  author: 'Links author',
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'coins', label: 'Coins' },
  { id: 'meme', label: 'Memes' },
  { id: 'founder', label: 'Founders' },
  { id: 'kol', label: 'KOLs' },
  { id: 'celebrity', label: 'Celebs' },
  { id: 'news', label: 'News' },
];

const MAX_TWEETS = 200;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HighlightedText = ({ text, terms, onTermClick }) => {
  const parts = useMemo(() => {
    const words = [...new Set(terms.filter((t) => t && t.length >= 2))].sort((a, b) => b.length - a.length);
    if (!words.length) return [text];
    const re = new RegExp(`(\\$?(?:${words.map(escapeRegExp).join('|')}))(?![A-Za-z0-9])`, 'gi');
    return text.split(re);
  }, [text, terms]);
  return parts.map((part, i) => (i % 2 === 1
    ? (onTermClick
      ? <button key={i} type="button" className="xfeed-hl xfeed-hl--btn" onClick={() => onTermClick(part)}>{part}</button>
      : <mark key={i} className="xfeed-hl">{part}</mark>)
    : <React.Fragment key={i}>{part}</React.Fragment>));
};

const CoinAvatar = ({ coin }) => {
  const candidates = useMemo(() => getArtworkCandidates(coin.image), [coin.image]);
  const [index, setIndex] = useState(0);
  if (!candidates[index]) {
    return <span className="xfeed-coin-img xfeed-coin-img--fallback">{(coin.symbol || '?')[0]}</span>;
  }
  return (
    <img
      src={candidates[index]}
      alt=""
      className="xfeed-coin-img"
      loading="lazy"
      onError={() => setIndex((i) => i + 1)}
    />
  );
};

const TweetCard = ({ tweet, isNew, onOpenCoin, onOpenCashtag }) => {
  const highlightTerms = useMemo(() => [
    ...(tweet.signals?.cashtags || []),
    ...tweet.coins.map((c) => c.matchedTerm).filter((t) => t && t !== 'ca'),
  ], [tweet]);

  // Tapping a highlighted term opens its matched coin, else resolves it by search.
  const handleTermClick = useCallback((part) => {
    const term = part.replace(/^\$/, '').toLowerCase();
    const matched = tweet.coins.find(
      (c) => String(c.symbol || '').toLowerCase() === term || String(c.matchedTerm || '').toLowerCase() === term,
    );
    if (matched) onOpenCoin(matched);
    else onOpenCashtag?.(term);
  }, [tweet, onOpenCoin, onOpenCashtag]);

  return (
    <article className={`xfeed-card ${isNew ? 'xfeed-card--new' : ''} ${tweet.coins.some((c) => c.verification) ? 'xfeed-card--verified' : ''}`}>
      <header className="xfeed-card-head">
        {tweet.author.avatar ? (
          <img src={tweet.author.avatar} alt="" className="xfeed-avatar" loading="lazy" />
        ) : (
          <span className="xfeed-avatar xfeed-avatar--fallback">{(tweet.author.name || '?')[0]}</span>
        )}
        <div className="xfeed-author">
          <span className="xfeed-author-name">{tweet.author.name}</span>
          <span className="xfeed-author-sub">
            @{tweet.author.handle}
            {tweet.author.label && <span className="xfeed-author-label">{tweet.author.label}</span>}
          </span>
        </div>
        <a className="xfeed-time" href={tweet.url} target="_blank" rel="noopener noreferrer" title="Open on X">
          {timeAgo(tweet.createdAtMs)} &#8599;
        </a>
      </header>

      {tweet.replyTo && <p className="xfeed-reply-to">Replying to @{tweet.replyTo}</p>}
      {tweet.text && (
        <p className="xfeed-text"><HighlightedText text={tweet.text} terms={highlightTerms} onTermClick={handleTermClick} /></p>
      )}

      {tweet.media?.[0] && (
        <a href={tweet.url} target="_blank" rel="noopener noreferrer" className="xfeed-media">
          <img src={tweet.media[0].url} alt="" loading="lazy" />
        </a>
      )}

      {tweet.quoted && (
        <div className="xfeed-quote">
          <span className="xfeed-quote-author">{tweet.quoted.author?.name} <span>@{tweet.quoted.author?.handle}</span></span>
          <p className="xfeed-quote-text"><HighlightedText text={tweet.quoted.text || ''} terms={highlightTerms} onTermClick={handleTermClick} /></p>
        </div>
      )}

      {tweet.coins.length > 0 && (
        <div className="xfeed-coins">
          <span className="xfeed-coins-label">Coins off this tweet</span>
          {tweet.coins.map((coin, i) => (
            <button key={coin.mintAddress} type="button" className="xfeed-coin-row" onClick={() => onOpenCoin(coin)}>
              <span className="xfeed-coin-rank">{i + 1}</span>
              <CoinAvatar coin={coin} />
              <span className="xfeed-coin-meta">
                <span className="xfeed-coin-symbol">
                  ${coin.symbol}
                  {coin.verification && (
                    <span className={`xfeed-badge xfeed-badge--${coin.verification}`}>&#10003; {VERIFICATION_LABEL[coin.verification]}</span>
                  )}
                  {coin.isFirst && <span className="xfeed-badge xfeed-badge--first">1st</span>}
                </span>
                <span className="xfeed-coin-name">{coin.name}</span>
              </span>
              <span className="xfeed-coin-stats">
                <span className="xfeed-coin-mc">{formatMc(coin.market_cap_usd)}</span>
                <span className="xfeed-coin-delay">
                  {coin.source === 'launch' ? `${formatDelay(coin.secondsAfterTweet)} after` : 'existing'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </article>
  );
};

const LiveFeed = ({ onOpenCoin, onOpenCashtag, onTrendsAvailable }) => {
  const [tweets, setTweets] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null, enabled: true, live: false });
  const [filter, setFilter] = useState('all');
  const [newIds, setNewIds] = useState(() => new Set());
  const [, setTick] = useState(0);

  const mergeTweet = useCallback((tweet, isFresh) => {
    setTweets((prev) => {
      const next = prev.filter((t) => t.id !== tweet.id);
      next.push(tweet);
      next.sort((a, b) => b.createdAtMs - a.createdAtMs);
      return next.slice(0, MAX_TWEETS);
    });
    if (isFresh) {
      setNewIds((prev) => new Set(prev).add(tweet.id));
      setTimeout(() => setNewIds((prev) => {
        const next = new Set(prev);
        next.delete(tweet.id);
        return next;
      }), 2500);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(getFullApiUrl('/api/x-feed?limit=120'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTweets(json.tweets || []);
      setStatus((s) => ({ ...s, loading: false, error: null, enabled: json.enabled !== false }));
      onTrendsAvailable?.(Boolean(json.trendsEnabled));
    } catch (err) {
      setStatus((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [onTrendsAvailable]);

  useEffect(() => {
    load();
    if (typeof EventSource === 'undefined') {
      const poll = setInterval(load, 6000);
      return () => clearInterval(poll);
    }
    const source = new EventSource(getFullApiUrl('/api/x-feed/stream'));
    source.onopen = () => setStatus((s) => ({ ...s, live: true }));
    source.onerror = () => setStatus((s) => ({ ...s, live: false }));
    const onTweet = (e) => { try { mergeTweet(JSON.parse(e.data), true); } catch { /* malformed frame */ } };
    const onUpdate = (e) => { try { mergeTweet(JSON.parse(e.data), false); } catch { /* malformed frame */ } };
    source.addEventListener('tweet', onTweet);
    source.addEventListener('update', onUpdate);
    return () => source.close();
  }, [load, mergeTweet]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const visible = useMemo(() => tweets.filter((t) => {
    if (t.lowSignal) return false;
    if (filter === 'all') return true;
    if (filter === 'coins') return t.coins.length > 0;
    return t.author?.category === filter;
  }), [tweets, filter]);

  return (
    <>
      <div className="xfeed-toolbar">
        <span className={`xfeed-live ${status.live ? 'xfeed-live--on' : ''}`}>
          <span className="xfeed-live-dot" />
          {status.live ? 'LIVE' : 'Connecting…'}
        </span>
        <div className="xfeed-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`xfeed-filter ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {status.loading && !tweets.length && (
        <div className="xtracker-status" role="status" aria-live="polite">
          <span className="xtracker-loader" aria-hidden="true">
            <span className="xtracker-loader-ring" />
            <span className="xtracker-loader-scan" />
            <span className="xtracker-loader-mark">X</span>
          </span>
          Connecting to the live X feed…
        </div>
      )}

      {!status.loading && !status.enabled && (
        <div className="xtracker-status">The live X feed isn't configured on the server yet.</div>
      )}

      {!status.loading && status.error && !tweets.length && (
        <div className="xtracker-status">
          Couldn't load the feed right now.
          <button className="xtracker-retry-btn" onClick={load}>Try again</button>
        </div>
      )}

      {!status.loading && status.enabled && !status.error && !visible.length && (
        <div className="xtracker-status">
          {filter === 'coins' ? 'No tweets with launched coins yet — they show up here seconds after a coin drops.' : 'Waiting for the next post…'}
        </div>
      )}

      {visible.map((tweet) => (
        <TweetCard key={tweet.id} tweet={tweet} isNew={newIds.has(tweet.id)} onOpenCoin={onOpenCoin} onOpenCashtag={onOpenCashtag} />
      ))}
    </>
  );
};

const TrendsFeed = ({ onOpenCoin }) => {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [showMomentumInfo, setShowMomentumInfo] = useState(false);

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

  const trends = state.data?.trends || [];

  return (
    <>
      {state.loading && !trends.length && (
        <div className="xtracker-status" role="status">Scanning X for trending events…</div>
      )}
      {!state.loading && (state.error || !trends.length) && (
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
            <button type="button" className="xtracker-momentum" onClick={() => setShowMomentumInfo(true)}>
              <span className="xtracker-momentum-track">
                <span className="xtracker-momentum-fill" style={{ width: `${trend.momentum}%` }} />
              </span>
              {trend.momentum}
            </button>
          </div>
          <h4 className="xtracker-headline">{trend.headline}</h4>
          <p className="xtracker-summary">{trend.summary}</p>
          {trend.coins?.length > 0 && (
            <div className="xtracker-coin-row">
              {trend.coins.map((coin) => (
                <button key={coin.mintAddress} className="xtracker-coin-chip" onClick={() => onOpenCoin(coin)}>
                  <span className="xtracker-coin-symbol">{coin.symbol}</span>
                  <span className="xtracker-coin-sub">{formatMc(coin.market_cap_usd)}</span>
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
      {showMomentumInfo && (
        <div className="xtracker-info-overlay" onClick={() => setShowMomentumInfo(false)}>
          <div className="xtracker-info-card" onClick={(e) => e.stopPropagation()}>
            <div className="xtracker-info-header">
              <strong>Momentum score</strong>
              <button className="menu-panel-close" onClick={() => setShowMomentumInfo(false)} aria-label="Close">✕</button>
            </div>
            <p>A 1-100 score for how fast a topic is trending on X right now, not how important it is overall.</p>
          </div>
        </div>
      )}
    </>
  );
};

const XTrackerPanel = ({ onClose }) => {
  const [tab, setTab] = useState('live');
  const [trendsAvailable, setTrendsAvailable] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const bodyRef = useRef(null);
  const touchStartY = useRef(null);

  const handleTouchStart = (e) => {
    if (e.target.closest('button, a') || bodyRef.current?.scrollTop > 0) return;
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

  const openCoin = useCallback((coin) => {
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
  }, [onClose]);

  // Cashtag with no matched coin: resolve the symbol through token search
  // (deepest-liquidity match) and open that coin card.
  const openCashtag = useCallback(async (term) => {
    try {
      const params = new URLSearchParams({ query: term, sort: 'liquidity' });
      const res = await fetch(getFullApiUrl(`/api/search?${params}`));
      const json = await res.json();
      const hit = (json?.results || []).find(
        (r) => String(r.symbol || '').toLowerCase() === term.toLowerCase(),
      ) || json?.results?.[0];
      if (!hit) return;
      openCoin({
        mintAddress: hit.mintAddress || hit.mint || hit.tokenAddress,
        symbol: hit.symbol,
        name: hit.name,
        image: hit.image || hit.profileImage || hit.logo || null,
        banner: hit.banner || hit.header || null,
        pairAddress: hit.pairAddress || null,
        price_usd: hit.priceUsd || hit.price || null,
        market_cap_usd: hit.marketCap || null,
      });
    } catch { /* search is best-effort */ }
  }, [openCoin]);

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
            {trendsAvailable && (
              <div className="xfeed-tabs">
                <button type="button" className={tab === 'live' ? 'active' : ''} onClick={() => setTab('live')}>Live</button>
                <button type="button" className={tab === 'trends' ? 'active' : ''} onClick={() => setTab('trends')}>Trends</button>
              </div>
            )}
            <button className="menu-panel-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div ref={bodyRef} className="menu-panel-body xtracker-body">
          {tab === 'live'
            ? <LiveFeed onOpenCoin={openCoin} onOpenCashtag={openCashtag} onTrendsAvailable={setTrendsAvailable} />
            : <TrendsFeed onOpenCoin={openCoin} />}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default XTrackerPanel;
