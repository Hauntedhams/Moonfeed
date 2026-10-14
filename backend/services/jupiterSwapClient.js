const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class JupiterRequestError extends Error {
  constructor(message, status, retryAfterMs = null) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function retryDelay(response, attempt, now = Date.now()) {
  const retryAfter = response.headers.get('retry-after');
  const reset = response.headers.get('x-ratelimit-reset');
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  const date = retryAfter === null ? NaN : Date.parse(retryAfter);
  const resetSeconds = reset === null ? NaN : Number(reset);
  return Math.max(
    1000 * 2 ** attempt,
    Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(date) ? date - now : 0,
    Number.isFinite(resetSeconds) ? resetSeconds * 1000 - now : 0,
  );
}

async function requestJupiterSwap(path, options = {}, { fetchImpl = fetch, wait = sleep, apiKey = process.env.JUPITER_API_KEY } = {}) {
  const base = apiKey ? 'https://api.jup.ag/swap/v1' : 'https://lite-api.jup.ag/swap/v1';
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetchImpl(`${base}/${path}`, {
      ...options,
      headers: { ...options.headers, ...(apiKey ? { 'x-api-key': apiKey } : {}) },
      signal: AbortSignal.timeout(12000),
    });
    if (response.status === 429) {
      const delay = retryDelay(response, attempt);
      // Do not block a trade button indefinitely or retry before the provider's reset.
      if (attempt === 2 || delay > 5000) {
        throw new JupiterRequestError('Trading provider is rate limited. No transaction was submitted; try again shortly.', 429, delay);
      }
      console.warn(`[instant-swap] Jupiter rate limited; retrying build request in ${delay}ms`);
      await wait(delay);
      continue;
    }
    if (response.status >= 500 && attempt < 2) {
      console.warn(`[instant-swap] Jupiter HTTP ${response.status}; retrying build request`);
      await wait(1000 * 2 ** attempt);
      continue;
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.error) {
      throw new JupiterRequestError(data?.error || `Trading provider request failed (${response.status})`, response.status);
    }
    return data;
  }
}

module.exports = { requestJupiterSwap, retryDelay, JupiterRequestError };
