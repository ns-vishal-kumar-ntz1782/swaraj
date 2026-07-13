// ==========================================================
//  DATA — Update only these arrays to change all charts
// ==========================================================
const DASHBOARD_WIDTH = 1440;
// Sanity ceiling on how far the dashboard scales UP on screens larger than the 1440 Figma
// reference (e.g. 1920x1080), so it fills the available space instead of sitting frozen at
// 1440px with dead margins, without ballooning to absurd sizes on very large displays.
const MAX_SCALE = 1.6;
// Below this width, styles.css switches the two-column grid to a single stacked column
// (its own @media(max-width:1024px) block). Shrinking the whole 1440px canvas to fit that
// width would make text illegible, so fitViewport() stops scaling and lets the page scroll
// naturally instead.
const TABLET_BREAKPOINT = 1024;
// Both remeasured live from the real DOM (border widths etc. make hardcoded guesses drift by
// a px or two, which is enough to force a spurious scrollbar). CSS transforms don't touch
// scrollHeight/getBoundingClientRect layout values, so this never goes stale.
let baselineContentHeight = 672;
let baselineHeaderHeight  = 56;

// projectPortfolioData, monthOrder, roleDirectory, and reasonDetails now live in mockData.js
// (loaded before this file) — this is the app's mock/seed data layer, kept separate from logic.

// ── Compliance Status data (Chart 3) — every row, including Total, is summed straight from
//    projectPortfolioData so it can never drift out of sync with the drill-down table again. ──
function computeComplianceStatusData() {
  const rows = ["M6","M4","M2"].map(type => {
    const ps      = projectPortfolioData.filter(p => p.type === type);
    const planned = ps.reduce((s,p) => s + p.planned, 0);
    const actual  = ps.reduce((s,p) => s + p.actual, 0);
    return { type, planned, actual, pct: planned ? Math.round(actual / planned * 100) : 0, variance: actual - planned };
  });
  const totalPlanned = rows.reduce((s,r) => s + r.planned, 0);
  const totalActual  = rows.reduce((s,r) => s + r.actual, 0);
  rows.push({
    type: "Total", planned: totalPlanned, actual: totalActual,
    pct: totalPlanned ? Math.round(totalActual / totalPlanned * 100) : 0,
    variance: totalActual - totalPlanned
  });
  return rows;
}
const complianceStatusData = computeComplianceStatusData();

// ── Compliance Rate data (Chart 4) — FY27 (the current-year actual line) is computed with
//    Compliance % = (Actual ÷ Planned) × 100, grouping projectPortfolioData by its reporting
//    month; this is the same formula and the same source data as the "month" drill-down table,
//    so the chart and its drill-down can never disagree. Months with no reporting project (Feb,
//    in this dataset) are left as a gap in the line (spanGaps handles the visual join) rather
//    than a fabricated 0%. There's no independent prior-year dataset in this app, so FY26
//    (comparison) is derived deterministically from the real FY27 series (a fixed offset, not a
//    random/static array) — clearly distinct, reproducible, and never independent of the real
//    numbers. Figma's design shows exactly two lines (FY26, FY27) — no AI-predicted 3rd line. ──
function computeComplianceRateData() {
  const FY27 = monthOrder.map(mon => {
    const ps = projectPortfolioData.filter(p => p.month === mon);
    if (!ps.length) return null;
    const planned = ps.reduce((s,p) => s + p.planned, 0);
    const actual  = ps.reduce((s,p) => s + p.actual, 0);
    return planned ? Math.round(actual / planned * 100) : null;
  });
  const known   = FY27.filter(v => v != null);
  const fallback = known.length ? Math.round(known.reduce((a,b) => a + b, 0) / known.length) : 60;
  const clamp   = v => Math.max(0, Math.min(100, v));
  const FY26    = FY27.map(v => clamp((v ?? fallback) - 4));
  return { FY27, FY26 };
}
const complianceRateData = computeComplianceRateData();

// ==========================================================
//  STATE
// ==========================================================
let fsWidgetId = null; // ID of the currently fullscreened widget
let openPanel = null;  // tracks currently open panel as "panelId|type|value"
let currentFilter = { 1: null, 2: null }; // per-row active filter state

// Chart instance registry — update data arrays above; no design changes needed
const charts = {};

// ==========================================================
//  VIEWPORT
// ==========================================================
function fitViewport() {
  const root   = document.getElementById("dashboardRoot");
  const wrap   = document.querySelector(".viewport-fit");
  const header = document.querySelector(".topnav");

  if (window.innerWidth <= TABLET_BREAKPOINT) {
    root.style.transform = "";
    root.style.transformOrigin = "";
    wrap.style.paddingTop = "0px";
    return;
  }

  if (header) baselineHeaderHeight = header.getBoundingClientRect().height;
  const availH = window.innerHeight - baselineHeaderHeight;

  // Re-capture baseline only when safe (no drill-down, no fullscreen).
  // We do NOT temporarily remove the transform here — that causes a reflow flash.
  // The initial baseline (672) matches the CSS exactly; subsequent measurements
  // happen naturally when layout is stable.
  if (!openPanel && !fsWidgetId && root.scrollHeight > 0) {
    baselineContentHeight = root.scrollHeight;
  }

  const scale = Math.min(MAX_SCALE, window.innerWidth / DASHBOARD_WIDTH, availH / baselineContentHeight);

  if (fsWidgetId) {
    root.style.transform = "";
    root.style.transformOrigin = "";
  } else {
    root.style.transform       = "scale(" + scale + ")";
    root.style.transformOrigin = "top center";
  }

  const topPad = Math.max(0, (availH - baselineContentHeight * scale) / 2);
  wrap.style.paddingTop = topPad + "px";
}

// Role display (avatar, name/email, which tabs show) and logout are both handled by
// shared.js's renderTopNav("dashboard") now — see init() below.

// ==========================================================
//  HELPERS
// ==========================================================
function delayBandFor(days) {
  if (days <= 15) return "On Track";
  if (days <= 60) return "Delayed";
  return "At Risk";
}
function statusBadgeClass(status) {
  if (status === "On Track") return "badge-ontrack";
  if (status === "Delayed")  return "badge-delayed";
  return "badge-critical"; // At Risk
}
// A project's status must agree with the same delay-band logic the health chart buckets it
// into — a project the chart shows as "On Time" can't also read "Critical" in this table.
projectPortfolioData.forEach(p => { p.status = delayBandFor(p.delayDays); });
function avg(arr, key) { return arr.length ? Math.round(arr.reduce((s,p) => s + p[key], 0) / arr.length) : 0; }
function mkBadge(txt, cls) { return "<span class='badge " + cls + "'>" + txt + "</span>"; }
// Escapes quotes too (not just &<>) — some callers (the Status hover tooltip) interpolate this
// straight into a single-quoted HTML attribute, and real risk/issue text routinely contains
// apostrophes ("the supplier's PPAP submission...") that would otherwise terminate the attribute early.
function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }

// Single source of truth for which 3 reporting months make up each quarter — shared by the
// Gate Status rings' totals (computeGateStatusByQuarter) AND their drill-down filter (the
// "quarter" case below), so a ring's P/A numbers and what you see after clicking it can never
// disagree again (previously the ring summed all 3 months but the click only filtered by the
// quarter's first month, so Q1/Q3/Q4 routinely opened to "0 records matched").
// Standard calendar quarters (Jan-start), not an Apr-start fiscal year — July is quarter 3.
const QUARTER_MONTHS = {
  Q1: ["Jan","Feb","Mar"], Q2: ["Apr","May","Jun"],
  Q3: ["Jul","Aug","Sep"], Q4: ["Oct","Nov","Dec"],
};

