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
//    than a fabricated 0%. There's no independent prior-year or ML-forecast dataset in this app,
//    so FY26 (comparison) and FY27 (AI Predicted) are derived deterministically from the real
//    FY27 series (a fixed offset, not a random/static array) — clearly distinct, reproducible,
//    and never independent of the real numbers. ──
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
  const FY27_AI = FY27.map(v => clamp((v ?? fallback) + 9));
  return { FY27, FY26, FY27_AI };
}
const complianceRateData = computeComplianceRateData();

// ==========================================================
//  STATE
// ==========================================================
let openPanel  = null; // "row1" | "row2" | null
let fsWidgetId = null; // ID of the currently fullscreened widget
// { type, value } per row, kept separately from `openPanel` (a display string) because
// typeGate values themselves contain "|" (e.g. "M2|Pre-KO"), which openPanel.split("|") can't
// round-trip — refresh/export need the real, unambiguous filter, not a reparsed string.
let currentFilter = { 1: null, 2: null };

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

// ==========================================================
//  ROLE DISPLAY
// ==========================================================
// roleDirectory lives in mockData.js
function applyRole() {
  const roleKey = sessionStorage.getItem("snpdRole") || "CEO";
  const role    = roleDirectory[roleKey] || roleDirectory.CEO;
  const avatarEl = document.getElementById("roleAvatar");
  const nameEl   = document.getElementById("avatarDropdownName");
  const emailEl  = document.getElementById("avatarDropdownEmail");
  if (avatarEl) avatarEl.textContent = role.avatar;
  if (nameEl)   nameEl.textContent   = role.name;
  if (emailEl)  emailEl.textContent  = role.email;

  // Admin tab only exists for roles pagesCatalog actually grants "admin-users" to — driven by
  // the same registry the route guard checks, so nav visibility can never promise access the
  // guard would then deny.
  document.getElementById("adminTab")?.toggleAttribute("hidden", !pageAllowsRole("admin-users", roleKey));
}

function logout() {
  sessionStorage.removeItem("snpdRole");
  window.location.href = "login.html";
}

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
function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

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
    default: return projectPortfolioData;
  }
}

// ==========================================================
//  TABLE RENDERERS
// ==========================================================
// reasonDetails (the expandable-row copy, keyed by each project's `reason`) lives in mockData.js

