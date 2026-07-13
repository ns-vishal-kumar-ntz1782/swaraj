// Portfolio Tracker — dynamic rendering from mock data
(function () {
  "use strict";

  // ── Helpers ──────────────────────────────────────────────────
  function esc(s) { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  // Priority badge color
  function priorityColor(p) {
    if (p === "Critical") return "#dc2626";
    if (p === "High")     return "#fb923c";
    if (p === "Medium")   return "#22c55e";
    return "#94a3b8";
  }

  // RAG → color
  function ragColor(ryg) {
    if (ryg === "Green") return "#22c55e";
    if (ryg === "Red")   return "#dc2626";
    return "#fb923c";
  }

  // Budget → indicator color
  function budgetColor(burn) {
    if (burn > 95) return "#dc2626";
    if (burn > 80) return "#fb923c";
    return "#22c55e";
  }

  // QCDG indicators for a project (Quality / Cost / Delivery / Gate)
  function qcdgIndicators(proj) {
    // Q (Quality): health-based
    const q = proj.healthScore >= 75 ? "#22c55e" : proj.healthScore >= 60 ? "#fb923c" : "#dc2626";
    // C (Cost): burn-based
    const c = budgetColor(proj.burnPct);
    // D (Delivery): delay-based (from gate status)
    const hasDelay = proj.gates && proj.gates.some(g => g.delayDays > 30);
    const d = hasDelay ? "#dc2626" : proj.gates && proj.gates.some(g => g.delayDays > 0) ? "#fb923c" : "#22c55e";
    // G (Gate): progress
    const g = proj.goals.pct >= 75 ? "#22c55e" : proj.goals.pct >= 50 ? "#fb923c" : "#dc2626";
    return [q, c, d, g];
  }

  // Gate stages in order
  const STAGES = ["Pre-KO","CVPA","VV","PC","PR","PPO","SOP"];

  // ── Build KPI row from mock data ──────────────────────────────
  function loadKpiCardConfig() {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", APP_ROOT + "data/portfolio.json", false);
    xhr.send(null);
    return JSON.parse(xhr.responseText).kpiCards;
  }

  function buildKpi(projects) {
    const metrics = {
      total:  projects.length,
      m6:     projects.filter(p => p.category === "M6").length,
      m4:     projects.filter(p => p.category === "M4").length,
      m2:     projects.filter(p => p.category === "M2").length,
      atRisk: projects.filter(p => p.rygStatus !== "Green").length,
      crit:   projects.filter(p => p.priority === "Critical").length,
    };

    const cards = loadKpiCardConfig().map(c => ({ ...c, num: metrics[c.metric] }));

    return cards.map(c => `
      <div class="pt-kpi-card${c.alert ? " alert" : ""}">
        <div class="pt-kpi-accent" style="background:${c.accent}"></div>
        <div class="pt-kpi-num" style="color:${c.numColor}">${c.num}</div>
        <div class="pt-kpi-info">
          <div class="pt-kpi-name">${esc(c.label)}</div>
          <div class="pt-kpi-delta ${c.up ? "up" : "down"}">${c.delta}</div>
        </div>
      </div>
    `).join("");
  }

  // ── Build the stage-gate matrix ──────────────────────────────
  function buildMatrix(projects, categoryFilter, portfolioFilter) {
    // Apply filters
    let data = projects;
    if (categoryFilter) data = data.filter(p => p.category === categoryFilter);
    if (portfolioFilter) data = data.filter(p => p.portfolio === portfolioFilter);

    // Group by platform
    const platforms = {};
    data.forEach(proj => {
      const plat = proj.platform || "Other";
      if (!platforms[plat]) platforms[plat] = {};
      const gate = proj.currentStage || "Pre-KO";
      if (!platforms[plat][gate]) platforms[plat][gate] = [];
      platforms[plat][gate].push(proj);
    });

    const headerCols = ["PLATFORM", "PRE-KO", "CVPA", "VV", "PC", "PR", "PPO", "SOVP"];
    const gateKeys   = ["Pre-KO",   "CVPA",  "VV",  "PC","PR","PPO","SOP"];

    let html = `<div class="pt-matrix-header">`;
    headerCols.forEach((h, i) => {
      html += `<div class="pt-matrix-header-cell${i===0?" platform-col":""}">${esc(h)}</div>`;
    });
    html += `</div><div class="pt-matrix-body">`;

    const platformOrder = ["Heavy","Compact","Utility"];
    const sortedPlatforms = Object.keys(platforms).sort((a,b) => {
      const ia = platformOrder.indexOf(a), ib = platformOrder.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    sortedPlatforms.forEach(plat => {
      const counts = Object.values(platforms[plat]).reduce((s,arr) => s + arr.length, 0);
      html += `<div class="pt-matrix-row">`;
      html += `<div class="pt-platform-cell">
        <div class="pt-platform-name">${esc(plat)}</div>
        <div class="pt-platform-sub">${counts} project${counts !== 1 ? "s" : ""}</div>
      </div>`;

      gateKeys.forEach(gate => {
        const cards = platforms[plat][gate] || [];
        html += `<div class="pt-gate-cell">`;
        const MAX_VISIBLE = 2;
        const visible = cards.slice(0, MAX_VISIBLE);
        visible.forEach(proj => { html += buildProjectCard(proj); });
        if (cards.length > MAX_VISIBLE) {
          html += `<div class="pt-more-badge">+${cards.length - MAX_VISIBLE} more</div>`;
        }
        html += `</div>`;
      });

      html += `</div>`;
    });

    html += `</div>`;
    return html;
  }

  function buildProjectCard(proj) {
    const pColor = priorityColor(proj.priority);
    const [q,c,d,g] = qcdgIndicators(proj);
    const approvedGate = proj.gates && proj.gates.find(gt => gt.status === "On Time" || gt.status === "Completed");
    const approvedDate = approvedGate ? approvedGate.actual : null;

    return `
      <div class="pt-proj-card" data-project="${esc(proj.projectCode)}" title="${esc(proj.projectName)} — ${esc(proj.vehicleSeries)}">
        <div class="pt-proj-card-header">
          <div class="pt-proj-card-name">${esc(proj.projectName)}</div>
          <div class="pt-proj-card-priority" style="background:${pColor}" title="Priority: ${esc(proj.priority)}">P</div>
        </div>
        <div class="pt-proj-card-meta">${esc(proj.category)} ${esc(proj.portfolio === "BB" ? "Blockbuster" : "Non-BB")}</div>
        <div class="pt-proj-card-indicators">
          <div class="pt-indicator" style="background:${q}" title="Quality">Q</div>
          <div class="pt-indicator" style="background:${c}" title="Cost">C</div>
          <div class="pt-indicator" style="background:${d}" title="Delivery">D</div>
          <div class="pt-indicator" style="background:${g}" title="Gate Readiness">G</div>
        </div>
        ${approvedDate ? `<div class="pt-proj-card-date">Approved: ${esc(approvedDate)}</div>` : ""}
      </div>
    `;
  }

  // ── Legend Panel ──────────────────────────────────────────────
  function buildLegend() {
    return `
      <div class="pt-legend-inner">
        <div>
          <p class="pt-legend-section-title">Project Priority</p>
          <div class="pt-legend-items">
            <div class="pt-legend-item"><div class="pt-legend-circle" style="background:#dc2626">P1</div> Highest — Critical path</div>
            <div class="pt-legend-item"><div class="pt-legend-circle" style="background:#fb923c">P2</div> Medium — Key program</div>
            <div class="pt-legend-item"><div class="pt-legend-circle" style="background:#22c55e">P3</div> Normal — Standard program</div>
          </div>
        </div>
        <div>
          <p class="pt-legend-section-title">RAG / Project Status</p>
          <div class="pt-legend-items">
            <div class="pt-legend-item"><div class="pt-legend-pill" style="background:#22c55e"></div> On Track</div>
            <div class="pt-legend-item"><div class="pt-legend-pill" style="background:#dc2626"></div> At Risk / Delayed</div>
            <div class="pt-legend-item"><div class="pt-legend-pill" style="background:#fb923c"></div> Watch / Monitor</div>
          </div>
        </div>
        <div>
          <p class="pt-legend-section-title">Q · C · D · G Indicators</p>
          <div class="pt-legend-items">
            <div class="pt-legend-item"><div class="pt-legend-dot" style="background:#dc2626"></div> Delayed — with impact on targets</div>
            <div class="pt-legend-item"><div class="pt-legend-dot" style="background:#fb923c"></div> Delayed — without impact on targets</div>
            <div class="pt-legend-item"><div class="pt-legend-dot" style="background:#22c55e"></div> On Track</div>
            <p class="pt-legend-note">Q = Quality · C = Cost · D = Timeline · G = Gate Readiness</p>
          </div>
        </div>
        <div>
          <p class="pt-legend-section-title">Budget (CAPEX &amp; REVEX) Status</p>
          <div class="pt-legend-items">
            <div class="pt-legend-item"><div class="pt-legend-square" style="background:#dc2626">B</div> Budget Overrun (&gt; 95%)</div>
            <div class="pt-legend-item"><div class="pt-legend-square" style="background:#fb923c">B</div> Approaching limit (81–95%)</div>
            <div class="pt-legend-item"><div class="pt-legend-square" style="background:#22c55e">B</div> Within Budget (≤ 80%)</div>
            <div class="pt-legend-item"><div class="pt-legend-square-outline">B</div> Under workout / Approval</div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Scale to fit viewport — fills the space below the topnav ──────
  function fitPage() {
    const page   = document.querySelector(".pt-page");
    const topnav = document.getElementById("topnav-root");
    if (!page) return;

    const vw         = document.documentElement.clientWidth;
    const vh         = document.documentElement.clientHeight;
    const navH       = topnav ? topnav.offsetHeight : 56;
    const available  = vh - navH;          // px below the topnav
    const designW    = 1440;
    const scale      = Math.min(1, vw / designW);
    // At this scale, how tall can the page be to exactly fill available height?
    const pageH      = Math.floor(available / scale);

    page.style.height   = pageH + "px";
    page.style.overflow = "hidden";

    if (vw > 1024) {
      page.style.transform = `scale(${scale})`;
      // After scaling, the element still occupies its pre-scale height in the flow.
      // Compensate so the viewport-fit div doesn't over-scroll.
      page.style.marginBottom = `${(pageH * scale) - pageH}px`;
    } else {
      page.style.transform    = "";
      page.style.marginBottom = "";
      page.style.height       = "auto";
      page.style.overflow     = "";
    }
  }

  // ── Main init ─────────────────────────────────────────────────
  window.initPortfolioTracker = function () {
    const projects = typeof listProjectDetails === "function" ? listProjectDetails() : [];

    // KPI
    const kpiEl = document.getElementById("kpiRow");
    if (kpiEl) kpiEl.innerHTML = buildKpi(projects);

    // Matrix (initial render)
    function renderMatrix() {
      const catFilter  = document.getElementById("filterCategory")?.value || "";
      const portFilter = document.getElementById("filterPortfolio")?.value || "";
      const matrixEl   = document.getElementById("matrixTable");
      if (matrixEl) matrixEl.innerHTML = buildMatrix(projects, catFilter, portFilter);

      // Card click → navigate to project detail
      matrixEl && matrixEl.querySelectorAll(".pt-proj-card").forEach(card => {
        card.addEventListener("click", () => {
          const code = card.dataset.project;
          if (code) window.location.href = `../project-detail/index.html?id=${encodeURIComponent(code)}`;
        });
      });
    }
    renderMatrix();

    // Filters
    document.getElementById("filterCategory")?.addEventListener("change", renderMatrix);
    document.getElementById("filterPortfolio")?.addEventListener("change", renderMatrix);

    // Legend
    const legendEl = document.getElementById("legendPanel");
    if (legendEl) legendEl.innerHTML = buildLegend();

    // Fit + resize
    fitPage();
    window.addEventListener("resize", fitPage);
  };
})();
