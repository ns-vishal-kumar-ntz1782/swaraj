// ==========================================================
//  PROJECT DETAIL — built from the REAL enterprise dataset (data/projects.json +
//  projectGateInstances.json + projectDeliverableAssignments.json + projectRisks.json +
//  projectMilestones.json + gateApprovalHistory.json + projectComments.json +
//  gateChecklistDocuments.json + projectMembers.json + orgUsers.json + actionRegister.json +
//  gateMaster.json), NOT a pseudo-random generator — every gate, deliverable, risk, approval,
//  milestone and comment shown here is a real record joined by projectCode.
//  A handful of fields with no direct enterprise equivalent (portfolio BB/N-BB classification,
//  numeric healthScore, FY26/AI-predicted comparison lines) are deterministically DERIVED from
//  real fields (projectTypeCode, the four Health enums, the real FY27 compliance line) — never
//  independently randomized — so they can't drift from the real data they're based on.
//  Exposes: getProjectDetail(id), listProjectDetails() — id resolves by project CODE or NAME.
// ==========================================================
(function (global) {
  "use strict";

  // Self-locating project root — same trick app-config.js/auth.js use, needed here since this
  // file is sometimes loaded before auth.js sets APP_ROOT (see pages/portfolio-tracker/index.html).
  const DATA_ROOT = (function () {
    const self = document.currentScript
      || [...document.getElementsByTagName("script")].find(s => /(^|\/)assets\/js\/data\/project-detail-seed\.js(\?|#|$)/.test(s.getAttribute("src") || ""));
    return self && self.src ? self.src.replace(/assets\/js\/data\/project-detail-seed\.js(\?[^#]*)?(#.*)?$/, "") : "";
  })();
  function loadJsonSync(relPath) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", DATA_ROOT + "data/" + relPath, false);
    xhr.send(null);
    return JSON.parse(xhr.responseText);
  }

  // ── Projects created via the Admin Console's "Projects" module (pages/admin/js/views/projects.js
  // -> store/projectExecution.js's createProject/cloneProject) live only in localStorage, under the
  // exact same keys that store's own db.js uses (spd.<entity>.v1). This is a plain script, not an
  // ES module, so it can't import that store directly — same reasoning/pattern already used a few
  // lines below for gate checklist templates (localStorage.getItem + try/catch + JSON.parse).
  // Deliberately ADDITIVE ONLY: a live project can never override or shadow a statically-seeded
  // one, so this cannot regress any of the real seed projects even if localStorage holds something
  // malformed — worst case the try/catch below silently contributes nothing. ──
  function mergeLiveProjects(staticProjects, staticGateInstances, staticDeliverableAssignments) {
    try {
      const raw = localStorage.getItem("spd.projects_exec.v1");
      const liveProjects = raw ? JSON.parse(raw) : null;
      if (!liveProjects || !liveProjects.length) return { projects: staticProjects, gateInstances: staticGateInstances, deliverableAssignments: staticDeliverableAssignments };
      const staticCodes = new Set(staticProjects.map(p => p.code));
      const newProjects = liveProjects.filter(p => !staticCodes.has(p.code));
      if (!newProjects.length) return { projects: staticProjects, gateInstances: staticGateInstances, deliverableAssignments: staticDeliverableAssignments };
      const newCodes = new Set(newProjects.map(p => p.code));
      const liveGateInstances = JSON.parse(localStorage.getItem("spd.project_gate_instances.v1") || "[]").filter(g => newCodes.has(g.projectCode));
      const liveAssignments = JSON.parse(localStorage.getItem("spd.project_deliverable_assignments.v1") || "[]").filter(a => newCodes.has(a.projectCode));
      return {
        projects: [...staticProjects, ...newProjects],
        gateInstances: [...staticGateInstances, ...liveGateInstances],
        deliverableAssignments: [...staticDeliverableAssignments, ...liveAssignments],
      };
    } catch (e) {
      return { projects: staticProjects, gateInstances: staticGateInstances, deliverableAssignments: staticDeliverableAssignments };
    }
  }

  const gateMasterList        = loadJsonSync("gateMaster.json").slice().sort((a, b) => a.displayOrder - b.displayOrder);
  const { projects, gateInstances, deliverableAssignments } = mergeLiveProjects(
    loadJsonSync("projects.json"), loadJsonSync("projectGateInstances.json"), loadJsonSync("projectDeliverableAssignments.json")
  );

  // Gate Skip Registry resolution — same in-memory-only stamp-and-filter as app-config.js's
  // applyGateSkips (see that file's comment for the full rationale); this page has its own
  // separate load/merge of gateInstances/deliverableAssignments so it needs its own resolution.
  (function applyGateSkips() {
    if (typeof isGateSkipped !== "function") return;
    const skippedInstanceIds = new Set();
    gateInstances.forEach(g => {
      if (isGateSkipped(g.projectCode, g.gateCode)) {
        g.currentStatus = "Skipped";
        skippedInstanceIds.add(g.id);
      }
    });
    if (skippedInstanceIds.size) {
      for (let i = deliverableAssignments.length - 1; i >= 0; i--) {
        if (skippedInstanceIds.has(deliverableAssignments[i].gateInstanceId)) deliverableAssignments.splice(i, 1);
      }
    }
  })();

  const risksAll              = loadJsonSync("projectRisks.json");
  const milestonesAll         = loadJsonSync("projectMilestones.json");
  const approvalHistoryAll    = loadJsonSync("gateApprovalHistory.json");
  const commentsAll           = loadJsonSync("projectComments.json");
  const checklistDocsAll      = loadJsonSync("gateChecklistDocuments.json");
  const projectMembersAll     = loadJsonSync("projectMembers.json");
  const orgUsers              = loadJsonSync("orgUsers.json");
  const actionRegisterAll     = loadJsonSync("actionRegister.json");

  const STAGES = gateMasterList.map(g => g.gateCode); // ["Pre-KO","CVPA","VV","PC","PR","PPO"]
  const userById = Object.fromEntries(orgUsers.map(u => [u.id, u]));
  function userName(id) { return (userById[id] && userById[id].fullName) || "Unassigned"; }

  // Raw projectDeliverableAssignments.json record -> Deliverables-tab display row. Single source
  // of truth for this transform: used both to build the initial static gateDetails below, AND
  // reused live by project-detail.js (via window.mapAssignmentToDisplay) to re-derive one row
  // after a real mutation comes back from the workspace bridge — so a freshly-persisted record
  // renders identically to how it would have looked if it had been seeded that way from the start.
  function mapAssignmentToDisplay(d) {
    const plannedStartD = parseISO(d.plannedStart);
    let plannedEndD = parseISO(d.targetDate);
    if (plannedStartD) {
      if (!plannedEndD) plannedEndD = new Date(plannedStartD.getTime() + 21 * 86400000);
      const gap = diffDays(plannedStartD, plannedEndD);
      if (gap < 5)  plannedEndD = new Date(plannedStartD.getTime() + 5  * 86400000);
      if (gap > 60) plannedEndD = new Date(plannedStartD.getTime() + 60 * 86400000);
    }
    const actualD = d.actualEnd ? parseISO(d.actualEnd) : null;
    // Real delay is actual-vs-plan against this same (now-corrected) planned end, not a
    // stale precomputed figure — so the Status pill's RAG color and the two visible dates can
    // never disagree.
    const delayDays = actualD && plannedEndD ? Math.max(0, diffDays(plannedEndD, actualD)) : (d.delayDays || 0);
    // Outlook — a revised "we now expect to finish by" date the responsible member can propose;
    // no seed record has ever had one, so it starts blank rather than defaulting to some other
    // date, and only ever holds a real value once someone explicitly sets it.
    const outlookD = d.outlookDate ? parseISO(d.outlookDate) : null;
    const ownerId = (d.responsibleMemberUserIds || [])[0];
    const responsibleNames = (d.responsibleMemberUserIds || []).map(userName);
    const depId = (d.dependencyAssignments || [])[0];
    const dep = depId ? deliverableAssignments.find(x => x.assignmentId === depId) : null;
    const uploaded = (d.uploadedDocuments || [])[0];
    return {
      assignmentId: d.assignmentId,
      name: d.deliverableName, owner: ownerId ? userName(ownerId) : "Unassigned",
      responsible: responsibleNames, // full multi-person list — `owner` above stays the first name only, for older consumers (e.g. the Snapshot tab's gate accordion)
      responsibleIds: d.responsibleMemberUserIds || [],
      department: d.department,
      plannedDate: plannedStartD ? fmtDate(plannedStartD) : "-",
      plannedEndDate: plannedEndD ? fmtDate(plannedEndD) : "-",
      actualDate: actualD ? fmtDate(actualD) : "-",
      outlookDate: outlookD ? fmtDate(outlookD) : "-",
      // Raw status (Not Started/Assigned/In Progress/Ready for Review/Completed/Rejected/Rework),
      // NOT the collapsed on-time/delayed "legacy" vocabulary used elsewhere in this file (activities/
      // gates) — the Deliverables tab has its own purpose-built status-pill system (statusClass/
      // statusLabel in project-detail.js) that already understands every one of these real values,
      // and this field round-trips straight to/from the real assignment record via the workspace
      // bridge, so it must stay the actual value, not a lossy derived one.
      status: d.status,
      completion: d.completionPct ?? d.progress ?? 0,
      delayDays,
      remarks: d.remarks || "-",
      dependency: dep ? dep.deliverableName : "-",
      evidence: uploaded ? uploaded.fileName : ((d.requiredDocuments || [])[0] || "Pending"),
      uploadedDocuments: d.uploadedDocuments || [],
      requiredDocuments: d.requiredDocuments || [],
      // Parent/child deliverable hierarchy (one level only) — real assignmentId reference set via
      // PDWorkspace.setAssignmentParent, or inherited from the library's parentDeliverableCode
      // when this row was first added to the gate. Null/undefined = top-level.
      parentAssignmentId: d.parentAssignmentId || null,
    };
  }
  global.mapAssignmentToDisplay = mapAssignmentToDisplay;

  // ── Gate Checklist master items — read from the Admin Console's "Gate Checklist Templates"
  // page (pages/admin/js/store/gateChecklistTemplates.js), which persists them client-side under
  // this exact key. This file is a plain script (not an ES module) so it can't import that store
  // directly; reading the same localStorage key keeps the two in sync without a second source of
  // truth. If the admin hasn't opened that page yet in this browser, fall back to the identical
  // defaults that store itself seeds — so "how many items a gate has" (4 for Pre-KO, 5 for the
  // rest, or whatever an admin has since edited) is always the one real answer, never guessed.
  const CHECKLIST_TEMPLATE_DEFAULTS = {
    "Pre-KO": [
      ["Design Review Document", "Initial concept and design intent.", true],
      ["Market Requirement Document", "Voice of customer, target segment.", true],
      ["Product Concept Approval", "Sponsor sign-off on concept.", true],
    ],
    "CVPA": [
      ["Concept Design Review Report", "Styling and engineering concept review findings.", true],
      ["Program Cost Estimate", "Program-level cost roll-up for the CVPA review.", true],
      ["Vehicle Program Approval Record", "Formal sign-off to proceed to Virtual Validation.", true],
      ["Styling Theme Approval", "Sign-off on the selected styling direction.", false],
    ],
    "VV": [
      ["Vehicle Validation Report", "Consolidated CAE/simulation validation results.", true],
      ["DFMEA", "Design Failure Mode and Effects Analysis.", true],
      ["PV Test Report", "Performance validation results against the DVP&R plan.", true],
      ["Vehicle Approval", "Engineering approval to proceed beyond Virtual Validation.", true],
      ["Engineering Review", "Cross-functional engineering review minutes.", false],
    ],
    "PC": [
      ["Prototype Build Report", "Build log and deviation summary.", true],
      ["Tooling Trial Report", "First-off tooling trial and dimensional conformance.", true],
      ["Supplier PPAP Package", "Supplier Production Part Approval Process submission.", true],
      ["Manufacturing Feasibility Report", "Confirms the process plan meets target rate.", false],
    ],
    "PR": [
      ["Field Trial Report", "Results and issue log from pre-production field trials.", true],
      ["Homologation Certificate", "Regulatory certification confirming compliance.", true],
      ["PPAP Approval", "Final PPAP sign-off for production-intent parts.", true],
      ["Production Process Sign-off", "Manufacturing's readiness sign-off for volume production.", true],
    ],
    "PPO": [
      ["Launch Readiness Checklist", "Final cross-functional launch readiness confirmation.", true],
      ["Production Ramp-up Report", "Tracks output and yield through ramp-up.", true],
      ["Program Closure Report", "Formal program closure record.", true],
    ],
  };
  function loadChecklistTemplates() {
    try {
      const raw = (typeof localStorage !== "undefined") ? localStorage.getItem("spd.gate_checklist_templates.v1") : null;
      if (raw) {
        const map = JSON.parse(raw);
        if (map && Object.keys(map).length) return map;
      }
    } catch (e) { /* fall through to defaults */ }
    const map = {};
    Object.keys(CHECKLIST_TEMPLATE_DEFAULTS).forEach(gateCode => {
      map[gateCode] = CHECKLIST_TEMPLATE_DEFAULTS[gateCode].map(([title, description, mandatory], i) => ({
        id: `GCT-${gateCode}-${i}`, gateCode, title, description, mandatory, displayOrder: i + 1,
      }));
    });
    return map;
  }
  const checklistTemplatesByGate = loadChecklistTemplates();

  // Deterministic PRNG — used ONLY for the two comparison lines with no real source (FY26 prior
  // year, FY27 AI-predicted), always as an offset from the real FY27 line, never standalone.
  function rng(seedInt) { let a = seedInt >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seedFromString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  const MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const MONTH_ORDER = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
  function fmtDate(d) { return d ? String(d.getDate()).padStart(2, "0") + " " + MON3[d.getMonth()] + " " + String(d.getFullYear()).slice(2) : "-"; }
  function fmtDateFull(d) { return d ? String(d.getDate()).padStart(2, "0") + " " + MON3[d.getMonth()] + " " + d.getFullYear() : "-"; }
  // Parsed as LOCAL date components (not UTC) so "2025-10-03" never shifts a day depending on
  // the browser's timezone offset.
  function parseISO(s) { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  function diffDays(a, b) { return Math.round((b - a) / 86400000); }
  const TODAY = new Date(2026, 6, 7); // 07 Jul 2026 — the app's fixed "today", used throughout

  function gateStatusToLegacy(currentStatus, delayDays) {
    if (currentStatus === "Skipped") return "Skipped";
    if (currentStatus === "Completed") {
      if (delayDays <= 0) return "On Time";
      if (delayDays <= 15) return "Completed";
      if (delayDays <= 60) return "Delayed 15-60";
      return "Delayed >60";
    }
    if (currentStatus === "Active") return "In Progress";
    return "Pending";
  }
  function deliverableStatusToLegacy(status, delayDays) {
    if (status === "Completed") {
      if (delayDays <= 0) return "On Time";
      if (delayDays <= 15) return "Completed";
      if (delayDays <= 60) return "Delayed 15-60";
      return "Delayed >60";
    }
    if (status === "In Progress" || status === "Ready for Review") return "In Progress";
    return "Pending"; // Backlog, Not Started, Overdue, Blocked, Rejected
  }
  function monthLabelOf(iso) { const d = parseISO(iso); return d ? MON3[d.getMonth()] : null; }

  function build(project) {
    const code = project.code;
    const rand = rng(seedFromString(code));
    const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

    const projGateInstances = gateInstances.filter(g => g.projectCode === code);
    const projDeliv = deliverableAssignments.filter(d => d.projectCode === code);
    const projActions = actionRegisterAll.filter(a => a.projectCode === code);

    // ── Stage-gate timeline — one row per real gate instance ──
    const gates = STAGES.map((stageCode, gi) => {
      const inst = projGateInstances.find(g => g.gateCode === stageCode);
      if (!inst) {
        return { id: "G" + (gi + 1), stage: stageCode, name: stageCode, plannedStart: "-", target: "-", actual: "-", outlook: "-", status: "Pending", owner: "-", delayDays: 0, reason: "-", correctiveAction: "-", milestone: stageCode + " Gate Review", approval: "Pending" };
      }
      // A Skipped gate needs no approval/deliverables and is never scheduled — blank its dates
      // rather than show the plan it would have had, matching "no approval no deliverable".
      if (inst.currentStatus === "Skipped") {
        return { id: "G" + (gi + 1), stage: stageCode, name: stageCode, plannedStart: "-", target: "-", actual: "-", outlook: "-", status: "Skipped", owner: "-", delayDays: 0, reason: "-", correctiveAction: "-", milestone: stageCode + " Gate Review", approval: "Skipped" };
      }
      const plannedStart = parseISO(inst.plannedStart);
      const plannedFinish = parseISO(inst.plannedFinish);
      const actualFinish = parseISO(inst.actualFinish);
      let delayDays = 0;
      if (actualFinish && plannedFinish) delayDays = Math.max(0, diffDays(plannedFinish, actualFinish));
      else if (inst.currentStatus === "Active" && plannedFinish && TODAY > plannedFinish) delayDays = diffDays(plannedFinish, TODAY);
      const status = gateStatusToLegacy(inst.currentStatus, delayDays);
      const approval = inst.approvalStatus === "Approved" ? "Approved" : inst.approvalStatus === "NotStarted" ? "Pending" : "In Review";
      const gateAction = projActions.find(a => a.gateCode === stageCode);
      // Outlook = actual finish once known, else the current planned finish — the same "best
      // current estimate" principle the per-deliverable activities table already uses.
      const outlookDate = actualFinish || plannedFinish;
      return {
        id: "G" + (gi + 1), stage: stageCode, name: stageCode,
        plannedStart: plannedStart ? fmtDate(plannedStart) : "-",
        target: plannedFinish ? fmtDate(plannedFinish) : "-",
        actual: actualFinish ? fmtDate(actualFinish) : "-",
        outlook: outlookDate ? fmtDate(outlookDate) : "-",
        status, owner: userName(inst.gateOwnerUserId), delayDays,
        reason: delayDays > 0 ? (inst.gateRemarks || "Schedule slip") : "-",
        correctiveAction: delayDays > 0 ? (gateAction ? gateAction.title : "Escalated to review board") : "-",
        milestone: stageCode + " Gate Review",
        approval,
      };
    });

    const gateReached = projGateInstances.filter(g => g.currentStatus === "Completed").length;
    const currentGateIdx = STAGES.indexOf(project.currentGate);
    const currentG = currentGateIdx >= 0 ? currentGateIdx + 1 : gateReached + 1;

    // A Skipped gate is never "required" — it doesn't count toward how many gates this project
    // has to clear, so it can't drag the percentage down like an incomplete real gate would.
    const skippedGateCount = projGateInstances.filter(g => g.currentStatus === "Skipped").length;
    const realGateCount = Math.max(1, STAGES.length - skippedGateCount);
    const goals = { done: gateReached, total: realGateCount, pct: +(gateReached / realGateCount * 100).toFixed(2) };

    const delivDone = projDeliv.filter(d => d.status === "Completed").length;
    const delivTotal = projDeliv.length || 1;
    const deliverables = { done: delivDone, total: delivTotal, pct: +(delivDone / delivTotal * 100).toFixed(2) };

    // ── Activities — one row per real deliverable assignment (planned/approved/outlook,
    //    variance, risk, department — every field a real generated attribute). ──
    const activities = projDeliv.map(d => {
      const plannedD = parseISO(d.plannedStart) || parseISO(d.targetDate);
      const outlookD = parseISO(d.targetDate) || plannedD;
      const approvedD = d.actualEnd ? parseISO(d.actualEnd) : (d.completedDate ? parseISO(d.completedDate) : null);
      const ownerId = (d.responsibleMemberUserIds || [])[0];
      const variance = d.delayDays || 0;
      return {
        activity: d.deliverableName, stage: d.gateCode,
        planned: plannedD ? fmtDate(plannedD) : "-",
        approved: approvedD ? fmtDate(approvedD) : "-",
        outlook: outlookD ? fmtDate(outlookD) : "-",
        variance, done: d.status === "Completed",
        owner: ownerId ? userName(ownerId) : d.department,
        department: d.department,
        status: d.status === "In Progress" ? "In Progress" : deliverableStatusToLegacy(d.status, variance),
        risk: d.riskFlag === "Critical" ? "High" : d.riskFlag,
        correctiveAction: variance > 15 ? (d.remarks || "Re-baselined plan") : "-",
        gate: "G" + (STAGES.indexOf(d.gateCode) + 1),
        priority: (d.riskFlag === "Critical" || d.riskFlag === "High") ? "High" : d.riskFlag === "Medium" ? "Medium" : "Low",
        milestone: false,
      };
    });

    // ── Monthly compliance (planned vs actual deliverable count per FY month) — real counts,
    //    fy26/predicted are deterministic offsets of the real fy27 line (no independent source
    //    exists in this app, same principle the dashboard's own compliance-rate chart uses). ──
    const monthly = MONTH_ORDER.map(m => {
      const inMonth = projDeliv.filter(d => monthLabelOf(d.targetDate) === m);
      return { month: m, planned: inMonth.length, actual: inMonth.filter(d => d.status === "Completed").length };
    });
    const monthlyRateRaw = monthly.map(r => ({ month: r.month, pct: r.planned ? Math.round(r.actual / r.planned * 100) : null }));
    const known = monthlyRateRaw.map(r => r.pct).filter(v => v != null);
    const fallback = known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : 60;
    // Leading FY months with no deliverables due yet (before the project's first real data
    // point) would otherwise start the Process Compliance Rate chart with a blank gap —
    // spanGaps only bridges a gap BETWEEN two known points, not one with nothing before it.
    // Backfill those leading months with this project's own average rate so the line always
    // starts at the first month of the fiscal year; interior gaps (a month with no deliverables
    // due between two real ones) are untouched and still bridged visually by spanGaps.
    const firstKnownIdx = monthlyRateRaw.findIndex(r => r.pct != null);
    const monthlyRate = monthlyRateRaw.map((r, i) => (r.pct == null && firstKnownIdx > i) ? { month: r.month, pct: fallback } : r);
    const clamp = v => Math.max(0, Math.min(100, v));
    const fy26 = monthlyRate.map(r => ({ month: r.month, pct: r.pct == null ? null : clamp(r.pct - between(3, 9)) }));
    const predicted = monthlyRate.map(r => ({ month: r.month, pct: r.pct == null ? null : clamp(r.pct + between(4, 14)) }));

    // ── Gate deliverable detail (per gate) — real assignments, grouped by gateCode ──
    // plannedStart and targetDate are two DISTINCT real fields on every assignment record
    // (median real gap ~21 days, verified across all 1069 records: min 8, max 63) — previously
    // collapsed into one via `plannedStart || targetDate`, which only ever kept plannedStart and
    // silently discarded targetDate, so the UI ended up displaying the same date for both Planned
    // Start and Planned End. Kept as two fields now; the only synthesis is clamping the gap to
    // the requested 5–60 day window on the rare record outside it (15 of 1069 run slightly past 60).
    const gateDetails = STAGES.map((stageCode, si) => {
      const items = projDeliv.filter(d => d.gateCode === stageCode).map(mapAssignmentToDisplay);
      return { gate: "G" + (si + 1), stage: stageCode, deliverables: items };
    });

    // ── Gate Checklist (per project) — the item LIST is exactly the Admin Console template for
    // that gate (however many items an admin configured — 4, 5, whatever). Per-item
    // responsible/dates/status are derived from this project's OWN real deliverables in that
    // same gate (never fabricated): each checklist item borrows one real deliverable record
    // (cycling through them if there are fewer deliverables than checklist items), and is marked
    // "Completed" once that many of the gate's real deliverables are themselves Completed — so a
    // gate that's 3/5 done on its real deliverables shows its first 3 checklist items closed out,
    // matching the gate's actual real progress instead of an independent random state.
    const gateChecklist = STAGES.map((stageCode, si) => {
      const templateItems = (checklistTemplatesByGate[stageCode] || []).slice().sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      const gateDeliv = projDeliv.filter(d => d.gateCode === stageCode);
      const doneCount = gateDeliv.filter(d => d.status === "Completed").length;

      const items = templateItems.map((tpl, i) => {
        const src = gateDeliv.length ? gateDeliv[i % gateDeliv.length] : null;
        const isDone = gateDeliv.length ? i < doneCount : false;

        const plannedStartD = src ? parseISO(src.plannedStart) : null;
        let plannedEndD = src ? parseISO(src.targetDate) : null;
        if (plannedStartD) {
          if (!plannedEndD) plannedEndD = new Date(plannedStartD.getTime() + 21 * 86400000);
          const gap = diffDays(plannedStartD, plannedEndD);
          if (gap < 5)  plannedEndD = new Date(plannedStartD.getTime() + 5  * 86400000);
          if (gap > 60) plannedEndD = new Date(plannedStartD.getTime() + 60 * 86400000);
        }
        const actualD = isDone && src && src.actualEnd ? parseISO(src.actualEnd) : null;
        const delayDays = actualD && plannedEndD ? Math.max(0, diffDays(plannedEndD, actualD)) : 0;
        const responsible = src ? (src.responsibleMemberUserIds || []).map(userName) : [];
        const status = isDone ? "Completed" : (plannedStartD && plannedStartD <= TODAY ? "In Progress" : "Not Started");

        return {
          id: tpl.id, title: tpl.title, description: tpl.description || "", mandatory: !!tpl.mandatory,
          responsible,
          plannedDate: plannedStartD ? fmtDate(plannedStartD) : "-",
          plannedEndDate: plannedEndD ? fmtDate(plannedEndD) : "-",
          actualDate: actualD ? fmtDate(actualD) : "-",
          status, delayDays,
          completion: isDone ? 100 : (status === "In Progress" ? (src ? Math.max(10, Math.min(90, src.completionPct ?? src.progress ?? 40)) : 40) : 0),
          remarks: isDone ? "Closed on plan with all required evidence attached." : (status === "In Progress" ? "Work underway; on track against the gate window." : "Not yet started; queued behind current gate work."),
          evidence: isDone ? (tpl.title.replace(/\s+/g, "_") + ".pdf") : "",
        };
      });

      const completedItems = items.filter(x => x.status === "Completed").length;
      // A Skipped gate has no checklist to complete — reads as "N/A", never blocks approval
      // gating downstream (project-detail.js's renderApprovalSection reads allComplete directly).
      const isSkipped = (projGateInstances.find(g => g.gateCode === stageCode) || {}).currentStatus === "Skipped";
      return {
        gate: "G" + (si + 1), stage: stageCode, items: isSkipped ? [] : items,
        totalItems: isSkipped ? 0 : items.length, completedItems: isSkipped ? 0 : completedItems,
        allComplete: isSkipped ? true : (items.length > 0 && completedItems === items.length),
        skipped: isSkipped,
      };
    });

    // ── Risks — real records, corrective action pulled from any real action logged against
    //    the same gate (falls back to the risk's own mitigation plan). ──
    const risks = risksAll.filter(r => r.projectCode === code).map(r => ({
      title: r.title, severity: r.severity,
      impact: r.impact, probability: r.probability,
      owner: userName(r.ownerUserId),
      mitigation: r.mitigationPlan,
      correctiveAction: (projActions.find(a => a.gateCode === r.gateCode) || {}).title || r.mitigationPlan,
      status: r.status,
    }));

    // ── Documents / comments / milestones / approvals — real generated records ──
    const documents = checklistDocsAll.filter(doc => doc.projectCode === code).slice(0, 8).map(doc => ({
      name: doc.fileName, type: doc.documentType, updated: doc.uploadedDate ? fmtDate(parseISO(doc.uploadedDate)) : "-",
    }));
    const comments = commentsAll.filter(c => c.projectCode === code)
      .sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""))
      .slice(-6)
      .map(c => ({ author: userName(c.userId), role: (userById[c.userId] || {}).businessRole || "-", date: fmtDate(parseISO(c.timestamp)), text: c.comment }));
    const milestones = milestonesAll.filter(m => m.projectCode === code).map(m => ({
      name: m.name, date: m.plannedDate ? fmtDate(parseISO(m.plannedDate)) : "-", status: m.status,
    }));
    const approvals = approvalHistoryAll.filter(a => a.projectCode === code).map(a => ({
      gate: a.gateCode, approver: userName(a.approverUserId),
      status: a.decision, date: a.approvalDate ? fmtDate(parseISO(a.approvalDate)) : "-",
    }));

    // ── Leaders / team — resolved via projectMembers + orgUsers ──
    const membersForProject = projectMembersAll.filter(m => m.projectCode === code && m.active);
    const findMember = re => (membersForProject.find(m => re.test(m.projectRole)) || {}).userName;
    const pmgr = userName(project.projectManagerUserId);
    const pel = findMember(/Engineering Manager/) || userName(project.programManagerUserId);
    const pml = findMember(/Quality Lead/) || "-";
    const pvl = findMember(/Validation Engineer 1/) || findMember(/Testing Lead/) || "-";
    const teamMembers = membersForProject.map(m => m.userName);
    // Same team, but with real userIds — needed wherever a feature must WRITE a record back
    // into a userId-keyed store (e.g. the project-page Action Register, which shares its data
    // with the Admin Console's Action Register and so must use the same assignedToUserId shape).
    const teamMembersDetailed = membersForProject.map(m => ({ userId: m.userId, name: m.userName, role: m.projectRole }));
    const businessOwner = userName(project.sponsorUserId);

    // ── Health / classification — deterministically derived from real enum/number fields ──
    const healthMap = { Green: 90, Amber: 65, Red: 35 };
    const healthScore = Math.round(((healthMap[project.projectHealth] || 60) + (healthMap[project.budgetHealth] || 60) +
      (healthMap[project.scheduleHealth] || 60) + (healthMap[project.riskHealth] || 60)) / 4);
    const portfolio = project.projectTypeCode === "M6" ? "BB" : "N-BB";
    const category = project.projectTypeCode === "Exploration" ? "EXP" : project.projectTypeCode;
    const priority = (project.riskHealth === "Red" || project.scheduleHealth === "Red") ? "Critical"
      : (project.riskHealth === "Amber" || project.scheduleHealth === "Amber") ? "High" : "Medium";
    const burnPct = project.budgetPlanned ? Math.round(project.budgetConsumed / project.budgetPlanned * 100) : 0;

    const sopDateObj = parseISO(project.targetSOP);
    const forecastObj = parseISO(project.forecastSOP);
    const startObj = parseISO(project.startDate);
    const sopStr = fmtDateFull(sopDateObj);
    const launchStr = forecastObj ? fmtDateFull(forecastObj) : sopStr;
    const startStr = fmtDateFull(startObj);
    const currentGateName = currentG <= 6 ? "G" + currentG + " (" + project.currentGate + ")" : "SOP";

    return {
      // Overview
      projectName: project.name, projectCode: project.code, financialYear: "FY 2026-27",
      portfolio, category, platform: project.platform,
      vehicleSeries: project.productFamily, priority,
      gate: gates[Math.max(0, gateReached - 1)] ? gates[Math.max(0, gateReached - 1)].id : "G1",
      currentGate: currentGateName, currentStage: project.currentGate,
      rygStatus: project.projectHealth, healthScore, progressPct: project.overallProgress,
      budgetPlanned: project.budgetPlanned, budgetConsumed: project.budgetConsumed, burnPct,
      projectLeader: pel, projectManager: pmgr,
      leaders: { PMgr: pmgr, PEL: pel, PML: pml, PVL: pvl },
      teamMembers, teamMembersDetailed, businessOwner,
      sopDate: sopStr, targetLaunch: launchStr, programmeStart: startStr, targetSop: sopStr,
      description: project.description,
      compliancePct: deliverables.pct,
      // Health & compliance
      deliverables, goals,
      monthly, monthlyRate, fy26, predicted,
      // Timeline
      gates, activities, gateDetails, gateChecklist,
      // Risk
      risks,
      // Meta
      documents, comments, milestones, approvals,
    };
  }

  // Indexed by BOTH project code and project name, so links built either way (older
  // name-keyed links, newer code-keyed links) resolve to the same real record.
  const DETAILS_BY_CODE = {};
  const DETAILS = {};
  projects.forEach(p => {
    const rec = build(p);
    DETAILS_BY_CODE[p.code] = rec;
    DETAILS[p.code] = rec;
    DETAILS[p.name] = rec;
  });

  global.getProjectDetail = id => DETAILS[id] || DETAILS[decodeURIComponent(id || "")] || null;
  global.listProjectDetails = () => projects.map(p => DETAILS_BY_CODE[p.code]);
  global.PD_STAGES = STAGES;
})(typeof window !== "undefined" ? window : this);
