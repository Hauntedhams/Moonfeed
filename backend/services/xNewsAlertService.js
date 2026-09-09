const crypto = require('crypto');
const DeviceToken = require('../models/DeviceToken');
const XNewsAlert = require('../models/XNewsAlert');
const pushService = require('./pushService');

const ALERT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function fingerprintFor(trend) {
  const primaryCoin = trend.coins?.[0]?.mintAddress || '';
  const identity = `${normalize(trend.topic)}|${primaryCoin}`;
  return crypto.createHash('sha256').update(identity).digest('hex');
}

function isAlertWorthy(trend, liveSearchUsed = true) {
  if (!liveSearchUsed) return false;
  const momentum = Number(trend.momentum) || 0;
  const officialLaunch = trend.sourceType === 'official' && trend.eventType === 'coin_launch';
  if (officialLaunch) return momentum >= 60;
  if (!trend?.coins?.length) return false;
  const cryptoEvent = trend.category === 'crypto';
  return (cryptoEvent && momentum >= 75) || momentum >= 90;
}

function decorateTrends(trends, liveSearchUsed = true) {
  return trends.map((trend) => ({
    ...trend,
    alertWorthy: isAlertWorthy(trend, liveSearchUsed),
    alertKey: fingerprintFor(trend),
  }));
}

async function sendToAllDevices(payload) {
  const devices = await DeviceToken.find({ 'prefs.xNews': { $ne: false } }).select('token').lean();
  const tokens = [...new Set(devices.map((device) => device.token).filter(Boolean))];
  if (!tokens.length) return 0;

  let sent = 0;
  const invalidTokens = [];
  for (let index = 0; index < tokens.length; index += 500) {
    const batch = tokens.slice(index, index + 500);
    const result = await pushService.sendToTokens(batch, payload);
    invalidTokens.push(...result.invalidTokens);
    sent += batch.length - result.invalidTokens.length;
  }
  if (invalidTokens.length) await DeviceToken.deleteMany({ token: { $in: invalidTokens } });
  return sent;
}

async function processTrends(trends) {
  if (!pushService.isEnabled()) return;
  const candidates = trends.filter((trend) => trend.alertWorthy);
  if (!candidates.length) return;

  for (const trend of candidates) {
    const coin = trend.coins?.[0] || null;
    try {
      await XNewsAlert.create({
        fingerprint: trend.alertKey,
        topic: trend.topic,
        headline: trend.headline,
        eventId: trend.id,
        mint: coin?.mintAddress || null,
        expireAt: new Date(Date.now() + ALERT_TTL_MS),
      });
    } catch (error) {
      if (error?.code === 11000) continue;
      throw error;
    }

    const change = Number(coin?.priceChange24h);
    const movement = Number.isFinite(change)
      ? ` ${coin.symbol || 'The related coin'} is ${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}% in 24h.`
      : '';
    const sent = await sendToAllDevices({
      title: `Breaking on X: ${trend.topic}`,
      body: `${trend.headline}${movement} Open X Tracker for the full story.`,
      image: coin?.image || null,
      data: {
        type: 'xNews',
        eventId: trend.id,
        alertKey: trend.alertKey,
        topic: trend.topic,
        mint: coin?.mintAddress || '',
      },
    });
    console.log(`[x-news] pushed "${trend.topic}" to ${sent} device(s)`);
  }
}

module.exports = { decorateTrends, isAlertWorthy, processTrends };