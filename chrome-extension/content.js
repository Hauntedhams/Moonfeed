// Runs inside moonfeed.app when loaded in the extension popup iframe.
if (window.self !== window.top) {
  const applyFix = () => {
    if (document.getElementById('mf-ext-fix')) return;

    const h = window.innerHeight; // iframe's actual viewport height

    const style = document.createElement('style');
    style.id = 'mf-ext-fix';
    style.textContent = `
      /* Ensure nav is always on top and at the bottom */
      .bottom-nav {
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 2147483647 !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        transform: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);

    // Also override meta viewport with explicit height
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.content = `width=device-width, height=${h}, initial-scale=1.0`;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFix);
  } else {
    applyFix();
  }
}
