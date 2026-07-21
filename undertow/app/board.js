/* Undertow web desk — Board surface (free mirror of the bot's /board, plus the
   subscriber path mirroring the bot's format_segment entitled behavior).
   Classic script; only core.js is guaranteed to have loaded first.
   Renders segment tier strip + per-segment cards + the informational overlay,
   with absence-of-data disclosed (accruing), never faked calm.
   Signed-in subscribers (UT.authedPack resolves with the full pack) get every
   measure row with its note; the free tier keeps summary cards and an honest
   teaser — first two measures without notes, remainder disclosed, never faked. */
(function () {
  "use strict";

  var CSS_ID = "utb-style";
  var CSS = [
    ".utb-head{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;margin-bottom:10px}",
    ".utb-muted{color:var(--faint,#94A3B8);font-size:12px;line-height:1.5}",
    ".utb-sub{display:inline-flex;align-items:center;border:1px solid var(--amber,#F59E0B);color:var(--amber,#F59E0B);border-radius:8px;padding:2px 8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}",
    ".utb-strip{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0 6px}",
    ".utb-strip-item{display:inline-flex;align-items:center;gap:7px;background:var(--panel,#111A2E);border:1px solid var(--line,#1E293B);border-radius:8px;padding:5px 9px}",
    ".utb-strip-name{font-weight:600;font-size:12px;letter-spacing:.05em;color:var(--text,#E2E8F0)}",
    ".utb-funding{display:inline-flex;align-items:center;gap:6px;border:1px dashed var(--amber,#F59E0B);color:var(--amber,#F59E0B);border-radius:8px;padding:5px 9px;font-size:12px;font-weight:600;letter-spacing:.03em}",
    ".utb-funding-note{margin:0 0 12px}",
    ".utb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin:0 0 16px}",
    ".utb-card{background:var(--panel,#111A2E);border:1px solid var(--line,#1E293B);border-radius:10px;padding:12px}",
    ".utb-card-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}",
    ".utb-card-name{font-weight:700;font-size:14px;letter-spacing:.05em;color:var(--text,#E2E8F0)}",
    ".utb-meta{font-size:12px;color:var(--faint,#94A3B8);line-height:1.6}",
    ".utb-note{font-size:12px;line-height:1.55;color:var(--text,#E2E8F0);margin:8px 0 0}",
    ".utb-measures{margin:8px 0 0;border-top:1px solid var(--line,#1E293B);padding-top:8px;display:flex;flex-direction:column;gap:8px}",
    ".utb-mrow{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;font-size:12px;line-height:1.5}",
    ".utb-mname{font-weight:600;color:var(--text,#E2E8F0)}",
    ".utb-mbadge{display:inline-block;border-radius:6px;padding:1px 6px;font-size:11px;font-weight:700;background:rgba(148,163,184,.12);color:var(--text,#E2E8F0)}",
    ".utb-mbadge-accruing{color:var(--amber,#F59E0B);background:rgba(245,158,11,.10)}",
    ".utb-mmeta{color:var(--faint,#94A3B8);font-size:11px}",
    ".utb-mnote{font-size:12px;line-height:1.55;color:var(--faint,#94A3B8);margin:2px 0 0}",
    ".utb-teaser{margin:10px 0 0}",
    ".utb-info{border:1px dashed var(--amber,#F59E0B);border-radius:10px;padding:12px;margin:0 0 16px;background:rgba(245,158,11,.05)}",
    ".utb-info-title{margin:0 0 4px;font-size:13px;font-weight:700;color:var(--amber,#F59E0B);letter-spacing:.04em}",
    ".utb-info-policy{font-size:12px;color:var(--faint,#94A3B8);margin:0 0 8px;line-height:1.5}",
    ".utb-info-mod{margin:8px 0 0}",
    ".utb-info-name{font-size:12px;font-weight:700;color:var(--text,#E2E8F0);letter-spacing:.04em}",
    ".utb-info-bit{font-size:12px;color:var(--faint,#94A3B8);line-height:1.55;margin:2px 0 0}",
    ".utb-foot{margin:2px 0 12px}"
  ].join("\n");

  function ensureCss() {
    if (typeof document === "undefined") return;
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement("style");
    s.id = CSS_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* Mirror the bot's _segments(): accept either a dict or a list of cells. */
  function segmentsOf(board) {
    var segs = board && board.segments;
    if (!segs || typeof segs !== "object") return {};
    if (Array.isArray(segs)) {
      var out = {};
      segs.forEach(function (cell) {
        if (cell && cell.segment != null) out[String(cell.segment)] = cell;
      });
      return out;
    }
    return segs;
  }

  function esc(v) { return UT.esc(v == null ? "" : String(v)); }

  function num(v) { return typeof v === "number" && isFinite(v); }

  /* The measures array of a segment cell; [] when absent (the trimmed free
     mirror may carry no measures at all — never error on absent keys). */
  function measuresOf(cell) {
    var ms = cell && typeof cell === "object" ? cell.measures : null;
    return Array.isArray(ms) ? ms : [];
  }

  /* Stress percentile badge like the bot's f"{sp:.0%}": a percent when the
     percentile exists, 'accruing' when null — never a faked number. */
  function pctlBadge(sp) {
    if (num(sp)) {
      return '<span class="utb-mbadge">' + esc(Math.round(sp * 100) + "%") + "</span>";
    }
    return '<span class="utb-mbadge utb-mbadge-accruing">accruing</span>';
  }

  /* One measure row mirroring the bot's format_segment line:
     name — badge (asof X, n=Y); the note line only when withNote and the
     note actually exists (entitled path only). */
  function measureRow(m, withNote) {
    m = m && typeof m === "object" ? m : {};
    var h = '<div class="utb-mrow"><span class="utb-mname">' +
            esc(m.measure != null ? m.measure : "?") + "</span>" +
            pctlBadge(m.stress_pctl) +
            '<span class="utb-mmeta">asof ' +
            esc(m.asof != null ? m.asof : "?") +
            " · n=" + esc(m.obs != null ? m.obs : "?") + "</span></div>";
    if (withNote && typeof m.note === "string" && m.note) {
      h += '<p class="utb-mnote">' + esc(m.note) + "</p>";
    }
    return h;
  }

  function segmentCard(name, cell, entitled) {
    var tier = cell && typeof cell === "object" ? cell.tier : null;
    var h = '<div class="utb-card">';
    h += '<div class="utb-card-head"><span class="utb-card-name">' + esc(name) + "</span>" + UT.chip(tier) + "</div>";
    var meta = [];
    if (num(cell.score)) meta.push("mean stress pctl " + esc(cell.score.toFixed(2)));
    if (num(cell.n_measures)) {
      var m = esc(cell.n_measures) + " measure" + (cell.n_measures === 1 ? "" : "s");
      if (num(cell.n_qualifying)) m += " · " + esc(cell.n_qualifying) + " qualifying";
      else if (tier === "PARTIAL" || tier === "UNAVAILABLE" || tier == null) m += " accruing";
      meta.push(m);
    }
    if (meta.length) h += '<div class="utb-meta">' + meta.join(" · ") + "</div>";
    /* one-line read/note fields present in the pack cell — only if they exist */
    if (typeof cell.note === "string" && cell.note) {
      h += '<p class="utb-note">' + esc(cell.note) + "</p>";
    }
    if (typeof cell.dispersion_note === "string" && cell.dispersion_note) {
      h += '<p class="utb-note">' + esc(cell.dispersion_note) + "</p>";
    }

    var measures = measuresOf(cell);
    if (entitled) {
      /* subscriber path (bot's format_segment entitled): every measure as a
         row with its note in muted text. */
      if (measures.length) {
        h += '<div class="utb-measures">';
        measures.forEach(function (mm) { h += measureRow(mm, true); });
        h += "</div>";
      }
    } else if (measures.length > 2) {
      /* free teaser (bot's format_segment free): the first two measures
         without notes, then the remainder disclosed — never hidden. */
      h += '<div class="utb-measures utb-teaser">';
      measures.slice(0, 2).forEach(function (mm) { h += measureRow(mm, false); });
      h += '<p class="utb-muted">…' + esc(measures.length - 2) +
           " more measures + full notes for subscribers</p>";
      h += "</div>";
    }
    h += "</div>";
    return h;
  }

  /* Informational overlay: rendered alongside the board, clearly marked as
     not a scored tier. Only string fields actually present are shown. */
  function infoSection(info) {
    if (!info || typeof info !== "object") return "";
    var mods = [];
    for (var key in info) {
      if (key === "policy" || !Object.prototype.hasOwnProperty.call(info, key)) continue;
      var mod = info[key];
      if (!mod || typeof mod !== "object") continue;
      var bits = [];
      ["label", "status", "alerts_policy", "note", "prereg"].forEach(function (f) {
        if (typeof mod[f] === "string" && mod[f]) bits.push(mod[f]);
      });
      var stamps = [];
      ["asof", "period"].forEach(function (f) {
        if (typeof mod[f] === "string" && mod[f]) stamps.push(mod[f]);
      });
      mods.push({ name: key, bits: bits, stamps: stamps });
    }
    if (!mods.length && typeof info.policy !== "string") return "";
    var h = '<div class="utb-info">';
    h += '<p class="utb-info-title">informational overlay — not a scored tier</p>';
    if (typeof info.policy === "string" && info.policy) {
      h += '<p class="utb-info-policy">' + esc(info.policy) + "</p>";
    }
    mods.forEach(function (mod) {
      h += '<div class="utb-info-mod"><span class="utb-info-name">' +
           esc(mod.name.replace(/_/g, " ")) + "</span>";
      if (mod.stamps.length) {
        h += ' <span class="utb-muted">· ' + esc(mod.stamps.join(" · ")) + "</span>";
      }
      mod.bits.forEach(function (bit) {
        h += '<p class="utb-info-bit">' + esc(bit) + "</p>";
      });
      h += "</div>";
    });
    h += "</div>";
    return h;
  }

  async function render(root) {
    ensureCss();
    /* Subscriber path first: the full board pack when the session is
       entitled; null on free/logged-out/any failure — fail closed to the
       free mirror, the gate never silently opens. Guarded for a core.js
       that predates the webdesk contract. */
    var authed = null;
    if (typeof UT.authedPack === "function") {
      try { authed = await UT.authedPack("board"); } catch (e) { authed = null; }
    }
    var entitled = !!authed;
    var board = authed || await UT.pack("board");
    if (!board) {
      root.innerHTML = UT.empty("the board pack could not be loaded — nothing is faked in the meantime");
      return;
    }

    var segs = segmentsOf(board);
    var names = Object.keys(segs).sort(); /* the bot's /board order: sorted() */
    var h = "";

    /* (4) header line: as-of + reading count + subscriber chip when entitled */
    h += '<div class="utb-head">';
    if (board.asof) h += UT.stale(board.asof);
    if (num(board.n_readings)) {
      h += '<span class="utb-muted">' + esc(board.n_readings) + " readings</span>";
    }
    if (entitled) h += '<span class="utb-sub">subscriber tier</span>';
    h += "</div>";

    /* (1) tier-row strip: one chip per segment, funding regime beside them */
    if (names.length) {
      h += '<div class="utb-strip">';
      names.forEach(function (name) {
        var cell = segs[name] || {};
        h += '<span class="utb-strip-item"><span class="utb-strip-name">' +
             esc(name) + "</span>" + UT.chip(cell.tier) + "</span>";
      });
      var fund = board.funding;
      if (fund && typeof fund === "object" && typeof fund.regime === "string" && fund.regime) {
        h += '<span class="utb-funding">FUNDING overlay · ' + esc(fund.regime) + "</span>";
      }
      h += "</div>";
      if (fund && typeof fund === "object") {
        var fnote = "";
        if (Array.isArray(fund.measures)) {
          for (var i = 0; i < fund.measures.length; i++) {
            var fm = fund.measures[i];
            if (fm && typeof fm.note === "string" && fm.note) { fnote = fm.note; break; }
          }
        }
        var basis = typeof fund.regime_basis === "string" && fund.regime_basis
          ? "regime basis: " + fund.regime_basis : "";
        if (fnote || basis) {
          h += '<p class="utb-muted utb-funding-note">' +
               esc(basis) + (basis && fnote ? " — " : "") + esc(fnote) + "</p>";
        }
      }
    }

    /* (2) a card per segment — full measure tables for subscribers, honest
       teasers on the free mirror */
    if (names.length) {
      h += '<div class="utb-grid">';
      names.forEach(function (name) { h += segmentCard(name, segs[name] || {}, entitled); });
      h += "</div>";
    } else {
      h += UT.empty("the board pack published no segments — nothing is faked in the meantime");
    }

    /* (3) informational overlay, clearly marked */
    h += infoSection(board.informational);

    /* (5) footnote; the disclaimer rides on every render. The gating CTA is
       free-tier only — a subscriber already has every measure note here. */
    h += '<div class="utb-foot"><span class="utb-muted">twice-daily rebuild · ' +
         (entitled
           ? "full measure detail unlocked · instant flip alerts in the Telegram desk · "
           : "full measure detail in the Telegram desk · ") +
         "research &amp; market data, not investment advice</span></div>";
    if (!entitled) h += UT.cta("every measure note and instant flip alerts");

    root.innerHTML = h;
  }

  UT.mount("board", "Board", render);
})();
