// ==========================================================
//  MOCK DATA — the app's seed/demo data layer.
//
//  Everything in this file is what a real backend would eventually serve
//  (project records, role directory, reference text). script.js treats it
//  as read-only input: it derives all chart/table data (totals, monthly
//  compliance %, etc.) FROM projectPortfolioData rather than hardcoding
//  parallel numbers, specifically so the two can never drift out of sync.
//
//  Swapping to a real API later means replacing the contents of this file
//  (or the fetch that populates it) — script.js itself shouldn't need to
//  change, since it only ever reads these names.
// ==========================================================

// ── Role directory — shared by login.html (demo accounts + email-pattern detection, via
//    `match`) and index.html (avatar/dropdown labels). One definition, both pages load it. ──
const roleDirectory = {
  CEO: { avatar:"CEO", name:"CEO",           email:"ceo@swaraj.mahindra.com",         match:["ceo"] },
  PMO: { avatar:"PMO", name:"PMO Manager",   email:"pmo.manager@swaraj.mahindra.com", match:["pmo"] },
  RD:  { avatar:"R&D", name:"R&D Head",      email:"rnd.head@swaraj.mahindra.com",    match:["rnd", "r&d", "rd."] },
  SA:  { avatar:"SA",  name:"Super Admin",   email:"admin@swaraj.mahindra.com",       match:["admin", "sa."] },
};

// ── Roles catalog — what the Super Admin's User Management page lets you assign. Keys match
//    roleDirectory exactly (both index into the same 4 roles by design). ──
const rolesCatalog = [
  { key:"CEO", label:"CEO",         description:"Executive-level access to all portfolio and compliance dashboards." },
  { key:"PMO", label:"PMO Manager", description:"Manages project portfolio tracking, budgets, and compliance reporting." },
  { key:"RD",  label:"R&D Head",    description:"Oversees product development stage-gates and technical risk." },
  { key:"SA",  label:"Super Admin", description:"Full system access, including user and role management." },
];

// ── Page registry — the single source of truth for routing + access control. Every protected
//    page calls guardPage(key) (see auth.js) against this list before it renders; the nav also
//    reads it to only show links a role is actually allowed to follow. Add a page here first,
//    then build it — that's what keeps 40+ pages from needing 40+ copies of the same check. ──
// paths are ROOT-RELATIVE (no leading slash): nav/guard resolve them via appUrl() = APP_ROOT +
// path, so they work under both file:// and http(s):// regardless of the current page's depth.
const pagesCatalog = [
  { key:"dashboard",         label:"Dashboard",         path:"index.html",                        roles:["CEO","PMO","RD","SA"] },
  { key:"portfolio-tracker", label:"Portfolio Tracker", path:"pages/portfolio-tracker/index.html", roles:["CEO","PMO","RD","SA"] },
  { key:"overall-budget",    label:"Overall Budget",    path:"pages/overall-budget/index.html",    roles:["CEO","PMO","SA"] },
  { key:"admin-console",     label:"Admin Console",     path:"pages/admin/index.html",             roles:["SA"] },
];

// ── Mock users — what the Super Admin's User Management page lists/edits. Persisted to
//    localStorage by that page once edited; this array is only the first-run seed. ──
const mockUsers = [
  { id:1, name:"Rajesh Sharma", email:"rajesh.sharma@swaraj.mahindra.com", role:"CEO", status:"Active",   lastLogin:"09 Jul 2026, 09:12" },
  { id:2, name:"Priya Nair",    email:"priya.nair@swaraj.mahindra.com",    role:"PMO", status:"Active",   lastLogin:"09 Jul 2026, 08:45" },
  { id:3, name:"Arjun Mehta",   email:"arjun.mehta@swaraj.mahindra.com",   role:"RD",  status:"Active",   lastLogin:"08 Jul 2026, 17:30" },
  { id:4, name:"Sunita Iyer",   email:"sunita.iyer@swaraj.mahindra.com",   role:"SA",  status:"Active",   lastLogin:"09 Jul 2026, 10:05" },
  { id:5, name:"Karan Verma",   email:"karan.verma@swaraj.mahindra.com",   role:"PMO", status:"Inactive", lastLogin:"22 Jun 2026, 14:00" },
  { id:6, name:"Neha Kapoor",   email:"neha.kapoor@swaraj.mahindra.com",   role:"RD",  status:"Active",   lastLogin:"07 Jul 2026, 11:20" },
];

