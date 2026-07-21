/* Undertow web desk — core: shared UT helpers + tab router.
   Classic script (no modules). Surfaces register via UT.mount and are
   rendered into #surface when their tab is shown. */
(function () {
  'use strict';

  var MIRROR = 'https://api.seiche.info/undertow';
  var DESK = 'https://api.seiche.info/undertow/desk';   // exported as UT.DESK — the subscriber backend
  var TAB_ORDER = ['board', 'crypto', 'calls', 'quantum', 'world', 'strategy'];
  var TG = 'https://t.me/undertow_LiquiLens_bot';
  var SESSION_KEY = 'ut_session';
  var SESSION_TTL_S = 30 * 86400;   // fallback when the desk reply carries no exp

  var surfaces = {};      // id -> { title, renderFn }
  var packCache = {};     // name -> Promise (settled to parsed JSON or null)
  var summaryPromise = null;
  var loginUrlPromise = null;       // cached per page load
  var entitlementPromise = null;    // cached per page load
  var booted = false;
  var currentId = null;
  var renderSeq = 0;      // race guard for fast tab switching

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function () { return null; });
  }

  function pack(name) {
    if (!packCache[name]) packCache[name] = fetchJson(MIRROR + '/' + name + '.json');
    return packCache[name];
  }

  function summary() {
    if (!summaryPromise) summaryPromise = fetchJson(MIRROR + '/x402/summary');
    return summaryPromise;
  }

  /* ---------- subscriber auth ---------- */

  function readStored() {
    var raw;
    try { raw = localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* private mode */ }
  }

  function saveSession(s) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }

  function session() {
    var s = readStored();
    if (!s) return null;
    if (!s.token || !(Number(s.exp) > 0) || Number(s.exp) <= Math.floor(Date.now() / 1000)) {
      clearSession();          // expired or malformed — disclosed as logged out
      return null;
    }
    return s;
  }

  function logout() {
    clearSession();
    location.reload();
  }

  function fetchWithTimeout(url, opts, ms) {
    if (typeof AbortController === 'undefined') return fetch(url, opts);
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, ms);
    opts = opts || {};
    opts.signal = ctrl.signal;
    return fetch(url, opts).then(
      function (r) { clearTimeout(t); return r; },
      function (e) { clearTimeout(t); throw e; }
    );
  }

  function loginUrl() {
    // Only meaningful over https — never offered on file:// or plain http.
    if (location.protocol !== 'https:') return Promise.resolve(null);
    if (!loginUrlPromise) {
      loginUrlPromise = fetchJson(DESK + '/config').then(function (cfg) {
        if (!cfg || !cfg.bot_id) return null;
        var origin = cfg.oauth_origin || 'https://liquilens.in';
        return 'https://oauth.telegram.org/auth?bot_id=' + encodeURIComponent(String(cfg.bot_id)) +
          '&origin=' + encodeURIComponent(origin) +
          '&return_to=' + encodeURIComponent(location.href.split('#')[0]) +
          '&request_access=write';
      });
    }
    return loginUrlPromise;
  }

  function entitlement() {
    var s = session();
    if (!s) return Promise.resolve(null);
    if (!entitlementPromise) {
      entitlementPromise = fetch(DESK + '/me', {
        headers: { 'Authorization': 'Bearer ' + s.token },
        cache: 'no-store'
      }).then(function (r) {
        if (r.status === 401) { clearSession(); return null; }   // stale token — fail closed
        if (!r.ok) return null;
        return r.json();
      }).then(function (j) {
        return j && j.entitlement ? j.entitlement : null;
      }).catch(function () { return null; });
    }
    return entitlementPromise;
  }

  function authedPack(name) {
    var s = session();
    if (!s) return Promise.resolve(null);
    return fetch(DESK + '/pack/' + encodeURIComponent(name), {
      headers: { 'Authorization': 'Bearer ' + s.token },
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) return null;   // 401/403/5xx — surfaces fall back to the free mirror + CTA
      return r.json();
    }).then(function (j) {
      return j && j.data != null ? j.data : null;
    }).catch(function () { return null; });
  }

  /* ---------- oauth return ---------- */

  function stripQuery() {
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* ignore */ }
  }

  // Telegram redirects back from oauth.telegram.org with ?id&auth_date&hash&…
  // Exchange those params for a desk session before the surfaces boot, so the
  // first render already sees the session. Resolves to null on success / no
  // return params, or to an honest error string on failure.
  function handleOAuthReturn() {
    var q;
    if (!location.search || location.search.length < 2) return Promise.resolve(null);
    try { q = new URLSearchParams(location.search); } catch (e) { return Promise.resolve(null); }
    if (!q.get('id') || !q.get('hash') || !q.get('auth_date')) return Promise.resolve(null);
    if (location.protocol !== 'https:') { stripQuery(); return Promise.resolve(null); }
    var payload = {};
    q.forEach(function (v, k) { payload[k] = v; });
    return fetchWithTimeout(DESK + '/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 10000).then(function (r) {
      if (r.ok) {
        return r.json().then(function (j) {
          if (j && j.token) {
            saveSession({
              token: String(j.token),
              name: j.name ? String(j.name) : 'subscriber',
              chat_id: j.chat_id != null ? String(j.chat_id) : '',
              exp: Number(j.exp) > 0 ? Number(j.exp) : Math.floor(Date.now() / 1000) + SESSION_TTL_S
            });
            stripQuery();
            return null;
          }
          stripQuery();
          return 'Sign-in failed — the desk returned no session. The free tier is unaffected.';
        }, function () {
          stripQuery();
          return 'Sign-in failed — the desk reply was unreadable. The free tier is unaffected.';
        });
      }
      stripQuery();
      if (r.status === 401) return 'Telegram sign-in could not be verified — nothing was stored. The free tier is unaffected.';
      if (r.status === 429) return 'Too many sign-in attempts — wait a minute, then try again. The free tier is unaffected.';
      if (r.status === 503) return 'Web sign-in is not configured on the server yet. The free tier is unaffected.';
      return 'Sign-in failed (HTTP ' + r.status + ') — nothing was stored. The free tier is unaffected.';
    }, function () {
      stripQuery();
      return 'Sign-in failed — the desk could not be reached. The free tier is unaffected.';
    });
  }

  /* ---------- header account widget ---------- */

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  function renderAccount() {
    var el = document.getElementById('account');
    if (!el) return;
    var s = session();
    if (!s) {
      el.innerHTML = '';
      loginUrl().then(function (url) {
        if (session()) { renderAccount(); return; }   // signed in meanwhile
        if (!url) return;                             // hidden on file:// or when the desk is down
        el.innerHTML = '<a class="acct-pill" href="' + esc(url) + '" rel="noopener">Sign in with Telegram</a>';
      });
      return;
    }
    entitlement().then(function (ent) {
      var cur = session();
      if (!cur) { renderAccount(); return; }          // session cleared (stale token) — logged-out view
      var mid;
      if (ent && ent.tier) {
        mid = '<span class="acct-tier">' + esc(String(ent.tier)) + '</span>';
        if (ent.entitled && ent.until) {
          var d = fmtDate(ent.until);
          if (d) mid += ' <span class="acct-until">· until ' + esc(d) + '</span>';
        }
      } else {
        mid = '<span class="acct-unknown">status unknown</span>';
      }
      el.innerHTML = '<span class="acct-pill acct-in">' +
        '<span class="acct-name">' + esc(cur.name || 'subscriber') + '</span> · ' + mid +
        '</span><button type="button" class="acct-logout" id="acct-logout">log out</button>';
      var btn = document.getElementById('acct-logout');
      if (btn) btn.addEventListener('click', logout);
    });
  }

  /* ---------- formatting ---------- */

  var TIER_CLASS = {
    DEFICIENT: 'chip-deficient',
    STRAINED: 'chip-strained',
    NORMAL: 'chip-normal',
    SURPLUS: 'chip-surplus'
  };

  function chip(tier) {
    var t = (tier == null ? '' : String(tier)).toUpperCase();
    if (TIER_CLASS[t]) {
      return '<span class="chip ' + TIER_CLASS[t] + '">' + esc(t) + '</span>';
    }
    // PARTIAL / null / unknown — disclosed as still accruing, never as calm.
    return '<span class="chip chip-accruing">accruing</span>';
  }

  function usd(n) {
    if (n == null || isNaN(n)) return '—';
    var v = Number(n);
    var a = Math.abs(v);
    var sign = v < 0 ? '-' : '';
    if (a >= 1e9) return sign + '$' + (a / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B';
    if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
    if (a >= 1e3) return sign + '$' + Math.round(a).toLocaleString('en-US');
    if (a >= 1) return sign + '$' + a.toFixed(2);
    if (a > 0) return sign + '$' + a.toPrecision(2);
    return '$0';
  }

  function bp(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toFixed(1) + ' bp';
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function ts(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() +
           ' ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ' UTC';
  }

  function stale(asof) {
    return '<p class="asof">as of ' + esc(ts(asof)) + '</p>';
  }

  /* ---------- honesty machinery blocks ---------- */

  function cta(feature) {
    return '<div class="locked">' +
      '<p class="locked-title">🔒 ' + esc(feature) + '</p>' +
      '<p class="locked-body">This surface is part of the full Telegram desk. ' +
      'The web tier shows the free row only — nothing is hidden by calm colors here, just locked.</p>' +
      '<p><a class="locked-link" href="' + TG + '" rel="noopener">' +
      'Unlock in the Telegram desk — /subscribe, ≈$29/mo →</a></p>' +
      '</div>';
  }

  function empty(msg) {
    return '<div class="empty">' +
      '<p><strong>' + esc(msg || 'Could not load this surface.') + '</strong></p>' +
      '<p class="empty-sub">Nothing is faked in the meantime — absence of data is disclosed, never rendered as calm.</p>' +
      '</div>';
  }

  function loading() {
    return '<div class="loading"><p>Loading the latest published pack…</p></div>';
  }

  /* ---------- registration ---------- */

  function mount(id, title, renderFn) {
    surfaces[id] = { title: title, renderFn: renderFn };
    if (booted) addTab(id);           // tolerate late-loading surface scripts
  }

  /* ---------- router ---------- */

  function addTab(id) {
    var nav = document.getElementById('tabs');
    if (!nav || document.getElementById('tab-' + id)) return;
    var a = document.createElement('a');
    a.id = 'tab-' + id;
    a.href = '#/' + id;
    a.textContent = surfaces[id].title;
    a.setAttribute('role', 'tab');
    // insert respecting the fixed surface order
    var idx = TAB_ORDER.indexOf(id);
    var next = null;
    for (var i = idx + 1; i < TAB_ORDER.length; i++) {
      var cand = document.getElementById('tab-' + TAB_ORDER[i]);
      if (cand) { next = cand; break; }
    }
    nav.insertBefore(a, next);
  }

  function idFromHash() {
    var m = /^#\/([a-z]+)/.exec(location.hash || '');
    var id = m && m[1];
    if (id && surfaces[id]) return id;
    for (var i = 0; i < TAB_ORDER.length; i++) {
      if (surfaces[TAB_ORDER[i]]) return TAB_ORDER[i];
    }
    return null;
  }

  function show(id) {
    var root = document.getElementById('surface');
    if (!root) return;
    if (!id || !surfaces[id]) {
      root.innerHTML = empty('No surfaces registered.');
      return;
    }
    currentId = id;
    var seq = ++renderSeq;

    var tabs = document.querySelectorAll('#tabs a');
    for (var i = 0; i < tabs.length; i++) {
      var active = tabs[i].id === 'tab-' + id;
      tabs[i].className = active ? 'active' : '';
      if (active) tabs[i].setAttribute('aria-current', 'page');
      else tabs[i].removeAttribute('aria-current');
    }

    root.innerHTML = loading();
    var s = surfaces[id];
    var result;
    try {
      result = s.renderFn(root);
    } catch (e) {
      root.innerHTML = empty('Could not render this surface (' + (e && e.message ? e.message : 'error') + ').');
      return;
    }
    Promise.resolve(result).then(function () {
      if (seq !== renderSeq || currentId !== id) return;   // user moved on
      if (id === 'board') headerAsof();
    }).catch(function (e) {
      if (seq !== renderSeq || currentId !== id) return;
      root.innerHTML = empty('Could not render this surface (' + (e && e.message ? e.message : 'error') + ').');
    });
  }

  function headerAsof() {
    var el = document.getElementById('board-asof');
    if (!el || el.getAttribute('data-done')) return;
    pack('board').then(function (j) {
      if (j && j.asof) {
        el.innerHTML = 'board as of ' + esc(ts(j.asof));
        el.setAttribute('data-done', '1');
        el.style.display = '';
      }
    });
  }

  function onRoute() { show(idFromHash()); }

  function boot(authErr) {
    booted = true;
    for (var i = 0; i < TAB_ORDER.length; i++) {
      if (surfaces[TAB_ORDER[i]]) addTab(TAB_ORDER[i]);
    }
    window.addEventListener('hashchange', onRoute);
    renderAccount();
    if (authErr) {
      // Sign-in was attempted and failed — disclosed in the surface area.
      // The free tier itself is unaffected; any tab click renders normally.
      var root = document.getElementById('surface');
      if (root) root.innerHTML = empty(authErr);
      return;
    }
    onRoute();
  }

  // The oauth return exchange runs before boot so the first surface render
  // already has the session when Telegram just signed the user in.
  function start() {
    handleOAuthReturn().then(function (authErr) { boot(authErr || null); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  /* ---------- public contract ---------- */

  window.UT = {
    MIRROR: MIRROR,
    DESK: DESK,
    esc: esc,
    pack: pack,
    summary: summary,
    mount: mount,
    chip: chip,
    usd: usd,
    bp: bp,
    ts: ts,
    stale: stale,
    cta: cta,
    empty: empty,
    session: session,
    logout: logout,
    loginUrl: loginUrl,
    entitlement: entitlement,
    authedPack: authedPack
  };
})();
