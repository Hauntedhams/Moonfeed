// Firebase Cloud Messaging sender. Delivers to iOS + Android from one API.
// Initializes lazily from a service-account JSON (env FIREBASE_SERVICE_ACCOUNT =
// the raw JSON string, or GOOGLE_APPLICATION_CREDENTIALS = a file path). If no
// credentials are configured, every send is a safe no-op so the app still runs.
let admin = null;
let initialized = false;
let enabled = false;

function init() {
  if (initialized) return enabled;
  initialized = true;

  try {
    admin = require('firebase-admin');
  } catch (_) {
    console.warn('[push] firebase-admin not installed — remote push disabled');
    return false;
  }

  try {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      const json = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
      );
      credential = admin.credential.cert(json);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(json);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credential = admin.credential.applicationDefault();
    } else {
      console.warn('[push] no FIREBASE_SERVICE_ACCOUNT_BASE64 / FIREBASE_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS — remote push disabled');
      return false;
    }

    if (!admin.apps.length) {
      admin.initializeApp({ credential });
    }
    enabled = true;
    console.log('[push] Firebase Cloud Messaging initialized');
  } catch (err) {
    console.error('[push] Firebase init failed:', err.message);
    enabled = false;
  }
  return enabled;
}

function isEnabled() {
  return init();
}

// Send one notification to a list of device tokens. Returns the tokens FCM
// reported as permanently invalid (unregistered) so the caller can prune them.
async function sendToTokens(tokens, { title, body, data = {} } = {}) {
  if (!init() || !tokens?.length) return { invalidTokens: [] };

  const stringData = {};
  for (const [k, v] of Object.entries(data)) stringData[k] = String(v);

  const message = {
    tokens: [...new Set(tokens)].slice(0, 500), // FCM multicast cap
    notification: { title, body },
    data: stringData,
    apns: {
      payload: { aps: { sound: 'default', 'content-available': 1 } },
    },
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'moonfeed_alerts' },
    },
  };

  const invalidTokens = [];
  try {
    const res = await admin.messaging().sendEachForMulticast(message);
    res.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error?.code || '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument'
      ) {
        invalidTokens.push(message.tokens[i]);
      }
    });
  } catch (err) {
    console.error('[push] send error:', err.message);
  }
  return { invalidTokens };
}

module.exports = { isEnabled, sendToTokens };
