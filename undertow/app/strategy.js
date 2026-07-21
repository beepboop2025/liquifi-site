/* Undertow web desk — Strategy surface (/strategy mirror).
   Liquidity risk overlay + exit router. RESEARCH/paper only — never a live
   signal, no performance promises. Classic script; requires core.js first. */
(function () {
  "use strict";

  var PANEL = "background:var(--panel,#111A2E);border:1px solid var(--line,#1E293B);border-radius:10px;padding:18px 20px;margin:0 0 14px;";
  var FAINT = "color:var(--faint,#94A3B8);";
  var MONO = "font-family:ui-monospace,Menlo,monospace;font-size:13px;";
  var AMBER = "color:var(--amber,#F59E0B);";
  var BLUE = "color:var(--blue,#38BDF8);";

  function pct(x, digits) {
    if (x === null || x === undefined || isNaN(x)) return "—";
    return (Number(x) * 100).toFixed(digits === undefined ? 0 : digits) + "%";
  }

  function signedPct(x) {
    if (x === null || x === undefined || isNaN(x)) return "—";
    var v = Number(x) * 100;
    return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
  }

  function heading(t) {
    return '<h3 style="font-size:15px;letter-spacing:.08em;text-transform:uppercase;' + FAINT + 'margin:18px 0 10px;">' + t + "</h3>";
  }

  async function render(root) {
    var pack = await UT.pack("strategy");
    if (!pack) {
      root.innerHTML = UT.empty("Could not load the strategy pack — nothing is faked in the meantime.");
      return;
    }

    var h = "";

    /* (1) paper / research only banner */
    h += '<div style="background:var(--panel,#111A2E);border-left:4px solid var(--amber,#F59E0B);border-radius:0 10px 10px 0;padding:16px 20px;margin:0 0 16px;">';
    h += '<strong style="' + AMBER + '">Paper / research only.</strong>';
    h += '<p style="' + FAINT + 'font-size:14.5px;margin:6px 0 0;">Not a buy/sell signal. A liquidity <strong style="color:var(--text,#E2E8F0);">risk overlay</strong>: how much of a base long to hold when liquidity is healthy vs stressed, plus the cheapest door to exit. No price prediction, no live orders.</p>';
    h += "</div>";

    /* (2) risk-overlay card — today's position */
    var today = pack.today || {};
    if (today.target_exposure !== null && today.target_exposure !== undefined) {
      h += heading("Risk overlay — today");
      h += '<div style="' + PANEL + '">';
      h += '<div style="font-size:17px;">Target exposure today: <strong style="' + BLUE + '">' + pct(today.target_exposure) + "</strong> of a base long";
      if (pack.asset) h += ' <span style="' + FAINT + 'font-size:14px;">(' + UT.esc(pack.asset) + "; rest in cash/stables)</span>";
      h += "</div>";
      var reasons = today.reasons || [];
      if (reasons.length) {
        h += '<ul style="list-style:none;margin:10px 0 0;">';
        reasons.slice(0, 4).forEach(function (r) {
          h += '<li style="' + FAINT + 'font-size:14px;padding:3px 0 3px 18px;position:relative;"><span style="position:absolute;left:0;' + AMBER + '">·</span>' + UT.esc(r) + "</li>";
        });
        h += "</ul>";
      }
      var sig = today.signals || {};
      var sigBits = [];
      if (sig.crypto_tier) sigBits.push("crypto tier " + UT.chip(sig.crypto_tier));
      if (sig.funding_regime) sigBits.push('funding <span style="' + MONO + BLUE + '">' + UT.esc(sig.funding_regime) + "</span>");
      if (sig.state) sigBits.push('state <span style="' + MONO + BLUE + '">' + UT.esc(sig.state) + "</span>");
      if (sig.episode_alert) sigBits.push('<span style="' + AMBER + '">episode alert</span>');
      if (sigBits.length) {
        h += '<div style="margin-top:10px;font-size:13.5px;' + FAINT + 'display:flex;gap:14px;flex-wrap:wrap;align-items:center;">' + sigBits.join("") + "</div>";
      }
      h += "</div>";
    }

    /* (3) execution-router card — measured bps savings */
    var er = pack.exit_routing || {};
    var sizes = Object.keys(er).filter(function (k) {
      return er[k] && er[k].routable;
    }).sort(function (a, b) {
      return (er[a].q_usd || 0) - (er[b].q_usd || 0);
    });
    if (sizes.length) {
      h += heading("Execution router — cheapest exit door");
      h += '<div style="' + PANEL + '">';
      sizes.forEach(function (k) {
        var r = er[k];
        h += '<div style="padding:8px 0;border-bottom:1px solid var(--line,#1E293B);">';
        h += '<span style="' + MONO + BLUE + '">' + UT.esc(UT.usd(r.q_usd)) + " " + UT.esc(r.asset || "") + "</span>";
        h += ' → <strong>' + UT.esc(r.route_to) + "</strong> at " + UT.esc(UT.bp(r.route_to_bp));
        if (r.bps_saved_vs_worst !== null && r.bps_saved_vs_worst !== undefined) {
          h += ' <span style="' + FAINT + 'font-size:14px;">— saves ' + UT.esc(UT.bp(r.bps_saved_vs_worst));
          if (r.usd_saved_vs_worst !== null && r.usd_saved_vs_worst !== undefined) {
            h += " (" + UT.esc(UT.usd(r.usd_saved_vs_worst)) + ")";
          }
          if (r.worst_venue) h += " vs " + UT.esc(r.worst_venue);
          h += "</span>";
        }
        /* "measured, not projected" only where the pack itself frames it that way */
        if (r.note && /measured/i.test(String(r.note))) {
          h += ' <span style="' + MONO + AMBER + '">measured, not projected</span>';
        }
        h += "</div>";
      });
      var firstNote = er[sizes[0]].note;
      if (firstNote) {
        h += '<p style="' + FAINT + 'font-size:13.5px;margin:10px 0 0;">' + UT.esc(firstNote) + "</p>";
      }
      h += "</div>";
    }

    /* paper equity */
    var paper = pack.paper || {};
    if (paper.equity !== null && paper.equity !== undefined) {
      h += heading("Paper track");
      h += '<div style="' + PANEL + '">';
      h += '<div style="font-size:16px;">Paper equity: <strong style="' + BLUE + '">' + Number(paper.equity).toFixed(4) + "</strong>";
      h += ' <span style="' + FAINT + 'font-size:14px;">(base 1.000) over ' + UT.esc(paper.n_days || 0) + " board-days — every step sealed, un-fakeable.</span></div>";
      h += "</div>";
    }

    /* (4) backtest card — pack's own numbers and honest bands, weak skill
           disclosed with full prominence */
    var bt = pack.backtest || {};
    if (bt.status || bt.note) {
      h += heading("Backtest");
      if (bt.status === "insufficient_history") {
        h += '<div style="' + PANEL + 'border-left:4px solid var(--amber,#F59E0B);">';
        h += '<div>' + UT.chip(null) + ' <span style="' + FAINT + 'font-size:14px;">accruing (' + UT.esc(bt.n_days || 0) + " board-days) — the edge claim (bar 5b) cannot be read yet; shown as mechanism, not a track record.</span></div>";
      } else if (bt.status === "evaluated") {
        var weak = (bt.strategy_return !== null && bt.strategy_return !== undefined &&
                    bt.buy_hold_return !== null && bt.buy_hold_return !== undefined &&
                    Number(bt.strategy_return) <= Number(bt.buy_hold_return));
        h += '<div style="' + PANEL + (weak ? "border-left:4px solid var(--amber,#F59E0B);" : "") + '">';
        h += '<div style="font-size:15px;">' + UT.esc(bt.n_days) + "d: overlay " + signedPct(bt.strategy_return) + " vs buy-hold " + signedPct(bt.buy_hold_return) + "; max drawdown " + pct(bt.strategy_max_drawdown) + " vs " + pct(bt.buy_hold_max_drawdown) + ".</div>";
        if (weak) {
          h += '<div style="' + AMBER + 'font-size:14.5px;margin-top:8px;"><strong>Disclosed:</strong> over this window the overlay did not beat buy-and-hold. Weak or negative skill is shown, never hidden.</div>';
        }
        h += '<div style="' + FAINT + 'font-size:13.5px;margin-top:6px;">Edge claim still gated by bar 5b.</div>';
      } else {
        h += '<div style="' + PANEL + '">';
        h += '<div>' + UT.chip(null) + ' <span style="' + FAINT + 'font-size:14px;">status: ' + UT.esc(bt.status || "unknown") + "</span></div>";
      }
      if (bt.note) {
        h += '<p style="' + AMBER + 'font-size:14px;margin:10px 0 0;"><strong>' + UT.esc(bt.note) + "</strong></p>";
      }
      if (bt.prereg) {
        h += '<p style="' + FAINT + 'font-size:13.5px;margin:8px 0 0;">' + UT.esc(bt.prereg) + "</p>";
      }
      h += "</div>";
    }

    /* (5) pack disclaimer, verbatim */
    if (pack.disclaimer) {
      h += '<div style="background:var(--panel,#111A2E);border:1px solid var(--line,#1E293B);border-radius:10px;padding:14px 18px;margin:16px 0 14px;' + FAINT + 'font-size:13.5px;">' + UT.esc(pack.disclaimer) + "</div>";
    }

    h += '<p style="' + FAINT + 'font-size:13px;">Live trading is deliberately OFF — this machinery is a risk/execution overlay with an unvalidated edge; it never places orders.</p>';
    h += '<p style="' + FAINT + 'font-size:13px;margin-top:8px;">research &amp; market data, not investment advice</p>';
    h += UT.stale(pack.asof);

    root.innerHTML = h;
  }

  UT.mount("strategy", "Strategy", render);
})();