// ==========================================================
//  FILTER
// ==========================================================
function filterProjects(type, value) {
  switch (type) {
    case "health":
      if (value === "BB" || value === "N-BB") return projectPortfolioData.filter(p => p.classification === value);
      if (value === "all") return projectPortfolioData;
      return projectPortfolioData.filter(p => delayBandFor(p.delayDays) === value);
    case "classification":
      return projectPortfolioData.filter(p => p.type === value);
    case "typeGate": {
      const [t, g] = value.split("|");
      return projectPortfolioData.filter(p => p.type === t && p.gate === g);
    }
    case "compliance": {
      const typeFilter = value.split("-")[0];
      if (typeFilter === "Total") return projectPortfolioData;
      return projectPortfolioData.filter(p => p.type === typeFilter);
    }
    case "month": {
      const [mon] = value.split("-");
      return projectPortfolioData.filter(p => p.month === mon);
    }
    case "quarter": {
      const months = QUARTER_MONTHS[value] || [];
      return projectPortfolioData.filter(p => months.includes(p.month));
    }
    default: return projectPortfolioData;
  }
}

// ==========================================================
//  TABLE RENDERERS
// ==========================================================

// Reason / Corrective Action / Mitigation Plan used to be their own table columns; the current
// Figma drill-down (node 376:2162, "5 Project - Risk & AI Prediction") drops them in favor of
// Process Compliance Score + Deliverables columns and surfaces that same detail as a hover
// tooltip on the Status badge instead — see wireRiskTooltip().
// thId/tbId each accept either an element id string (the row-2 fixed panel) or the element
// itself (row-1's dynamically-created panels, which have no global id to collide across
// multiple simultaneously-open instances).
function renderProjectTable(thId, tbId, projects) {
  const theadEl = typeof thId === "string" ? document.getElementById(thId) : thId;
  const tbodyEl = typeof tbId === "string" ? document.getElementById(tbId) : tbId;
  theadEl.innerHTML = "<tr><th>PROJECT NAME</th><th>PROCESS COMPLIANCE SCORE</th><th>GATE</th><th>DELIVERABLES</th><th>TYPE</th><th>CLASSIFICATION</th><th>DELAY</th><th>STATUS</th></tr>";
  if (!projects.length) {
    tbodyEl.innerHTML = "<tr><td colspan='8' class='dd-empty'>No records match this filter.</td></tr>";
    return;
  }
  tbodyEl.innerHTML = projects.map((p) => {
    // On-track projects stay green; everything else is tiered by riskScore (same 70-point cut
    // the compliance-score pill uses), matching Figma showing both Critical AND High rows within
    // a single delay-band drilldown rather than one uniform label per band.
    const onTrack  = p.status === "On Track";
    const severe   = !onTrack && p.riskScore >= 70;
    const statusLbl = onTrack ? "On Track" : severe ? "Critical" : "High";
    const statusCls = onTrack ? "dd-status-ontrack" : severe ? "dd-status-critical" : "dd-status-high";
    const scoreCls  = onTrack ? "dd-risk-ok" : severe ? "dd-risk-high" : "dd-risk-med";
    const delayCls = p.delayDays > 30 ? "dd-delay-high" : p.delayDays > 0 ? "dd-delay-med" : "dd-delay-low";
    const clsChip  = p.classification === "N-BB" ? "<span class='dd-chip-nbb'>N-BB</span>" : "<span class='dd-chip-bb'>BB</span>";
    return "<tr>" +
      "<td class='col-project'><a class='dd-project-link' href='pages/project-detail/index.html?id=" + encodeURIComponent(p.projectCode) + "'>" + esc(p.projectName) + "</a></td>" +
      "<td><span class='dd-risk-pill " + scoreCls + "'>" + p.riskScore + "</span></td>" +
      "<td><span class='dd-chip'>" + esc(p.gate) + "</span></td>" +
      "<td>" + p.deliverablesCompleted + "/" + p.deliverablesTotal + "</td>" +
      "<td><span class='dd-chip'>" + esc(p.type) + "</span></td><td>" + clsChip + "</td>" +
      "<td class='" + delayCls + "'>" + p.delayDays + "d</td>" +
      "<td><span class='dd-status-badge dd-has-tip " + statusCls + "'" +
        " data-tip-code='" + esc(p.projectCode) + "'>" + statusLbl + "</span></td>" +
    "</tr>";
  }).join("");
}

// The nearest-due (or nearest-overdue) deliverable in a project's CURRENT gate — "current
// deliverables" for a project means whatever's actually coming up next, not an arbitrary one.
// Real record from _deliverables (app-config.js), matched by projectCode + the project's own
// current gate code.
function nearestDeliverableFor(projectCode, gateCode) {
  const candidates = _deliverables.filter(d => d.projectCode === projectCode && d.gateCode === gateCode && d.targetDate);
  if (!candidates.length) return "-";
  const today = Date.now();
  candidates.sort((a, b) => Math.abs(new Date(a.targetDate) - today) - Math.abs(new Date(b.targetDate) - today));
  return candidates[0].deliverableName;
}

// "Overall Project Health" drives two different clickable surfaces that both route through
// type:"health" — the BB/Non-BB/Total segmented bar and the On Track/Delayed/At Risk bar chart —
// and each needs its own column set, not the generic 8-column table both used to share.
function renderHealthTable(thId, tbId, value, projects) {
  const theadEl = typeof thId === "string" ? document.getElementById(thId) : thId;
  const tbodyEl = typeof tbId === "string" ? document.getElementById(tbId) : tbId;
  const isDelayView = value === "On Track" || value === "Delayed" || value === "At Risk";

  if (isDelayView) {
    // PROJECT NAME | PROCESS COMPLIANCE SCORE | 0-15 / 15-60 / >60 day delay bands — counted in
    // real deliverables (not projects), from each deliverable's own real delayDays.
    theadEl.innerHTML = "<tr><th>PROJECT NAME</th><th>PROCESS COMPLIANCE SCORE</th><th>0-15 (No. of Deliverables)</th><th>15-60 (No. of Deliverables)</th><th>&gt;60 (No. of Deliverables)</th></tr>";
    if (!projects.length) { tbodyEl.innerHTML = "<tr><td colspan='5' class='dd-empty'>No records match this filter.</td></tr>"; return; }
    tbodyEl.innerHTML = projects.map(p => {
      const deliv = _deliverables.filter(d => d.projectCode === p.projectCode);
      const band = (lo, hi) => deliv.filter(d => { const days = d.delayDays || 0; return days > lo && days <= hi; }).length;
      const scoreCls = p.riskScore >= 70 ? "dd-risk-high" : p.riskScore >= 40 ? "dd-risk-med" : "dd-risk-ok";
      return "<tr>" +
        "<td class='col-project'><a class='dd-project-link' href='pages/project-detail/index.html?id=" + encodeURIComponent(p.projectCode) + "'>" + esc(p.projectName) + "</a></td>" +
        "<td><span class='dd-risk-pill " + scoreCls + "'>" + p.riskScore + "</span></td>" +
        "<td>" + band(-Infinity, 15) + "</td><td>" + band(15, 60) + "</td><td>" + band(60, Infinity) + "</td>" +
      "</tr>";
    }).join("");
  } else {
    // PROJECT NAME | Platform | Current GATE | Current DELIVERABLES (nearest to today's date)
    theadEl.innerHTML = "<tr><th>PROJECT NAME</th><th>PLATFORM</th><th>CURRENT GATE</th><th>CURRENT DELIVERABLES</th></tr>";
    if (!projects.length) { tbodyEl.innerHTML = "<tr><td colspan='4' class='dd-empty'>No records match this filter.</td></tr>"; return; }
    tbodyEl.innerHTML = projects.map(p => {
      const nearest = nearestDeliverableFor(p.projectCode, p.gate);
      return "<tr>" +
        "<td class='col-project'><a class='dd-project-link' href='pages/project-detail/index.html?id=" + encodeURIComponent(p.projectCode) + "'>" + esc(p.projectName) + "</a></td>" +
        "<td>" + esc(p.platform || "-") + "</td>" +
        "<td><span class='dd-chip'>" + esc(p.gate) + "</span></td>" +
        "<td>" + esc(nearest) + "</td>" +
      "</tr>";
    }).join("");
  }
}