// ── Project portfolio (source of truth for all row-1 charts) ──
const projectPortfolioData = [
  // M2 (4 projects: BB=3, N-BB=1)
  { projectName:"Tractor 1",  gate:"Pre-KO", type:"M2", classification:"BB",   riskScore:72, delayDays:66, reason:"Approval Delay",  correctiveAction:"Escalate Review Board", month:"Sep", planned:22, actual:14 },
  { projectName:"Tractor 2",  gate:"CVPA",   type:"M2", classification:"N-BB", riskScore:74, delayDays:28, reason:"Resource Gap",     correctiveAction:"Reallocate Team",       month:"May", planned:22, actual:15 },
  { projectName:"Tractor 3",  gate:"VV",     type:"M2", classification:"BB",   riskScore:55, delayDays:12, reason:"None",             correctiveAction:"Monitor",               month:"Aug", planned:18, actual:14 },
  { projectName:"Tractor 4",  gate:"PR",     type:"M2", classification:"BB",   riskScore:45, delayDays: 9, reason:"None",             correctiveAction:"Monitor",               month:"Jun", planned:17, actual:14 },
  // M4 (7 projects: BB=4, N-BB=3)
  { projectName:"Tractor 5",  gate:"Pre-KO", type:"M4", classification:"BB",   riskScore:82, delayDays:70, reason:"Approval Delay",  correctiveAction:"Review L2 Sign-off",    month:"Apr", planned:28, actual:17 },
  { projectName:"Tractor 6",  gate:"Pre-KO", type:"M4", classification:"N-BB", riskScore:45, delayDays: 9, reason:"None",             correctiveAction:"Monitor",               month:"Jun", planned:20, actual:17 },
  { projectName:"Tractor 7",  gate:"CVPA",   type:"M4", classification:"BB",   riskScore:49, delayDays: 7, reason:"None",             correctiveAction:"Monitor",               month:"Oct", planned:25, actual:22 },
  { projectName:"Tractor 8",  gate:"CVPA",   type:"M4", classification:"N-BB", riskScore:61, delayDays:75, reason:"Approval Delay",  correctiveAction:"Expedite Review",       month:"Jul", planned:22, actual:14 },
  { projectName:"Tractor 9",  gate:"PC",     type:"M4", classification:"BB",   riskScore:53, delayDays:10, reason:"None",             correctiveAction:"Monitor",               month:"Nov", planned:24, actual:21 },
  { projectName:"Tractor 10", gate:"PR",     type:"M4", classification:"BB",   riskScore:44, delayDays: 4, reason:"None",             correctiveAction:"Monitor",               month:"Jan", planned:26, actual:23 },
  { projectName:"Tractor 11", gate:"PR",     type:"M4", classification:"N-BB", riskScore:80, delayDays:72, reason:"Budget Overrun",  correctiveAction:"Cost Freeze",           month:"Dec", planned:20, actual:11 },
  // M6 (4 projects: BB=2, N-BB=2)
  { projectName:"Tractor 12", gate:"CVPA",   type:"M6", classification:"BB",   riskScore:68, delayDays:18, reason:"Budget Overrun",  correctiveAction:"Escalate CFO",          month:"Jun", planned:24, actual:19 },
  { projectName:"Tractor 13", gate:"VV",     type:"M6", classification:"N-BB", riskScore:47, delayDays: 6, reason:"None",             correctiveAction:"Monitor",               month:"Apr", planned:23, actual:20 },
  { projectName:"Tractor 14", gate:"PC",     type:"M6", classification:"N-BB", riskScore:73, delayDays:65, reason:"Supply Chain",    correctiveAction:"Alternative Vendor",    month:"May", planned:19, actual:10 },
  { projectName:"Tractor 15", gate:"PR",     type:"M6", classification:"BB",   riskScore:64, delayDays:33, reason:"Approval Delay",  correctiveAction:"Fast Track Approval",   month:"Mar", planned:20, actual:14 },
];

const monthOrder = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

// Longer-form detail shown in the expandable row, keyed by the project's short `reason`.
// Keeps the main row scannable (short REASON / CORRECTIVE ACTION columns) while still giving
// each of the four requested detail fields real, distinct, non-repeated content.
const reasonDetails = {
  "Approval Delay": {
    riskReason: "Stage-gate sign-off is pending from L2/L3 leadership, exposing the project to schedule slippage if the review isn't closed out soon.",
    delayReason: "The approval review has exceeded the standard 10-working-day SLA; the review board has not yet convened to close out the sign-off.",
    correctiveActionDetail: "Escalated to the Review Board chair; a dedicated sign-off session has been requested ahead of the next scheduled cycle.",
    mitigationPlan: "Assign a named owner to track approval status daily and pre-clear future gate reviews at least 2 weeks ahead of the target date."
  },
  "Resource Gap": {
    riskReason: "Key engineering or testing resources are under-allocated relative to the plan, putting deliverable timelines at risk.",
    delayReason: "Cross-project resource contention has left this project short-staffed against its original resourcing plan.",
    correctiveActionDetail: "Team members are being reallocated from lower-priority workstreams to restore planned staffing levels.",
    mitigationPlan: "Raise a standing resourcing request with the PMO for the next sprint cycle to prevent recurrence on future gates."
  },
  "Budget Overrun": {
    riskReason: "Actual spend has exceeded the approved budget envelope, risking a funding freeze on remaining deliverables.",
    delayReason: "Cost overruns triggered a finance review, pausing further spend approval until the variance is explained.",
    correctiveActionDetail: "A budget variance review has been escalated to the CFO's office; discretionary spend is frozen in the interim.",
    mitigationPlan: "Rebaseline the cost plan against actuals and introduce monthly budget checkpoints for the remaining gates."
  },
  "Supply Chain": {
    riskReason: "A critical component or vendor delivery is delayed, blocking downstream validation and production activities.",
    delayReason: "The primary supplier has confirmed a delivery slip, with no confirmed recovery date at this time.",
    correctiveActionDetail: "An alternative vendor is being qualified and onboarded for the affected component.",
    mitigationPlan: "Dual-source the affected component going forward and hold a minimum safety-stock buffer for critical parts."
  },
  "None": {
    riskReason: "No material risk identified at this time; the project is progressing within its planned tolerance band.",
    delayReason: "No delay driver recorded — current schedule variance is within the accepted 0–15 day tolerance.",
    correctiveActionDetail: "No corrective action required; the project remains under standard monitoring.",
    mitigationPlan: "Continue the standard monitoring cadence; re-assess if delay exceeds 15 days."
  },
};
