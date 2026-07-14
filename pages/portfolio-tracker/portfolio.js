// Portfolio Tracker — GATES column + category swimlanes, matching the Figma board design.
// Real data only: every color/badge/date below is derived from listProjectDetails(), which
// itself derives from the regenerated projects.json / gate-instance records — nothing here is
// fabricated or randomized.
(function () {
  "use strict";

  function esc(s) { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  // ── Figma-exact color tokens ──────────────────────────────────
  const RAG        = { Green: "#22c55e", Amber: "#fb923c", Red: "#dc2626" };
  const CHIP        = {
    Green:  { bg: "#bbf7d0", text: "#15803d" },
    Amber:  { bg: "#fed7aa", text: "#ea580c" },
    Red:    { bg: "#fecaca", text: "#dc2626" },
    Gray:   { bg: "#e5e7eb", text: "#1f2937" },
  };
  const PRIORITY_MAP = { Critical: { label: "P1", color: "#dc2626" }, High: { label: "P2", color: "#fb923c" }, Medium: { label: "P3", color: "#22c55e" } };

  // ── Gates — real gate sequence, Figma's exact display labels + gradient ──
  const GATE_ROWS = [
    { code: "Pre-KO", no: "01", label: "Pre Kick Off",        bg: "#1e40af" },
    { code: "CVPA",   no: "02", label: "Concept Validation",   bg: "#1d4ed8" },
    { code: "VV",     no: "03", label: "Virtual Validation",   bg: "#2563eb" },
    { code: "PC",     no: "04", label: "Program Confirmation", bg: "#3d79ee" },
    { code: "PR",     no: "05", label: "Product Readiness",    bg: "#3b82f6" },
    { code: "PPO",    no: "06", label: "Product Prove - Out",  bg: "#60a5fa" },
  ];
  const GATE_INDEX = Object.fromEntries(GATE_ROWS.map((g, i) => [g.code, i]));

  // ── Categories — real `platform` field, Figma's tint per column ──
  const CATEGORIES = [
    { key: "Heavy",   label: "HEAVY",   tint: "#ffe5e5" },
    { key: "Compact", label: "COMPACT", tint: "#e5f1ff" },
    { key: "Utility", label: "UTILITY", tint: "#e6f5e7" },
  ];

  // Real parent → child relationships established in the portfolio data story.
  const PARENT_CHILD = { PJ01002: "PJ01005", PJ01012: "PJ01014" };
  const CHILD_TO_PARENT = Object.fromEntries(Object.entries(PARENT_CHILD).map(([p, c]) => [c, p]));

  function chip(colorKey) { const c = CHIP[colorKey] || CHIP.Gray; return { bg: c.bg, text: c.text }; }

  function gateRowIndexFor(detail) {
    const idx = GATE_INDEX[detail.currentStage];
    return idx !== undefined ? idx : GATE_ROWS.length - 1; // Completed projects → last row (PPO)
  }

  // ── Card ──────────────────────────────────────────────────────
  function buildProjectCard(detail) {
    const rag = RAG[detail.rygStatus] || RAG.Green;
    const pr = PRIORITY_MAP[detail.priority] || PRIORITY_MAP.Medium;
    const budgetColor = RAG[detail.budgetHealth] || RAG.Green;
    const qcdg = detail._qcdg;
    const isParent = !!PARENT_CHILD[detail.projectCode];
    const dateLabel = detail._dateLabel;

    return `
      <div class="pt-card" data-code="${esc(detail.projectCode)}" style="border-left-color:${rag}">
        <div class="pt-card-top">
          <div class="pt-card-top-left">
            <span class="pt-card-b" style="background:${budgetColor}">B</span>
            <span class="pt-card-cat-pill">${esc(detail.category)}</span>
          </div>
          <span class="pt-card-priority" style="background:${pr.color}">${pr.label}</span>
        </div>
        <p class="pt-card-name">${esc(detail.projectName)}</p>
        <div class="pt-card-qcdg">
          <span class="pt-chip" style="background:${qcdg.Q.bg};color:${qcdg.Q.text}">Q</span>
          <span class="pt-chip" style="background:${qcdg.C.bg};color:${qcdg.C.text}">C</span>
          <span class="pt-chip" style="background:${qcdg.D.bg};color:${qcdg.D.text}">D</span>
          <span class="pt-chip" style="background:${qcdg.G.bg};color:${qcdg.G.text}">G</span>
        </div>
        <div class="pt-card-date">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/><circle cx="8" cy="15" r="1" fill="#1e293b" stroke="none"/><circle cx="12" cy="15" r="1" fill="#1e293b" stroke="none"/><circle cx="16" cy="15" r="1" fill="#1e293b" stroke="none"/></svg>
          <span>${esc(dateLabel)}</span>
        </div>
        ${isParent ? `<div class="pt-star-flag" data-parent-code="${esc(detail.projectCode)}" title="Parent program — click the star to view its derivative"><svg width="13" height="13" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6z"/></svg></div>` : ""}
      </div>
    `;
  }

  // ── Board: one CSS grid — GATES column + N category columns share the SAME row tracks, so
  // expanding a cell (see buildBoard) grows that row's height in lockstep across every column
  // instead of only the one category's own stack drifting out of alignment. ──────────────────
  function buildBoard(details, expandedCells) {
    let html = `<div class="pt-gates-header" style="grid-column:1;grid-row:1">GATES</div>`;
    GATE_ROWS.forEach((g, i) => {
      html += `
        <div class="pt-gate-row" style="background:${g.bg};grid-column:1;grid-row:${i + 2}">
          <div class="pt-gate-no">${g.no}</div>
          <div class="pt-gate-label">${esc(g.label)}</div>
        </div>
      `;
    });

    CATEGORIES.forEach((cat, ci) => {
      const col = ci + 2;
      const inCat = details.filter(d => d.platform === cat.key);
      const byGate = {};
      inCat.forEach(d => { (byGate[gateRowIndexFor(d)] ||= []).push(d); });

      html += `
        <div class="pt-cat-header" style="background:${cat.tint};grid-column:${col};grid-row:1">
          <span class="pt-cat-title">${esc(cat.label)}</span>
          <span class="pt-cat-count">${inCat.length}</span>
        </div>
      `;
      GATE_ROWS.forEach((g, i) => {
        const cellKey = cat.key + "|" + i;
        const cellProjects = byGate[i] || [];
        const isExpanded = expandedCells.has(cellKey);
        const MAX_VISIBLE = 2;
        const visible = isExpanded ? cellProjects : cellProjects.slice(0, MAX_VISIBLE);
        const overflow = cellProjects.length - visible.length;
        const cards = visible.map(buildProjectCard).join("") +
          (overflow > 0
            ? `<button type="button" class="pt-more-badge" data-cell-key="${esc(cellKey)}">+${overflow} more</button>`
            : (isExpanded && cellProjects.length > MAX_VISIBLE
              ? `<button type="button" class="pt-less-badge" data-cell-key="${esc(cellKey)}">Show less</button>`
              : ""));
        html += `<div class="pt-cat-cell${isExpanded ? " expanded" : ""}" style="grid-column:${col};grid-row:${i + 2}">${cards}</div>`;
      });
    });

    return html;
  }

  // ── Legend Panel (collapsible, default open) ─────────────────────
  function buildLegend() {
    return `
      <div class="pt-legend-header" id="legendToggle" role="button" tabindex="0" aria-expanded="true">
        <span class="pt-legend-title">Legend</span>
        <svg class="pt-legend-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      </div>
      <div class="pt-legend-inner" id="legendInner">
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

  // ── Relationship mode: click a parent (star) card → highlight + dim + draw connector ──
  let relationshipActive = null;

  function clearRelationship() {
    relationshipActive = null;
    document.querySelectorAll(".pt-card").forEach(c => c.classList.remove("dimmed", "relationship-active"));
    document.querySelectorAll(".pt-more-badge, .pt-less-badge").forEach(b => b.classList.remove("dimmed"));
    document.querySelectorAll(".pt-cat-cell").forEach(cell => cell.classList.remove("relationship-mode"));
    const svg = document.getElementById("connectorSvg");
    if (svg) svg.innerHTML = "";
  }

  function drawConnector(fromEl, toEl, containerEl) {
    const svg = document.getElementById("connectorSvg");
    if (!svg || !fromEl || !toEl) return;
    const cRect = svg.getBoundingClientRect();
    // .pt-page is scaled via CSS transform (fitPage()) to fit the viewport — that transform
    // shrinks the SVG's PAINTED size but not its layout size, and without an explicit viewBox
    // the browser maps user units 1:1 to the (unscaled) layout box, not the rect we just read.
    // Pinning the viewBox to the SVG's own actual on-screen rect makes 1 user unit = 1 rendered
    // pixel of THIS box regardless of any ancestor transform, so the coordinates below line up.
    svg.setAttribute("viewBox", `0 0 ${cRect.width} ${cRect.height}`);
    const fRect = fromEl.getBoundingClientRect();
    const tRect = toEl.getBoundingClientRect();
    const fCenterX = fRect.left - cRect.left + fRect.width / 2;
    const tCenterX = tRect.left - cRect.left + tRect.width / 2;
    const fTop = fRect.top - cRect.top, fBottom = fRect.bottom - cRect.top;
    const tTop = tRect.top - cRect.top, tBottom = tRect.bottom - cRect.top;

    // The child card can sit above OR below the parent (a derivative program often starts at an
    // earlier gate than its parent, so it commonly renders in a higher row) — anchor to whichever
    // edge actually faces the other card so the line/arrowhead is never drawn backwards.
    const parentBelow = fTop > tBottom;
    const x1 = fCenterX, x2 = tCenterX;
    const y1 = parentBelow ? fTop : fBottom;
    const y2 = parentBelow ? tBottom : tTop;
    const arrowDir = parentBelow ? -1 : 1; // -1 = arrowhead points up, 1 = points down
    const yEnd = y2 - arrowDir * 8;

    let path;
    if (Math.abs(x1 - x2) < 2) {
      path = `M ${x1} ${y1} L ${x2} ${yEnd}`;
    } else {
      const midY = (y1 + y2) / 2;
      const r = 10;
      const dirX = x2 > x1 ? 1 : -1;
      const dirY = y2 > y1 ? 1 : -1;
      path = `M ${x1} ${y1} L ${x1} ${midY - dirY * r} Q ${x1} ${midY} ${x1 + dirX * r} ${midY} L ${x2 - dirX * r} ${midY} Q ${x2} ${midY} ${x2} ${midY + dirY * r} L ${x2} ${yEnd}`;
    }
    const arrowY1 = y2 - arrowDir * 12, arrowY2 = y2 - arrowDir * 2;

    svg.innerHTML = `
      <circle cx="${x1}" cy="${y1}" r="4" fill="#fb923c"></circle>
      <path d="${path}" fill="none" stroke="#fb923c" stroke-width="2"></path>
      <polyline points="${x2 - 5},${arrowY1} ${x2},${arrowY2} ${x2 + 5},${arrowY1}" fill="none" stroke="#fb923c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
    `;
  }

  function activateRelationship(parentCode, boardEl) {
    const childCode = PARENT_CHILD[parentCode];
    if (!childCode) return;
    relationshipActive = parentCode;
    const parentEl = boardEl.querySelector(`.pt-card[data-code="${parentCode}"]`);
    const childEl  = boardEl.querySelector(`.pt-card[data-code="${childCode}"]`);
    boardEl.querySelectorAll(".pt-card").forEach(c => {
      const isRelated = c === parentEl || c === childEl;
      c.classList.toggle("dimmed", !isRelated);
      c.classList.toggle("relationship-active", isRelated);
    });
    // "+more"/"show less" controls belong to cells with no visible related card — hide them too,
    // and let each cell center whatever (if anything) is still visible inside it.
    boardEl.querySelectorAll(".pt-more-badge, .pt-less-badge").forEach(b => b.classList.add("dimmed"));
    boardEl.querySelectorAll(".pt-cat-cell").forEach(cell => cell.classList.add("relationship-mode"));
    drawConnector(parentEl, childEl, boardEl);
  }

  // ── Scale to fit viewport — fills the space below the topnav ──────
  // Scales on whichever ratio (width or height) is more constraining, so the whole board +
  // legend always fits with no scroll/clipping, instead of only ever scaling by width and then
  // clipping any extra height (which was cutting the bottom gate row off the screen).
  function fitPage() {
    const page   = document.querySelector(".pt-page");
    const topnav = document.getElementById("topnav-root");
    if (!page) return;

    // Measure the page's true, unscaled content height first.
    page.style.transform    = "";
    page.style.marginBottom = "";
    page.style.height       = "auto";
    page.style.overflow     = "visible";
    const naturalH = page.scrollHeight;

    const vw        = document.documentElement.clientWidth;
    const vh        = document.documentElement.clientHeight;
    const navH      = topnav ? topnav.offsetHeight : 56;
    const available = vh - navH;
    const designW   = 1440;
    const scale     = Math.min(1, vw / designW, naturalH > 0 ? available / naturalH : 1);

    if (vw > 1024) {
      page.style.height       = naturalH + "px";
      page.style.overflow     = "hidden";
      page.style.transform    = `scale(${scale})`;
      page.style.marginBottom = `${(naturalH * scale) - naturalH}px`;
    }
  }

  // ── Real-data derivation for a listProjectDetails() row ──────────
  function enrich(detail) {
    const gate = (detail.gates || []).find(g => g.stage === detail.currentStage);
    const gColor = !gate ? "Gray"
      : gate.approval === "Approved" ? "Green"
      : gate.approval === "In Review" ? "Amber"
      : (gate.delayDays > 0 ? "Red" : "Gray");
    detail._qcdg = {
      Q: chip(detail.rygStatus === "Green" ? "Green" : detail.rygStatus === "Amber" ? "Amber" : "Red"),
      C: chip(detail.budgetHealth === "Green" ? "Green" : detail.budgetHealth === "Amber" ? "Amber" : "Red"),
      D: chip(detail.scheduleHealth === "Green" ? "Green" : detail.scheduleHealth === "Amber" ? "Amber" : "Red"),
      G: chip(gColor),
    };
    detail._dateLabel = gate && gate.target && gate.target !== "-" ? gate.target : (detail.targetSop || "-");
    return detail;
  }

  // ── Main init ─────────────────────────────────────────────────
  window.initPortfolioTracker = function () {
    const raw = typeof listProjectDetails === "function" ? listProjectDetails() : [];
    // riskHealth / budgetHealth / scheduleHealth live on the underlying project record, which
    // listProjectDetails() doesn't currently surface — pull them straight from projectPortfolioData's
    // source (_projects, loaded by app-config.js) so the board can use the exact same real fields
    // the Dashboard already reconciles against.
    const byCode = Object.fromEntries((typeof _projects !== "undefined" ? _projects : []).map(p => [p.code, p]));
    raw.forEach(d => {
      const src = byCode[d.projectCode];
      if (src) { d.riskHealth = src.riskHealth; d.budgetHealth = src.budgetHealth; d.scheduleHealth = src.scheduleHealth; }
      enrich(d);
    });

    const expandedCells = new Set();

    function renderBoard() {
      const catFilter  = document.getElementById("filterCategory")?.value || "";
      const portFilter = document.getElementById("filterPortfolio")?.value || "";
      let data = raw;
      if (catFilter) data = data.filter(p => p.category === catFilter);
      if (portFilter) data = data.filter(p => p.portfolio === portFilter);

      const boardEl = document.getElementById("boardTable");
      if (!boardEl) return;
      boardEl.innerHTML = buildBoard(data, expandedCells) + `<svg id="connectorSvg" class="pt-connector-svg"></svg>`;

      // Star flag → the ONLY thing that opens relationship mode; the rest of a parent card
      // still navigates to its Project Detail page like any other card.
      boardEl.querySelectorAll(".pt-star-flag").forEach(star => {
        star.addEventListener("click", (e) => {
          e.stopPropagation();
          const code = star.dataset.parentCode;
          if (relationshipActive === code) clearRelationship();
          else activateRelationship(code, boardEl);
        });
      });

      boardEl.querySelectorAll(".pt-card").forEach(card => {
        card.addEventListener("click", (e) => {
          if (relationshipActive) { clearRelationship(); return; }
          const code = card.dataset.code;
          if (code) window.location.href = `../project-detail/index.html?id=${encodeURIComponent(code)}`;
        });
      });

      boardEl.querySelectorAll(".pt-more-badge, .pt-less-badge").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const key = btn.dataset.cellKey;
          if (expandedCells.has(key)) expandedCells.delete(key); else expandedCells.add(key);
          renderBoard();
          fitPage();
        });
      });

      boardEl.addEventListener("click", (e) => {
        if (e.target === boardEl) clearRelationship();
      });
    }
    renderBoard();

    document.getElementById("filterCategory")?.addEventListener("change", () => { clearRelationship(); renderBoard(); });
    document.getElementById("filterPortfolio")?.addEventListener("change", () => { clearRelationship(); renderBoard(); });

    // Legend (collapsible, default expanded)
    const legendEl = document.getElementById("legendPanel");
    if (legendEl) {
      legendEl.innerHTML = buildLegend();
      const toggle = document.getElementById("legendToggle");
      const inner  = document.getElementById("legendInner");
      toggle?.addEventListener("click", () => {
        const collapsed = legendEl.classList.toggle("collapsed");
        toggle.setAttribute("aria-expanded", String(!collapsed));
        fitPage();
      });
    }

    fitPage();
    window.addEventListener("resize", () => { fitPage(); if (relationshipActive) activateRelationship(relationshipActive, document.getElementById("boardTable")); });
  };
})();
