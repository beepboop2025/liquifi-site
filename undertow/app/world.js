/* Undertow web desk — World surface (/world mirror).
   Fetch: the current-affairs overlay. Informational only, never a scored tier.
   Classic script; requires core.js (window.UT) loaded first. */
(function () {
  "use strict";

  var SURFACE_LABEL = {
    seiche_funding: "Seiche (plumbing)",
    liquilens_institutions: "LiquiLens (institutions)",
    undertow_markets: "Undertow (markets)"
  };

  var PANEL = "background:var(--panel,#111A2E);border:1px solid var(--line,#1E293B);border-radius:10px;padding:18px 20px;margin:0 0 14px;";
  var FAINT = "color:var(--faint,#94A3B8);";
  var MONO = "font-family:ui-monospace,Menlo,monospace;font-size:13px;";
  var AMBER = "color:var(--amber,#F59E0B);";

  function surgeText(v) {
    if (v === null || v === undefined || isNaN(v)) return "n/a";
    return Number(v).toFixed(2) + "×";
  }

  function trendArrow(o) {
    /* render a trend arrow only if the pack actually carries one */
    var t = o.trend || o.trend_arrow || o.arrow;
    if (!t) return "";
    var map = { up: "↑", rising: "↑", down: "↓", falling: "↓", flat: "→", stable: "→" };
    var a = map[String(t).toLowerCase()];
    if (!a) return "";
    return ' <span style="' + AMBER + '" title="trend: ' + UT.esc(t) + '">' + a + "</span>";
  }

  function channelCard(o) {
    var surge = (o.latest_surge === null || o.latest_surge === undefined) ? null : Number(o.latest_surge);
    var hot = surge !== null && !isNaN(surge) && surge >= 1.5;
    var surface = SURFACE_LABEL[o.surface] || o.surface;
    var h = '<div style="' + PANEL + '">';
    h += '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline;">';
    h += '<strong style="font-size:16px;">' + UT.esc(o.name || o.channel || "unnamed channel") + "</strong>";
    h += '<span style="' + MONO + (hot ? AMBER : "color:var(--blue,#38BDF8);") + '">attention ' + UT.esc(surgeText(o.latest_surge)) + (hot ? " ▲" : "") + trendArrow(o) + "</span>";
    h += "</div>";
    if (o.stress_pctl !== null && o.stress_pctl !== undefined) {
      h += '<div style="' + FAINT + 'font-size:14px;margin-top:4px;">' + Math.round(Number(o.stress_pctl) * 100) + "% vs its history</div>";
    }
    if (o.note) {
      h += '<div style="' + AMBER + 'font-size:13.5px;margin-top:6px;">' + UT.esc(o.note) + "</div>";
    }
    if (o.mechanism) {
      h += '<p style="' + FAINT + 'font-size:14.5px;margin:8px 0 0;">' + UT.esc(o.mechanism) + "</p>";
    }
    h += '<div style="margin-top:10px;font-size:13.5px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">';
    if (o.source_id) {
      h += '<span style="' + MONO + FAINT + '">grounding: ' + UT.esc(o.source_id) + "</span>";
    } else {
      h += "<span></span>";
    }
    if (surface) {
      h += '<span style="' + FAINT + '">shocks → <span style="color:var(--blue,#38BDF8);">' + UT.esc(surface) + "</span></span>";
    }
    h += "</div></div>";
    return h;
  }

  async function render(root) {
    var pack = await UT.pack("fetch");
    if (!pack) {
      root.innerHTML = UT.empty("Could not load the world current-affairs overlay — nothing is faked in the meantime.");
      return;
    }

    var h = "";

    /* informational banner — never a scored tier */
    h += '<div style="background:var(--panel,#111A2E);border-left:4px solid var(--amber,#F59E0B);border-radius:0 10px 10px 0;padding:16px 20px;margin:0 0 16px;">';
    h += '<strong style="' + AMBER + '">Informational overlay — never a scored tier.</strong>';
    h += '<p style="' + FAINT + 'font-size:14.5px;margin:6px 0 0;">The exogenous wind: global news attention per cited channel, routed to the lab surface it plausibly shocks. Not a forecast — the lead-to-liquidity-stress claim is a pre-registered bar, not asserted.</p>';
    h += "</div>";

    /* fused overlay */
    var fused = pack.fused || {};
    h += '<div style="' + PANEL + '">';
    h += '<div style="font-size:15px;">Fused current-affairs stress: ';
    if (fused.stress === null || fused.stress === undefined) {
      h += UT.chip(null) + ' <span style="' + FAINT + 'font-size:14px;">— the world is still being watched, not scored.</span>';
    } else {
      h += '<strong style="color:var(--blue,#38BDF8);">' + Math.round(Number(fused.stress) * 100) + "%</strong>";
      if (fused.n_qualifying !== null && fused.n_qualifying !== undefined) {
        h += ' <span style="' + FAINT + 'font-size:14px;">(' + UT.esc(fused.n_qualifying) + " channels)</span>";
      }
    }
    h += "</div>";
    if (fused.note) {
      h += '<div style="' + FAINT + 'font-size:13.5px;margin-top:6px;">' + UT.esc(fused.note) + "</div>";
    }
    h += "</div>";

    /* channel cards, highest attention first */
    var channels = (pack.channels || []).slice().sort(function (a, b) {
      return (b.latest_surge || 0) - (a.latest_surge || 0);
    });
    if (channels.length) {
      h += '<h3 style="font-size:15px;letter-spacing:.08em;text-transform:uppercase;' + FAINT + 'margin:18px 0 10px;">Channels</h3>';
      h += channels.map(channelCard).join("");
    }

    /* unreachable channels — absence disclosed, never smoothed */
    var un = pack.unreachable || {};
    var unKeys = Object.keys(un);
    if (unKeys.length) {
      h += '<div style="' + PANEL + 'border-style:dashed;">';
      h += '<strong style="' + AMBER + 'font-size:14.5px;">Unreachable this run — disclosed, not smoothed over:</strong>';
      h += '<ul style="list-style:none;margin:8px 0 0;">';
      unKeys.forEach(function (k) {
        h += '<li style="' + FAINT + 'font-size:13.5px;padding:3px 0;">— ' + UT.esc(k) + ' <span style="' + MONO + '">' + UT.esc(un[k]) + "</span></li>";
      });
      h += "</ul></div>";
    }

    h += '<p style="' + FAINT + 'font-size:13px;margin-top:14px;">Grounded in cited research (GPR/EPU indices; alphaXiv papers per channel). Surge = latest news attention vs its 3-day baseline (GDELT, free). Fetch sits upstream of Seiche, LiquiLens and Undertow — one wind, three surfaces.</p>';
    h += '<p style="' + FAINT + 'font-size:13px;margin-top:8px;">research &amp; market data, not investment advice</p>';
    h += UT.stale(pack.asof);

    root.innerHTML = h;
  }

  UT.mount("world", "World", render);
})();
