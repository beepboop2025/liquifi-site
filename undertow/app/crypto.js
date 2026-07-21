/* Undertow web desk — crypto surface (free tier + subscriber web desk).
   Free tier mirrors the bot's /crypto + /map free view: USDT/USD peg read,
   an exit-size selector derived from the pack's published rungs, a
   per-venue exit-cost table for BTC with the cheapest door highlighted,
   the _heat bucket map, venue concentration, and the RESEARCH
   liquidity-state line. ETH and the S(-1) venue-failure scenario stay
   locked behind the Telegram CTA.
   Subscriber path: when UT.authedPack('crypto_desk') returns the full
   pack (valid entitled session), the whole desk unlocks on the web —
   BTC + ETH, each with the S(-1) venue-failure scenario from
   venue_concentration.withdrawal_scenario (labelled 'scenario, not
   forecast', mirroring the bot's _crypto_asset_lines entitled branch).
   Instant flip alerts stay in the Telegram desk (/watch).
   Classic script; depends only on window.UT (core.js, loaded first). */
(function () {
  "use strict";

  var currentRung = null; // selected exit size, persists across tab shows

  var CSS = "" +
    "<style>" +
    ".utc{font-family:inherit}" +
    ".utc .peg{margin:6px 0 14px;font-size:13.5px;color:var(--faint,#94A3B8)}" +
    ".utc .peg.warn{color:var(--amber,#F59E0B);border:1px dashed var(--amber,#F59E0B);" +
    "border-radius:8px;padding:10px 12px}" +
    ".utc h3{font-size:15px;color:var(--blue,#38BDF8);margin:18px 0 8px}" +
    ".utc .pills{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px}" +
    ".utc .pill{background:var(--panel,#111A2E);border:1px solid var(--line,#1E293B);" +
    "color:var(--text,#E2E8F0);border-radius:999px;padding:6px 14px;font-size:13px;" +
    "cursor:pointer;font-family:inherit}" +
    ".utc .pill:hover{border-color:var(--blue,#38BDF8)}" +
    ".utc .pill.on{background:var(--blue,#38BDF8);color:#06121F;font-weight:bold;" +
    "border-color:var(--blue,#38BDF8)}" +
    ".utc .pillslab{font-size:12.5px;color:var(--faint,#94A3B8);align-self:center}" +
    ".utc table{border-collapse:collapse;width:100%;font-size:13.5px;margin:4px 0 8px}" +
    ".utc th{color:var(--faint,#94A3B8);text-align:left;font-weight:normal;" +
    "padding:6px 10px;border-bottom:1px solid var(--line,#1E293B)}" +
    ".utc td{padding:7px 10px;border-bottom:1px solid var(--line,#1E293B)}" +
    ".utc td.num,.utc th.num{text-align:right;font-variant-numeric:tabular-nums}" +
    ".utc tr.best td{background:rgba(56,189,248,.08)}" +
    ".utc tr.best td:first-child{border-left:3px solid var(--blue,#38BDF8)}" +
    ".utc td:first-child{border-left:3px solid transparent}" +
    ".utc .tag{display:inline-block;margin-left:8px;font-size:11px;color:var(--blue,#38BDF8);" +
    "border:1px solid var(--blue,#38BDF8);border-radius:4px;padding:0 5px}" +
    ".utc .door{margin:8px 0 2px;font-size:13.5px;color:var(--faint,#94A3B8)}" +
    ".utc .door strong{color:var(--text,#E2E8F0)}" +
    ".utc .heat{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0 4px}" +
    ".utc .hcell{width:34px;height:30px;border-radius:5px;display:flex;align-items:center;" +
    "justify-content:center;font-size:11px;color:#06121F;font-weight:bold}" +
    ".utc .hcell.x{background:var(--panel,#111A2E);color:var(--faint,#94A3B8);" +
    "border:1px dashed var(--line,#1E293B)}" +
    ".utc .hrow{display:flex;align-items:center;gap:8px;margin:3px 0}" +
    ".utc .hrow .vname{width:76px;font-size:12.5px;color:var(--faint,#94A3B8);" +
    "overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".utc .hhead{display:flex;gap:4px;margin-left:84px;flex-wrap:wrap}" +
    ".utc .hhead span{width:34px;text-align:center;font-size:11px;color:var(--faint,#94A3B8)}" +
    ".utc .legend{font-size:11.5px;color:var(--faint,#94A3B8);margin:6px 0 0}" +
    ".utc .conc{font-size:13.5px;color:var(--faint,#94A3B8);margin:10px 0}" +
    ".utc .conc strong{color:var(--text,#E2E8F0)}" +
    ".utc .scen{margin:12px 0 2px;font-size:13.5px;color:var(--text,#E2E8F0);" +
    "background:var(--panel,#111A2E);border:1px solid var(--line,#1E293B);" +
    "border-left:3px solid var(--amber,#F59E0B);border-radius:8px;padding:10px 12px}" +
    ".utc .sclab{display:block;font-size:11px;font-weight:bold;letter-spacing:.06em;" +
    "text-transform:uppercase;color:var(--amber,#F59E0B);margin-bottom:5px}" +
    ".utc .state{font-size:13.5px;color:var(--faint,#94A3B8);margin:4px 0 0}" +
    ".utc .note{font-size:12px;color:var(--faint,#94A3B8);margin:2px 0 0;opacity:.85}" +
    ".utc .subbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;" +
    "margin:2px 0 10px}" +
    ".utc .subchip{font-size:11px;font-weight:bold;letter-spacing:.06em;" +
    "text-transform:uppercase;color:#06121F;background:var(--amber,#F59E0B);" +
    "border-radius:999px;padding:3px 10px}" +
    ".utc .subnote{font-size:12px;color:var(--faint,#94A3B8)}" +
    ".utc .tgline{margin-top:16px;font-size:12.5px;color:var(--faint,#94A3B8)}" +
    ".utc details{margin:16px 0;border:1px solid var(--line,#1E293B);border-radius:8px;" +
    "background:var(--panel,#111A2E);padding:10px 14px}" +
    ".utc summary{cursor:pointer;color:var(--blue,#38BDF8);font-size:13.5px}" +
    ".utc details h4{font-size:12.5px;color:var(--text,#E2E8F0);margin:12px 0 4px;" +
    "text-transform:uppercase;letter-spacing:.08em}" +
    ".utc details p{font-size:13px;color:var(--faint,#94A3B8);margin:0}" +
    ".utc .disc{margin-top:18px;font-size:12.5px;color:var(--faint,#94A3B8);" +
    "border-top:1px solid var(--line,#1E293B);padding-top:12px}" +
    "</style>";

  // Same shade ladder as the bot's _heat: <=0.1 / <=1 / <=10 / >10 bp,
  // one hue light->dark (colorblind-immune lightness ladder), ✕ unknown.
  var HEAT_BINS = [
    [0.1, "rgba(56,189,248,.18)"],
    [1.0, "rgba(56,189,248,.38)"],
    [10.0, "rgba(56,189,248,.62)"],
    [Infinity, "rgba(56,189,248,.92)"]
  ];

  function heatColor(bp) {
    if (typeof bp !== "number" || !isFinite(bp)) return null;
    for (var i = 0; i < HEAT_BINS.length; i++) {
      if (bp <= HEAT_BINS[i][0]) return HEAT_BINS[i][1];
    }
    return HEAT_BINS[HEAT_BINS.length - 1][1];
  }

  // Bot's _RETAIL_Q_LABEL; anything else falls back to UT.usd.
  function sizeLabel(q) {
    var known = { 1e3: "$1k", 1e4: "$10k", 1e5: "$100k", 1e6: "$1M" };
    return known[q] || UT.usd(q);
  }

  function rungsOf(block) {
    var out = [];
    var rows = (block && block.exit_table) || [];
    for (var i = 0; i < rows.length; i++) {
      var q = rows[i] && rows[i].q_usd;
      if (typeof q === "number" && isFinite(q)) out.push(q);
    }
    return out.sort(function (a, b) { return a - b; });
  }

  function rowAt(block, rung) {
    var rows = (block && block.exit_table) || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].q_usd === rung) return rows[i];
    }
    return null;
  }

  function pegHtml(peg) {
    if (!peg || typeof peg.price !== "number") {
      return '<div class="peg warn">USDT/USD peg read: — (not in today\'s pack; ' +
        'the USD≈USDT equivalence is disclosed, not assumed)</div>';
    }
    var price = peg.price.toFixed(4);
    var dev = typeof peg.deviation === "number" ? (peg.deviation * 100).toFixed(2) : null;
    var thr = typeof peg.depeg_warn_threshold === "number"
      ? (peg.depeg_warn_threshold * 100).toFixed(1) : null;
    var src = peg.source ? " · " + UT.esc(peg.source) : "";
    if (peg.depeg_flag) {
      return '<div class="peg warn">⚠ USDT/USD at ' + UT.esc(price) +
        (dev ? " — " + dev + "% off peg" : "") +
        (thr ? " (warn threshold " + thr + "%)" : "") + src +
        ". USD- and USDT-quoted venues are NOT comparable right now; the " +
        "equivalence assumption is flagged, not assumed.</div>";
    }
    return '<div class="peg">USDT/USD ' + UT.esc(price) +
      (dev ? " — dev " + dev + "%" : "") +
      (thr ? ", under the " + thr + "% warn threshold" : "") + src + ".</div>";
  }

  function tableHtml(block, rung) {
    var row = rowAt(block, rung);
    if (!row) return UT.empty("No published exit row at this size today.");
    var byVenue = row.sell_bp_by_venue || {};
    var conc = block.venue_concentration || {};
    var depthBy = conc.depth_usd_by_venue || {};
    var shareBy = conc.share_by_venue || {};
    var best = row.best_venue || {};
    var worst = row.worst_venue || {};
    var venues = Object.keys(byVenue).sort(function (a, b) {
      var xa = byVenue[a], xb = byVenue[b];
      var na = typeof xa === "number" && isFinite(xa);
      var nb = typeof xb === "number" && isFinite(xb);
      if (na && nb) return xa - xb;          // cheapest door first
      if (na) return -1;
      if (nb) return 1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    var h = '<table><thead><tr><th>Venue</th>' +
      '<th class="num">Exit cost (sell)</th>' +
      '<th class="num">Depth ±1%</th>' +
      '<th class="num">Depth share</th></tr></thead><tbody>';
    if (!venues.length) {
      h += '<tr><td colspan="4">No venue can absorb this size within its ' +
        'observed book — the refusal is the reading.</td></tr>';
    }
    for (var i = 0; i < venues.length; i++) {
      var v = venues[i];
      var isBest = best.venue === v && typeof byVenue[v] === "number";
      var share = typeof shareBy[v] === "number"
        ? (shareBy[v] * 100).toFixed(1) + "%" : "—";
      h += '<tr class="' + (isBest ? "best" : "") + '">' +
        "<td>" + UT.esc(v) + (isBest ? '<span class="tag">cheapest door</span>' : "") + "</td>" +
        '<td class="num">' + UT.bp(byVenue[v]) + "</td>" +
        '<td class="num">' + UT.usd(depthBy[v]) + "</td>" +
        '<td class="num">' + share + "</td></tr>";
    }
    h += "</tbody></table>";
    var door = "";
    if (best.venue && typeof best.sell_bp === "number") {
      door = '<div class="door">Cheapest door out today at ' +
        UT.esc(sizeLabel(rung)) + ": <strong>" + UT.esc(best.venue) + " · " +
        UT.bp(best.sell_bp) + "</strong>";
      if (worst.venue && worst.venue !== best.venue &&
          typeof worst.sell_bp === "number") {
        door += " · dearest " + UT.esc(worst.venue) + " " + UT.bp(worst.sell_bp);
      }
      if (typeof row.venue_spread_bp === "number") {
        door += " · venue spread " + UT.bp(row.venue_spread_bp);
      }
      door += "</div>";
    }
    var unable = row.unable_at_observed_depth || [];
    if (unable.length) {
      door += '<div class="door">Cannot absorb ' + UT.esc(sizeLabel(rung)) +
        " at observed depth: <strong>" +
        unable.map(UT.esc).join(", ") + "</strong>.</div>";
    }
    return h + door;
  }

  function heatHtml(block) {
    var rows = (block && block.exit_table) || [];
    if (!rows.length) return "";
    var conc = block.venue_concentration || {};
    var shareBy = conc.share_by_venue || {};
    // Venue order: by depth share (map ordering), falling back to any
    // venue named in the exit rows.
    var seen = {};
    var venues = Object.keys(shareBy).sort(function (a, b) {
      return shareBy[b] - shareBy[a];
    });
    for (var i = 0; i < rows.length; i++) {
      var bv = rows[i].sell_bp_by_venue || {};
      for (var v in bv) {
        if (Object.prototype.hasOwnProperty.call(bv, v) &&
            venues.indexOf(v) < 0 && !seen[v]) {
          seen[v] = 1;
          venues.push(v);
        }
      }
    }
    var h = '<div class="hhead">';
    for (i = 0; i < rows.length; i++) {
      h += "<span>" + UT.esc(sizeLabel(rows[i].q_usd)) + "</span>";
    }
    h += "</div>";
    for (i = 0; i < venues.length; i++) {
      v = venues[i];
      h += '<div class="hrow"><span class="vname">' + UT.esc(v) + "</span>" +
        '<span class="heat">';
      for (var j = 0; j < rows.length; j++) {
        var bp = (rows[j].sell_bp_by_venue || {})[v];
        var c = heatColor(typeof bp === "number" ? bp : null);
        h += c
          ? '<span class="hcell" style="background:' + c + '" title="' +
            UT.esc(v) + " · " + UT.esc(sizeLabel(rows[j].q_usd)) + " · " +
            UT.esc(UT.bp(bp)) + '">' +
            (typeof bp === "number" ? (bp < 1 ? bp.toFixed(2) : bp.toFixed(1)) : "") +
            "</span>"
          : '<span class="hcell x" title="' + UT.esc(v) + " · " +
            UT.esc(sizeLabel(rows[j].q_usd)) + ' · beyond observed book">✕</span>';
      }
      h += "</span></div>";
    }
    h += '<div class="legend">One-day sell cost per venue, bp in cell. ' +
      "Light→dark: ≤0.1 · ≤1 · ≤10 · &gt;10 bp · ✕ beyond observed book.</div>";
    return h;
  }

  function concHtml(block) {
    var conc = (block && block.venue_concentration) || {};
    var shares = conc.share_by_venue || {};
    var venues = Object.keys(shares).sort(function (a, b) {
      return shares[b] - shares[a];
    });
    if (!venues.length) return "";
    var txt = venues.map(function (v) {
      return UT.esc(v) + " " + (shares[v] * 100).toFixed(0) + "%";
    }).join(" · ");
    var neff = typeof conc.n_eff_venues === "number"
      ? conc.n_eff_venues.toFixed(1) : "—";
    return '<div class="conc">🚪 Which door are you depending on? ±1% depth: ' +
      txt + " — effectively <strong>" + UT.esc(neff) + " doors</strong> open.</div>";
  }

  // S(-1) venue-failure withdrawal scenario — subscriber-only, mirrors the
  // bot's _crypto_asset_lines entitled branch (top venue goes dark, the
  // surviving venues' residual 10bp sell capacity, split execution
  // declared). Always labelled 'scenario, not forecast'.
  function scenHtml(block) {
    var conc = (block && block.venue_concentration) || {};
    var ws = conc.withdrawal_scenario || {};
    var top = (conc.cr1_top_venue || {}).venue;
    var res = (ws.residual_sell_capacity || {})["10bp"] || {};
    if (!top || typeof ws.depth_share_lost !== "number" ||
        typeof res.sell_capacity_usd !== "number") {
      return '<div class="scen"><span class="sclab">S(-1) venue-failure ' +
        'scenario — scenario, not forecast</span>Not in today\'s pack for ' +
        'this asset — the absence is disclosed, never read as safety.</div>';
    }
    var atleast = res.at_least ? "≥" : "≈";
    var lostPct = (ws.depth_share_lost * 100).toFixed(0);
    var capM = (res.sell_capacity_usd / 1e6).toFixed(1);
    var h = '<div class="scen"><span class="sclab">S(-1) venue-failure ' +
      'scenario — scenario, not forecast</span>If <strong>' + UT.esc(top) +
      "</strong> goes dark (halt/geoblock/failure): " + UT.esc(lostPct) +
      "% of depth is gone; surviving venues still quote " + atleast + "$" +
      UT.esc(capM) + "M of sell capacity within 10bp (split execution).</div>";
    if (ws.assumption) {
      h += '<div class="note">' + UT.esc(ws.assumption) + "</div>";
    }
    return h;
  }

  function regimeHtml(block) {
    var reg = (block && block.regime) || {};
    var cur = reg.current_state || {};
    var eps = ((reg.episodes || {}).n_episodes);
    var state = cur.state || "withheld (history still accruing)";
    var h = '<div class="state">🌊 Liquidity state: <strong>' + UT.esc(state) +
      "</strong> (RESEARCH label) · depth-collapse episodes on record: " +
      UT.esc(typeof eps === "number" ? String(eps) : "—") + "</div>";
    if (cur.note) h += '<div class="note">' + UT.esc(cur.note) + "</div>";
    return h;
  }

  function methodHtml(notes) {
    var keys = notes ? Object.keys(notes) : [];
    if (!keys.length) return "";
    var h = "<details><summary>Method &amp; limits (from the pack, verbatim)</summary>";
    for (var i = 0; i < keys.length; i++) {
      h += "<h4>" + UT.esc(keys[i]) + "</h4><p>" + UT.esc(notes[keys[i]]) + "</p>";
    }
    return h + "</details>";
  }

  function freeBodyHtml(pack) {
    var assets = pack.assets || {};
    var btc = assets.BTC;
    var h = CSS + '<div class="utc">';
    h += UT.stale(pack.asof);
    h += pegHtml(pack.usdt_usd);

    if (!btc || !rungsOf(btc).length) {
      h += "<h3>BTC — exit cost per venue</h3>" +
        UT.empty("BTC is not in today's crypto desk pack — nothing is faked " +
          "in the meantime.");
    } else {
      var rungs = rungsOf(btc);
      if (currentRung === null || rungs.indexOf(currentRung) < 0) {
        // Default: the $10k rung the bot leads with, else the smallest rung.
        currentRung = rungs.indexOf(1e4) >= 0 ? 1e4 : rungs[0];
      }
      h += "<h3>BTC — exit cost per venue, at your size</h3>";
      h += '<div class="pills" role="group" aria-label="Exit size">';
      for (var i = 0; i < rungs.length; i++) {
        h += '<button type="button" class="pill' +
          (rungs[i] === currentRung ? " on" : "") + '" data-rung="' + rungs[i] +
          '">' + UT.esc(sizeLabel(rungs[i])) + "</button>";
      }
      h += "</div>";
      h += tableHtml(btc, currentRung);
      h += "<h3>Depth map — BTC</h3>" + heatHtml(btc);
      h += concHtml(btc);
      h += regimeHtml(btc);
    }

    // ETH desk + the S(-1) venue-failure scenario are subscriber-only.
    h += "<h3>ETH</h3>" +
      UT.cta("the ETH desk and the S(-1) venue-failure scenario — " +
        "≈$29/mo in Telegram");

    h += methodHtml(pack.method_notes);
    if (pack.disclaimer) {
      h += '<div class="disc">' + UT.esc(pack.disclaimer) + "</div>";
    }
    return h + "</div>";
  }

  // One asset's full desk section (subscriber view): exit-cost table at the
  // shared rung, the S(-1) scenario, depth map, concentration, regime.
  function assetHtml(symbol, block, rung) {
    if (!block || !rungsOf(block).length) {
      return "<h3>" + UT.esc(symbol) + " — exit cost per venue</h3>" +
        UT.empty(UT.esc(symbol) + " is not in today's crypto desk pack — " +
          "nothing is faked in the meantime.");
    }
    return "<h3>" + UT.esc(symbol) + " — exit cost per venue, at your size</h3>" +
      tableHtml(block, rung) +
      scenHtml(block) +
      "<h3>Depth map — " + UT.esc(symbol) + "</h3>" + heatHtml(block) +
      concHtml(block) +
      regimeHtml(block);
  }

  // Subscriber view: everything the free BTC view shows, for BTC AND ETH,
  // plus the S(-1) venue-failure scenario per asset. One exit-size
  // selector, shared across both assets (the published grid is the same).
  function entitledBodyHtml(pack) {
    var assets = (pack && pack.assets) || {};
    var btc = assets.BTC;
    var eth = assets.ETH;
    var rungs = rungsOf(btc);
    var extra = rungsOf(eth);
    for (var i = 0; i < extra.length; i++) {
      if (rungs.indexOf(extra[i]) < 0) rungs.push(extra[i]);
    }
    rungs.sort(function (a, b) { return a - b; });
    if (rungs.length && (currentRung === null || rungs.indexOf(currentRung) < 0)) {
      // Default: the $10k rung the bot leads with, else the smallest rung.
      currentRung = rungs.indexOf(1e4) >= 0 ? 1e4 : rungs[0];
    }
    var h = CSS + '<div class="utc">';
    h += UT.stale(pack && pack.asof);
    h += '<div class="subbar"><span class="subchip">subscriber tier</span>' +
      '<span class="subnote">full desk unlocked — BTC + ETH + the S(-1) ' +
      'venue-failure scenario</span></div>';
    h += pegHtml(pack && pack.usdt_usd);
    if (rungs.length) {
      h += '<div class="pills" role="group" aria-label="Exit size">' +
        '<span class="pillslab">exit size, both assets:</span>';
      for (i = 0; i < rungs.length; i++) {
        h += '<button type="button" class="pill' +
          (rungs[i] === currentRung ? " on" : "") + '" data-rung="' + rungs[i] +
          '">' + UT.esc(sizeLabel(rungs[i])) + "</button>";
      }
      h += "</div>";
    }
    h += assetHtml("BTC", btc, currentRung);
    h += assetHtml("ETH", eth, currentRung);
    h += '<div class="tgline">instant flip alerts live in the Telegram ' +
      'desk (/watch)</div>';
    h += methodHtml(pack && pack.method_notes);
    if (pack && pack.disclaimer) {
      h += '<div class="disc">' + UT.esc(pack.disclaimer) + "</div>";
    }
    return h + "</div>";
  }

  function bind(root, pack, entitled) {
    var pills = root.querySelectorAll(".utc .pill");
    for (var i = 0; i < pills.length; i++) {
      pills[i].addEventListener("click", function () {
        var q = parseFloat(this.getAttribute("data-rung"));
        if (isFinite(q)) {
          currentRung = q;
          root.innerHTML = entitled ? entitledBodyHtml(pack) : freeBodyHtml(pack);
          bind(root, pack, entitled);
        }
      });
    }
  }

  async function render(root) {
    root.innerHTML = '<div class="utc"><div class="peg">Loading the crypto desk pack…</div></div>';
    // Subscriber path first: a valid entitled session returns the full pack.
    // Degrade to the free view on 401/403/failure — or on an old core.js
    // that predates UT.authedPack.
    var full = null;
    if (typeof UT.authedPack === "function") {
      try {
        full = await UT.authedPack("crypto_desk");
      } catch (e) {
        full = null;
      }
    }
    if (full && typeof full === "object") {
      root.innerHTML = entitledBodyHtml(full);
      bind(root, full, true);
      return;
    }
    var pack = await UT.pack("crypto_desk");
    if (!pack) {
      root.innerHTML = UT.empty("Could not load the crypto desk pack — " +
        "nothing is faked in the meantime.");
      return;
    }
    root.innerHTML = freeBodyHtml(pack);
    bind(root, pack, false);
  }

  UT.mount("crypto", "Crypto desk", render);
})();
