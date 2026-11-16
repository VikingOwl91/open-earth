/**
 * Open Earth - Cookieless page analytics (OpenPanel, self-hosted).
 * Disabled on localhost, loopback and file: so development runs stay out of the statistics.
 * Session replay is intentionally not configured. See docs/PRIVACY.md.
 */
(() => {
  'use strict';

  const CONFIG = {
    apiUrl: 'https://op.nachtigall.dev/api',
    clientId: '75cb34b1-c4d2-4299-a93f-f5563fbaf40c',
    trackScreenViews: true,
    trackOutgoingLinks: true,
    trackAttributes: true
  };

  // Vendored, pinned copy of https://openpanel.dev/op1.js (see vendor/openpanel/README.md)
  const SCRIPT_URL = './vendor/openpanel/op1.js';

  function isLocalContext(loc) {
    const host = String(loc?.hostname || '').toLowerCase();
    return loc?.protocol === 'file:'
      || !host
      || host === 'localhost'
      || host.endsWith('.localhost')
      || host === '127.0.0.1'
      || host === '[::1]'
      || host === '::1';
  }

  // Drops screen_view events that differ from the last sent one only by the camera (`c`) URL param.
  // Anything unexpected is let through.
  function createScreenViewFilter() {
    let last = null;
    return (event) => {
      try {
        const payload = event?.payload;
        if (event?.type !== 'track' || payload?.name !== 'screen_view') return true;
        const url = new URL(payload.properties.__path);
        url.searchParams.delete('c');
        url.searchParams.sort();
        if (url.href === last) return false;
        last = url.href;
        return true;
      } catch {
        return true;
      }
    };
  }

  function installStub(win) {
    win.op = win.op || function () { var n = []; return new Proxy(function () { arguments.length && n.push([].slice.call(arguments)); }, { get: function (t, r) { return 'q' === r ? n : function () { n.push([r].concat([].slice.call(arguments))); }; }, has: function (t, r) { return 'q' === r; } }); }();
  }

  function init(win, doc) {
    if (!win || !doc || isLocalContext(win.location)) return false;
    installStub(win);
    win.op('init', { ...CONFIG, filter: createScreenViewFilter() });
    const script = doc.createElement('script');
    script.src = SCRIPT_URL;
    script.defer = true;
    script.async = true;
    doc.head.appendChild(script);
    return true;
  }

  const Analytics = { CONFIG, SCRIPT_URL, isLocalContext, createScreenViewFilter, init };

  if (typeof window !== 'undefined') {
    window.OpenEarth = window.OpenEarth || {};
    window.OpenEarth.analytics = Analytics;
    init(window, document);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Analytics;
  }
})();