// Same gate-started + real-calendar-quarter logic as computeGateStatusByQuarter (Chart 2's
// rings), grouped per project instead of summed across all of them, so this drill-down's rows
// always reconcile with the ring totals that opened it.
function computePerProjectQuarterBreakdown() {
  const gateStatusById = Object.fromEntries(_gateInstances.map(g => [g.id, g.currentStatus]));
  const quarters = currentFYQuarters();
  return projectPortfolioData.map(p => {
    const started = _deliverables.filter(d => {
      if (d.projectCode !== p.projectCode) return false;
      const s = gateStatusById[d.gateInstanceId];
      return s === "Active" || s === "Completed";
    });
    const row = { projectCode: p.projectCode, projectName: p.projectName };
    let totalPlanned = 0, totalActual = 0;
    quarters.forEach(({ key, start, end }) => {
      const inQ = started.filter(d => d.targetDate && new Date(d.targetDate + "T00:00:00") >= start && new Date(d.targetDate + "T00:00:00") <= end);
      const planned = inQ.length;
      const actual  = inQ.filter(d => d.status === "Completed").length;
      row[key] = { planned, actual };
      totalPlanned += planned; totalActual += actual;
    });
    row.total = { planned: totalPlanned, actual: totalActual };
    return row;
  });
}

function renderQuarterTable(thId, tbId, rows) {
  const theadEl = typeof thId === "string" ? document.getElementById(thId) : thId;
  const tbodyEl = typeof tbId === "string" ? document.getElementById(tbId) : tbId;
  theadEl.innerHTML =
    "<tr><th rowspan='2'>SR. NO</th><th rowspan='2'>PROJECT NAME</th>" +
    ["Q1","Q2","Q3","Q4","TOTAL"].map(q => "<th colspan='2'>" + q + "</th>").join("") +
    "</tr><tr>" + ["Q1","Q2","Q3","Q4","TOTAL"].map(() => "<th>Planned</th><th>Actual</th>").join("") + "</tr>";
  if (!rows.length) {
    tbodyEl.innerHTML = "<tr><td colspan='12' class='dd-empty'>No records match this filter.</td></tr>";
    return;
  }
  tbodyEl.innerHTML = rows.map((r, i) => {
    const qCells = ["Q1","Q2","Q3","Q4"].map(q => "<td>" + r[q].planned + "</td><td>" + r[q].actual + "</td>").join("");
    return "<tr style='background:" + (i % 2 === 1 ? "#f8f9fb" : "#fff") + "'>" +
      "<td>" + (i + 1) + "</td>" +
      "<td class='col-project'><a class='dd-project-link' href='pages/project-detail/index.html?id=" + encodeURIComponent(r.projectCode) + "'>" + esc(r.projectName) + "</a></td>" +
      qCells +
      "<td style='font-weight:700'>" + r.total.planned + "</td><td style='font-weight:700'>" + r.total.actual + "</td>" +
    "</tr>";
  }).join("") + (function () {
    const totalP = rows.reduce((s, r) => s + r.total.planned, 0);
    const totalA = rows.reduce((s, r) => s + r.total.actual, 0);
    const qTotals = ["Q1","Q2","Q3","Q4"].map(q => ({
      p: rows.reduce((s, r) => s + r[q].planned, 0), a: rows.reduce((s, r) => s + r[q].actual, 0),
    }));
    return "<tr style='background:#f1f5f9;font-weight:700;border-top:2px solid #e2e8f0'>" +
      "<td></td><td style='padding-left:12px;color:#1e3a5f'>TOTAL (" + rows.length + " projects)</td>" +
      qTotals.map(q => "<td style='font-weight:800'>" + q.p + "</td><td style='font-weight:800'>" + q.a + "</td>").join("") +
      "<td style='font-weight:800'>" + totalP + "</td><td style='font-weight:800'>" + totalA + "</td>" +
    "</tr>";
  })();
}

function renderComplianceTable(thId, tbId, type, value) {
  // typeFilter = "M2"|"M4"|"M6"|"Total", col = "Planned"|"Actual"|"Percentage"|""
  const typeFilter = value.split("-")[0];
  const colHighlight = value.split("-")[1] || null;

  // Get the projects for this filter
  const projects = typeFilter === "Total"
    ? projectPortfolioData.slice()
    : projectPortfolioData.filter(p => p.type === typeFilter);

  // Header — highlight the clicked column
  const hl = col => colHighlight === col ? "style='background:#eff6ff;font-weight:800'" : "";
  document.getElementById(thId).innerHTML =
    "<tr>" +
    "<th>PROJECT NAME</th>" +
    "<th>TYPE</th>" +
    "<th>CLASSIFICATION</th>" +
    "<th " + hl("Planned")    + ">PLANNED</th>" +
    "<th " + hl("Actual")     + ">ACTUAL</th>" +
    "<th " + hl("Percentage") + ">COMPLIANCE %</th>" +
    "<th>VARIANCE</th>" +
    "<th>STATUS</th>" +
    "</tr>";

  if (!projects.length) {
    document.getElementById(tbId).innerHTML = "<tr><td colspan='8' class='dd-empty'>No records match this filter.</td></tr>";
    return;
  }

  // Project rows — each project shows its own planned/actual so the sum always matches the chart
  document.getElementById(tbId).innerHTML = projects.map((p, i) => {
    const pct      = p.planned ? Math.round(p.actual / p.planned * 100) : 0;
    const variance = p.actual - p.planned;
    const pColor   = pct >= 85 ? "#15803d" : pct >= 70 ? "#d97706" : "#dc2626";
    const pBg      = pct >= 85 ? "#f0fdf4" : pct >= 70 ? "#fffbeb" : "#ffebee";
    const lbl      = pct >= 85 ? "On Track" : pct >= 70 ? "Watch" : "At Risk";
    const clsBadge = p.classification === "N-BB" ? mkBadge("N-BB","badge-nbb") : mkBadge("BB","badge-bb");
    const bg       = i % 2 === 1 ? "#f8f9fb" : "#fff";
    return "<tr style='background:" + bg + "'>" +
      "<td class='col-project'><a class='dd-project-link' href='pages/project-detail/index.html?id=" + encodeURIComponent(p.projectCode) + "'>" + esc(p.projectName) + "</a></td>" +
      "<td>" + esc(p.type) + "</td>" +
      "<td>" + clsBadge + "</td>" +
      "<td style='font-weight:600" + (colHighlight === "Planned"    ? ";background:#eff6ff;color:#1d4ed8" : "") + "'>" + p.planned + "</td>" +
      "<td style='font-weight:600" + (colHighlight === "Actual"     ? ";background:#eff6ff;color:#1d4ed8" : "") + "'>" + p.actual + "</td>" +
      "<td style='font-weight:700;color:" + pColor + (colHighlight === "Percentage" ? ";background:#fffbeb" : "") + "'>" + pct + "%</td>" +
      "<td style='color:" + (variance < 0 ? "#dc2626" : "#15803d") + ";font-weight:600'>" + (variance > 0 ? "+" : "") + variance + "</td>" +
      "<td><span style='display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:" + pBg + ";color:" + pColor + "'>" + lbl + "</span></td>" +
    "</tr>";
  }).join("") +
  // Summary totals row
  (function() {
    const totalPlanned = projects.reduce((s,p) => s + p.planned, 0);
    const totalActual  = projects.reduce((s,p) => s + p.actual, 0);
    const totalPct     = totalPlanned ? Math.round(totalActual / totalPlanned * 100) : 0;
    const totalVar     = totalActual - totalPlanned;
    const tColor       = totalPct >= 85 ? "#15803d" : totalPct >= 70 ? "#d97706" : "#dc2626";
    return "<tr style='background:#f1f5f9;font-weight:700;border-top:2px solid #e2e8f0'>" +
      "<td style='padding-left:12px;font-weight:700;color:#1e3a5f'>TOTAL (" + projects.length + " projects)</td>" +
      "<td></td><td></td>" +
      "<td style='font-weight:800'>" + totalPlanned + "</td>" +
      "<td style='font-weight:800'>" + totalActual + "</td>" +
      "<td style='font-weight:800;color:" + tColor + "'>" + totalPct + "%</td>" +
      "<td style='color:" + (totalVar < 0 ? "#dc2626" : "#15803d") + ";font-weight:800'>" + (totalVar > 0 ? "+" : "") + totalVar + "</td>" +
      "<td></td></tr>";
  })();
}

