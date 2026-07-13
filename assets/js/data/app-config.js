// ==========================================================
//  APP CONFIG — loads the app's seed/demo data from data/*.json (via a synchronous XHR, so
//  every later <script> on the page can keep reading these as plain globals exactly as
//  before — no page had to change how or when it reads them, only where the values come from).
//
//  script.js/dashboard.js treat this as read-only input: it derives all chart/table data
//  (totals, monthly compliance %, etc.) FROM projectPortfolioData rather than hardcoding
//  parallel numbers, specifically so the two can never drift out of sync.
//
//  Swapping to a real API later means replacing loadJsonSync()'s implementation (or the
//  data/*.json files themselves) — nothing downstream needs to change, since it only ever
//  reads these names.
// ==========================================================

// DATA_ROOT = the project root URL, computed from this script's OWN resolved script URL —
// same self-locating trick assets/js/auth.js uses for APP_ROOT (which isn't loaded yet at this
// point on every page, so this can't just reuse it).
const DATA_ROOT = (function () {
  const self = document.currentScript
    || [...document.getElementsByTagName("script")].find(s => /(^|\/)assets\/js\/data\/app-config\.js(\?|#|$)/.test(s.getAttribute("src") || ""));
  return self && self.src ? self.src.replace(/assets\/js\/data\/app-config\.js(\?[^#]*)?(#.*)?$/, "") : "";
})();

function loadJsonSync(relPath) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", DATA_ROOT + "data/" + relPath, false);
  xhr.send(null);
  return JSON.parse(xhr.responseText);
}

const _usersData = loadJsonSync("users.json");
const _rolesData = loadJsonSync("roles.json");
const _portfolioData = loadJsonSync("portfolio.json"); // kpiCards color/label config only now

// ── Role directory — shared by login.html (demo accounts + email-pattern detection, via
//    `match`) and index.html (avatar/dropdown labels). One definition, both pages load it. ──
const roleDirectory = _usersData.roleDirectory;

// ── Root login role (CEO/PMO/RD/SA, sessionStorage "snpdRole") → Admin Console business role
//    (System Administrator/CEO/PMO Manager/R&D Head/Finance Manager/Engineer). One real login
//    identity underneath both role vocabularies — same mapping the Admin Console's own
//    getActiveUser() uses, loaded here so the outer app's RBAC checks (auth.js) resolve to the
//    exact same business role the RBAC Matrix (Admin Console) actually configures. ──
const rootRoleToBusinessRole = _usersData.rootRoleToBusinessRole;

// ── Roles catalog — what the Super Admin's User Management page lets you assign. Keys match
//    roleDirectory exactly (both index into the same 4 roles by design). ──
const rolesCatalog = _rolesData.rolesCatalog;

// ── Page registry — label/path directory only; WHO can open a page now lives in the one RBAC
//    matrix (see auth.js) so the outer app and the Admin Console share a single source of truth
//    instead of two separately-maintained access lists. ──
// paths are ROOT-RELATIVE (no leading slash): nav/guard resolve them via appUrl() = APP_ROOT +
// path, so they work under both file:// and http(s):// regardless of the current page's depth.
const pagesCatalog = _rolesData.pagesCatalog;

// ── RBAC defaults + widget/tab catalogs — the same data pages/admin/js/rbac.js reads, loaded
//    here too so the outer app's plain-script pages (no ES modules) can compute the same
//    effective permissions without a saved matrix in localStorage yet (first-ever page load). ──
const rbacDefaultMatrix = _rolesData.defaultMatrix;

// ── Mock users — what the Super Admin's User Management page lists/edits. Persisted to
//    localStorage by that page once edited; this array is only the first-run seed. ──
const mockUsers = _usersData.legacyMockUsers;

const monthOrder = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

// ==========================================================
//  Real enterprise project portfolio — replaces the old data/portfolio.json mock rows.
//  Built from data/projects.json joined against projectRisks.json, projectIssues.json,
//  projectDeliverableAssignments.json and actionRegister.json, so every number the dashboard's
//  charts show (risk score, delay days, reason, corrective action, monthly compliance) is a
//  real generated fact, not a random mock — same field NAMES as before, so dashboard.js's chart
//  logic needed zero changes, only where the values come from.
// ==========================================================
// ── Projects created via the Admin Console's "Projects" module live only in localStorage
// (spd.projects_exec.v1 / spd.project_deliverable_assignments.v1 — the exact keys
// store/projectExecution.js's createProject/cloneProject write to). This file is a plain script,
// not an ES module, so it can't import that store directly; reading the same localStorage keys
// keeps the Dashboard's portfolio table in sync without a second source of truth — the same
// pattern assets/js/data/project-detail-seed.js already uses for gate checklist templates.
// Deliberately ADDITIVE ONLY: a live project can never override or shadow a statically-seeded
// one, so a malformed localStorage value degrades gracefully (silently contributes nothing) rather
// than ever risking one of the 15 real seed projects. ──
function mergeLiveProjects(staticProjects, staticDeliverableAssignments, staticGateInstances) {
  try {
    const raw = localStorage.getItem("spd.projects_exec.v1");
    const liveProjects = raw ? JSON.parse(raw) : null;
    if (!liveProjects || !liveProjects.length) return { projects: staticProjects, deliverableAssignments: staticDeliverableAssignments, gateInstances: staticGateInstances };
    const staticCodes = new Set(staticProjects.map(p => p.code));
    const newProjects = liveProjects.filter(p => !staticCodes.has(p.code));
    if (!newProjects.length) return { projects: staticProjects, deliverableAssignments: staticDeliverableAssignments, gateInstances: staticGateInstances };
    const newCodes = new Set(newProjects.map(p => p.code));
    const liveAssignments = JSON.parse(localStorage.getItem("spd.project_deliverable_assignments.v1") || "[]").filter(a => newCodes.has(a.projectCode));
    const liveGateInstances = JSON.parse(localStorage.getItem("spd.project_gate_instances.v1") || "[]").filter(g => newCodes.has(g.projectCode));
    return {
      projects: [...staticProjects, ...newProjects],
      deliverableAssignments: [...staticDeliverableAssignments, ...liveAssignments],
      gateInstances: [...staticGateInstances, ...liveGateInstances],
    };
  } catch (e) {
    return { projects: staticProjects, deliverableAssignments: staticDeliverableAssignments, gateInstances: staticGateInstances };
  }
}

const _projectRisks    = loadJsonSync("projectRisks.json");
const _projectIssues   = loadJsonSync("projectIssues.json");
const _actionRegister  = loadJsonSync("actionRegister.json");
const { projects: _projects, deliverableAssignments: _deliverables, gateInstances: _gateInstances } = mergeLiveProjects(
  loadJsonSync("projects.json"), loadJsonSync("projectDeliverableAssignments.json"), loadJsonSync("projectGateInstances.json")
);

const _MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function _parseISO(s) { if (!s) return null; const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); }
function _monthLabelOf(iso) { const d = _parseISO(iso); return d ? _MON3[d.getMonth()] : null; }

function _buildPortfolioRow(p) {
  const type = p.projectTypeCode === "Exploration" ? "EXP" : p.projectTypeCode;
  const classification = p.projectTypeCode === "M6" ? "BB" : "N-BB";
  const delayDays = Math.max(0, p.sopVarianceDays || 0);

  const risks = _projectRisks.filter(r => r.projectCode === p.code);
  const openRisk = risks.find(r => r.status !== "Closed") || risks[0] || null;
  const issues = _projectIssues.filter(i => i.projectCode === p.code);
  const openIssue = issues.find(i => i.status !== "Resolved" && i.status !== "Closed") || issues[0] || null;
  const sevScore = { Critical: 95, High: 80, Medium: 55, Low: 30 };
  const riskScore = risks.length ? Math.round(risks.reduce((s,r) => s + (sevScore[r.severity] || 50), 0) / risks.length) : 40;

  const reason = openRisk ? openRisk.title : (openIssue ? openIssue.title : "None");
  const relatedAction = _actionRegister.find(a => a.projectCode === p.code && a.status !== "Closed") || _actionRegister.find(a => a.projectCode === p.code);
  const correctiveAction = relatedAction ? relatedAction.title : (openRisk ? openRisk.mitigationPlan : "Monitor and reassess");

  const deliv = _deliverables.filter(d => d.projectCode === p.code);
  const month = _monthLabelOf(p.targetSOP) || "Apr";
  const monthDeliv = deliv.filter(d => _monthLabelOf(d.targetDate) === month);
  const pool = monthDeliv.length ? monthDeliv : deliv;
  const planned = pool.length || 10;
  const actual = pool.filter(d => d.status === "Completed").length;
  // Cumulative (whole-project, not just this reporting month) deliverable completion — feeds the
  // Risk & AI Prediction drill-down's "Deliverables" column (e.g. "50/78"), a distinct figure from
  // the month-scoped planned/actual pair above that drives the Compliance Rate chart.
  const deliverablesTotal = deliv.length;
  const deliverablesCompleted = deliv.filter(d => d.status === "Completed").length;

  // "AI Corrective Actions Summary" (Status-badge hover) — up to 3 real, currently-open items,
  // pooled from this project's open action-register entries AND open risks' mitigation plans
  // (never a fabricated recommendation), ranked by severity so the worst items surface first.
  const sevRank = { Critical: 3, High: 3, Medium: 2, Low: 1 };
  const openActions = _actionRegister.filter(a => a.projectCode === p.code && !["Closed","Completed"].includes(a.status));
  const openRisksForActions = risks.filter(r => r.status !== "Closed" && r.mitigationPlan);
  const aiActions = [
    ...openActions.map(a => ({ priority: a.priority || "Medium", title: a.title })),
    ...openRisksForActions.map(r => ({ priority: r.severity, title: r.mitigationPlan })),
  ]
    .sort((a, b) => (sevRank[b.priority] || 1) - (sevRank[a.priority] || 1))
    .slice(0, 3);

  return {
    projectName: p.name, projectCode: p.code, platform: p.platform,
    gate: p.currentGate, type, classification,
    riskScore, delayDays, reason, correctiveAction,
    month, planned, actual,
    deliverablesCompleted, deliverablesTotal, aiActions,
  };
}

// ── Project portfolio (source of truth for all row-1 charts) ──
const projectPortfolioData = _projects.map(_buildPortfolioRow);

// Longer-form detail shown in the expandable row, keyed by the project's NAME (each real risk/
// issue title is now unique per project, not drawn from a small shared vocabulary of ~5 reasons
// the way the old mock data was — so the join key moved from `reason` text to `projectName`).
const reasonDetails = {};
_projects.forEach(p => {
  const risks = _projectRisks.filter(r => r.projectCode === p.code);
  const openRisk = risks.find(r => r.status !== "Closed") || risks[0] || null;
  const issues = _projectIssues.filter(i => i.projectCode === p.code);
  const openIssue = issues.find(i => i.status !== "Resolved" && i.status !== "Closed") || issues[0] || null;
  const action = _actionRegister.find(a => a.projectCode === p.code && a.status !== "Closed") || _actionRegister.find(a => a.projectCode === p.code);
  reasonDetails[p.name] = {
    riskReason: openRisk ? openRisk.description : (openIssue ? openIssue.description : "No open risk or issue currently logged against this project."),
    delayReason: p.description,
    correctiveActionDetail: action ? action.description : (openRisk ? openRisk.mitigationPlan : "No corrective action currently required."),
    mitigationPlan: openRisk ? openRisk.mitigationPlan : (openIssue ? openIssue.resolution || "Under investigation." : "N/A"),
  };
});
reasonDetails["None"] = {
  riskReason: "No open risk currently logged against this project.",
  delayReason: "No delay currently attributed to this project.",
  correctiveActionDetail: "No corrective action currently required.",
  mitigationPlan: "N/A",
};