function renderProjectTable(thId, tbId, projects) {
  document.getElementById(thId).innerHTML = "<tr><th>PROJECT NAME</th><th>GATE</th><th>TYPE</th><th>CLASSIFICATION</th><th>RISK SCORE</th><th>DELAY</th><th>REASON</th><th>CORRECTIVE ACTION</th><th>STATUS</th></tr>";
  if (!projects.length) {
    document.getElementById(tbId).innerHTML = "<tr><td colspan='9' class='dd-empty'>No records match this filter.</td></tr>";
    return;
  }
  document.getElementById(tbId).innerHTML = projects.map((p, i) => {
    const delColor = p.delayDays > 60 ? "#dc2626" : p.delayDays > 15 ? "#d97706" : "#15803d";
    const clsBadge = p.classification === "N-BB" ? mkBadge("N-BB","badge-nbb") : mkBadge("BB","badge-bb");
    const bg     = i % 2 === 1 ? "#f8f9fb" : "#fff";
    const detail = reasonDetails[p.reason] || reasonDetails["None"];
    // Reason and Corrective Action each get their own small inline toggle rather than one
    // whole-row chevron — clicking either reveals just that field's detail, independently.
    return "<tr style='background:" + bg + "'>" +
      "<td class='col-project'><a class='dd-project-link' href='project-detail.html?id=" + encodeURIComponent(p.projectName) + "'>" + esc(p.projectName) + "</a></td>" +
      "<td>" + esc(p.gate) + "</td><td>" + esc(p.type) + "</td><td>" + clsBadge + "</td>" +
      "<td>" + mkBadge(p.riskScore, p.riskScore >= 70 ? "badge-critical" : "badge-high") + "</td>" +
      "<td style='color:" + delColor + ";font-weight:600'>" + p.delayDays + "d</td>" +
      "<td><div class='dd-field-cell'><span>" + esc(p.reason) + "</span>" +
        "<button type='button' class='dd-field-toggle' data-detail='reason' aria-expanded='false' title='View risk & delay reason'>⌄</button></div></td>" +
      "<td><div class='dd-field-cell'><span>" + esc(p.correctiveAction) + "</span>" +
        "<button type='button' class='dd-field-toggle' data-detail='corrective' aria-expanded='false' title='View corrective action & mitigation plan'>⌄</button></div></td>" +
      "<td>" + mkBadge(p.status, statusBadgeClass(p.status)) + "</td>" +
    "</tr>" +
    "<tr class='dd-expand-row dd-expand-reason' hidden style='background:" + bg + "'>" +
      "<td colspan='9'>" +
        "<div class='dd-expand-grid dd-expand-grid-2'>" +
          "<div><span class='dd-expand-label'>Risk Reason</span><p>" + esc(detail.riskReason) + "</p></div>" +
          "<div><span class='dd-expand-label'>Delay Reason</span><p>" + esc(detail.delayReason) + "</p></div>" +
        "</div>" +
      "</td>" +
    "</tr>" +
    "<tr class='dd-expand-row dd-expand-corrective' hidden style='background:" + bg + "'>" +
      "<td colspan='9'>" +
        "<div class='dd-expand-grid dd-expand-grid-2'>" +
          "<div><span class='dd-expand-label'>Corrective Action</span><p>" + esc(detail.correctiveActionDetail) + "</p></div>" +
          "<div><span class='dd-expand-label'>Mitigation Plan</span><p>" + esc(detail.mitigationPlan) + "</p></div>" +
        "</div>" +
      "</td>" +
    "</tr>";
  }).join("");
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
      "<td class='col-project'><a class='dd-project-link' href='project-detail.html?id=" + encodeURIComponent(p.projectName) + "'>" + esc(p.projectName) + "</a></td>" +
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
      "<td class='col-project'><a class='dd-project-link' href='project-detail.html?id=" + encodeURIComponent(p.projectName) + "'>" + esc(p.projectName) + "</a></td>" +
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
const titleMap = {
  health:        v => "Overall Project Health \u2014 " + v,
  classification:v => "Classification \u2014 " + v + " Projects",
  typeGate:      v => "Classification " + v.replace("|"," / ") + " Projects",
  compliance:    v => "Process Compliance Status \u2014 " + (v.split("-")[0] === "Total" ? "All Projects" : v.split("-")[0] + " Projects"),
  month:         v => "Compliance Rate \u2014 " + v.replace("-"," "),
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
};

// Populates a panel's content for a given type/value \u2014 shared by showDrillDown (first open)
// and refreshDrillDown (re-render the currently-open filter) so they can never drift apart.
function renderDrillDownContent(row, type, value) {
  const projects  = filterProjects(type, value);
  const makeTitle = titleMap[type] || (v => v);
  const subtitle  = type === "compliance"
    ? (() => {
        const tf = value.split("-")[0];
        const cnt = tf === "Total" ? projectPortfolioData.length : projectPortfolioData.filter(p => p.type === tf).length;
        return cnt + " project(s) \u2014 Planned vs Actual \u2014 As on 07 Jul 2026";
      })()
    : projects.length + " project(s) matched \u2014 As on 07 Jul 2026";

  if (row === 1) {
    document.getElementById("ddFilterLabel1").textContent = "\u25B6 " + value.replace("|"," / ");
    document.getElementById("ddTitle1").textContent    = makeTitle(value);
    document.getElementById("ddSubTitle1").textContent = subtitle;
    renderProjectTable("ddTH1","ddTB1", projects);
    document.getElementById("ddAI1").textContent = (aiMap[type] || (() => "\uD83E\uDD16 AI insights"))(value, projects);
  } else {
    document.getElementById("ddFilterLabel2").textContent = "\u25B6 " + value.replace("|"," / ").replace("-"," ");
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

function closeDrillDown(row) {
  const panelId = row === 1 ? "drillDownRow1" : "drillDownRow2";
  document.getElementById(panelId).classList.remove("open", "dd-expanded");
  currentFilter[row] = null;
  openPanel = null;
  updateScrollLock();
  document.querySelectorAll(".widget").forEach(w => w.classList.remove("widget-active"));
}

function closeAllDrillDowns() {
  ["drillDownRow1","drillDownRow2"].forEach(id => document.getElementById(id).classList.remove("open", "dd-expanded"));
  currentFilter = { 1: null, 2: null };
  openPanel = null;
  updateScrollLock();
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
  const map = { health:"healthWidget", classification:"classificationWidget",
    typeGate:"classificationWidget", compliance:"complianceStatusWidget", month:"complianceRateWidget" };
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
      c.fillStyle = "#fef2f2"; c.strokeStyle = "#fca5a5"; c.lineWidth = 1;
      c.beginPath();
      if (c.roundRect) c.roundRect(x - w/2, top - h, w, h, 3); else c.rect(x - w/2, top - h, w, h);
      c.fill(); c.stroke();
      c.fillStyle = "#dc2626"; c.textAlign = "center"; c.textBaseline = "middle";
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
        backgroundColor: ["#14b8a6","#f59e0b","#ef4444"],
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
//  CHART 2 — Mini Classification Donuts
//  Counts fully driven from projectPortfolioData
// ==========================================================
function buildMiniTypeChart(canvasId, type) {
  const ps     = projectPortfolioData.filter(p => p.type === type);
  const bbCnt  = ps.filter(p => p.classification === "BB").length;
  const nbbCnt = ps.filter(p => p.classification === "N-BB").length;

  const leftId = { M2:"donutM2Left", M4:"donutM4Left", M6:"donutM6Left" }[type];
  const numId  = { M2:"dcM2", M4:"dcM4", M6:"dcM6" }[type];
  if (document.getElementById(leftId))
    document.getElementById(leftId).innerHTML =
      "<span class='bb-txt'>BB - " + String(bbCnt).padStart(2,"0") + "</span>" +
      "<span class='nbb-txt'>N-BB - " + String(nbbCnt).padStart(2,"0") + "</span>";
  if (document.getElementById(numId))
    document.getElementById(numId).textContent = ps.length;

  const ctx = document.getElementById(canvasId).getContext("2d");
  return new Chart(ctx, {
    type: "doughnut",
    data: { labels:["BB","N-BB"], datasets:[{ data:[bbCnt, nbbCnt], backgroundColor:["#1e3a5f","#14b8a6"], borderWidth:0, cutout:"72%" }] },
    options: {
      responsive:false, animation:false,
      plugins:{ legend:{display:false}, tooltip:{enabled:false} },
      onClick() { showDrillDown(1,"classification",type); }
    }
  });
}

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
          type:"line", label:"Percentage",
          data: complianceStatusData.map(r => r.pct),
          yAxisID:"yRight", borderColor:"#f59e0b", backgroundColor:"#f59e0b",
          borderWidth:2, tension:.3, pointRadius:4,
          pointBackgroundColor:"#1e3a5f", pointBorderColor:"#1e3a5f",
          datalabels: {
            display: true, color:"#1e3a5f", anchor:"end", align:"top",
            // The percentage point and the taller bar's value label can end up close together
            // in pixel space (e.g. Total: a tall Planned bar near the top of the 0-400 axis vs.
            // a percentage point that's also high on the independent 0-100 axis) — push the
            // label further out whenever that gap is tight so it can't be painted over.
            offset(ctx) {
              const row     = complianceStatusData[ctx.dataIndex];
              const barFrac = Math.max(row.planned, row.actual) / 400;
              const pctFrac = row.pct / 100;
              return (barFrac - pctFrac) < 0.12 ? 22 : 4;
            },
            font:{ size:10, weight:"700" }, formatter:v=>v+"%"
          }
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
        x: { grid:{display:false}, ticks:{color:"#6b7280",font:{size:11,weight:"600"}},
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
    plugins: [ChartDataLabels]
  });
  return charts.complianceStatus;
}

// ==========================================================
//  CHART 4 — Process Compliance Rate (3-line)
//  FY26 dashed teal | FY27 solid navy (real, computed) | FY27 AI dashed amber
//  Callout points are computed from the data (first known month; AI line's
//  high/low) rather than hardcoded indices, so they stay correct if the
//  underlying project data changes.
// ==========================================================
function firstValidIndex(data) {
  const i = data.findIndex(v => v != null);
  return i === -1 ? 0 : i;
}

function buildComplianceRateChart() {
  const firstFY  = firstValidIndex(complianceRateData.FY27);
  const aiData   = complianceRateData.FY27_AI;
  // Only the FIRST index hitting the high/low gets a callout — several months can genuinely
  // tie (real data), and labeling every tied point stacks duplicate text on top of itself.
  const aiMaxIdx = aiData.indexOf(Math.max(...aiData));
  const aiMinIdx = aiData.indexOf(Math.min(...aiData));

  const ctx = document.getElementById("complianceRateChart").getContext("2d");
  charts.complianceRate = new Chart(ctx, {
    type: "line",
    data: {
      labels: monthOrder,
      datasets: [
        {
          label: "FY26",
          data: complianceRateData.FY26,
          borderColor:"#14b8a6", backgroundColor:"rgba(20,184,166,.08)",
          borderWidth:2, borderDash:[5,4], spanGaps:true,
          pointStyle:"circle", pointRadius:3, pointBackgroundColor:"#14b8a6", tension:.35,
          datalabels: {
            display(ctx) { return ctx.dataIndex === firstFY; },
            color:"#0d9488", anchor:"end", align:"top", offset:4,
            font:{ size:10, weight:"700" }, formatter:v => v + "%"
          }
        },
        {
          label: "FY27",
          data: complianceRateData.FY27,
          borderColor:"#1e3a5f", backgroundColor:"rgba(30,58,95,.06)",
          borderWidth:2.5, spanGaps:true,
          pointStyle:"circle", pointRadius:3, pointBackgroundColor:"#1e3a5f", tension:.35,
          datalabels: {
            display(ctx) { return ctx.dataIndex === firstFY; },
            color:"#1e3a5f", anchor:"end", align:"top", offset:4,
            font:{ size:10, weight:"700" }, formatter:v => v + "%"
          }
        },
        {
          label: "FY27 (AI Predicted)",
          data: aiData,
          borderColor:"#f59e0b", backgroundColor:"rgba(245,158,11,.07)",
          borderWidth:2, borderDash:[6,3], spanGaps:true,
          pointStyle:"circle", pointRadius:3, pointBackgroundColor:"#f59e0b", tension:.35,
          datalabels: {
            display(ctx) { return ctx.dataIndex === aiMaxIdx || ctx.dataIndex === aiMinIdx; },
            color:"#b45309", anchor:"end", align:"top", offset:4,
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
        y: { min:10, max:100, ticks:{ stepSize:10, callback:v => v + "%", color:"#666", font:{size:10} }, grid:{color:"#e5e7eb"} }
      },
      onClick(_e, els) {
        if (!els.length) { showDrillDown(2,"month","Apr-FY27"); return; }
        const { datasetIndex, index } = els[0];
        const mon = monthOrder[index];
        const fy  = ["FY26","FY27","FY27_AI"][datasetIndex] || "FY27";
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

  // ── Mini donut blocks (click whole block) ──
  document.querySelectorAll(".mini-donut-block").forEach(el =>
    el.addEventListener("click", () => showDrillDown(1,"classification", el.dataset.type))
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

  // ── Per-field Reason / Corrective Action detail toggles ──
  // Event delegation on the (static) table wrapper: rows are re-rendered via innerHTML on every
  // filter change, so per-row listeners would need re-binding after each render; delegation avoids that.
  // Each data row is followed by two independent expand rows (.dd-expand-reason then
  // .dd-expand-corrective, in that fixed order) — data-detail on the clicked toggle picks which one.
  document.querySelectorAll(".dd-table-wrap").forEach(wrap => {
    wrap.addEventListener("click", e => {
      const btn = e.target.closest(".dd-field-toggle");
      if (!btn) return;
      const dataRow   = btn.closest("tr");
      const expandRow = btn.dataset.detail === "reason"
        ? dataRow.nextElementSibling
        : dataRow.nextElementSibling?.nextElementSibling;
      if (!expandRow || !expandRow.classList.contains("dd-expand-row")) return;
      const willOpen = expandRow.hidden;
      expandRow.hidden = !willOpen;
      btn.setAttribute("aria-expanded", String(willOpen));
      btn.classList.toggle("dd-field-toggle-open", willOpen);
    });
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

  // ── Dashboard / browser fullscreen (top nav) ──
  const navMax = document.getElementById("navMaxBtn");
  if (navMax) {
    navMax.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.();
      }
    });
    document.addEventListener("fullscreenchange", () => {
      navMax.title = document.fullscreenElement ? "Exit fullscreen" : "Toggle fullscreen";
    });
  }

  // ── Inline search: expands leftward from the icon within the header ──
  const searchBtn      = document.getElementById("navSearchBtn");
  const searchInputWrap= document.getElementById("navSearchInputWrap");
  const searchInput    = document.getElementById("searchInput");
  const searchClose    = document.getElementById("searchClose");

  function openSearch() {
    searchInputWrap.classList.add("open");
    searchBtn.setAttribute("aria-expanded", "true");
    setTimeout(() => searchInput?.focus(), 250);
  }
  function closeSearch() {
    searchInputWrap.classList.remove("open");
    searchBtn.setAttribute("aria-expanded", "false");
    if (searchInput) searchInput.value = "";
  }
  if (searchBtn && searchInputWrap) {
    searchBtn.addEventListener("click", e => {
      e.stopPropagation();
      searchInputWrap.classList.contains("open") ? closeSearch() : openSearch();
    });
    searchClose?.addEventListener("click", e => { e.stopPropagation(); closeSearch(); });
    document.addEventListener("click", e => {
      if (searchInputWrap.classList.contains("open") && !searchInputWrap.contains(e.target) && e.target !== searchBtn)
        closeSearch();
    });
  }

  // ── FY / as-on-date dropdown ──
  const fyBtn      = document.getElementById("fyBtn");
  const fyDropdown = document.getElementById("fyDropdown");
  const fyLabel    = document.getElementById("fyLabel");
  const asOfDateEl = document.querySelector(".as-of-date-inline");

  function closeFyDropdown() {
    fyDropdown.hidden = true;
    fyBtn.setAttribute("aria-expanded", "false");
  }
  if (fyBtn && fyDropdown) {
    fyBtn.addEventListener("click", e => {
      e.stopPropagation();
      const willOpen = fyDropdown.hidden;
      closeAvatarDropdown();
      fyDropdown.hidden = !willOpen;
      fyBtn.setAttribute("aria-expanded", String(willOpen));
    });
    fyDropdown.querySelectorAll(".fy-option").forEach(opt => {
      opt.addEventListener("click", () => {
        fyDropdown.querySelectorAll(".fy-option").forEach(o => o.classList.remove("fy-option-active"));
        opt.classList.add("fy-option-active");
        fyLabel.textContent = opt.dataset.fy ? "FY: " + opt.dataset.fy : opt.textContent;
        if (asOfDateEl) asOfDateEl.textContent = "As on " + opt.dataset.date;
        closeFyDropdown();
      });
    });
  }

  // ── Avatar dropdown (role info + logout) ──
  const avatarBtn      = document.getElementById("roleAvatar");
  const avatarDropdown = document.getElementById("avatarDropdown");

  function closeAvatarDropdown() {
    avatarDropdown.hidden = true;
    avatarBtn.setAttribute("aria-expanded", "false");
  }
  if (avatarBtn && avatarDropdown) {
    avatarBtn.addEventListener("click", e => {
      e.stopPropagation();
      const willOpen = avatarDropdown.hidden;
      closeFyDropdown();
      avatarDropdown.hidden = !willOpen;
      avatarBtn.setAttribute("aria-expanded", String(willOpen));
    });
  }
  document.getElementById("logoutBtn")?.addEventListener("click", logout);

  // ── Close dropdowns on outside click ──
  document.addEventListener("click", () => { closeFyDropdown(); closeAvatarDropdown(); });

  // ── Escape: close dropdowns, drill-downs or fullscreen ──
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (fsWidgetId) closeWidgetFullscreen();
      else if (!fyDropdown.hidden) closeFyDropdown();
      else if (!avatarDropdown.hidden) closeAvatarDropdown();
      else if (searchInputWrap.classList.contains("open")) closeSearch();
      else closeAllDrillDowns();
    }
  });
}

// ==========================================================
//  INIT
// ==========================================================
function init() {
  applyRole();
  buildOverallHealthChart();
  buildMiniTypeChart("typeM2Chart","M2");
  buildMiniTypeChart("typeM4Chart","M4");
  buildMiniTypeChart("typeM6Chart","M6");
  buildComplianceStatusChart();
  buildComplianceRateChart();
  wireEvents();
  fitViewport(); // measures real rendered content height, so do this last
}

window.addEventListener("resize", fitViewport);
window.addEventListener("DOMContentLoaded", init);