function renderMonthTable(thId, tbId, projects) {
  document.getElementById(thId).innerHTML = "<tr><th>PROJECT NAME</th><th>GATE</th><th>TYPE</th><th>CLASSIFICATION</th><th>MONTH</th><th>PLANNED</th><th>ACTUAL</th><th>COMPLIANCE %</th><th>STATUS</th></tr>";
  if (!projects.length) {
    document.getElementById(tbId).innerHTML = "<tr><td colspan='9' class='dd-empty'>No records for this period.</td></tr>";
    return;
  }
  document.getElementById(tbId).innerHTML = projects.map((p, i) => {
    const compPct  = p.planned ? Math.round(p.actual / p.planned * 100) : 0;
    const pColor   = compPct >= 85 ? "#15803d" : compPct >= 70 ? "#d97706" : "#dc2626";
    const clsBadge = p.classification === "N-BB" ? mkBadge("N-BB","badge-nbb") : mkBadge("BB","badge-bb");
    return "<tr style='background:" + (i % 2 === 1 ? "#f8f9fb" : "#fff") + "'>" +
      "<td class='col-project'><a class='dd-project-link' href='pages/project-detail/index.html?id=" + encodeURIComponent(p.projectCode) + "'>" + esc(p.projectName) + "</a></td>" +
      "<td>" + esc(p.gate) + "</td><td>" + esc(p.type) + "</td><td>" + clsBadge + "</td>" +
      "<td>" + esc(p.month) + "</td><td>" + p.planned + "</td><td>" + p.actual + "</td>" +
      "<td style='color:" + pColor + ";font-weight:700'>" + compPct + "%</td>" +
      "<td>" + mkBadge(p.status, statusBadgeClass(p.status)) + "</td>" +
    "</tr>";
  }).join("");
}

// ==========================================================
//  DRILL-DOWN PANEL CONTROLLER
// ==========================================================
// Gate Status quarters are real calendar-year quarters (see currentFYQuarters) for the actual
// current year \u2014 not a hardcoded "2026-2027" fiscal-year span.
function quarterLabel(key) {
  const months = QUARTER_MONTHS[key] || [];
  const year = new Date().getFullYear();
  return key + " (" + months[0] + "\u2013" + months[months.length - 1] + " " + year + ")";
}

const titleMap = {
  health:        v => "Overall Project Health \u2014 " + v,
  classification:v => "Classification \u2014 " + v + " Projects",
  typeGate:      v => "Classification " + v.replace("|"," / ") + " Projects",
  compliance:    v => "Process Compliance Status \u2014 " + (v.split("-")[0] === "Total" ? "All Projects" : v.split("-")[0] + " Projects"),
  month:         v => "Compliance Rate \u2014 " + v.replace("-"," "),
  quarter:       v => "Gate Status \u2014 " + quarterLabel(v),
};
const filterLabelMap = {
  quarter: v => quarterLabel(v),
};
const aiMap = {
  health:        (v,ps) => "\uD83E\uDD16 AI: " + ps.filter(p=>p.status==="At Risk").length + " at risk in \"" + v + "\" \u2014 avg risk " + avg(ps,"riskScore") + ". Compliance = (Actual \u00F7 Planned) \u00D7 100.",
  classification:(v,ps) => "\uD83E\uDD16 AI: " + ps.length + " " + v + " project(s) \u2014 " + ps.filter(p=>p.status==="At Risk").length + " at risk, " + ps.filter(p=>p.status==="Delayed").length + " delayed",
  typeGate:      (v,ps) => "\uD83E\uDD16 AI: " + ps.length + " project(s) at " + v.replace("|"," / ") + " \u2014 " + ps.filter(p=>p.status==="At Risk").length + " at risk",
  compliance:    ()     => {
    const rows  = complianceStatusData.filter(r => r.type !== "Total");
    const total = complianceStatusData.find(r => r.type === "Total");
    const best  = rows.reduce((a,b) => b.pct > a.pct ? b : a);
    const worst = rows.reduce((a,b) => b.pct < a.pct ? b : a);
    return "\uD83E\uDD16 AI: Compliance % = (Actual \u00F7 Planned) \u00D7 100.  Total: " + total.actual + "\u00F7" + total.planned + " = " + total.pct + "%.  " +
      best.type + " leads (" + best.pct + "%), " + worst.type + " needs attention (" + worst.pct + "%).";
  },
  month:         (v,ps) => "\uD83E\uDD16 AI: " + ps.length + " project(s) in " + v.replace("-"," ") + " \u2014 avg risk " + avg(ps,"riskScore") + ". Formula: Compliance % = (Actual Completed \u00F7 Planned) \u00D7 100.",
  // Uses the SAME gateStatusData the rings themselves show (real quarter-of-real-date +
  // gate-started counts) rather than re-deriving from the old per-project p.planned/p.actual \u2014
  // so the AI note can never disagree with the numbers inside the ring that was clicked.
  quarter:       (v) => {
    const row = gateStatusData.find(q => q.key === v);
    if (!row) return "\uD83E\uDD16 AI insights";
    return "\uD83E\uDD16 AI: " + row.actual + "\u00F7" + row.planned + " deliverables complete in " + quarterLabel(v) + " (" + row.pct + "%).";
  },
};

// Populates a panel's content for a given type/value \u2014 shared by showDrillDown (first open)
// and refreshDrillDown (re-render the currently-open filter) so they can never drift apart.
function renderDrillDownContent(row, type, value) {
  const projects  = filterProjects(type, value);
  const makeTitle = titleMap[type] || (v => v);
  const asOf = typeof todayISTLabel === "function" ? todayISTLabel() : "";
  const subtitle  = type === "compliance"
    ? (() => {
        const tf = value.split("-")[0];
        const cnt = tf === "Total" ? projectPortfolioData.length : projectPortfolioData.filter(p => p.type === tf).length;
        return cnt + " project(s) \u2014 Planned vs Actual \u2014 As on " + asOf;
      })()
    : type === "quarter"
    ? projectPortfolioData.length + " project(s) \u2014 Gate deliverables by quarter \u2014 As on " + asOf
    : projects.length + " project(s) matched \u2014 As on " + asOf;

  if (row === 1) {
    document.getElementById("ddFilterLabel1").textContent = "\u25B6 " + (filterLabelMap[type] ? filterLabelMap[type](value) : value.replace("|"," / "));
    document.getElementById("ddTitle1").textContent    = makeTitle(value);
    document.getElementById("ddSubTitle1").textContent = subtitle;
    if (type === "quarter") renderQuarterTable("ddTH1","ddTB1", computePerProjectQuarterBreakdown());
    else if (type === "health") renderHealthTable("ddTH1","ddTB1", value, projects);
    else renderProjectTable("ddTH1","ddTB1", projects);
    document.getElementById("ddAI1").textContent = (aiMap[type] || (() => "\uD83E\uDD16 AI insights"))(value, projects);
  } else {
    document.getElementById("ddFilterLabel2").textContent = "\u25B6 " + (filterLabelMap[type] ? filterLabelMap[type](value) : value.replace("|"," / ").replace("-"," "));
    document.getElementById("ddTitle2").textContent    = makeTitle(value);
    document.getElementById("ddSubTitle2").textContent = subtitle;
    if (type === "compliance") renderComplianceTable("ddTH2","ddTB2", type, value);
    else renderMonthTable("ddTH2","ddTB2", projects);
    document.getElementById("ddAI2").textContent = (aiMap[type] || (() => "\uD83E\uDD16 AI insights"))(value, projects);
  }
  updateChartSelection(row, type);
  currentFilter[row] = { type, value };
}

