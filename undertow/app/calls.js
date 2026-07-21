/* Undertow web desk — Sealed calls surface (free tier).
   Mirrors the bot's /calls + /receipts public record: every call was
   hash-chained and post-quantum signed BEFORE its outcome, so misses render
   with the same weight as hits — nothing can be quietly deleted.
   Classic script; relies on window.UT from core.js (loaded first). */
(function () {
  "use strict";

  var C = {
    panel: "#111A2E", line: "#1E293B", text: "#E2E8F0", faint: "#94A3B8",
    blue: "#38BDF8", amber: "#F59E0B", hit: "#34D399", miss: "#F87171"
  };
  var MONO = "ui-monospace,Menlo,monospace";

  function trunc(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  function mono(value, n) {
    var full = String(value == null ? "" : value);
    return '<span style="font-family:' + MONO + ';font-size:12px" title="' +
      UT.esc(full) + '">' + UT.esc(trunc(full, n)) + "</span>";
  }

  function card(inner, extra) {
    return '<div style="background:' + C.panel + ";border:1px solid " + C.line +
      ';border-radius:10px;padding:14px 16px;margin:0 0 12px;' + (extra || "") +
      '">' + inner + "</div>";
  }

  function sectionLabel(t) {
    return '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;' +
      "color:" + C.faint + ';margin:4px 0 8px">' + t + "</div>";
  }

  function statusChip(outcome) {
    // same visual weight for hit and miss — only the colour differs
    var o = String(outcome || "PENDING").toUpperCase();
    var map = {
      HIT: { t: "✓ hit", c: C.hit },
      MISS: { t: "✗ miss", c: C.miss },
      VOID: { t: "◦ void — datum unavailable, never scored a win or loss", c: C.faint },
      UNSCORED: { t: "unscored prose", c: C.faint },
      NO_MARKET: { t: "market died", c: C.faint }
    };
    var s = map[o] || { t: "pending — settles at horizon", c: C.amber };
    return '<span style="display:inline-block;font-family:' + MONO +
      ';font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;' +
      "color:" + s.c + ";border:1px solid " + s.c + ';border-radius:999px;padding:2px 9px">' +
      s.t + "</span>";
  }

  /* Same bucketing as the bot's call_tally: every sealed call lands in
     exactly one bucket — a miss counts as a miss and is never hidden. */
  function tallyFromRecent(recent) {
    var t = { sealed: 0, hit: 0, miss: 0, void: 0, unscored: 0, pending: 0,
              blind_pending: 0, wild_hit: 0, wild_miss: 0, wild_nomarket: 0 };
    (recent || []).forEach(function (c) {
      t.sealed += 1;
      var out = String((c && c.outcome) || "").toUpperCase();
      var wild = !!(c && c.tier === "wild");
      if (out === "NO_MARKET") t.wild_nomarket += 1;
      else if ((out === "HIT" || out === "MISS") && wild) {
        t[out === "HIT" ? "wild_hit" : "wild_miss"] += 1;
      }
      else if (out === "HIT") t.hit += 1;
      else if (out === "MISS") t.miss += 1;
      else if (out === "VOID") t.void += 1;
      else if (out === "UNSCORED") t.unscored += 1;
      else if (c && c.blind) t.blind_pending += 1;
      else t.pending += 1;
    });
    return t;
  }

  /* record.authors is the full-chain tally (recent is only the latest few),
     so prefer it; fall back to bucketing the recent list client-side. */
  function tallyFromRecord(record) {
    var authors = (record && record.authors) || [];
    if (!authors.length) return null;
    var t = { sealed: 0, hit: 0, miss: 0, void: 0, unscored: 0, pending: 0,
              blind_pending: 0, wild_hit: 0, wild_miss: 0, wild_nomarket: 0 };
    authors.forEach(function (a) {
      t.sealed += a.sealed || 0;
      t.hit += a.hit || 0;
      t.miss += a.miss || 0;
      t.void += a.void || 0;
      t.pending += a.pending || 0;
    });
    return t;
  }

  function stat(value, label, color) {
    return '<div style="min-width:86px">' +
      '<div style="font-family:' + MONO + ';font-size:22px;font-weight:700;color:' +
      color + '">' + value + "</div>" +
      '<div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:' +
      C.faint + '">' + label + "</div></div>";
  }

  function renderTally(pack) {
    var t = tallyFromRecord(pack.record) || tallyFromRecent(pack.recent);
    var sealed = (typeof pack.n_sealed === "number") ? pack.n_sealed : t.sealed;
    var decided = t.hit + t.miss;
    // hit-rate over HIT+MISS only; with nothing decided it is "—", never a number
    var rate = decided ? Math.round((100 * t.hit) / decided) + "%" : "—";
    var html = '<div style="display:flex;flex-wrap:wrap;gap:18px">' +
      stat(sealed, "sealed", C.text) +
      stat(t.hit, "hits", C.hit) +
      stat(t.miss, "misses", C.miss) +
      stat(t.pending + t.blind_pending, "pending", C.amber) +
      stat(t.void, "void", C.faint) +
      stat(rate, "hit-rate · " + decided + " decided", decided ? C.text : C.faint) +
      "</div>";
    if (t.unscored) {
      html += '<div style="margin-top:8px;font-size:12px;color:' + C.faint + '">📝 ' +
        t.unscored + " unscored prose (the timestamp is the receipt; readers judge)</div>";
    }
    if (t.wild_hit || t.wild_miss || t.wild_nomarket) {
      html += '<div style="margin-top:8px;font-size:12px;color:' + C.faint + '">🃏 wild tier: ' +
        t.wild_hit + " hit · " + t.wild_miss + " miss · " + t.wild_nomarket +
        " market died — separate ledger, never ranked</div>";
    }
    html += '<div style="margin-top:10px;font-size:12px;color:' + C.faint + '">' +
      "Every sealed call is on the chain — including the misses. " +
      "Nothing here can be quietly deleted.</div>";
    return card(html);
  }

  function renderCall(c) {
    var head = '<div style="display:flex;justify-content:space-between;gap:10px;' +
      'flex-wrap:wrap;align-items:center">' + statusChip(c.outcome) +
      '<span style="color:' + C.faint + ';font-size:12px">sealed ' +
      UT.esc(c.created_asof || "?") + " → horizon " + UT.esc(c.horizon || "?") +
      "</span></div>";
    var claim = c.claim_text
      ? '<div style="margin-top:8px;font-size:14px;line-height:1.45;color:' + C.text + '">' +
        UT.esc(c.claim_text) + "</div>"
      : '<div style="margin-top:8px;font-size:13px;color:' + C.faint + '">' +
        "blind commit " + mono(c.call_id, 16) +
        " — the claim publishes automatically at the horizon</div>";
    var detail = "";
    if (c.scored_predicate) {
      detail += '<div style="margin-top:6px;font-size:12px;color:' + C.faint +
        '">scored predicate: <span style="font-family:' + MONO + '">' +
        UT.esc(c.scored_predicate) + "</span></div>";
    }
    if (c.observed) {
      detail += '<div style="margin-top:6px;font-size:12px;color:' + C.text +
        '">settled — ' + UT.esc(c.observed) + "</div>";
    }
    if (c.late_publication) {
      detail += '<div style="margin-top:6px;font-size:12px;color:' + C.amber + '">' +
        "⚠ horizon board published late (&gt;1 day after) — scored, disclosed</div>";
    }
    var foot = '<div style="margin-top:8px;font-size:12px;color:' + C.faint + '">id ' +
      mono(c.call_id || c.call_label, 16) +
      (c.author ? " · " + UT.esc(c.author) : "") + "</div>";
    return card(head + claim + detail + foot);
  }

  function renderVerify(pack) {
    var rows = [];
    if (pack.ledger_root) {
      rows.push('<div><span style="color:' + C.faint + ';font-size:12px">ledger root </span>' +
        mono(pack.ledger_root, 20) + "</div>");
    }
    var a = pack.ton_anchor;
    if (a) {
      if (a.anchor_wallet) {
        rows.push('<div style="margin-top:6px"><span style="color:' + C.faint +
          ';font-size:12px">TON anchor (' + UT.esc(a.network || "mainnet") +
          ") wallet </span>" + mono(a.anchor_wallet, 16) + "</div>");
      }
      if (a.comment) {
        rows.push('<div style="margin-top:6px;font-family:' + MONO +
          ';font-size:12px;word-break:break-all;color:' + C.text + '" title="' +
          UT.esc(a.comment) + '">' + UT.esc(a.comment) + "</div>");
      }
    }
    rows.push('<div style="margin-top:10px;font-size:12px;line-height:1.5;color:' + C.faint + '">' +
      "hash-chained before outcome · post-quantum signed · verify offline: " +
      '<span style="font-family:' + MONO + '">python3 scripts/verify_record.py</span>' +
      " (repo: github.com/beepboop2025/liquilens-undertow)</div>");
    return card('<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;' +
      "color:" + C.blue + ';margin-bottom:8px">Verify it yourself</div>' + rows.join(""));
  }

  async function render(root) {
    var pack = await UT.pack("sealed_calls");
    if (!pack) {
      root.innerHTML = UT.empty("Could not load the sealed-calls pack — " +
        "nothing is faked in the meantime.");
      return;
    }
    var parts = [];
    parts.push('<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:' + C.faint +
      '">Every call below was cryptographically sealed <em>before</em> its outcome, ' +
      "then scored against our own published board. Losers cannot be deleted or " +
      "backdated — verify the chain yourself.</p>");
    parts.push(renderTally(pack));
    var recent = pack.recent || [];
    if (recent.length) {
      parts.push(sectionLabel("Most recent sealed calls"));
      recent.forEach(function (c) { parts.push(renderCall(c)); });
    } else {
      parts.push(card('<span style="color:' + C.faint + ';font-size:13px">' +
        "No sealed calls in the published list yet.</span>"));
    }
    parts.push(renderVerify(pack));
    parts.push(UT.cta("seal your own calls — a personal track record nobody can backdate"));
    parts.push('<div style="font-size:11px;color:' + C.faint + ';margin:8px 0 4px">' +
      "research & market data, not investment advice</div>");
    parts.push(UT.stale(pack.asof));
    root.innerHTML = parts.join("");
  }

  UT.mount("calls", "Sealed calls", render);
})();
