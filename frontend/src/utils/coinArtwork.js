const SOLANA_TRACKER_IMAGE_PROXY = 'https://image.solanatracker.io/proxy?url=';

const normalizeArtworkUrl = (url) => {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${trimmed.slice('ipfs://'.length)}`;
  }
  return trimmed;
};

export const getProfileImage = (coin = {}) => coin.profileImage || coin.image || coin.logo
  || coin.icon || coin.imageUrl || coin.logoURI || coin.logoUrl || null;

export const getBannerImage = (coin = {}) => coin.banner || coin.bannerImage || coin.header
  || coin.headerImage || coin.bannerUrl || null;

export const getArtworkCandidates = (...urls) => {
  const candidates = [];
  urls.flat().forEach((value) => {
    const url = normalizeArtworkUrl(value);
    if (!url || candidates.includes(url)) return;
    candidates.push(url);
    if (/^https?:\/\//i.test(url) && !url.startsWith(SOLANA_TRACKER_IMAGE_PROXY)) {
      candidates.push(`${SOLANA_TRACKER_IMAGE_PROXY}${encodeURIComponent(url)}`);
    }
  });
  return candidates;
};