function showDrillDown(row, type, value) {
  const panelId = row === 1 ? "drillDownRow1" : "drillDownRow2";
  const panel   = document.getElementById(panelId);
  const isSame  = openPanel === panelId + "|" + type + "|" + value;

  if (isSame) { closeDrillDown(row); return; }

  ["drillDownRow1","drillDownRow2"].forEach(id => {
    if (id !== panelId) document.getElementById(id).classList.remove("open");
  });

  renderDrillDownContent(row, type, value);

  panel.classList.add("open");
  openPanel = panelId + "|" + type + "|" + value;
  updateScrollLock();
  setTimeout(() => panel.scrollIntoView({ behavior:"smooth", block:"nearest" }), 80);
}

// Closing a row-2 (bottom-of-page) drill-down shrinks .viewport-fit's content back down and
// flips it from overflow:auto to overflow:hidden (see updateScrollLock/layout.css) — but the
// element's scrollTop isn't reset by that alone, so it kept whatever offset the user had
// scrolled to while the panel was open. With overflow now hidden at a non-zero scrollTop, the
// content renders from that stale offset instead of the top, reading as "the page jumped and
// half the content is missing". Reset scroll position back to the top on every close.
function closeDrillDown(row) {
  const panelId = row === 1 ? "drillDownRow1" : "drillDownRow2";
  document.getElementById(panelId).classList.remove("open", "dd-expanded");
  currentFilter[row] = null;
  openPanel = null;
  updateScrollLock();
  document.querySelector(".viewport-fit").scrollTop = 0;
  document.querySelectorAll(".widget").forEach(w => w.classList.remove("widget-active"));
}

function closeAllDrillDowns() {
  ["drillDownRow1","drillDownRow2"].forEach(id => document.getElementById(id).classList.remove("open", "dd-expanded"));
  currentFilter = { 1: null, 2: null };
  openPanel = null;
  updateScrollLock();
  document.querySelector(".viewport-fit").scrollTop = 0;
  document.querySelectorAll(".widget").forEach(w => w.classList.remove("widget-active"));
}

// \u2500\u2500 Toolbar: Refresh / Expand-Restore / Export \u2500\u2500
function refreshDrillDown(row) {
  const cur = currentFilter[row];
  if (!cur) return;
  renderDrillDownContent(row, cur.type, cur.value);
}

function toggleDrillDownExpand(row) {
  const panelId = row === 1 ? "drillDownRow1" : "drillDownRow2";
  const panel   = document.getElementById(panelId);
  const btn     = panel.querySelector(".dd-expand-toggle");
  const expanded = panel.classList.toggle("dd-expanded");
  if (btn) btn.setAttribute("title", expanded ? "Restore" : "Expand");
}

function exportDrillDownCsv(row) {
  const cur = currentFilter[row];
  if (!cur) return;
  const { type, value } = cur;
  let rows, keys, filenamePart;

  if (type === "compliance") {
    const typeFilter = value.split("-")[0];
    const ps = typeFilter !== "Total" ? projectPortfolioData.filter(p => p.type === typeFilter) : projectPortfolioData.slice();
    rows = ps.map(p => ({
      projectName: p.projectName, type: p.type, classification: p.classification,
      planned: p.planned, actual: p.actual,
      pct: (p.planned ? Math.round(p.actual / p.planned * 100) : 0) + "%",
      variance: p.actual - p.planned, status: p.status
    }));
    keys = ["projectName","type","classification","planned","actual","pct","variance","status"];
    filenamePart = "compliance-status";
  } else if (type === "month") {
    rows = filterProjects(type, value).map(p => ({ ...p, compliancePct: (p.planned ? Math.round(p.actual / p.planned * 100) : 0) + "%" }));
    keys = ["projectName","gate","type","classification","month","planned","actual","compliancePct","status"];
    filenamePart = "compliance-rate";
  } else {
    rows = filterProjects(type, value);
    keys = ["projectName","gate","type","classification","riskScore","delayDays","reason","correctiveAction","status"];
    filenamePart = "project-health";
  }
  if (!rows.length) return;

  const csv = [keys.join(","), ...rows.map(r => keys.map(k => '"' + r[k] + '"').join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), { href:"data:text/csv;charset=utf-8," + encodeURIComponent(csv), download: filenamePart + "-export.csv" });
  a.click();
}

// Scrolling is only useful (and only enabled) while a drill-down panel is open and taller
// than the fitted viewport; see the .viewport-fit comment in styles.css for why.
function updateScrollLock() {
  document.querySelector(".viewport-fit")?.classList.toggle("scroll-enabled", !!openPanel);
}

function updateChartSelection(row, type) {
  document.querySelectorAll(".widget").forEach(w => w.classList.remove("widget-active"));
  // Gate Status rings (row 1) use their own "quarter" type now, distinct from the Compliance
  // Rate line's per-point "month" type (row 2) — each maps to exactly one widget, no collision.
  const map = { health:"healthWidget", classification:"classificationWidget",
    typeGate:"classificationWidget", compliance:"complianceStatusWidget",
    quarter:"classificationWidget", month:"complianceRateWidget" };
  document.getElementById(map[type])?.classList.add("widget-active");
}

// ==========================================================
//  FULLSCREEN
// ==========================================================
function openWidgetFullscreen(widgetId) {
  if (fsWidgetId) closeWidgetFullscreen();

  const widget = document.getElementById(widgetId);
  if (!widget) return;

  // Backdrop
  const bd = document.createElement("div");
  bd.id = "fsBackdrop";
  bd.className = "fs-backdrop";
  document.body.appendChild(bd);

  // Expand widget
  widget.classList.add("widget-fullscreen");
  const expandBtn = widget.querySelector(".expand-btn");
  if (expandBtn) { expandBtn.title = "Exit fullscreen"; expandBtn.setAttribute("aria-label", "Exit fullscreen"); }
  document.addEventListener("keydown", fsEscHandler);
  bd.addEventListener("click", closeWidgetFullscreen);
  fsWidgetId = widgetId;
  fitViewport(); // drop the dashboard-wide scale transform so fixed positioning uses the real viewport

  // Resize chart once layout has settled
  const keyMap = { healthWidget:"health", complianceStatusWidget:"complianceStatus", complianceRateWidget:"complianceRate" };
  const key = keyMap[widgetId];
  if (key && charts[key]) setTimeout(() => charts[key].resize(), 60);
}

function closeWidgetFullscreen() {
  if (!fsWidgetId) return;
  const widget = document.getElementById(fsWidgetId);
  if (widget) {
    widget.classList.remove("widget-fullscreen");
    const expandBtn = widget.querySelector(".expand-btn");
    if (expandBtn) { expandBtn.title = "Expand to fullscreen"; expandBtn.setAttribute("aria-label", "Expand to fullscreen"); }
  }
  document.getElementById("fsBackdrop")?.remove();
  document.removeEventListener("keydown", fsEscHandler);

  const keyMap = { healthWidget:"health", complianceStatusWidget:"complianceStatus", complianceRateWidget:"complianceRate" };
  const key = keyMap[fsWidgetId];
  fsWidgetId = null;

  // Shrink the chart's canvas back down BEFORE fitViewport() measures the dashboard's natural
  // height below: while the canvas still carries its oversized fullscreen dimensions, it
  // overflows its fixed-height widget and inflates #dashboardRoot's scrollHeight, which
  // fitViewport() would otherwise capture as the new baseline — corrupting the scale for the
  // WHOLE dashboard (every widget shrinks, not just the one that was fullscreened).
  if (key && charts[key]) charts[key].resize();
  fitViewport(); // restore the dashboard-wide scale transform
  if (key && charts[key]) setTimeout(() => charts[key].resize(), 60);
}

function fsEscHandler(e) { if (e.key === "Escape") closeWidgetFullscreen(); }

