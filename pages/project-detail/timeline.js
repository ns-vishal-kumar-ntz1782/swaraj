// ==========================================================
//  PROJECT TIMELINE — GATES ribbon + MILESTONES row + Planned/Timeline/Actual/Outlook/
//  Velocity table, one shared 18-checkpoint column grid throughout so every row (and the
//  floating start/end date chips + the current-gate "live" pulse) lines up vertically.
//  Matches Figma node 593:2190. Data-driven — every date/status/delay value below comes from
//  detail.gates / detail.gateDetails (see assets/js/data/project-detail-seed.js), nothing
//  hardcoded except the fixed checkpoint LABELS, which are auto-matched to this project's own
//  real deliverables by name (see findMatchedDeliverable) so their dates are always real.
// ==========================================================
(function (global) {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  // "DD Mon YY" (this app's one display date format, see project-detail-seed.js's fmtDate) ->
  // "YYYY-MM-DD" for <input type="date">'s value attribute. A self-contained copy of
  // project-detail.js's own displayToISO — that function is private to its own closure, and
  // duplicating this ~10-line parser here is simpler and safer than wiring a new cross-file
  // export just for it.
  const MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function displayToISO(display) {
    if (!display || display === "-" || display === "—") return "";
    if (/^\d{4}-/.test(display)) return display;
    const parts = display.trim().split(" ");
    if (parts.length < 3) return "";
    const day = parts[0].padStart(2, "0");
    const mo = MON3.indexOf(parts[1]);
    if (mo < 0) return "";
    const yr = parseInt(parts[2], 10) < 100 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
    return `${yr}-${String(mo + 1).padStart(2, "0")}-${day}`;
  }

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

  // ── P/A/O + Velocity checkpoint LABELS — the fixed generic stage-gate milestone names
  // (matches the Figma reference). Each one is auto-matched below against this project's own
  // real deliverable list for that gate; a checkpoint whose label doesn't correspond to any
  // real deliverable (e.g. VV's own placeholder, which just repeats the gate code) intentionally
  // shows no dates at all, rather than borrow the whole gate's aggregate date. ──
  const GATE_CHECKPOINTS = {
    "Pre-KO": ["PRF Approval", "QA & CC Requirements", "Technical Feasibility", "BC Approval", "Target Approval"],
    "CVPA":   ["DR0", "DFMEA-DVP Matrix"],
    "VV":     ["VV"],
    "PC":     ["L2 Release", "Vendor On Board", "VP Parts Receipt"],
    "PR":     ["VP Build", "VP Validation", "Homologation Builds", "PPAP Readiness"],
    "PPO":    ["ER-SOP Release", "PP Batch"],
  };

  // ── Checkpoint-label -> real-deliverable matching ───────────────────────────────────────
  // Normalizes both strings, then scores by (a) whether one contains the other outright, or
  // (b) how many of the label's significant words appear in the deliverable name either
  // literally OR as the initials of a consecutive word run (so "PRF Approval" finds "Product
  // Requirement Form Approval", "BC Approval" finds "...Business Case Approval", etc.). A
  // checkpoint literally named after its own gate (VV's "VV") is never matched — it's a
  // placeholder label, not a real milestone name, and per spec should show no dates.
  const STOPWORDS = new Set(["the","a","an","and","or","of","on","in","to","for"]);
  function normText(s) { return String(s || "").toLowerCase().replace(/[()&\-/]/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim(); }
  function rawWords(s) { return normText(s).split(" ").filter(Boolean); }
  function sigWords(s) { return rawWords(s).filter((w) => !STOPWORDS.has(w)); }
  function hasAcronymMatch(nameWords, token) {
    if (token.length < 2 || token.length > 5) return false;
    for (let start = 0; start + token.length <= nameWords.length; start++) {
      let ok = true;
      for (let k = 0; k < token.length; k++) {
        if (!nameWords[start + k] || nameWords[start + k][0] !== token[k]) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }
  function matchScore(label, name) {
    const nl = normText(label), nn = normText(name);
    if (!nl || !nn) return 0;
    let score = nn.includes(nl) ? 0.9 : 0;
    const labelWords = sigWords(label);
    const nameWordSet = new Set(sigWords(name));
    const nameWordsRaw = rawWords(name);
    if (labelWords.length) {
      let matched = 0;
      labelWords.forEach((tok) => {
        if (nameWordSet.has(tok) || hasAcronymMatch(nameWordsRaw, tok)) matched += 1;
      });
      score = Math.max(score, (matched / labelWords.length) * 0.85);
    }
    return score;
  }
  const MATCH_THRESHOLD = 0.5;
  function findMatchedDeliverable(label, stageCode, deliverables) {
    if (!deliverables || !deliverables.length) return null;
    if (normText(label) === normText(stageCode)) return null; // self-referential placeholder, e.g. VV's "VV"
    let best = null, bestScore = 0;
    deliverables.forEach((x, idx) => {
      const s = matchScore(label, x.name);
      if (s > bestScore) { bestScore = s; best = { deliv: x, idx }; }
    });
    return bestScore >= MATCH_THRESHOLD ? best : null;
  }

  // Builds the flat 18-checkpoint column list (+ trailing SOP pseudo-column) that every row —
  // MILESTONES, Planned/Timeline/Actual/Outlook/Velocity — is laid out against, so a value in
  // any row sits directly under/over its real milestone regardless of which function rendered it.
  // Each non-SOP column also carries its auto-matched real deliverable (matchedDeliv/matchedIdx),
  // the single source every date row below reads from.
  function buildColumns(detail) {
    const stages = global.PD_STAGES;
    const columns = [];
    stages.forEach((stageCode, gi) => {
      const g = detail.gates[gi] || null;
      const gd = (detail.gateDetails && detail.gateDetails[gi]) || null;
      const deliverables = gd ? gd.deliverables : [];
      const labels = GATE_CHECKPOINTS[stageCode] || [stageCode];
      labels.forEach((label, li) => {
        const match = findMatchedDeliverable(label, stageCode, deliverables);
        columns.push({
          label, stageCode, gate: g, gateIdx: gi, stageStart: li === 0, stageEnd: li === labels.length - 1,
          matchedDeliv: match ? match.deliv : null, matchedIdx: match ? match.idx : -1,
          // A checkpoint literally named after its own gate (VV's sole "VV" checkpoint) is a
          // placeholder, not a real milestone name — its cell shows "-" instead of repeating
          // the gate code. Every other checkpoint keeps its fixed label as-is, matched or not.
          isSelfPlaceholder: normText(label) === normText(stageCode),
        });
      });
    });
    // Trailing SOP column — a real project-level milestone date (targetSOP/forecastSOP, already
    // shown elsewhere on this same Snapshot tab), not a 7th process gate — this app's data model
    // only has the 6 real gates above, so no gate instance is invented for it. It has no
    // deliverable to match against, so it keeps using the project-level gate.target/actual/outlook.
    columns.push({
      label: "SOP", stageCode: "SOP", gateIdx: -1, stageStart: true, stageEnd: true,
      gate: { target: detail.sopDate || "-", actual: "-", outlook: detail.targetLaunch || detail.sopDate || "-", status: "" },
      matchedDeliv: null, matchedIdx: -1,
    });
    // Left/width percentage for every column, against the SAME total denominator — the single
    // basis every row (GATES ribbon, MILESTONES cells, date chips) positions itself against, so
    // nothing can drift out of alignment with anything else regardless of child count.
    const total = columns.length;
    columns.forEach((c, i) => { c.leftPct = (i / total) * 100; c.widthPct = (1 / total) * 100; });
    return columns;
  }

  // Groups the flat column list back into per-stage spans (for the GATES ribbon's merged cells)
  // — each span's left/width is the exact sum of its member columns', so a gate segment's right
  // edge always lands exactly where its last checkpoint's column ends, never short or long.
  function buildStageSpans(columns) {
    const spans = [];
    columns.forEach((c) => {
      const last = spans[spans.length - 1];
      if (last && last.stageCode === c.stageCode) { last.count += 1; last.widthPct += c.widthPct; }
      else spans.push({ stageCode: c.stageCode, count: 1, leftPct: c.leftPct, widthPct: c.widthPct });
    });
    return spans;
  }

  // Horizontal center of column i as a percentage of the shared track width — used only by the
  // live "we are here" pulse (still centered over the current gate's own milestone).
  function colCenterPct(i, total) { return ((i + 0.5) / total) * 100; }

  // Right edge of a gate's own span (leftPct + widthPct) as a percentage of the shared track
  // width — the single anchor the Timeline row's circles, its connecting line, and the end-date
  // chip all now share, so a gate's progress marker always sits exactly at that gate's real
  // boundary instead of the center of its last checkpoint column.
  function stageRightPct(spans, stageCode) {
    const s = spans.find((sp) => sp.stageCode === stageCode);
    return s ? s.leftPct + s.widthPct : 0;
  }

  // Timeline connecting line, split into up to 3 real-progress zones instead of one flat
  // color: solid dark blue through every completed gate, a dashed mid-blue stretch toward the
  // gate currently In Progress, and a pale future-blue tail beyond it. Falls back to a single
  // pale line when nothing has started, or a single solid line when everything has. Zone
  // boundaries land exactly on each gate's own right edge, matching where its circle now sits.
  function buildTimelineLineSegments(columns, spans) {
    let donePct = 0;
    let currentPct = -1;
    spans.forEach((s) => {
      const col = columns.find((c) => c.stageCode === s.stageCode);
      const g = col && col.gate;
      if (!col || col.gateIdx < 0 || !g) return;
      const rightPct = stageRightPct(spans, s.stageCode);
      if (COMPLETED_STATUSES.has(g.status)) donePct = rightPct;
      if (g.status === "In Progress") currentPct = rightPct;
    });
    const segs = [];
    if (currentPct >= 0) {
      if (donePct > 0) segs.push({ left: 0, width: donePct, color: "#3D79EE" });
      segs.push({ left: donePct, width: Math.max(0, currentPct - donePct), color: "#60A5FA", dashed: true });
      if (currentPct < 100) segs.push({ left: currentPct, width: 100 - currentPct, color: "#CDDAEF" });
    } else if (donePct > 0) {
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

    // Absolutely positioned against the shared leftPct/widthPct basis (not flex+gap) — a flex
    // row with `gap` divides its gap overhead differently depending on how many siblings it has,
    // which is exactly what silently drifted the GATES ribbon out of alignment with the
    // MILESTONES row below it (they have different child counts: ~7 gate segments vs 18
    // checkpoints). Percent-of-the-same-total positioning can't drift, by construction.
    const gatesHtml = spans.map((s) => {
      const c = STAGE_COLOR[s.stageCode] || STAGE_COLOR.SOP;
      return `<div class="ptl-gateseg" style="left:${s.leftPct}%;width:calc(${s.widthPct}% - 2px);background:${c.bg};color:${c.fg}">${esc(s.stageCode.toUpperCase())}</div>`;
    }).join("");

    const msCellsHtml = columns.map((c) => {
      // The cell always shows the fixed, short checkpoint label — matching a real deliverable
      // only decides which dates populate the rows below, it never swaps in the deliverable's
      // (often much longer) full name here. The one exception is a checkpoint literally named
      // after its own gate (VV's sole "VV" checkpoint), which reads as "-" instead.
      const label = c.isSelfPlaceholder ? "-" : c.label;
      const title = c.matchedDeliv ? `${esc(c.label)} — ${esc(c.matchedDeliv.name)}` : esc(c.label);
      return `<div class="ptl-mscell" style="left:${c.leftPct}%;width:calc(${c.widthPct}% - 2px)" title="${title}">${esc(label)}</div>`;
    }).join("");

    // A gate has "started" once it's In Progress or finished (any of the 4 completed-family
    // statuses) — Pending (not reached yet) and Skipped (never runs) show no start chip. Anchored
    // to the gate's own LEFT edge (its span's leftPct, same basis the ribbon/milestone cells use)
    // so it sits exactly at the gate's start boundary, not the center of its first checkpoint.
    const startChipsHtml = spans.map((s) => {
      const col = columns.find((c) => c.stageCode === s.stageCode);
      const g = col && col.gate;
      if (!col || col.gateIdx < 0 || !g) return "";
      const started = g.status !== "Pending" && g.status !== "Skipped" && g.plannedStart && g.plannedStart !== "-";
      if (!started) return "";
      return `<div class="ptl-chip ptl-chip-start" style="left:${s.leftPct}%" title="${esc(s.stageCode)} started ${esc(g.plannedStart)}">
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

  // ── "Continue with this gate" confirm — the reverse of openSkipConfirm above, offered on a
  // Skipped gate's own circle so a gate that was skipped by mistake (or is applicable after all)
  // can go back into the normal process instead of staying permanently excluded. Same popover/
  // reload mechanics as skip, calling unskipGate (assets/js/data/gate-skip.js) instead. ──
  function openUnskipConfirm(anchorEl, projectCode, gateCode, gateName) {
    if (!global.PDPopover) return;
    const html = `
      <div class="pd-skip-confirm">
        <h4>Continue with ${esc(gateName)} gate?</h4>
        <p>This gate will re-enter the normal process — its deliverables, checklist, and approval will count toward progress and compliance again.</p>
        <div class="pd-skip-actions">
          <button type="button" class="pd-skip-cancel">Cancel</button>
          <button type="button" class="pd-skip-confirm-btn pd-unskip-confirm-btn">Yes, continue this gate</button>
        </div>
      </div>`;
    const pop = global.PDPopover.open(anchorEl, html, 'pd-skip-popover');
    pop.querySelector('.pd-skip-cancel').addEventListener('click', () => global.PDPopover.close());
    pop.querySelector('.pd-unskip-confirm-btn').addEventListener('click', () => {
      if (typeof unskipGate === 'function') unskipGate(projectCode, gateCode);
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

  // A gate reads as "current or completed" for the Actual-Date-visibility rule below — Pending
  // (not reached) and Skipped never show an actual date, matching the fact one was never recorded.
  function isCurrentOrCompleted(gate) {
    return !!gate && (gate.status === "In Progress" || COMPLETED_STATUSES.has(gate.status));
  }

  // ── Values table: Planned Date / Timeline (gate circles + skip click) / Actual Date /
  // Outlook (editable) / Velocity-Delay rows, plus the floating "end date" chips (teal) at
  // each gate's own right boundary. ──
  function renderTimelineTable(el, detail) {
    const columns = buildColumns(detail);
    const spans = buildStageSpans(columns);
    const total = columns.length;
    const currentRole = (typeof getCurrentRole === "function") ? getCurrentRole() : (sessionStorage.getItem("snpdRole") || "");
    const canSkip = currentRole === "SA" || currentRole === "PMO";

    // Planned Date — "mandatory": always attempted whenever a real deliverable is matched,
    // independent of gate status (unlike Actual Date below). Sourced from the matched
    // deliverable's own planned end date; the SOP column keeps its project-level target date.
    const plannedRow = (() => {
      const cells = columns.map((c) => {
        const val = c.gateIdx === -1 ? c.gate.target : (c.matchedDeliv ? c.matchedDeliv.plannedEndDate : null);
        return `<div class="ptl-datacell" style="left:${c.leftPct}%;width:${c.widthPct}%">${esc(val && val !== "-" ? val : "-")}</div>`;
      }).join("");
      return `<div class="ptl-row">
        <div class="ptl-label ptl-label-blue">Planned Date</div>
        <div class="ptl-track ptl-datatrack">${cells}</div>
      </div>`;
    })();

    // Actual Date (renamed from "Approved Date") — only shown once the gate itself is current
    // or completed; a future/pending gate's matched deliverable may carry no real actual yet.
    const actualRow = (() => {
      const cells = columns.map((c) => {
        const val = c.gateIdx === -1
          ? c.gate.actual
          : (c.matchedDeliv && isCurrentOrCompleted(c.gate) ? c.matchedDeliv.actualDate : null);
        return `<div class="ptl-datacell" style="left:${c.leftPct}%;width:${c.widthPct}%">${esc(val && val !== "-" ? val : "-")}</div>`;
      }).join("");
      return `<div class="ptl-row">
        <div class="ptl-label ptl-label-green">Actual Date</div>
        <div class="ptl-track ptl-datatrack">${cells}</div>
      </div>`;
    })();

    // Outlook — the ONLY editable row in this table. Shows a plain "-" (or the real date, if
    // already set) by default, same as every other blank cell on this page — it only turns into
    // an actual date input, calendar icon and all, once clicked, and only where a real
    // deliverable is matched (nothing to edit otherwise, so those stay inert). Editing saves
    // through the exact same window.PDWorkspace.updateAssignmentFields + mapAssignmentToDisplay
    // pipeline the Deliverables tab's own Outlook input uses, so both views can never disagree,
    // then live-refreshes both this tab and (if already rendered) the Deliverables tab.
    const outlookRow = (() => {
      const cells = columns.map((c) => {
        if (c.gateIdx === -1) {
          const val = c.gate.outlook;
          return `<div class="ptl-datacell" style="left:${c.leftPct}%;width:${c.widthPct}%">${esc(val && val !== "-" ? val : "-")}</div>`;
        }
        if (!c.matchedDeliv) return `<div class="ptl-datacell" style="left:${c.leftPct}%;width:${c.widthPct}%">-</div>`;
        const hasVal = c.matchedDeliv.outlookDate && c.matchedDeliv.outlookDate !== "-";
        const displayText = hasVal ? c.matchedDeliv.outlookDate : "-";
        // Outlook is a forward-looking "expected completion" estimate — once its gate is
        // Completed there's nothing left to revise, so it's locked read-only regardless of role.
        if (COMPLETED_STATUSES.has(c.gate.status)) {
          return `<div class="ptl-datacell" style="left:${c.leftPct}%;width:${c.widthPct}%">${esc(displayText)}</div>`;
        }
        const iso = hasVal ? (displayToISO(c.matchedDeliv.outlookDate) || "") : "";
        return `<div class="ptl-datacell ptl-outlook-cell" style="left:${c.leftPct}%;width:${c.widthPct}%"
          data-assignment-id="${esc(c.matchedDeliv.assignmentId)}" data-gate-idx="${c.gateIdx}" data-deliv-idx="${c.matchedIdx}" data-iso="${esc(iso)}"
          title="Click to edit outlook date">${esc(displayText)}</div>`;
      }).join("");
      return `<div class="ptl-row">
        <div class="ptl-label ptl-label-orange">Outlook</div>
        <div class="ptl-track ptl-datatrack">${cells}</div>
      </div>`;
    })();

    // Timeline row: connecting line + one circle per real gate, each anchored to that gate's own
    // right boundary (matching the ribbon/end-chip above it) — colored by real status, the sole
    // progress indicator in the whole component.
    const lineHtml = buildTimelineLineSegments(columns, spans).map((s) =>
      `<div class="ptl-timeline-seg${s.dashed ? " ptl-timeline-seg-dashed" : ""}" style="left:${s.left}%;width:${s.width}%;border-color:${s.color}"></div>`
    ).join("");

    const circlesHtml = columns.filter((c) => c.stageEnd && c.gate && c.gateIdx >= 0).map((c) => {
      const g = c.gate;
      const left = stageRightPct(spans, c.stageCode);
      const skippable = canSkip && g.status === "Pending";
      const unskippable = canSkip && g.status === "Skipped";
      const cls = ["ptl-gatecircle", statusClass(g.status), (skippable || unskippable) ? "ptl-gatecircle-skippable" : ""].filter(Boolean).join(" ");
      const attrs = skippable ? ` data-skip-gate="${esc(g.stage)}" data-skip-name="${esc(g.name || g.stage)}"`
        : unskippable ? ` data-unskip-gate="${esc(g.stage)}" data-unskip-name="${esc(g.name || g.stage)}"` : "";
      const title = skippable ? "Click to skip this gate" : unskippable ? "Click to continue with this gate" : `${esc(g.id)} · ${esc(g.status)}`;
      // A Skipped gate gets a slash icon instead of its "G_" label — relying on color alone
      // (slate vs. the very-similar light-gray Pending fill) isn't a reliable enough signal.
      const inner = g.status === "Skipped"
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="6" y1="18" x2="18" y2="6"/></svg>'
        : esc(g.id);
      return `<div class="${cls}" style="left:${left}%" title="${title}"${attrs}>${inner}</div>`;
    }).join("");

    // End date chip — anchored to the gate's own RIGHT boundary (span leftPct + widthPct), not
    // the center of its last checkpoint column — "the end date should always be positioned
    // exactly at the end boundary of the gate."
    const endChipsHtml = spans.map((s) => {
      const g = (columns.find((c) => c.stageCode === s.stageCode) || {}).gate;
      if (!g || !COMPLETED_STATUSES.has(g.status) || !g.actual || g.actual === "-") return "";
      const right = stageRightPct(spans, s.stageCode);
      return `<div class="ptl-chip ptl-chip-end" style="left:${right}%" title="${esc(s.stageCode)} completed ${esc(g.actual)}">
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
        ${columns.map((c) => { const v = velocityCell(c); return `<div class="ptl-datacell" style="left:${c.leftPct}%;width:${c.widthPct}%;color:${v.color};font-weight:var(--fw-600)">${esc(v.text)}</div>`; }).join("")}
      </div>
    </div>`;

    const endChipsRow = `<div class="ptl-row ptl-row-endchips">
      <div class="ptl-label"></div>
      <div class="ptl-track">${endChipsHtml}</div>
    </div>`;

    el.innerHTML = `
      <div class="ptl-values">
        ${plannedRow}
        ${timelineRow}
        ${actualRow}
        ${outlookRow}
        ${velocityRow}
        ${endChipsRow}
      </div>`;

    if (canSkip) {
      el.querySelectorAll('[data-skip-gate]').forEach((node) => {
        node.addEventListener('click', () => {
          openSkipConfirm(node, detail.projectCode, node.dataset.skipGate, node.dataset.skipName, currentRole);
        });
      });
      el.querySelectorAll('[data-unskip-gate]').forEach((node) => {
        node.addEventListener('click', () => {
          openUnskipConfirm(node, detail.projectCode, node.dataset.unskipGate, node.dataset.unskipName);
        });
      });
    }

    // ── Outlook edit — the one editable row, click-to-reveal: the cell is plain "-"/date text
    // (no input chrome, no calendar icon) until clicked, at which point it becomes a real
    // <input type="date"> and opens the native picker. Persists through the real workspace
    // bridge (same one the Deliverables tab uses), updates this project's shared in-memory
    // deliverable record in place so BOTH tabs read the fresh value from then on, then
    // live-refreshes this tab and (if the Deliverables tab has already rendered once) that
    // tab too — no page reload needed. ──
    function saveOutlook(assignmentId, gateIdx, delivIdx, newValue) {
      const bridge = global.PDWorkspace;
      if (!bridge) return;
      const currentRole2 = (typeof getCurrentRole === "function") ? getCurrentRole() : (sessionStorage.getItem("snpdRole") || "");
      const actorName = (typeof roleDirectory !== "undefined" && roleDirectory[currentRole2]) ? roleDirectory[currentRole2].name : (currentRole2 || "User");
      const actorRoleBiz = (typeof currentBusinessRole === "function") ? (currentBusinessRole() || currentRole2) : currentRole2;
      try {
        const freshRaw = bridge.updateAssignmentFields(assignmentId, { outlookDate: newValue || null }, actorName, actorRoleBiz);
        const freshDisplay = (typeof global.mapAssignmentToDisplay === "function") ? global.mapAssignmentToDisplay(freshRaw) : null;
        if (freshDisplay && detail.gateDetails && detail.gateDetails[gateIdx] && detail.gateDetails[gateIdx].deliverables[delivIdx]) {
          detail.gateDetails[gateIdx].deliverables[delivIdx] = freshDisplay;
        }
        renderTimelineTable(el, detail);
        if (typeof global.PDRenderDeliverables === "function") global.PDRenderDeliverables(detail);
      } catch (e) {
        if (typeof global.PDShowToast === "function") global.PDShowToast("Could not save outlook date: " + e.message, "error");
      }
    }
    el.querySelectorAll('.ptl-outlook-cell').forEach((cell) => {
      cell.addEventListener('click', () => {
        const { assignmentId, gateIdx, delivIdx, iso } = cell.dataset;
        cell.innerHTML = `<input type="date" class="ptl-outlook-input" value="${esc(iso)}">`;
        cell.title = "";
        const input = cell.querySelector('input');
        input.focus();
        try { input.showPicker && input.showPicker(); } catch (e) { /* not supported — the input is still focused and usable */ }
        let committed = false;
        input.addEventListener('change', () => {
          committed = true;
          saveOutlook(assignmentId, parseInt(gateIdx, 10), parseInt(delivIdx, 10), input.value);
        });
        input.addEventListener('blur', () => {
          // No change made — just exit edit mode back to the plain "-"/date display, no save.
          if (!committed) renderTimelineTable(el, detail);
        });
      });
    });
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
        <span class="tl-vel"><i class="st-skipped"></i>Skipped</span>
      </div>`;
  }

  global.PDTimeline = { renderStageGate, renderTimelineTable, renderTimelineLegend, statusClass };
})(window);
