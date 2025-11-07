/**
 * Debug Utility - Only logs in development mode
 * Prevents console spam in production
 */

const isDev = import.meta.env.DEV;

// 🔇 Filter out third-party iframe warnings (e.g., from Dexscreener)
if (isDev) {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    // Filter out Dexscreener iframe warnings
    const message = args[0]?.toString() || '';
    if (
      message.includes('dexscreener.com') ||
      message.includes('pages_catch-all') ||
      message.includes('Encountered two children with the same key')
    ) {
      return; // Suppress third-party warnings
    }
    originalWarn.apply(console, args);
  };
}

export const debug = {
  /**
   * Log only in development mode
   */
  log: (...args) => {
    if (isDev) console.log(...args);
  },

  /**
   * Always log errors (even in production)
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Warn only in development mode
   */
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },

  /**
   * Info only in development mode
   */
  info: (...args) => {
    if (isDev) console.info(...args);
  },

  /**
   * Table only in development mode (useful for arrays/objects)
   */
  table: (...args) => {
    if (isDev) console.table(...args);
  },

  /**
   * Group logs only in development mode
   */
  group: (label) => {
    if (isDev) console.group(label);
  },

  groupEnd: () => {
    if (isDev) console.groupEnd();
  },

  /**
   * Performance measurement wrapper
   */
  measure: (name, fn) => {
    if (isDev) {
      performance.mark(`${name}-start`);
      const result = fn();
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      const measure = performance.getEntriesByName(name)[0];
      console.log(`⚡ ${name}: ${measure.duration.toFixed(2)}ms`);
      return result;
    }
    return fn();
  }
};

export default debug;
