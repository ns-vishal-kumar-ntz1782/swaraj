// ==========================================================
//  TIMELINE — Stage-Gate bar + P/A/O date table + legend.
//  Matches Figma node 197:10483. Data-driven, no hardcoded dates.
// ==========================================================
(function (global) {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  // Relative flex weights matching Figma stage proportions
  const STAGE_WEIGHT = { "Pre-KO": 3, "CVPA": 2, "VV": 1, "PC": 2.6, "PR": 3, "PPO": 1.4, "SOP": 1 };

  const COMPLETED_STATUSES = new Set(["On Time","Completed","Delayed 15-60","Delayed >60"]);

  function statusClass(status) {
    switch (status) {
      case "On Time":       return "st-ontime";
      case "Completed":     return "st-completed";
      case "In Progress":   return "st-inprogress";
      case "Delayed 15-60": return "st-delay-mid";
      case "Delayed >60":   return "st-delay-high";
      default:              return "st-pending";
    }
  }

  // SVG icons for gate nodes — one distinct shape per state (not just a color swap), so a
  // delayed gate reads as "delayed" even at a glance: check (on time/completed), warning
  // triangle (delayed — same shape the rest of the app already uses for alerts, just recreated
  // here since this outer-app page is a plain script with no shared icon module to import from),
  // clock (in progress), hourglass (pending / not started yet).
  const ICON_CHECK     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const ICON_CLOCK     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>';
  const ICON_WARNING   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  const ICON_HOURGLASS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12M6 22h12M17 2c0 5-3.5 6.5-5 8-1.5-1.5-5-3-5-8M7 22c0-5 3.5-6.5 5-8 1.5 1.5 5 3 5 8"/></svg>';
  const ICON_PENDING = ICON_HOURGLASS; // kept as an alias so any external reference to the old name still resolves

  function gateIcon(status) {
    if (status === "On Time" || status === "Completed") return ICON_CHECK;
    if (status === "In Progress") return ICON_CLOCK;
    if (status === "Delayed 15-60" || status === "Delayed >60") return ICON_WARNING;
    return ICON_HOURGLASS;
  }

  // ── Stage-gate bar: gradient bar + stage labels + circular gate nodes ──
  function renderStageGate(el, detail) {
    const stages = global.PD_STAGES;

    let labelsHtml = '';
    let barSegsHtml = '';

    stages.forEach((st, i) => {
      const g = detail.gates[i];
      const isLast = i === stages.length - 1;
      const stCls = g ? statusClass(g.status) : 'st-pending';
      const icon = g ? gateIcon(g.status) : ICON_PENDING;
      const targetDate = g ? esc(g.id) + '-' + esc(g.target) : '';
      const actualDate = g ? esc(g.actual || '-') : '-';
      const w = STAGE_WEIGHT[st] || 1;

      // Labels row: stage name centred + gate stub at right boundary
      labelsHtml += `<div class="sg-seg-wrap" style="flex:${w}">
        <span class="sg-stage-lbl">${esc(st.toUpperCase())}</span>
        ${(!isLast && g) ? `<div class="sg-gate-wrap">
          <span class="sg-gate-top">${targetDate}</span>
          <span class="sg-gate-node ${stCls}" title="${esc(g.id)} · ${esc(g.status)}">${icon}</span>
          <span class="sg-gate-bottom">${actualDate}</span>
        </div>` : ''}
      </div>`;

      // Bar segments
      let segCls = 'sg-seg-todo';
      if (g && COMPLETED_STATUSES.has(g.status)) segCls = 'sg-seg-done';
      else if (g && g.status === 'In Progress') segCls = 'sg-seg-active';
      barSegsHtml += `<div class="sg-seg ${segCls}" style="flex:${w}"></div>`;
    });

    el.innerHTML = `
      <div class="sg-container">
        <div class="sg-track-row">
          <div class="sg-flex-area">
            <div class="sg-labels-flex">${labelsHtml}</div>
            <div class="sg-bar">${barSegsHtml}</div>
          </div>
        </div>
      </div>`;
  }

  // ── P/A/O data table ──
  // Fixed checkpoint labels per gate (matches the Figma reference exactly — these are generic
  // stage-gate milestone names, not this project's own deliverable list, which is what the
  // Deliverables tab is for). Each checkpoint's P/A/O dates come from its own real gate instance
  // (gate-wise, not per-deliverable) — every column within a gate shares that gate's real
  // planned/actual/outlook dates, since the fixed labels don't map 1:1 to real per-project
  // deliverable records.
  const GATE_CHECKPOINTS = {
    "Pre-KO": ["PRF Approval", "QA & CC Inputs", "Technical Feasibility", "BC Approval", "Target Approval"],
    "CVPA":   ["DR0", "DFMEA-DVP Matrix"],
    "VV":     ["VV"],
    "PC":     ["L2 Release", "Vendor Onboard", "VP Part Receipt"],
    "PR":     ["VP Build", "VP Validation", "Homologation Builds", "PPAP Readiness"],
    "PPO":    ["ER-SOVP", "PP Batch"],
  };

  // Header treatment stays derived from real signals, never a hardcoded label match: red-top+pink
  // = that checkpoint's own gate is currently delayed (a real status already on the gate
  // instance); teal-top = the last checkpoint in its gate — the gate's real closing/approval
  // milestone, a structural fact, not a guessed name.
  function renderTimelineTable(el, detail) {
    const stages = global.PD_STAGES;
    const columns = [];
    stages.forEach((stageCode, gi) => {
      const g = detail.gates[gi] || null;
      const delayed = g && (g.status === "Delayed 15-60" || g.status === "Delayed >60");
      const labels = GATE_CHECKPOINTS[stageCode] || [stageCode];
      labels.forEach((label, li) => {
        columns.push({ label, gate: g, stageStart: li === 0, stageEnd: li === labels.length - 1, delayed });
      });
    });
    // Trailing SOP column — a real project-level milestone date (targetSOP/forecastSOP, already
    // shown elsewhere on this same Snapshot tab), not a 7th process gate — this app's data model
    // only has the 6 real gates above, so no gate instance is invented for it.
    columns.push({
      label: "SOP",
      gate: { target: detail.sopDate || "-", actual: "-", outlook: detail.targetLaunch || detail.sopDate || "-" },
      stageStart: true, stageEnd: true, delayed: false,
    });

    let headCells = '<th class="tl-corner"></th>';
    columns.forEach((c) => {
      let thCls = 'tl-h';
      if (c.stageStart) thCls += ' tl-stage-start';
      if (c.delayed) thCls += ' tl-h-red';
      else if (c.stageEnd) thCls += ' tl-h-teal';
      headCells += `<th class="${thCls}">${esc(c.label)}</th>`;
    });

    const rowFor = (label, field) => {
      let cells = `<td class="tl-row-label">${label}</td>`;
      columns.forEach((c) => {
        const val = c.gate ? c.gate[field] : null;
        cells += `<td class="tl-cell${c.stageStart ? ' tl-stage-start' : ''}">${esc(val || '-')}</td>`;
      });
      return `<tr>${cells}</tr>`;
    };

    el.innerHTML = `<table class="tl-table">
      <thead><tr>${headCells}</tr></thead>
      <tbody>
        ${rowFor('P','target')}
        ${rowFor('A','actual')}
        ${rowFor('O','outlook')}
      </tbody>
    </table>`;
  }

  // ── Legend row: P/A/O keys + velocity colour legend ──
  function renderTimelineLegend(el) {
    el.innerHTML = `
      <div class="tl-legend-keys">
        <span><b>P</b> - Planned Date</span>
        <span><b>A</b> - Actual Date</span>
        <span><b>O</b> - Outlook Date</span>
      </div>
      <div class="tl-legend-velocity">
        <span class="tl-vel-title">Velocity</span>
        <span class="tl-vel"><i class="st-completed"></i>Completed</span>
        <span class="tl-vel"><i class="st-pending"></i>Pending</span>
        <span class="tl-vel"><i class="st-delay-high"></i>Delayed (&gt;60 Days)</span>
        <span class="tl-vel"><i class="st-delay-mid"></i>Delayed (15-60 Days)</span>
        <span class="tl-vel"><i class="st-ontime"></i>On Time</span>
      </div>`;
  }

  global.PDTimeline = { renderStageGate, renderTimelineTable, renderTimelineLegend, statusClass };
})(window);
