// ==========================================================
//  PROJECT DETAIL — enterprise mock dataset.
//  One rich, UNIQUE record per project, keyed by project name (matching the dashboard's
//  project rows so a click can pass ?id=<name>). All derived numbers (compliance %, burn %,
//  variances, gate delays) are computed from base facts here, never hardcoded twice — the
//  same principle the dashboard data layer uses.
//  Exposes: getProjectDetail(id), listProjectDetails().
// ==========================================================
(function (global) {
  "use strict";

  const MONTHS   = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
  const STAGES   = ["Pre-KO","CVPA","VV","PC","PR","PPO","SOP"];
  // The 18 stage-gate activities shown across the Snapshot timeline table, each mapped to its stage.
  const ACTIVITIES = [
    { key:"PRF APPROVAL",        stage:"Pre-KO" },
    { key:"QA & CC INPUTS",      stage:"Pre-KO" },
    { key:"TECHNICAL FEASIBILITY",stage:"Pre-KO" },
    { key:"BC APPROVAL",         stage:"Pre-KO" },
    { key:"TARGET APPROVAL",     stage:"Pre-KO" },
    { key:"DR0",                 stage:"CVPA" },
    { key:"DFMEA-DVP MATRIX",    stage:"CVPA" },
    { key:"VV",                  stage:"VV" },
    { key:"L2 RELEASE",          stage:"PC" },
    { key:"VENDOR ONBOARD",      stage:"PC" },
    { key:"VP PART RECEIPT",     stage:"PC" },
    { key:"VP BUILD",            stage:"PC" },
    { key:"VP VALIDATION",       stage:"PR" },
    { key:"HOMOLOGATION BUILDS", stage:"PR" },
    { key:"PPAP READINESS",      stage:"PR" },
    { key:"ER-SOVP",             stage:"PPO" },
    { key:"PP BATCH",            stage:"PPO" },
    { key:"SOP",                 stage:"SOP" },
  ];
  const DEPTS = ["Product Engineering","Quality Assurance","Manufacturing","Supply Chain","Testing & Validation","Homologation","Program Management","Purchase"];
  // Deliverable name pools per gate (real automotive NPD artefacts, not placeholders).
  const GATE_DELIVERABLES = {
    "Pre-KO": ["Product Requirement Freeze","QA & CC Inputs","Technical Feasibility Study","Business Case Approval","Target Cost Sign-off"],
    "CVPA":   ["DR0 Design Review","DFMEA","DVP Matrix","Concept Validation Report","Styling Theme Freeze"],
    "VV":     ["PFMEA","Design Verification Plan","Virtual Validation Report","CAE Sign-off"],
    "PC":     ["L2 Drawing Release","Vendor Onboarding","VP Part Receipt","VP Build Report","Prototype Assembly"],
    "PR":     ["VP Validation","Homologation Builds","PPAP Readiness","Field Trial Report","Tool Release"],
    "PPO":    ["ER-SOVP Sign-off","PP Batch Build","Production Readiness Review","Line Trial"],
    "SOP":    ["Start of Production","Launch Sign-off","Quality Gate Closure"],
  };
  const RISK_POOL = [
    { title:"Supplier tool delivery delay",        mitigation:"Alternative supplier activated in parallel", corrective:"Weekly tool-progress tracking with vendor" },
    { title:"Homologation approval slippage",      mitigation:"Early submission of type-approval dossier",  corrective:"Dedicated homologation liaison assigned" },
    { title:"CAE correlation gap on BIW",          mitigation:"Additional physical validation build",       corrective:"Design review with CAE & test teams weekly" },
    { title:"Long-lead casting availability",      mitigation:"Buffer stock secured for critical castings", corrective:"Dual-sourcing casting supplier qualified" },
    { title:"Emission compliance margin tight",    mitigation:"Calibration optimisation sprint",            corrective:"Bi-weekly emission bench review" },
    { title:"Cost target overrun on transmission", mitigation:"Value-engineering workshop scheduled",       corrective:"Line-item cost freeze until re-baseline" },
    { title:"Test track slot contention",          mitigation:"Off-site proving ground booked",             corrective:"Shift-based test scheduling introduced" },
    { title:"Software release dependency",         mitigation:"Feature-flagged staged rollout",             corrective:"Daily software integration stand-up" },
  ];

  // ── 15 project seeds. Each carries the unique base facts; everything else is derived. ──
  const SEEDS = [
    { name:"Tractor 1",  code:"PJ01001", platform:"Heavy",   category:"M2", series:"7250 Series", portfolio:"BB",   priority:"High",   gateReached:5, health:78, goalsDone:4, goalsTotal:5, delivDone:52, delivTotal:81, budgetPlanned:1420, burn:71, pmgr:"A. Kulkarni", pel:"R. Deshmukh", pml:"S. Pawar",   pvl:"N. Joshi",    members:["V. Rao"],            owner:"CEO Office",   sop:"01 Jul 2026", launch:"15 Aug 2026" },
    { name:"Tractor 2",  code:"PJ01002", platform:"Heavy",   category:"M6", series:"9500 Series", portfolio:"N-BB", priority:"Critical",gateReached:2, health:61, goalsDone:4, goalsTotal:5, delivDone:48, delivTotal:87, budgetPlanned:1680, burn:64, pmgr:"Leader 1",    pel:"Leader 2",    pml:"Leader 3",   pvl:"Leader 4",    members:["Member 1"],          owner:"PMO",          sop:"01 Jul 2026", launch:"20 Sep 2026" },
    { name:"Tractor 3",  code:"PJ01003", platform:"Compact", category:"M2", series:"744 Series",  portfolio:"BB",   priority:"High",   gateReached:6, health:83, goalsDone:5, goalsTotal:6, delivDone:70, delivTotal:79, budgetPlanned:980,  burn:74, pmgr:"P. Menon",    pel:"K. Iyer",     pml:"D. Nair",    pvl:"G. Shetty",   members:["M. Reddy"],          owner:"R&D",          sop:"12 Aug 2026", launch:"05 Oct 2026" },
    { name:"Tractor 4",  code:"PJ01004", platform:"Compact", category:"M2", series:"735 Series",  portfolio:"BB",   priority:"Medium", gateReached:6, health:88, goalsDone:6, goalsTotal:6, delivDone:74, delivTotal:82, budgetPlanned:910,  burn:69, pmgr:"S. Gupta",    pel:"A. Verma",    pml:"R. Malhotra",pvl:"T. Bansal",   members:["H. Sethi"],          owner:"R&D",          sop:"09 Jun 2026", launch:"25 Jul 2026" },
    { name:"Tractor 5",  code:"PJ01005", platform:"Heavy",   category:"M4", series:"8100 Series", portfolio:"BB",   priority:"Critical",gateReached:1, health:58, goalsDone:2, goalsTotal:6, delivDone:44, delivTotal:96, budgetPlanned:2050, burn:60, pmgr:"J. Thomas",   pel:"L. Fernandez",pml:"B. Kurien",  pvl:"E. Mathew",   members:["C. Philip"],         owner:"CEO Office",   sop:"18 Aug 2026", launch:"30 Oct 2026" },
    { name:"Tractor 6",  code:"PJ01006", platform:"Utility", category:"M4", series:"6075 Series", portfolio:"N-BB", priority:"High",   gateReached:1, health:66, goalsDone:3, goalsTotal:5, delivDone:51, delivTotal:88, budgetPlanned:1240, burn:73, pmgr:"F. Khan",     pel:"Z. Ahmed",    pml:"Y. Sheikh",  pvl:"I. Ansari",   members:["O. Qureshi"],        owner:"PMO",          sop:"22 Sep 2026", launch:"10 Nov 2026" },
    { name:"Tractor 7",  code:"PJ01007", platform:"Utility", category:"M4", series:"6042 Series", portfolio:"BB",   priority:"Medium", gateReached:2, health:79, goalsDone:4, goalsTotal:5, delivDone:66, delivTotal:80, budgetPlanned:1150, burn:70, pmgr:"D. Chauhan",  pel:"M. Rathore",  pml:"S. Solanki", pvl:"V. Rana",     members:["A. Bhati"],          owner:"R&D",          sop:"14 Oct 2026", launch:"28 Nov 2026" },
    { name:"Tractor 8",  code:"PJ01008", platform:"Heavy",   category:"M4", series:"8300 Series", portfolio:"N-BB", priority:"Critical",gateReached:2, health:61, goalsDone:2, goalsTotal:6, delivDone:49, delivTotal:92, budgetPlanned:1990, burn:64, pmgr:"R. Krishnan", pel:"P. Subramanian",pml:"N. Balaji",pvl:"K. Venkat",   members:["S. Anand"],          owner:"CEO Office",   sop:"09 Jul 2026", launch:"18 Sep 2026" },
    { name:"Tractor 9",  code:"PJ01009", platform:"Compact", category:"M4", series:"742 Series",  portfolio:"BB",   priority:"Medium", gateReached:4, health:82, goalsDone:5, goalsTotal:6, delivDone:69, delivTotal:84, budgetPlanned:1020, burn:72, pmgr:"A. Kapoor",   pel:"R. Chadha",   pml:"M. Sood",    pvl:"D. Khanna",   members:["P. Ahuja"],          owner:"R&D",          sop:"20 Nov 2026", launch:"12 Jan 2027" },
    { name:"Tractor 10", code:"PJ01010", platform:"Compact", category:"M4", series:"724 Series",  portfolio:"BB",   priority:"Low",    gateReached:5, health:86, goalsDone:6, goalsTotal:6, delivDone:73, delivTotal:80, budgetPlanned:940,  burn:68, pmgr:"S. Naidu",    pel:"V. Prasad",   pml:"K. Rao",     pvl:"G. Murthy",   members:["L. Kamath"],         owner:"R&D",          sop:"10 Jan 2027", launch:"22 Feb 2027" },
    { name:"Tractor 11", code:"PJ01011", platform:"Heavy",   category:"M4", series:"8500 Series", portfolio:"N-BB", priority:"Critical",gateReached:5, health:62, goalsDone:3, goalsTotal:6, delivDone:55, delivTotal:95, budgetPlanned:2100, burn:65, pmgr:"H. Bhatt",    pel:"J. Trivedi",  pml:"M. Dave",    pvl:"R. Mehta",    members:["A. Shah"],           owner:"CEO Office",   sop:"05 Dec 2026", launch:"20 Feb 2027" },
    { name:"Tractor 12", code:"PJ01012", platform:"Utility", category:"M6", series:"6055 Series", portfolio:"BB",   priority:"Critical",gateReached:2, health:67, goalsDone:3, goalsTotal:5, delivDone:53, delivTotal:86, budgetPlanned:1560, burn:79, pmgr:"N. Pillai",   pel:"S. Kurup",    pml:"A. Menon",   pvl:"R. Warrier",  members:["D. Nambiar"],        owner:"PMO",          sop:"18 Jun 2026", launch:"02 Aug 2026" },
    { name:"Tractor 13", code:"PJ01013", platform:"Utility", category:"M6", series:"6028 Series", portfolio:"N-BB", priority:"Medium", gateReached:3, health:74, goalsDone:4, goalsTotal:6, delivDone:63, delivTotal:83, budgetPlanned:1180, burn:70, pmgr:"T. Sen",      pel:"B. Ghosh",    pml:"R. Dutta",   pvl:"S. Bose",     members:["A. Chatterjee"],     owner:"R&D",          sop:"09 Apr 2026", launch:"25 May 2026" },
    { name:"Tractor 14", code:"PJ01014", platform:"Heavy",   category:"M6", series:"9200 Series", portfolio:"N-BB", priority:"Critical",gateReached:4, health:73, goalsDone:4, goalsTotal:6, delivDone:60, delivTotal:90, budgetPlanned:1740, burn:75, pmgr:"V. Nanda",    pel:"A. Sethi",    pml:"P. Chopra",  pvl:"K. Grewal",   members:["M. Gill"],           owner:"CEO Office",   sop:"05 May 2026", launch:"18 Jun 2026" },
    { name:"Tractor 15", code:"PJ01015", platform:"Compact", category:"M6", series:"717 Series",  portfolio:"BB",   priority:"High",   gateReached:5, health:70, goalsDone:4, goalsTotal:5, delivDone:58, delivTotal:82, budgetPlanned:990,  burn:71, pmgr:"R. Iyengar",  pel:"S. Acharya",  pml:"K. Hegde",   pvl:"G. Kamath",   members:["N. Bhat"],           owner:"R&D",          sop:"25 Mar 2027", launch:"10 May 2027" },
  ];

  // Deterministic PRNG so a given project always renders identical numbers.
  function rng(seedInt) { let a = seedInt >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seedFromString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  const MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function fmtDate(d) { // "07 Jul 26" — compact, for the dense timeline
    return String(d.getDate()).padStart(2, "0") + " " + MON3[d.getMonth()] + " " + String(d.getFullYear()).slice(2);
  }
  function fmtDateFull(d) { // "07 Jul 2026" — for overview cards
    return String(d.getDate()).padStart(2, "0") + " " + MON3[d.getMonth()] + " " + d.getFullYear();
  }
  const addDays = (d0, n) => new Date(d0.getTime() + n * 86400000);
  // The whole app's "today". Completed gates sit before this, the current gate is in progress
  // around now, remaining gates + SOP fall after it.
  const TODAY = new Date(2026, 6, 7); // 07 Jul 2026

  // Status classification shared by gates/activities/deliverables.
  function statusFor(delayDays, done) {
    if (!done) return "Pending";
    if (delayDays <= 0)  return "On Time";
    if (delayDays <= 15) return "Completed";      // completed with minor slip
    if (delayDays <= 60) return "Delayed 15-60";
    return "Delayed >60";
  }

  function build(seed, idx) {
    const rand = rng(seedFromString(seed.code));
    const pick = arr => arr[Math.floor(rand() * arr.length)];
    const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

    // ── Monthly planned vs actual (drives the gauge + compliance-rate chart consistently) ──
    const monthly = MONTHS.map((m, i) => {
      const planned = between(6, 12);
      // actual trails planned by a project-specific factor; later months taper as work is pending
      const factor  = Math.min(1, (seed.burn / 100) + (rand() * 0.25 - 0.12) - (i > seed.gateReached + 3 ? 0.35 : 0));
      const actual  = Math.max(0, Math.min(planned, Math.round(planned * Math.max(0, factor))));
      return { month: m, planned, actual };
    });
    const monthlyRate = monthly.map(r => ({ month: r.month, pct: r.planned ? Math.round(r.actual / r.planned * 100) : 0 }));
    // FY26 (prior year) and AI-predicted lines, derived deterministically from the real FY27 line.
    const fy26 = monthlyRate.map(r => ({ month: r.month, pct: Math.max(10, Math.min(100, r.pct - between(3, 9))) }));
    const predicted = monthlyRate.map((r, i) => ({ month: r.month, pct: Math.max(10, Math.min(100, r.pct + between(4, 14) + (i > 6 ? 6 : 0))) }));

    // ── Gauges: deliverables (fraction/% consistent) & gates (completed of 6, matching the
    //    "GATES" label). Both derived so they can never disagree with the timeline. ──
    const deliverables = { done: seed.delivDone, total: seed.delivTotal, pct: +(seed.delivDone / seed.delivTotal * 100).toFixed(2) };
    const goals        = { done: seed.gateReached, total: 6, pct: +(seed.gateReached / 6 * 100).toFixed(2) };

    // ── Stage-gate timeline anchored to TODAY (realistic past / in-progress / future) ──
    const gateOwners = ["Program Mgmt","Design","Quality","Manufacturing","Validation","Homologation"];
    const currentG   = seed.gateReached + 1;   // 1-based gate currently IN PROGRESS (7 ⇒ all gates done)
    const remaining  = 6 - seed.gateReached;

    // Completion (SOP) target: realistic per gate progress.
    // ≤1 gate remaining → closes this year (Nov 2026)
    // 2 gates remaining → 2027 Q1-Q2
    // 3 gates remaining → 2027 Q3-Q4
    // 4+ gates remaining → 2028
    let sopDate;
    if (remaining <= 1)       sopDate = new Date(2026, 10, between(8, 26));            // Nov 2026
    else if (remaining === 2) sopDate = new Date(2027, between(2, 5), between(4, 26));   // Mar–Jun 2027
    else if (remaining === 3) sopDate = new Date(2027, between(7, 10), between(4, 26));  // Aug–Nov 2027
    else                      sopDate = new Date(2028, between(1, 8), between(4, 26));   // 2028

    // Anchor: the in-progress gate sits near now; if all gates are done, the last one just passed.
    const anchor = currentG <= 6 ? addDays(TODAY, between(-16, 18)) : addDays(TODAY, -between(20, 55));
    const futureGateCount = Math.max(0, 6 - currentG);

    // Target Date object per gate, then made strictly increasing.
    const gateDates = [];
    for (let g = 1; g <= 6; g++) {
      if (g < currentG)                          gateDates.push(addDays(anchor, -(currentG - g) * between(46, 68)));
      else if (g === currentG && currentG <= 6)  gateDates.push(new Date(anchor));
      else {
        const step = (sopDate.getTime() - anchor.getTime()) / (futureGateCount + 1);
        gateDates.push(new Date(anchor.getTime() + step * (g - currentG)));
      }
    }
    for (let i = 1; i < gateDates.length; i++) if (gateDates[i] <= gateDates[i - 1]) gateDates[i] = addDays(gateDates[i - 1], between(24, 44));

    const startDate = addDays(gateDates[0], -between(30, 60)); // programme kickoff, before G1

    const gates = gateDates.map((target, gi) => {
      const g = gi + 1;
      const reached = g <= seed.gateReached;
      const inProgress = (g === currentG && currentG <= 6);
      const delay = reached ? (g === seed.gateReached ? between(0, 65) : between(0, 18)) : 0;
      const actual = reached ? addDays(target, delay) : null;
      let status;
      if (inProgress)        status = "In Progress";
      else if (!reached)     status = "Pending";
      else if (delay === 0)  status = "On Time";
      else if (delay <= 15)  status = "Completed";
      else if (delay <= 60)  status = "Delayed 15-60";
      else                   status = "Delayed >60";
      return {
        id: "G" + g, stage: STAGES[gi], name: STAGES[gi],
        target: fmtDate(target), actual: actual ? fmtDate(actual) : "-",
        status, owner: gateOwners[gi], delayDays: delay,
        reason: delay > 15 ? pick(["Supplier testing delay","Design re-work","Homologation queue","Long-lead part delay"]) : (delay > 0 ? "Minor validation slip" : "-"),
        correctiveAction: delay > 15 ? pick(["Additional validation team assigned","Dual-sourcing activated","Escalated to review board","Overtime test slots booked"]) : "-",
        milestone: STAGES[gi] + " Gate Review",
        approval: reached ? "Approved" : (inProgress ? "In Review" : "Pending"),
      };
    });

    // ── 18 activity rows: Planned / Approved / Outlook dates interpolated across [start, SOP],
    //    so early (completed) activities are in the past and later ones fall in the future. ──
    const progSpan = Math.max(1, sopDate.getTime() - startDate.getTime());
    const activities = ACTIVITIES.map((a, i) => {
      const frac    = ACTIVITIES.length > 1 ? i / (ACTIVITIES.length - 1) : 0;
      const planned = new Date(startDate.getTime() + progSpan * frac);
      const stageIdx = STAGES.indexOf(a.stage);
      const done   = stageIdx < seed.gateReached;   // stage's gate already passed
      const active = stageIdx === seed.gateReached;  // current in-progress stage
      const delay  = done ? between(-5, 45) : 0;
      const approved = done ? addDays(planned, Math.max(0, delay)) : null;
      const outlook  = addDays(planned, between(-3, 18));
      const variance = approved ? Math.round((approved - planned) / 86400000) : Math.round((outlook - planned) / 86400000);
      return {
        activity: a.key, stage: a.stage,
        planned: fmtDate(planned),
        approved: approved ? fmtDate(approved) : "-",
        outlook: fmtDate(outlook),
        variance, done,
        owner: pick(DEPTS), department: pick(DEPTS),
        status: active ? "In Progress" : statusFor(delay, done),
        risk: delay > 30 ? "High" : delay > 10 ? "Medium" : "Low",
        correctiveAction: delay > 15 ? pick(["Re-baselined plan","Added resources","Vendor escalation"]) : "-",
        gate: "G" + Math.min(6, stageIdx + 1),
        priority: pick(["High","Medium","Low"]),
        milestone: i % 4 === 0,
      };
    });

    // ── Gate deliverable detail (per gate, several deliverables) ──
    const gateDetails = STAGES.map((st, si) => {
      const reached = si < seed.gateReached;
      const items = (GATE_DELIVERABLES[st] || []).map((dn, di) => {
        const done = reached || (si === seed.gateReached && di < 2);
        const delay = done ? between(-4, 40) : 0;
        const completion = done ? between(85, 100) : between(10, 70);
        return {
          name: dn, owner: pick(["A. Kulkarni","R. Deshmukh","S. Pawar","P. Menon","J. Thomas","F. Khan"]),
          department: DEPTS[(di + si) % DEPTS.length],
          plannedDate: activities[Math.min(activities.length - 1, si * 2 + di)] ? activities[Math.min(activities.length - 1, si * 2 + di)].planned : "-",
          actualDate: done ? activities[Math.min(activities.length - 1, si * 2 + di)].approved : "-",
          status: statusFor(delay, done),
          completion,
          delayDays: delay,
          remarks: delay > 15 ? "Slipped due to " + pick(["supplier","validation","approval"]) + " delay" : (done ? "Closed on plan" : "In progress"),
          dependency: di > 0 ? (GATE_DELIVERABLES[st][di - 1]) : "-",
          evidence: done ? pick(["Report.pdf","Signoff.xlsx","TestData.csv","Review-MoM.docx"]) : "Pending",
        };
      });
      return { gate: "G" + (si + 1), stage: st, deliverables: items };
    });

    // ── Risks (critical/high/medium/low mix per project) ──
    const nRisks = between(4, 6);
    const sevSeq = ["Critical","High","High","Medium","Medium","Low"];
    const risks = Array.from({ length: nRisks }, (_, i) => {
      const r = RISK_POOL[(idx + i) % RISK_POOL.length];
      const severity = sevSeq[i % sevSeq.length];
      return {
        title: r.title, severity,
        impact: severity === "Critical" ? "High" : pick(["High","Medium"]),
        probability: pick(["High","Medium","Low"]),
        owner: pick(DEPTS),
        mitigation: r.mitigation, correctiveAction: r.corrective,
        status: pick(["Open","Mitigating","Closed"]),
      };
    });

    const budgetConsumed = Math.round(seed.budgetPlanned * seed.burn / 100);
    const compliancePct  = deliverables.pct;
    const progressPct     = Math.round(seed.gateReached / 6 * 100);
    const rygStatus = seed.health >= 80 ? "Green" : seed.health >= 65 ? "Amber" : "Red";
    // Realistic completion dates derived from gate progress (override the seed's static SOP).
    const sopStr    = fmtDateFull(sopDate);
    const launchStr = fmtDateFull(addDays(sopDate, between(35, 65)));
    const startStr  = fmtDateFull(startDate);
    const currentGateName = currentG <= 6 ? gates[currentG - 1].id + " (" + STAGES[currentG - 1] + ")" : "SOP";

    const documents = [
      { name: seed.code + "_Charter.pdf",        type:"Charter",       updated: fmtDate(new Date(2025, 3, between(1,27))) },
      { name: seed.code + "_DFMEA.xlsx",         type:"FMEA",          updated: fmtDate(new Date(2025, 6, between(1,27))) },
      { name: seed.code + "_GateReview_G"+seed.gateReached+".pptx", type:"Gate Review", updated: fmtDate(new Date(2026, 1, between(1,27))) },
      { name: seed.code + "_Budget.xlsx",        type:"Budget",        updated: fmtDate(new Date(2026, 2, between(1,27))) },
    ];
    const comments = [
      { author: seed.pmgr, role:"PMgr", date: fmtDate(new Date(2026, 5, between(1,9))), text:"Gate "+seed.gateReached+" review closed; focus shifting to validation builds." },
      { author: seed.pel,  role:"PEL",  date: fmtDate(new Date(2026, 5, between(10,20))), text:"Two deliverables trending late — mitigation in progress with supplier." },
    ];

    return {
      // Overview
      projectName: seed.name, projectCode: seed.code, financialYear: "FY 2026-27",
      portfolio: seed.portfolio, category: seed.category, platform: seed.platform,
      vehicleSeries: seed.series, priority: seed.priority,
      gate: gates[Math.max(0, seed.gateReached - 1)] ? gates[Math.max(0, seed.gateReached - 1)].id : "G1",
      currentGate: currentGateName,
      currentStage: STAGES[Math.min(6, seed.gateReached)] || "Pre-KO",
      rygStatus, healthScore: seed.health, progressPct,
      budgetPlanned: seed.budgetPlanned, budgetConsumed, burnPct: seed.burn,
      projectLeader: seed.pel, projectManager: seed.pmgr,
      leaders: { PMgr: seed.pmgr, PEL: seed.pel, PML: seed.pml, PVL: seed.pvl },
      teamMembers: seed.members, businessOwner: seed.owner,
      sopDate: sopStr, targetLaunch: launchStr, programmeStart: startStr, targetSop: sopStr,
      description: seed.series + " " + seed.platform.toLowerCase() + " tractor programme under the " +
                   (seed.portfolio === "BB" ? "Breakthrough" : "Non-Breakthrough") + " portfolio, category " + seed.category +
                   ", targeting SOP on " + sopStr + ".",
      compliancePct,
      // Health & compliance
      deliverables, goals,
      monthly, monthlyRate, fy26, predicted,
      // Timeline
      gates, activities, gateDetails,
      // Risk
      risks,
      // Meta
      documents, comments,
      milestones: gates.map(g => ({ name: g.milestone, date: g.target, status: g.status })),
      approvals: gates.map(g => ({ gate: g.id, approver: g.owner, status: g.approval, date: g.actual })),
    };
  }

  const DETAILS = {};
  SEEDS.forEach((s, i) => { DETAILS[s.name] = build(s, i); });

  global.getProjectDetail  = id => DETAILS[id] || DETAILS[decodeURIComponent(id || "")] || null;
  global.listProjectDetails = () => Object.values(DETAILS);
  global.PD_STAGES = STAGES;
  global.PD_ACTIVITIES = ACTIVITIES;
})(typeof window !== "undefined" ? window : this);