// ==========================================================
//  CHART 1 — Overall Project Health (BAR)
//  Data fully driven from projectPortfolioData
// ==========================================================
function buildOverallHealthChart() {
  // Compute all values from data
  const onTrack = projectPortfolioData.filter(p => delayBandFor(p.delayDays) === "On Track").length;
  const delayed = projectPortfolioData.filter(p => delayBandFor(p.delayDays) === "Delayed").length;
  const atRisk  = projectPortfolioData.filter(p => delayBandFor(p.delayDays) === "At Risk").length;
  const bbCnt   = projectPortfolioData.filter(p => p.classification === "BB").length;
  const nbbCnt  = projectPortfolioData.filter(p => p.classification === "N-BB").length;

  // Update segmented header + KPI panel
  document.getElementById("segTotalVal").textContent = projectPortfolioData.length;
  document.getElementById("segBBVal").textContent    = bbCnt;
  document.getElementById("segNBBVal").textContent   = nbbCnt;
  // KPI panel (right side)
  if (document.getElementById("pillBB"))       document.getElementById("pillBB").textContent    = "BB : " + bbCnt;
  if (document.getElementById("pillNBB"))      document.getElementById("pillNBB").textContent   = "Non BB : " + nbbCnt;
  if (document.getElementById("kpiOntrackVal")) document.getElementById("kpiOntrackVal").textContent = onTrack;
  if (document.getElementById("kpiDelayVal"))   document.getElementById("kpiDelayVal").textContent   = delayed;
  if (document.getElementById("kpiRiskVal"))    document.getElementById("kpiRiskVal").innerHTML      = atRisk + "<span class='health-kpi-at-risk'>AT RISK \u2197</span>";

  const yMax = Math.max(10, Math.ceil(Math.max(onTrack, delayed, atRisk) / 2) * 2 + 2);

  // Custom plugin: AT RISK badge above 3rd bar
  const atRiskPlugin = {
    id: "atRiskPlugin",
    afterDraw(chart) {
      const { ctx:c, chartArea } = chart;
      const bar = chart.getDatasetMeta(0).data[2];
      if (!bar) return;
      const x = bar.x, top = bar.y - 10;
      c.save();
      c.font = "700 10px Inter";
      const lbl = "AT RISK \u2197";
      const w = c.measureText(lbl).width + 14;
      const h = 18;
      c.fillStyle = "#fee2e2"; c.strokeStyle = "#fee2e2"; c.lineWidth = 1;
      c.beginPath();
      if (c.roundRect) c.roundRect(x - w/2, top - h, w, h, 3); else c.rect(x - w/2, top - h, w, h);
      c.fill(); c.stroke();
      c.fillStyle = "#e24b4b"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(lbl, x, top - h/2);
      c.restore();
    }
  };

  const ctx = document.getElementById("overallHealthChart").getContext("2d");
  charts.health = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["On Time\n0\u201315 Days","Delay\n15\u201360 Days","Delay\n>60 Days"],
      datasets: [{
        data: [onTrack, delayed, atRisk],
        backgroundColor: ["#14b8a6","#f1c272","#e53935"],
        borderRadius: 4, barPercentage: 0.50,
        // Bar 2 (>60 days) also carries the "AT RISK" badge just above it (see atRiskPlugin below);
        // push its count further up so the badge doesn't paint over the number.
        datalabels: { anchor:"end", align:"end", offset:ctx=>ctx.dataIndex===2?28:6, font:{size:16,weight:"800"}, color:"#1f2937", formatter:v=>v }
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      layout: { padding:{ top:50, right:16, bottom:0, left:8 } },
      plugins: {
        legend:  { display:false },
        tooltip: { enabled: false },
        atRiskPlugin: {}, datalabels: {}
      },
      scales: {
        x: { grid:{display:false}, border:{display:false},
             ticks:{ color:"#374151", font:{size:12,weight:"600"}, callback(v){ return this.getLabelForValue(v).split("\n"); } } },
        y: { min:0, max:yMax, ticks:{ stepSize:2, color:"#666", font:{size:11} }, grid:{color:"#e5e7eb"}, border:{display:false} }
      },
      onClick(_e, els) {
        if (!els.length) { showDrillDown(1,"health","all"); return; }
        showDrillDown(1,"health", ["On Track","Delayed","At Risk"][els[0].index]);
      }
    },
    plugins: [ChartDataLabels, atRiskPlugin]
  });
  return charts.health;
}

// ==========================================================
//  CHART 2 — Gate Status Rings (Planned vs Actual, per FY quarter)
//  Deliverable planned/actual counts, bucketed by the SAME `month` field the
//  Process Compliance Rate chart uses — never an independent/fabricated number.
// ==========================================================
// Real, year-aware calendar-quarter boundaries (Jan-Mar/Apr-Jun/Jul-Sep/Oct-Dec) for the CURRENT
// calendar year, anchored to the actual current date exactly like the header's own "As on date"
// — not a hardcoded year. Previously QUARTER_MONTHS matched by month NAME only (ignoring year),
// which silently conflated e.g. every "November" a deliverable could ever fall in — a 2025
// completion and a 2026 target both landed in the same "Nov" bucket.
function currentFYQuarters() {
  const year = new Date().getFullYear();
  const starts = [0, 3, 6, 9].map(m => new Date(year, m, 1));
  const keys = ["Q1", "Q2", "Q3", "Q4"];
  return keys.map((key, i) => ({ key, start: starts[i], end: new Date(starts[i].getFullYear(), starts[i].getMonth() + 3, 0) }));
}

// Counts every real deliverable assignment exactly once, into whichever real FY quarter its own
// targetDate falls in — and only once its own gate has actually started (Active or Completed
// gate-instance status). A deliverable can carry a future targetDate on paper long before its
// gate is ever activated; counting those as "planned" made every quarter look partially worked
// on even when, per this program's real Stage-Gate status, nothing in it has started yet. This
// is why a future quarter correctly shows 0/0 (grey "not started") rather than a number.
function computeGateStatusByQuarter() {
  const gateStatusById = Object.fromEntries(_gateInstances.map(g => [g.id, g.currentStatus]));
  const started = _deliverables.filter(d => {
    const s = gateStatusById[d.gateInstanceId];
    return s === "Active" || s === "Completed";
  });
  return currentFYQuarters().map(({ key, start, end }) => {
    const inQuarter = started.filter(d => {
      if (!d.targetDate) return false;
      const t = new Date(d.targetDate + "T00:00:00");
      return t >= start && t <= end;
    });
    const planned = inQuarter.length;
    const actual  = inQuarter.filter(d => d.status === "Completed").length;
    return { key, months: QUARTER_MONTHS[key], planned, actual, pct: planned ? Math.round(actual / planned * 100) : 0 };
  });
}
const gateStatusData = computeGateStatusByQuarter();

