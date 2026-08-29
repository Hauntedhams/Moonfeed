/**
 * Admin auth for affiliate-management endpoints.
 * Requires ADMIN_API_KEY env var; key is passed via `x-admin-key` header
 * (or `?adminKey=` for browser GETs).
 */
function adminAuth(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;

  if (!configuredKey) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ success: false, error: 'Admin API not configured' });
    }
    console.warn('⚠️ ADMIN_API_KEY not set — allowing admin request (dev only)');
    return next();
  }

  const providedKey = req.headers['x-admin-key'] || req.query.adminKey;
  if (providedKey !== configuredKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
}

module.exports = adminAuth;
