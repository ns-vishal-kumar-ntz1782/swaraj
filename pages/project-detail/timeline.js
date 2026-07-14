// ==========================================================
//  PROJECT TIMELINE — GATES ribbon + MILESTONES row + Planned/Timeline/Approved/Outlook/
//  Velocity table, one shared 18-checkpoint column grid throughout so every row (and the
//  floating start/end date chips + the current-gate "live" pulse) lines up vertically.
//  Matches Figma node 593:2190. Data-driven — every date/status/delay value below comes from
//  detail.gates (see assets/js/data/project-detail-seed.js), nothing hardcoded.
// ==========================================================
(function (global) {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  // Fixed per-stage identity color for the GATES ribbon (Figma: navy → light blue gradient
  // across Pre-KO...PPO, gray for the trailing SOP milestone) — decorative "which stage is
  // this," independent of real progress. Real status lives entirely in the Timeline row below.
  const STAGE_COLOR = {
    "Pre-KO": { bg: "#003b88", fg: "#fff" },
    "CVPA":   { bg: "#1e40af", fg: "#fff" },
    "VV":     { bg: "#1d4ed8", fg: "#fff" },
    "PC":     { bg: "#3d79ee", fg: "#fff" },
    "PR":     { bg: "#60a5fa", fg: "#1f2937" },
    "PPO":    { bg: "#cddaef", fg: "#1f2937" },
    "SOP":    { bg: "#e5e7eb", fg: "#4b5563" },
  };

  const COMPLETED_STATUSES = new Set(["On Time","Completed","Delayed 15-60","Delayed >60"]);

  // Real per-gate status → circle fill in the Timeline row, the one place actual progress is
  // shown (kept as CSS classes, same names project-detail.css already defines elsewhere on
  // this page, so a status reads identically everywhere).
  function statusClass(status) {
    switch (status) {
      case "On Time":       return "st-ontime";
      case "Completed":     return "st-completed";
      case "In Progress":   return "st-inprogress";
      case "Delayed 15-60": return "st-delay-mid";
      case "Delayed >60":   return "st-delay-high";
      case "Skipped":       return "st-skipped";
      default:              return "st-pending";
    }
  }

  // ── P/A/O + Velocity checkpoint labels — the fixed generic stage-gate milestone names
  // (matches the Figma reference), not this project's own deliverable list (that's what the
  // Deliverables tab is for). Every checkpoint within a gate shares that gate's own real
  // planned/actual/outlook/delay values, since the fixed labels don't map 1:1 to real
  // per-project deliverable records. ──
  const GATE_CHECKPOINTS = {
    "Pre-KO": ["PRF Approval", "QA & CC Inputs", "Technical Feasibility", "BC Approval", "Target Approval"],
    "CVPA":   ["DR0", "DFMEA-DVP Matrix"],
    "VV":     ["VV"],
    "PC":     ["L2 Release", "Vendor Onboard", "VP Part Receipt"],
    "PR":     ["VP Build", "VP Validation", "Homologation Builds", "PPAP Readiness"],
    "PPO":    ["ER-SOVP", "PP Batch"],
  };

  // Builds the flat 18-checkpoint column list (+ trailing SOP pseudo-column) that every row —
  // MILESTONES, Planned/Timeline/Approved/Outlook/Velocity — is laid out against, so a value in
  // any row sits directly under/over its real milestone regardless of which function rendered it.
  function buildColumns(detail) {
    const stages = global.PD_STAGES;
    const columns = [];
    stages.forEach((stageCode, gi) => {
      const g = detail.gates[gi] || null;
      const labels = GATE_CHECKPOINTS[stageCode] || [stageCode];
      labels.forEach((label, li) => {
        columns.push({ label, stageCode, gate: g, gateIdx: gi, stageStart: li === 0, stageEnd: li === labels.length - 1 });
      });
    });
    // Trailing SOP column — a real project-level milestone date (targetSOP/forecastSOP, already
    // shown elsewhere on this same Snapshot tab), not a 7th process gate — this app's data model
    // only has the 6 real gates above, so no gate instance is invented for it.
    columns.push({
      label: "SOP", stageCode: "SOP", gateIdx: -1, stageStart: true, stageEnd: true,
      gate: { target: detail.sopDate || "-", actual: "-", outlook: detail.targetLaunch || detail.sopDate || "-" },
    });
    return columns;
  }

  // Groups the flat column list back into per-stage spans (for the GATES ribbon's merged cells).
  function buildStageSpans(columns) {
    const spans = [];
    columns.forEach((c) => {
      const last = spans[spans.length - 1];
      if (last && last.stageCode === c.stageCode) last.count += 1;
      else spans.push({ stageCode: c.stageCode, count: 1 });
    });
    return spans;
  }

  // Horizontal center of column i as a percentage of the shared track width — every floating
  // element (start/end date chip, live pulse, gate circle) is positioned with this, so they all
  // line up under/over the same milestone regardless of which row rendered them.
  function colCenterPct(i, total) { return ((i + 0.5) / total) * 100; }

  // Timeline connecting line, split into up to 3 real-progress zones instead of one flat
  // color: solid dark blue through every completed gate, a dashed mid-blue stretch toward the
  // gate currently In Progress, and a pale future-blue tail beyond it. Falls back to a single
  // pale line when nothing has started, or a single solid line when everything has.
  function buildTimelineLineSegments(columns, total) {
    const stageEndCols = columns
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.stageEnd && c.gate && c.gateIdx >= 0);
    let lastDoneIdx = -1;
    let currentIdx = -1;
    stageEndCols.forEach(({ c, i }) => {
      if (COMPLETED_STATUSES.has(c.gate.status)) lastDoneIdx = i;
      if (c.gate.status === "In Progress") currentIdx = i;
    });
    const donePct = lastDoneIdx >= 0 ? colCenterPct(lastDoneIdx, total) : 0;
    const segs = [];
    if (currentIdx >= 0) {
      const currentPct = colCenterPct(currentIdx, total);
      if (donePct > 0) segs.push({ left: 0, width: donePct, color: "#3D79EE" });
      segs.push({ left: donePct, width: Math.max(0, currentPct - donePct), color: "#60A5FA", dashed: true });
      if (currentPct < 100) segs.push({ left: currentPct, width: 100 - currentPct, color: "#CDDAEF" });
    } else if (lastDoneIdx >= 0) {
      segs.push({ left: 0, width: donePct, color: "#3D79EE" });
      if (donePct < 100) segs.push({ left: donePct, width: 100 - donePct, color: "#CDDAEF" });
    } else {
      segs.push({ left: 0, width: 100, color: "#CDDAEF" });
    }
    return segs;
  }

  // ── Stage-gate bar: GATES ribbon + MILESTONES row + floating "start date" chips (navy) +
  // the red "current gate" live pulse, positioned just above the active gate's milestone. ──
  function renderStageGate(el, detail) {
    const columns = buildColumns(detail);
    const spans = buildStageSpans(columns);
    const total = columns.length;

    const gatesHtml = spans.map((s) => {
      const c = STAGE_COLOR[s.stageCode] || STAGE_COLOR.SOP;
      return `<div class="ptl-gateseg" style="flex:${s.count} 1 0%;background:${c.bg};color:${c.fg}">${esc(s.stageCode.toUpperCase())}</div>`;
    }).join("");

    const msCellsHtml = columns.map((c) => `<div class="ptl-mscell">${esc(c.label)}</div>`).join("");

    // A gate has "started" once it's In Progress or finished (any of the 4 completed-family
    // statuses) — Pending (not reached yet) and Skipped (never runs) show no start chip.
    const startChipsHtml = columns.filter((c) => c.stageEnd && c.gate && c.gateIdx >= 0)
      .map((c) => {
        const g = c.gate;
        const started = g.status !== "Pending" && g.status !== "Skipped" && g.plannedStart && g.plannedStart !== "-";
        if (!started) return "";
        const left = colCenterPct(columns.indexOf(c), total);
        return `<div class="ptl-chip ptl-chip-start" style="left:${left}%" title="${esc(g.stage)} started ${esc(g.plannedStart)}">
          <span class="ptl-chip-body">${esc(g.plannedStart)}</span><span class="ptl-chip-tri"></span>
        </div>`;
      }).join("");

    // Red "we are here" pulse — the single gate currently In Progress, placed just above its
    // own milestone cell so it's unambiguous which milestone the project is currently working on.
    const currentCol = columns.find((c) => c.stageEnd && c.gate && c.gate.status === "In Progress");
    const pulseHtml = currentCol
      ? `<div class="ptl-live-pulse" style="left:${colCenterPct(columns.indexOf(currentCol), total)}%" title="Current gate: ${esc(currentCol.stageCode)}">
          <span class="ptl-live-ring ptl-live-ring2"></span><span class="ptl-live-ring ptl-live-ring1"></span><span class="ptl-live-dot"></span>
        </div>`
      : "";

    el.innerHTML = `
      <div class="ptl-block">
        <div class="ptl-row ptl-row-gates">
          <div class="ptl-label">GATES</div>
          <div class="ptl-track">${gatesHtml}${startChipsHtml}</div>
        </div>
        <div class="ptl-row ptl-row-milestones">
          <div class="ptl-label">MILESTONES</div>
          <div class="ptl-track">${pulseHtml}${msCellsHtml}</div>
        </div>
      </div>`;
  }

  // ── "Skip this gate" confirm — PMO/SA only, future gates only. Reuses the shared popover
  // helper project-detail.js exposes on window.PDPopover (same one the Deliverables tab's
  // Assign/Documents/History controls use) so there's only one floating-popover implementation
  // on this page. Confirming records the skip in the shared registry (assets/js/data/gate-skip.js)
  // and reloads — this page has no partial-refresh path that safely rebuilds the Chart.js gauges,
  // Gantt, and every other tab that a skip affects, so a reload is the simplest correct option. ──
  function openSkipConfirm(anchorEl, projectCode, gateCode, gateName, currentRole) {
    if (!global.PDPopover) return;
    const html = `
      <div class="pd-skip-confirm">
        <h4>Skip ${esc(gateName)} gate?</h4>
        <p>This gate will require no approval and no deliverables, and will be excluded from progress and compliance calculations for this project.</p>
        <label class="pd-skip-reason-lbl">Reason <span class="pd-skip-optional">(optional)</span></label>
        <textarea class="pd-skip-reason" rows="2" placeholder="e.g. Not applicable for this variant"></textarea>
        <div class="pd-skip-actions">
          <button type="button" class="pd-skip-cancel">Cancel</button>
          <button type="button" class="pd-skip-confirm-btn">Yes, skip this gate</button>
        </div>
      </div>`;
    const pop = global.PDPopover.open(anchorEl, html, 'pd-skip-popover');
    pop.querySelector('.pd-skip-cancel').addEventListener('click', () => global.PDPopover.close());
    pop.querySelector('.pd-skip-confirm-btn').addEventListener('click', () => {
      const reason = pop.querySelector('.pd-skip-reason').value.trim();
      const actorName = (typeof roleDirectory !== 'undefined' && roleDirectory[currentRole]) ? roleDirectory[currentRole].name : currentRole;
      if (typeof skipGate === 'function') skipGate(projectCode, gateCode, actorName, currentRole, reason);
      global.PDPopover.close();
      location.reload();
    });
  }

  // Real day-count per checkpoint, reusing its parent gate's own delayDays (checkpoints don't
  // carry independent real data — see the GATE_CHECKPOINTS comment above).
  function velocityCell(c) {
    if (c.stageCode === "SOP" || !c.gate || c.gate.status === "Pending" || c.gate.status === "Skipped") {
      return { text: "-", color: "#9ca3af" };
    }
    const dd = c.gate.delayDays || 0;
    if (dd <= 0)  return { text: "On Time", color: "#14b8a6" };
    if (dd <= 15) return { text: `${dd} Day${dd === 1 ? "" : "s"}`, color: "#006b3f" };
    if (dd <= 60) return { text: `${dd} Days`, color: "#f1c272" };
    return { text: `${dd} Days`, color: "#e53935" };
  }

  // ── Values table: Planned Date / Timeline (gate circles + skip click) / Approved Date /
  // Outlook / Velocity-Delay rows, plus the floating "end date" chips (teal) below completed
  // gates' circles. ──
  function renderTimelineTable(el, detail) {
    const columns = buildColumns(detail);
    const total = columns.length;
    const currentRole = (typeof getCurrentRole === "function") ? getCurrentRole() : (sessionStorage.getItem("snpdRole") || "");
    const canSkip = currentRole === "SA" || currentRole === "PMO";

    const dateRow = (labelText, labelCls, field) => {
      const cells = columns.map((c) => {
        const val = c.gate ? c.gate[field] : null;
        return `<div class="ptl-datacell">${esc(val || "-")}</div>`;
      }).join("");
      return `<div class="ptl-row">
        <div class="ptl-label ${labelCls}">${labelText}</div>
        <div class="ptl-track ptl-datatrack">${cells}</div>
      </div>`;
    };

    // Timeline row: connecting line + one circle per real gate at its own stageEnd column,
    // colored by real status — this is the sole progress indicator in the whole component.
    const lineHtml = buildTimelineLineSegments(columns, total).map((s) =>
      `<div class="ptl-timeline-seg${s.dashed ? " ptl-timeline-seg-dashed" : ""}" style="left:${s.left}%;width:${s.width}%;border-color:${s.color}"></div>`
    ).join("");

    const circlesHtml = columns.filter((c) => c.stageEnd && c.gate && c.gateIdx >= 0).map((c) => {
      const g = c.gate;
      const left = colCenterPct(columns.indexOf(c), total);
      const skippable = canSkip && g.status === "Pending";
      const cls = ["ptl-gatecircle", statusClass(g.status), skippable ? "ptl-gatecircle-skippable" : ""].filter(Boolean).join(" ");
      const attrs = skippable ? ` data-skip-gate="${esc(g.stage)}" data-skip-name="${esc(g.name || g.stage)}"` : "";
      const title = skippable ? "Click to skip this gate" : `${esc(g.id)} · ${esc(g.status)}`;
      // A Skipped gate gets a slash icon instead of its "G_" label — relying on color alone
      // (slate vs. the very-similar light-gray Pending fill) isn't a reliable enough signal.
      const inner = g.status === "Skipped"
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="6" y1="18" x2="18" y2="6"/></svg>'
        : esc(g.id);
      return `<div class="${cls}" style="left:${left}%" title="${title}"${attrs}>${inner}</div>`;
    }).join("");

    const endChipsHtml = columns.filter((c) => c.stageEnd && c.gate && c.gateIdx >= 0).map((c) => {
      const g = c.gate;
      if (!COMPLETED_STATUSES.has(g.status) || !g.actual || g.actual === "-") return "";
      const left = colCenterPct(columns.indexOf(c), total);
      return `<div class="ptl-chip ptl-chip-end" style="left:${left}%" title="${esc(g.stage)} completed ${esc(g.actual)}">
        <span class="ptl-chip-tri"></span><span class="ptl-chip-body">${esc(g.actual)}</span>
      </div>`;
    }).join("");

    const timelineRow = `<div class="ptl-row ptl-row-timeline">
      <div class="ptl-label">Timeline</div>
      <div class="ptl-track ptl-timelinetrack">
        ${lineHtml}
        ${circlesHtml}
      </div>
    </div>`;

    const velocityRow = `<div class="ptl-row">
      <div class="ptl-label">Velocity / Delay</div>
      <div class="ptl-track ptl-datatrack">
        ${columns.map((c) => { const v = velocityCell(c); return `<div class="ptl-datacell" style="color:${v.color};font-weight:var(--fw-600)">${esc(v.text)}</div>`; }).join("")}
      </div>
    </div>`;

    const endChipsRow = `<div class="ptl-row ptl-row-endchips">
      <div class="ptl-label"></div>
      <div class="ptl-track">${endChipsHtml}</div>
    </div>`;

    el.innerHTML = `
      <div class="ptl-values">
        ${dateRow("Planned Date", "ptl-label-blue", "target")}
        ${timelineRow}
        ${dateRow("Approved Date", "ptl-label-green", "actual")}
        ${dateRow("Outlook", "ptl-label-orange", "outlook")}
        ${velocityRow}
        ${endChipsRow}
      </div>`;

    if (canSkip) {
      el.querySelectorAll('[data-skip-gate]').forEach((node) => {
        node.addEventListener('click', () => {
          openSkipConfirm(node, detail.projectCode, node.dataset.skipGate, node.dataset.skipName, currentRole);
        });
      });
    }
  }

  // ── Legend row: P/A/O keys + velocity colour legend ──
  function renderTimelineLegend(el) {
    el.innerHTML = `
      <div class="tl-legend-keys">
        <span><b>P</b> - Planned Date</span>
        <span><b>A</b> - Approved Date</span>
        <span><b>O</b> - Outlook Date</span>
      </div>
      <div class="tl-legend-velocity">
        <span class="tl-vel-title">Velocity</span>
        <span class="tl-vel"><i class="st-completed"></i>Completed</span>
        <span class="tl-vel"><i class="st-pending"></i>Pending</span>
        <span class="tl-vel"><i class="st-delay-high"></i>Delayed (&gt;60 Days)</span>
        <span class="tl-vel"><i class="st-delay-mid"></i>Delayed (15-60 Days)</span>
        <span class="tl-vel"><i class="st-ontime"></i>On Time</span>
        <span class="tl-vel"><i class="st-skipped"></i>Skipped</span>
      </div>`;
  }

  global.PDTimeline = { renderStageGate, renderTimelineTable, renderTimelineLegend, statusClass };
})(window);