function buildGateStatusRing(quarter) {
  const row = gateStatusData.find(q => q.key === quarter);
  const started = row.planned > 0;
  const centerEl = document.getElementById("gateRing" + quarter + "Left");
  if (centerEl) {
    centerEl.innerHTML = started
      ? "<span class='a-label'>A - " + row.actual + "</span><span class='pa-divider'></span><span class='p-label'>P - " + row.planned + "</span>"
      : "<span class='a-label muted'>A - 0</span><span class='pa-divider'></span><span class='p-label muted'>P - 0</span>";
  }

  // No onClick here — the wrapping .gate-ring-col listener (wireEvents) covers the whole column,
  // canvas included; adding a second handler on the canvas itself would double-fire showDrillDown
  // (event bubbles from canvas -> column) and the toggle-close logic would open then immediately
  // close the panel.
  const ctx = document.getElementById("gateRing" + quarter + "Chart").getContext("2d");
  if (!started) {
    // Grey "not started yet" ring — this quarter's gates haven't been activated, so there's no
    // Planned/Actual ratio to show yet (distinct from a real 0%, which would still be teal/navy).
    return new Chart(ctx, {
      type: "doughnut",
      data: { labels: ["Not started"], datasets: [{ data: [1], backgroundColor: ["#e2e8f0"], borderWidth: 0, cutout: "72%" }] },
      options: { responsive: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
    });
  }
  return new Chart(ctx, {
    type: "doughnut",
    data: { labels:["Actual","Remaining"], datasets:[{ data:[row.pct, 100 - row.pct], backgroundColor:["#14b8a6","#1e3a5f"], borderWidth:0, cutout:"72%" }] },
    options: {
      responsive:false, animation:false,
      plugins:{ legend:{display:false}, tooltip:{enabled:false} },
    }
  });
}

// Draws the bold "82%" line directly under the x-axis, above each category's own tick label —
// matches Figma exactly and keeps the percentage legible without ever overlapping a bar's value
// label (which the inline per-point datalabel used to do). Reads complianceStatusData directly
// since this chart's categories are always exactly that array, in that order.
const pctBelowAxisPlugin = {
  id: "pctBelowAxis",
  afterDraw(chart) {
    const { ctx, chartArea, scales: { x } } = chart;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#1e3a5f";
    ctx.font = "700 11px Inter, sans-serif";
    complianceStatusData.forEach((row, i) => {
      ctx.fillText(row.pct + "%", x.getPixelForTick(i), chartArea.bottom + 6);
    });
    ctx.restore();
  }
};

// ==========================================================
//  CHART 3 — Process Compliance Status
//  Tooltips enabled; bar values visible via datalabels
// ==========================================================
function buildComplianceStatusChart() {
  const ctx = document.getElementById("complianceStatusChart").getContext("2d");
  charts.complianceStatus = new Chart(ctx, {
    data: {
      labels: complianceStatusData.map(r => r.type),
      datasets: [
        {
          type:"bar", label:"Planned",
          data: complianceStatusData.map(r => r.planned),
          backgroundColor:"#1e3a5f", borderRadius:3, barThickness:36,
          datalabels: {
            display: true, anchor:"end", align:"top", offset:2,
            color:"#374151", font:{ size:9, weight:"700" }, formatter:v=>v
          }
        },
        {
          type:"bar", label:"Actual",
          data: complianceStatusData.map(r => r.actual),
          backgroundColor:"#14b8a6", borderRadius:3, barThickness:36,
          datalabels: {
            display: true, anchor:"end", align:"top", offset:2,
            color:"#374151", font:{ size:9, weight:"700" }, formatter:v=>v
          }
        },
        {
          // No per-point datalabel here (Figma has none) — a floating "%" label next to the dot
          // routinely collided with the bar-value labels right beside it (e.g. a dot sitting
          // near a tall bar's own value text), reading as "the line/percentage is hidden". Figma's
          // actual design (node 376:2836) instead prints the bold "%" as a second line UNDER the
          // x-axis, below each category name — drawn by pctBelowAxisPlugin, never overlapping
          // anything in the chart body itself.
          type:"line", label:"Percentage",
          data: complianceStatusData.map(r => r.pct),
          yAxisID:"yRight", borderColor:"#f0ad4e", backgroundColor:"#f0ad4e",
          borderWidth:2, tension:.3, pointRadius:4,
          pointBackgroundColor:"#1e3a5f", pointBorderColor:"#1e3a5f",
          datalabels: { display:false }
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { position:"bottom", labels:{ boxWidth:12, boxHeight:12, color:"#6b7280", usePointStyle:true, font:{family:"Inter",size:11} } },
        tooltip: { enabled: false },
        datalabels: {}
      },
      scales: {
        // ticks.padding pushes the "M6"/"M4"/... labels down, opening a gap right under the axis
        // line where pctBelowAxisPlugin draws the bold percentage — see comment above.
        x: { grid:{display:false}, ticks:{color:"#6b7280",font:{size:11,weight:"600"},padding:20},
             title:{display:true,text:"Product Classification",color:"#6b7280",font:{size:11}} },
        y: { min:0, max:400,
          ticks:{stepSize:100,color:"#666",font:{size:10}},
          grid:{color:"#e5e7eb"},
          title:{ display:true, text:"Deliverables (Nos.)", color:"#64748b", font:{size:11,weight:"500"}, padding:{top:0,bottom:4} }
        },
        yRight: { position:"right", min:0, max:100, ticks:{stepSize:25,callback:v=>v+"%",color:"#666",font:{size:10}}, grid:{drawOnChartArea:false} }
      },
      onClick(_e, els) {
        if (!els.length) { showDrillDown(2,"compliance","Total"); return; }
        const { datasetIndex, index } = els[0];
        const typeVal = complianceStatusData[index].type;
        const layer   = ["Planned","Actual","Percentage"][datasetIndex] || "";
        showDrillDown(2,"compliance", typeVal + (layer ? "-" + layer : ""));
      }
    },
    plugins: [ChartDataLabels, pctBelowAxisPlugin]
  });
  return charts.complianceStatus;
}

// ==========================================================
//  CHART 4 — Process Compliance Rate (2-line, matches Figma exactly)
//  FY26 dashed green | FY27 solid blue (real, computed)
//  Callout point is computed from the data (first known month) rather than a
//  hardcoded index, so it stays correct if the underlying project data changes.
// ==========================================================
function firstValidIndex(data) {
  const i = data.findIndex(v => v != null);
  return i === -1 ? 0 : i;
}

function buildComplianceRateChart() {
  const firstFY  = firstValidIndex(complianceRateData.FY27);

  const ctx = document.getElementById("complianceRateChart").getContext("2d");
  charts.complianceRate = new Chart(ctx, {
    type: "line",
    data: {
      labels: monthOrder,
      datasets: [
        {
          label: "FY26",
          data: complianceRateData.FY26,
          borderColor:"#16a34a", backgroundColor:"rgba(22,163,74,.08)",
          borderWidth:2, borderDash:[5,4], spanGaps:true,
          pointStyle:"circle", pointRadius:3, pointBackgroundColor:"#fff", pointBorderColor:"#16a34a", pointBorderWidth:1.5, tension:.35,
          datalabels: {
            display(ctx) { return ctx.dataIndex === firstFY; },
            color:"#16a34a", anchor:"end", align:"top", offset:4,
            font:{ size:10, weight:"700" }, formatter:v => v + "%"
          }
        },
        {
          label: "FY27",
          data: complianceRateData.FY27,
          borderColor:"#1e3a5f", backgroundColor:"rgba(30,58,95,.10)",
          borderWidth:2.5, spanGaps:true, fill:true,
          pointStyle:"circle", pointRadius:3, pointBackgroundColor:"#1e3a5f", tension:.35,
          datalabels: {
            display(ctx) { return ctx.dataIndex === firstFY; },
            color:"#1e3a5f", anchor:"end", align:"top", offset:4,
            font:{ size:10, weight:"700" }, formatter:v => v + "%"
          }
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      // Real data can genuinely peak close to 100%; without headroom above the axis max,
      // a datalabel on a near-100% point gets clipped by the chart area boundary.
      layout: { padding:{ top:22 } },
      plugins: {
        legend: { position:"bottom", labels:{ boxWidth:24, boxHeight:2, color:"#374151", usePointStyle:false, font:{family:"Inter",size:11} } },
        tooltip: { enabled: false },
        datalabels: {}
      },
      scales: {
        x: { grid:{display:false}, ticks:{color:"#6b7280",font:{size:11}} },
        y: { min:0, max:100, ticks:{ stepSize:10, callback:v => v + "%", color:"#666", font:{size:10} }, grid:{color:"#e5e7eb"} }
      },
      onClick(_e, els) {
        if (!els.length) { showDrillDown(2,"month","Apr-FY27"); return; }
        const { datasetIndex, index } = els[0];
        const mon = monthOrder[index];
        const fy  = ["FY26","FY27"][datasetIndex] || "FY27";
        showDrillDown(2,"month", mon + "-" + fy);
      }
    },
    plugins: [ChartDataLabels]
  });
  return charts.complianceRate;
}

// ==========================================================
//  WIRE EVENTS
// ==========================================================
function wireEvents() {
  // ── Health header buttons ──
  document.getElementById("segTotal").addEventListener("click", () => showDrillDown(1,"health","all"));
  document.getElementById("segBB").addEventListener("click",    () => showDrillDown(1,"health","BB"));
  document.getElementById("segNBB").addEventListener("click",   () => showDrillDown(1,"health","N-BB"));

  // ── Gate status ring columns (click anywhere in the column, not just the canvas) — filters by
  // the "quarter" type (all 3 months), matching how the ring's own P/A totals were summed. ──
  let lastGateQuarter = "Q1";
  document.querySelectorAll(".gate-ring-col").forEach(el =>
    el.addEventListener("click", () => { lastGateQuarter = el.dataset.quarter; showDrillDown(1,"quarter", el.dataset.quarter); })
  );
  // Planned / Actual legend keys are the same two series every ring already plots — clicking
  // either re-opens the drill-down for whichever quarter's ring was last selected (Q1 by default).
  document.querySelectorAll(".gate-status-legend .legend-key").forEach(el =>
    el.addEventListener("click", () => showDrillDown(1,"quarter", lastGateQuarter))
  );

  // ── Matrix cells ──
  document.querySelectorAll(".matrix-btn").forEach(el =>
    el.addEventListener("click", () => showDrillDown(1,"typeGate", el.dataset.type + "|" + el.dataset.stage))
  );

  // ── Drill-down toolbars (close / expand-restore / refresh / export), both rows ──
  [1, 2].forEach(row => {
    document.getElementById("ddClose" + row).addEventListener("click", () => closeDrillDown(row));
    document.getElementById("ddExpand" + row)?.addEventListener("click", () => toggleDrillDownExpand(row));
    document.getElementById("ddRefresh" + row)?.addEventListener("click", () => refreshDrillDown(row));
    document.getElementById("ddExportCsv" + row)?.addEventListener("click", () => exportDrillDownCsv(row));
  });

  // ── Widget fullscreen buttons ──
  document.querySelectorAll(".expand-btn").forEach(btn =>
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const target = btn.getAttribute("data-target");
      if (fsWidgetId === target) closeWidgetFullscreen();
      else openWidgetFullscreen(target);
    })
  );

  // ── Drag-to-reposition widgets, restricted to swapping within their own row: the two
  // drill-down panels are hardcoded to row 1 / row 2 (see showDrillDown), so a widget dragged
  // into the other row would keep firing into a drill-down panel nowhere near it. ──
  let dragArmedHandle = null; // only start a real drag if it began on the handle, not anywhere on the card
  document.querySelectorAll(".drag-handle").forEach(handle => {
    handle.addEventListener("mousedown", () => { dragArmedHandle = handle; });
  });
  document.addEventListener("mouseup", () => { dragArmedHandle = null; });

  document.querySelectorAll(".widget").forEach(widget => {
    widget.addEventListener("dragstart", e => {
      if (!dragArmedHandle || !widget.contains(dragArmedHandle)) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", widget.id);
      widget.classList.add("dragging");
    });
    widget.addEventListener("dragend", () => {
      widget.classList.remove("dragging");
      document.querySelectorAll(".drag-over-before,.drag-over-after")
        .forEach(w => w.classList.remove("drag-over-before","drag-over-after"));
    });
    widget.addEventListener("dragover", e => {
      const draggingEl = document.querySelector(".widget.dragging");
      if (!draggingEl || draggingEl === widget || draggingEl.parentElement !== widget.parentElement) return;
      e.preventDefault();
      const before = e.clientX < widget.getBoundingClientRect().left + widget.offsetWidth / 2;
      widget.classList.toggle("drag-over-before", before);
      widget.classList.toggle("drag-over-after", !before);
    });
    widget.addEventListener("dragleave", () => widget.classList.remove("drag-over-before", "drag-over-after"));
    widget.addEventListener("drop", e => {
      const draggingEl = document.querySelector(".widget.dragging");
      widget.classList.remove("drag-over-before", "drag-over-after");
      if (!draggingEl || draggingEl === widget || draggingEl.parentElement !== widget.parentElement) return;
      e.preventDefault();
      const before = e.clientX < widget.getBoundingClientRect().left + widget.offsetWidth / 2;
      widget.parentElement.insertBefore(draggingEl, before ? widget : widget.nextSibling);
    });
  });

  // Header (logo, tabs, search, FY dropdown, fullscreen, avatar/logout) is rendered and wired
  // once by shared.js's renderTopNav() — every page uses that same component now, so none of
  // that wiring lives here anymore.

  // ── Escape: close drill-downs or exit widget fullscreen ──
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (fsWidgetId) closeWidgetFullscreen();
      else closeAllDrillDowns();
    }
  });
}

