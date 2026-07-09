// ==========================================================
//  TIMELINE — Stage-Gate bar + Planned/Approved/Outlook table + legend.
//  Rendered from the project-detail record; every date/status is data-driven.
// ==========================================================
(function (global) {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // Relative flex weights approximating the Figma stage proportions.
  const STAGE_WEIGHT = { "Pre-KO": 3, "CVPA": 2, "VV": 1, "PC": 2.6, "PR": 3, "PPO": 1.4, "SOP": 1 };

  // Status → { css class, inline SVG icon } for gate nodes and cells.
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
  const COMPLETED_STATUSES = new Set(["On Time", "Completed", "Delayed 15-60", "Delayed >60"]);
  const ICON = {
    check:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    warn:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    hourglass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>',
    clock:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>',
  };
  function gateIcon(status) {
    if (status === "In Progress") return ICON.clock;
    if (status === "On Time" || status === "Completed") return ICON.check;
    if (status === "Delayed 15-60" || status === "Delayed >60") return ICON.warn;
    return ICON.hourglass;
  }

  // ── Stage-gate bar: 7 stage segments with 6 gate nodes at internal boundaries.
  //    A start marker sits at the far left showing the programme kick-off date. ──
  function renderStageGate(el, detail) {
    const stages = global.PD_STAGES;
    let html = '<div class="sg-track">';
    // programme start marker
    html += `<div class="sg-start">
        <span class="sg-start-top">START</span>
        <span class="sg-start-node"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 3 19 12 5 21 5 3"/></svg></span>
        <span class="sg-start-bottom">${esc(detail.programmeStart || "-")}</span>
      </div>`;
    stages.forEach((st, i) => {
      const g = detail.gates[i];
      const segDone = i < stages.length - 1 && g && COMPLETED_STATUSES.has(g.status);
      const segActive = i < stages.length - 1 && g && g.status === "In Progress";
      const segCls = segActive ? "sg-seg-active" : segDone ? "sg-seg-done" : "sg-seg-todo";
      html += `<div class="sg-seg ${segCls}" style="flex:${STAGE_WEIGHT[st] || 1}">
                 <span class="sg-seg-label">${esc(st.toUpperCase())}</span>
               </div>`;
      // gate node after every stage except the last
      if (i < stages.length - 1 && g) {
        const cls = statusClass(g.status);
        html += `<div class="sg-gate">
            <span class="sg-gate-top ${cls}">${esc(g.id)}-${esc(g.target)}</span>
            <span class="sg-gate-node ${cls}" title="${esc(g.id)} · ${esc(g.status)}">${gateIcon(g.status)}</span>
            <span class="sg-gate-bottom">${esc(g.actual)}</span>
          </div>`;
      }
    });
    html += "</div>";
    el.innerHTML = html;
  }

  // Which activity headers get the "critical gate deliverable" pink treatment (from Figma).
  const PINK_HEADERS = new Set(["PRF APPROVAL", "QA & CC INPUTS", "BC APPROVAL", "TARGET APPROVAL", "VP BUILD"]);

  // ── Planned / Approved / Outlook table across the 18 activities ──
  function renderTimelineTable(el, detail) {
    const acts = detail.activities;
    let head = '<tr><th class="tl-corner"></th>';
    acts.forEach((a, i) => {
      const stageStart = i === 0 || acts[i - 1].stage !== a.stage;
      const cls = (PINK_HEADERS.has(a.activity) ? " tl-h-pink" : "") + (stageStart ? " tl-stage-start" : "");
      head += `<th class="tl-h${cls}">${esc(a.activity)}</th>`;
    });
    head += "</tr>";

    const rowFor = (label, field) => {
      let r = `<tr><td class="tl-row-label">${label}</td>`;
      acts.forEach((a, i) => {
        const stageStart = i === 0 || acts[i - 1].stage !== a.stage;
        r += `<td class="tl-cell${stageStart ? " tl-stage-start" : ""}">${esc(a[field])}</td>`;
      });
      return r + "</tr>";
    };

    el.innerHTML = `<table class="tl-table">
        <thead>${head}</thead>
        <tbody>
          ${rowFor("P", "planned")}
          ${rowFor("A", "approved")}
          ${rowFor("O", "outlook")}
        </tbody>
      </table>`;
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
      </div>`;
  }

  global.PDTimeline = { renderStageGate, renderTimelineTable, renderTimelineLegend, statusClass };
})(window);
