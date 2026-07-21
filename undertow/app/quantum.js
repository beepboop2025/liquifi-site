/* Undertow web desk — Q-day watch surface.
   Mirrors the bot's /quantum view (bot/undertow_bot.py format_quantum).
   Every figure is verbatim from data/packs/quantum_watch.json; a block
   with no data is omitted, never invented. No doom clock — the pack
   deliberately has none. */
(function () {
  "use strict";

  var C = {
    panel: "#111A2E",
    line: "#1E293B",
    text: "#E2E8F0",
    faint: "#94A3B8",
    blue: "#38BDF8",
    amber: "#F59E0B",
    green: "#34D399"
  };

  /* Status-tag colors: peer-reviewed is the strongest signal; vendor
     announcements and secondary reports stay muted so they are never
     dressed up as demonstrations. */
  var STATUS_COLOR = {
    "peer-reviewed": C.green,
    "preprint": C.amber,
    "vendor-announced": C.faint,
    "reported": C.faint,
    "government": C.blue,
    "survey": C.faint,
    "community-forecast": C.faint,
    "absent": C.faint
  };

  function esc(v) {
    return UT.esc(v === null || v === undefined ? "" : String(v));
  }

  function num(v) {
    if (typeof v !== "number" || !isFinite(v)) return "—";
    return v.toLocaleString("en-US");
  }

  /* Compact factor formatting, mirroring the bot's {x:g} / {x:,.0f} mix:
     keep at most one decimal, drop a trailing ".0". */
  function factor(v) {
    if (typeof v !== "number" || !isFinite(v)) return "—";
    var r = Math.round(v * 10) / 10;
    var s = r.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    });
    return s;
  }

  function yearOf(date) {
    return String(date === null || date === undefined ? "?" : date).slice(0, 4);
  }

  function statusChip(status) {
    var s = status || "unverified";
    var col = STATUS_COLOR[s] || C.faint;
    return '<span style="display:inline-block;padding:1px 8px;' +
      'border:1px solid ' + col + ';border-radius:999px;color:' + col + ';' +
      'font-size:11px;letter-spacing:.04em;text-transform:uppercase;' +
      'white-space:nowrap">' + esc(s) + "</span>";
  }

  function srcLink(url) {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return "";
    return ' <a href="' + esc(url) + '" target="_blank" rel="noopener" ' +
      'style="color:' + C.blue + ';text-decoration:none;font-size:12px">' +
      "source&nbsp;↗</a>";
  }

  function panel(extra) {
    return "background:" + C.panel + ";border:1px solid " + C.line + ";" +
      "border-radius:10px;padding:14px 16px;" + (extra || "");
  }

  function h3(text) {
    return '<div style="font-size:12px;letter-spacing:.08em;' +
      'text-transform:uppercase;color:' + C.faint + ';margin:0 0 10px">' +
      esc(text) + "</div>";
  }

  /* One sourced claim row: status chip first, then the pack's own words,
     then date + source link. The claim text is rendered verbatim. */
  function claimRow(item) {
    var date = item.date ? ' <span style="color:' + C.faint +
      ';font-size:12px">(' + esc(item.date) + ")</span>" : "";
    return '<li style="margin:0 0 10px;list-style:none">' +
      statusChip(item.status) + " " +
      '<span style="color:' + C.text + '">' + esc(item.claim) + "</span>" +
      date + srcLink(item.source) + "</li>";
  }

  function claimList(items) {
    var out = '<ul style="margin:0;padding:0">';
    for (var i = 0; i < items.length; i++) out += claimRow(items[i]);
    return out + "</ul>";
  }

  /* ---- block builders: each returns "" when its data is absent ------- */

  function axesCards(pack) {
    var hw = Array.isArray(pack.hardware) ? pack.hardware : [];
    var req = Array.isArray(pack.requirements) ? pack.requirements : [];
    if (!hw.length && !req.length) return "";

    var byTarget = {};
    for (var i = 0; i < req.length; i++) {
      var t = req[i].target || "other";
      if (!byTarget[t]) byTarget[t] = [];
      byTarget[t].push(req[i]);
    }

    var left = '<div style="flex:1 1 320px;min-width:280px;' + panel() + '">' +
      h3("Demonstrated hardware") +
      '<div style="font-size:12px;color:' + C.faint + ';margin-bottom:10px">' +
      "What has actually been built or run — vendor promises tagged as " +
      "such, never counted as demonstrations.</div>" +
      (hw.length ? claimList(hw) :
        '<div style="color:' + C.faint + '">No hardware entries in this pack.</div>') +
      "</div>";

    var targets = Object.keys(byTarget).sort();
    var right = '<div style="flex:1 1 320px;min-width:280px;' + panel() + '">' +
      h3("Break requirements") +
      '<div style="font-size:12px;color:' + C.faint + ';margin-bottom:10px">' +
      "Published resource estimates for breaking secp256k1 and RSA-2048.</div>";
    if (!targets.length) {
      right += '<div style="color:' + C.faint +
        '">No requirement estimates in this pack.</div>';
    }
    for (var j = 0; j < targets.length; j++) {
      right += '<div style="margin:8px 0 6px;color:' + C.blue +
        ';font-size:13px;font-weight:600">' + esc(targets[j]) + "</div>" +
        claimList(byTarget[targets[j]]);
    }
    right += "</div>";

    return '<div style="display:flex;flex-wrap:wrap;gap:14px;margin:14px 0">' +
      left + right + "</div>";
  }

  function gapBlock(gap) {
    if (!gap || typeof gap !== "object") return "";
    var axes = gap.axes || {};
    var rows = [];

    var lg = axes.logical_qubits;
    if (lg && typeof lg.demonstrated === "number" &&
        typeof lg.required === "number") {
      rows.push("Error-corrected (logical) qubits: best demonstrated <b>" +
        num(lg.demonstrated) + "</b> vs <b>" + num(lg.required) +
        "</b> needed to break secp256k1 — <b>" +
        factor(lg.shortfall_factor) + "× short</b>" +
        (lg.note ? ' <span style="color:' + C.faint + ';font-size:12px">(' +
          esc(lg.note) + ")</span>" : ""));
    }
    var ph = axes.physical_qubits;
    if (ph && typeof ph.demonstrated === "number" &&
        typeof ph.required === "number") {
      rows.push("Raw (physical) qubits: largest demonstrated system <b>" +
        num(ph.demonstrated) + "</b> vs <b>" + num(ph.required) +
        "</b> in the smallest published break-estimate — <b>" +
        factor(ph.shortfall_factor) + "× short</b>" +
        (ph.note ? ' <span style="color:' + C.faint + ';font-size:12px">(' +
          esc(ph.note) + ")</span>" : ""));
    }

    var trend = gap.requirements_trend || {};
    var targets = Object.keys(trend).sort();
    for (var i = 0; i < targets.length; i++) {
      var tr = trend[targets[i]] || {};
      if (typeof tr.requirement_fell_by_factor !== "number" ||
          !tr.from || !tr.to) continue;
      rows.push("⚠ The goalposts move TOWARD the attacker: the " +
        esc(targets[i]) + " requirement fell <b>" +
        factor(tr.requirement_fell_by_factor) + "×</b> between " +
        esc(yearOf(tr.from.date)) + " and " + esc(yearOf(tr.to.date)) +
        (typeof tr.from.physical_qubits === "number" &&
         typeof tr.to.physical_qubits === "number"
          ? " (" + num(tr.from.physical_qubits) + " → " +
            num(tr.to.physical_qubits) + " physical qubits)"
          : "") +
        " as algorithms improved");
    }

    if (!rows.length) return "";
    var out = '<div style="' + panel("border-left:4px solid " + C.amber + ";") +
      'margin:14px 0">' + h3("The gap — the honest headline") +
      '<ul style="margin:0;padding-left:2px">';
    for (var j = 0; j < rows.length; j++) {
      out += '<li style="margin:0 0 10px;list-style:none;color:' + C.text +
        '">' + rows[j] + "</li>";
    }
    out += "</ul>";
    if (gap.honesty) {
      out += '<div style="color:' + C.faint + ';font-size:12px;' +
        'font-style:italic;margin-top:4px">' + esc(gap.honesty) + "</div>";
    }
    return out + "</div>";
  }

  function exposureBlock(items) {
    if (!Array.isArray(items) || !items.length) return "";
    return '<div style="' + panel() + 'margin:14px 0">' +
      h3("Bitcoin's exposure today") + claimList(items) + "</div>";
  }

  function forecastsBlock(forecasts, anchors) {
    var surveys = (forecasts && Array.isArray(forecasts.surveys)) ?
      forecasts.surveys : [];
    var hasAnchors = Array.isArray(anchors) && anchors.length;
    var meta = forecasts && forecasts.metaculus;
    var questions = (meta && meta.questions) || {};
    var qids = Object.keys(questions);
    var liveAbsent = false;
    for (var i = 0; i < qids.length; i++) {
      if (questions[qids[i]] && questions[qids[i]].status === "absent") {
        liveAbsent = true;
      }
    }
    if (!surveys.length && !hasAnchors && !meta) return "";

    var out = '<div style="' + panel() + 'margin:14px 0">' +
      h3("Forecasts & policy anchors — attributed, never ours") +
      '<div style="color:' + C.faint + '">';
    if (meta && meta.note) {
      out += '<div style="font-size:12px;margin-bottom:8px">' +
        esc(meta.note) + "</div>";
    }
    if (liveAbsent) {
      out += '<div style="font-size:12px;margin-bottom:8px">' +
        "Metaculus live values: absent — the API was unreachable when " +
        "this pack was built. The last-known medians below are labelled " +
        "as such; nothing is faked in the meantime.</div>";
    }
    if (surveys.length) out += claimList(surveys);
    if (hasAnchors) {
      out += '<div style="margin:10px 0 6px;font-size:12px;' +
        'letter-spacing:.08em;text-transform:uppercase">Policy anchors</div>' +
        claimList(anchors);
    }
    return out + "</div></div>";
  }

  function recordBlock(note) {
    if (!note) return "";
    return '<div style="' + panel("border-left:4px solid " + C.blue + ";") +
      'margin:14px 0">' + h3("Our own record") +
      '<div style="color:' + C.text + '">' + esc(note) + "</div></div>";
  }

  function arxivBlock(feed) {
    var feeds = (feed && feed.feeds) || {};
    var names = Object.keys(feeds).sort();
    var has = false;
    var i;
    for (i = 0; i < names.length; i++) {
      var es = feeds[names[i]] && feeds[names[i]].entries;
      if (Array.isArray(es) && es.length) { has = true; break; }
    }
    if (!has) return "";

    var out = '<details style="' + panel() + 'margin:14px 0">' +
      '<summary style="cursor:pointer;color:' + C.faint + ';font-size:12px;' +
      'letter-spacing:.08em;text-transform:uppercase">' +
      "Primary sources — arXiv reading list</summary>";
    if (feed.note) {
      out += '<div style="color:' + C.faint + ';font-size:12px;' +
        'margin:10px 0">' + esc(feed.note) + "</div>";
    }
    for (i = 0; i < names.length; i++) {
      var entries = feeds[names[i]] && feeds[names[i]].entries;
      if (!Array.isArray(entries) || !entries.length) continue;
      out += '<div style="margin:10px 0 6px;color:' + C.blue +
        ';font-size:13px">' + esc(names[i]) + "</div>" +
        '<ul style="margin:0;padding-left:18px">';
      for (var j = 0; j < entries.length; j++) {
        var e = entries[j] || {};
        out += '<li style="margin:0 0 8px;color:' + C.text + '">' +
          '<span style="color:' + C.faint + ';font-size:12px">' +
          esc(e.published || "") + "</span> — " + esc(e.title || "") +
          srcLink(e.url) + "</li>";
      }
      out += "</ul>";
    }
    return out + "</details>";
  }

  function footer(pack) {
    var prov = pack.provenance || {};
    var bits = [];
    if (prov.curation_policy) bits.push(esc(prov.curation_policy));
    if (prov.dataset_version) {
      bits.push("dataset " + esc(prov.dataset_version));
    }
    var out = '<div style="margin-top:18px;color:' + C.faint +
      ';font-size:12px;line-height:1.5">';
    if (bits.length) out += bits.join(" · ") + "<br>";
    out += "Research &amp; market data, not investment advice.</div>";
    return out;
  }

  async function render(root) {
    var pack = await UT.pack("quantum_watch");
    if (!pack) {
      root.innerHTML = UT.empty("Q-day watch could not be loaded — " +
        "nothing is faked in the meantime.");
      return;
    }

    root.innerHTML =
      '<div style="font-size:13px;color:' + C.faint + ';margin:2px 0 4px">' +
      "How far quantum computers actually are from Bitcoin's cryptography " +
      "— measured, sourced, no doom clock.</div>" +
      (UT.stale(pack.asof) || "") +
      gapBlock(pack.gap) +
      axesCards(pack) +
      exposureBlock(pack.exposure_btc) +
      forecastsBlock(pack.forecasts, pack.policy_anchors) +
      recordBlock(pack.our_record) +
      arxivBlock(pack.arxiv_feed) +
      footer(pack);
  }

  UT.mount("quantum", "Q-day watch", render);
})();