// ==========================================================
//  RISK TOOLTIP — the drill-down table's Status badge (Critical/High) shows Reason / Corrective
//  Action / Mitigation on hover instead of as separate columns (see renderProjectTable). One
//  shared tooltip element, appended to <body> (not #dashboardRoot) so it renders at real size
//  regardless of the dashboard's zoom transform, and positioned "fixed" via getBoundingClientRect
//  so it's never clipped by the drill-down table's own overflow:auto scroll box.
// ==========================================================
function wireRiskTooltip() {
  const projectByCode = Object.fromEntries(projectPortfolioData.map((p) => [p.projectCode, p]));
  const PRIORITY_CLS = { Critical: "rt-pill-high", High: "rt-pill-high", Medium: "rt-pill-med", Low: "rt-pill-low" };
  const PRIORITY_LBL = { Critical: "High", High: "High", Medium: "Med", Low: "Low" };

  const tip = document.createElement("div");
  tip.className = "risk-tooltip";
  tip.innerHTML = `
    <div class="rt-head">
      <span class="rt-head-icon">✦</span>
      <span class="rt-head-title">AI Corrective Actions Summary</span>
    </div>
    <div class="rt-list"></div>
    <a class="rt-cta" target="_blank" rel="noopener">Click to view full details <span>→</span></a>
  `;
  document.body.appendChild(tip);
  const listEl = tip.querySelector(".rt-list");
  const ctaEl  = tip.querySelector(".rt-cta");

  function show(target) {
    const p = projectByCode[target.dataset.tipCode];
    if (!p) return;
    const actions = p.aiActions && p.aiActions.length
      ? p.aiActions
      : [{ priority: "Low", title: "No open corrective action currently logged for this project." }];
    listEl.innerHTML = actions.map((a) =>
      `<div class="rt-row"><span class="rt-pill ${PRIORITY_CLS[a.priority] || "rt-pill-low"}">${PRIORITY_LBL[a.priority] || "Low"}</span><span class="rt-row-text">${esc(a.title)}</span></div>`
    ).join("");
    ctaEl.href = "pages/project-detail/index.html?id=" + encodeURIComponent(p.projectCode);

    tip.classList.add("visible");
    const r = target.getBoundingClientRect();
    const tipW = tip.offsetWidth;
    let left = r.left + r.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    const above = r.top > 260;
    tip.style.left = left + "px";
    tip.style.top  = above ? (r.top - tip.offsetHeight - 12) + "px" : (r.bottom + 12) + "px";
    tip.classList.toggle("rt-below", !above);
  }
  function hide() { tip.classList.remove("visible"); }

  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest(".dd-has-tip");
    if (target) show(target);
    else if (!e.target.closest(".risk-tooltip")) hide();
  });
  document.addEventListener("scroll", hide, true);
  // The tooltip itself is interactive (its CTA is a real link), unlike a plain hover hint — so
  // it needs its own mouseleave, not just the badge's mouseout, or moving from badge to card
  // (a gap of a few px) would hide it before the pointer ever reaches the link.
  tip.addEventListener("mouseleave", hide);
}

// ==========================================================
//  INIT
// ==========================================================
// Every "As on <date>" chart subtitle uses the real current date — the same todayISTLabel()
// the header's own "As on date" already uses (shared.js) — instead of a hardcoded snapshot date.
function applyAsOfDates() {
  if (typeof todayISTLabel !== "function") return;
  const label = "As on " + todayISTLabel();
  ["healthAsOf", "classificationAsOf", "complianceStatusAsOf", "complianceRateAsOf"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = label;
  });
}

function init() {
  renderTopNav("dashboard");
  applyAsOfDates();
  applyWidgetVisibility();
  buildOverallHealthChart();
  buildGateStatusRing("Q1");
  buildGateStatusRing("Q2");
  buildGateStatusRing("Q3");
  buildGateStatusRing("Q4");
  buildComplianceStatusChart();
  buildComplianceRateChart();
  wireEvents();
  wireRiskTooltip();
  fitViewport(); // measures real rendered content height, so do this last
}

window.addEventListener("resize", fitViewport);
window.addEventListener("DOMContentLoaded", init);
