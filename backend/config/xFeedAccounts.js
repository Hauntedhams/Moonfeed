// Accounts the live X feed tracks. Tier 1 = accounts whose posts routinely
// spawn new meme coins within seconds (polled fastest); tier 2 = news /
// celebrity / market accounts that move the space but are less time-critical.
// Extra handles can be added without a deploy via X_FEED_EXTRA_ACCOUNTS
// ("handle:tier:category,handle2" — tier/category optional).

const ACCOUNTS = [
  // Solana / meme-coin platform founders & CEOs
  { handle: 'aeyakovenko', tier: 1, category: 'founder', label: 'Solana co-founder' },
  { handle: 'rajgokal', tier: 1, category: 'founder', label: 'Solana co-founder' },
  { handle: '0xMert_', tier: 1, category: 'founder', label: 'Helius CEO' },
  { handle: 'weremeow', tier: 1, category: 'founder', label: 'Jupiter co-founder' },
  { handle: 'a1lon9', tier: 1, category: 'founder', label: 'Pump.fun co-founder' },
  { handle: 'cz_binance', tier: 1, category: 'founder', label: 'Binance founder' },
  { handle: 'heyibinance', tier: 1, category: 'founder', label: 'Binance co-founder' },
  { handle: 'brian_armstrong', tier: 1, category: 'founder', label: 'Coinbase CEO' },
  { handle: 'jessepollak', tier: 2, category: 'founder', label: 'Base lead' },
  { handle: 'VitalikButerin', tier: 2, category: 'founder', label: 'Ethereum co-founder' },

  // Platforms whose posts start metas
  { handle: 'pumpdotfun', tier: 1, category: 'platform', label: 'Pump.fun' },
  { handle: 'solana', tier: 1, category: 'platform', label: 'Solana' },
  { handle: 'JupiterExchange', tier: 2, category: 'platform', label: 'Jupiter' },
  { handle: 'phantom', tier: 2, category: 'platform', label: 'Phantom' },
  { handle: 'dexscreener', tier: 2, category: 'platform', label: 'DEX Screener' },
  { handle: 'bonk_inu', tier: 2, category: 'platform', label: 'BONK' },

  // Meme-coin KOLs / traders
  { handle: 'blknoiz06', tier: 1, category: 'kol', label: 'Ansem' },
  { handle: 'MustStopMurad', tier: 1, category: 'kol', label: 'Murad' },
  { handle: 'Cupseyy', tier: 1, category: 'kol', label: 'Cupsey' },
  { handle: 'orangie', tier: 1, category: 'kol', label: 'Orangie' },
  { handle: 'notthreadguy', tier: 1, category: 'kol', label: 'threadguy' },
  { handle: 'frankdegods', tier: 1, category: 'kol', label: 'Frank (DeGods)' },
  { handle: 'CryptoDonAlt', tier: 2, category: 'kol', label: 'DonAlt' },
  { handle: 'Pentosh1', tier: 2, category: 'kol', label: 'Pentoshi' },
  { handle: 'HsakaTrades', tier: 2, category: 'kol', label: 'Hsaka' },
  { handle: 'cobie', tier: 2, category: 'kol', label: 'Cobie' },
  { handle: 'zachxbt', tier: 2, category: 'kol', label: 'ZachXBT' },

  // Celebrities / meme drivers (one post can start a whole wave)
  { handle: 'elonmusk', tier: 1, category: 'celebrity', label: 'Elon Musk' },
  { handle: 'realDonaldTrump', tier: 1, category: 'celebrity', label: 'Donald Trump' },
  { handle: 'DogeDesigner', tier: 1, category: 'celebrity', label: 'DogeDesigner' },
  { handle: 'cb_doge', tier: 2, category: 'celebrity', label: 'DogeDesigner fan acct' },
  { handle: 'BillyM2k', tier: 2, category: 'celebrity', label: 'Dogecoin co-creator' },
  { handle: 'MrBeast', tier: 2, category: 'celebrity', label: 'MrBeast' },
  { handle: 'kanyewest', tier: 2, category: 'celebrity', label: 'Ye' },
  { handle: 'stoolpresidente', tier: 2, category: 'celebrity', label: 'Dave Portnoy' },
  { handle: 'saylor', tier: 2, category: 'celebrity', label: 'Michael Saylor' },

  // Fast crypto news
  { handle: 'tier10k', tier: 1, category: 'news', label: 'DB News' },
  { handle: 'WatcherGuru', tier: 2, category: 'news', label: 'Watcher.Guru' },
  { handle: 'lookonchain', tier: 2, category: 'news', label: 'Lookonchain' },
  { handle: 'solanafloor', tier: 2, category: 'news', label: 'SolanaFloor' },
  { handle: 'MarioNawfal', tier: 2, category: 'news', label: 'Mario Nawfal' },
  { handle: 'Cointelegraph', tier: 2, category: 'news', label: 'Cointelegraph' },
];

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

function parseExtraAccounts(raw) {
  return String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [handle, tier, category] = entry.replace(/^@/, '').split(':');
      return {
        handle,
        tier: tier === '1' ? 1 : 2,
        category: category || 'kol',
        label: handle,
      };
    })
    .filter((a) => HANDLE_RE.test(a.handle));
}

function getTrackedAccounts() {
  const byHandle = new Map();
  for (const account of [...ACCOUNTS, ...parseExtraAccounts(process.env.X_FEED_EXTRA_ACCOUNTS)]) {
    byHandle.set(account.handle.toLowerCase(), account);
  }
  return [...byHandle.values()];
}

module.exports = { getTrackedAccounts };
