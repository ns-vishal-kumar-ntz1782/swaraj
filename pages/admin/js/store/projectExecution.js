// Project execution layer — the real 15 projects, their per-gate instances, and their
// deliverable assignments, seeded once from data/*.json (via db.js's loadJsonSync/seedOnce,
// same pattern every other store module already uses) and mutated through localStorage from
// then on. Master reference data (project templates, checklist definitions, gate master) is
// read-only and never persisted — it's re-read from JSON on every module load, matching how
// stages.js/rbac.js already treat their own reference data.
import { load, save, seedOnce, ENTITY_KEYS, loadJsonSync } from "./db.js";
import { addAuditEntry } from "./audit.js";
import { notify } from "./notifications.js";
import { listUsers } from "./users.js";
import { nowIso, nextSequenceCode } from "../utils.js";
import { getProjectTeam, isOnProjectTeam, displayFor } from "./orgDirectory.js";
import { getTemplate as getProjectTemplate } from "./projectTemplateAdmin.js";
import { getGate as getGateMasterRecord } from "./gateMasterAdmin.js";
import { getDeliverable } from "./deliverables.js";
import { getForm } from "./forms.js";

const _projectTemplates = loadJsonSync("projectTemplates.json");
const _checklistItems = loadJsonSync("checklistItems.json");
const _gateMaster = loadJsonSync("gateMaster.json");
const templateByType = Object.fromEntries(_projectTemplates.map((t) => [t.projectType, t]));
const gateInfoByCode = Object.fromEntries(_gateMaster.map((g) => [g.gateCode, g]));

// Gates seeded as already-finished use "Completed" (see data/projectGateInstances.json); once a
// gate goes through this workflow it lands on "Closed" instead. Both are the same read-only
// bucket — this codebase doesn't rename the historical seed data to match, so both are treated
// identically everywhere the UI decides whether a gate is browsable-but-locked.
export const READ_ONLY_STATUSES = ["Completed", "Closed", "Approved"];
export const EDITABLE_STATUSES = ["Active", "Rejected"];

export function ensureSeeded() {
  seedOnce(ENTITY_KEYS.PROJECTS_EXEC, () => loadJsonSync("projects.json"));
  seedOnce(ENTITY_KEYS.GATE_INSTANCES, () => loadJsonSync("projectGateInstances.json"));
  seedOnce(ENTITY_KEYS.DELIVERABLE_ASSIGNMENTS, () => loadJsonSync("projectDeliverableAssignments.json"));
}

// Resolves against the admin console's own session/login roster (store/users.js — the 4-role
// login model), used only for notification targeting of the console user who submitted a gate.
// This is a separate identity system from the org roster (orgUsers.json/projectMembers.json)
// that approval-panel members and deliverable ownership now reference by userId.
function userIdByName(name) {
  return listUsers().find((u) => u.name === name)?.id || null;
}

// ---- projects ----
export function listProjects() {
  return load(ENTITY_KEYS.PROJECTS_EXEC, []);
}
export function getProject(code) {
  return listProjects().find((p) => p.code === code) || null;
}
function persistProjects(list) {
  save(ENTITY_KEYS.PROJECTS_EXEC, list);
}
function templateFor(projectCode) {
  const project = getProject(projectCode);
  return project ? templateByType[project.projectTypeCode] : null;
}

// ---- gate instances ----
export function listGateInstances(projectCode) {
  return load(ENTITY_KEYS.GATE_INSTANCES, [])
    .filter((g) => g.projectCode === projectCode)
    .sort((a, b) => a.sequence - b.sequence);
}
export function getGateInstance(projectCode, gateCode) {
  return load(ENTITY_KEYS.GATE_INSTANCES, []).find((g) => g.projectCode === projectCode && g.gateCode === gateCode) || null;
}
function allGateInstances() {
  return load(ENTITY_KEYS.GATE_INSTANCES, []);
}
function persistGateInstances(list) {
  save(ENTITY_KEYS.GATE_INSTANCES, list);
}

// ---- deliverable assignments ----
export function listAssignments(projectCode, gateCode) {
  return load(ENTITY_KEYS.DELIVERABLE_ASSIGNMENTS, []).filter((a) => a.projectCode === projectCode && a.gateCode === gateCode);
}
export function getAssignment(assignmentId) {
  return load(ENTITY_KEYS.DELIVERABLE_ASSIGNMENTS, []).find((a) => a.assignmentId === assignmentId) || null;
}
function allAssignments() {
  return load(ENTITY_KEYS.DELIVERABLE_ASSIGNMENTS, []);
}
function persistAssignments(list) {
  save(ENTITY_KEYS.DELIVERABLE_ASSIGNMENTS, list);
}

export function gateInfo(gateCode) {
  return gateInfoByCode[gateCode] || null;
}
export function templateForProject(projectCode) {
  return templateFor(projectCode);
}

// ---- checklist (master definitions + live computed status, never duplicated) ----
export function checklistItemsForGate(gateCode) {
  return _checklistItems.filter((c) => c.gateCode === gateCode);
}
export function computeChecklistStatus(projectCode, gateCode, checklistItem) {
  const assignments = listAssignments(projectCode, gateCode);
  const linked = checklistItem.linkedDeliverables.map((no) => assignments.find((a) => a.deliverableNo === no)).filter(Boolean);
  const completed = linked.filter((a) => a.status === "Completed").length;
  const uploadedDocumentsCount = linked.reduce((s, a) => s + a.uploadedDocuments.length, 0);
  const requiredDocumentsCount = linked.reduce((s, a) => s + a.requiredDocuments.length, 0);
  const pendingDocumentsCount = Math.max(0, requiredDocumentsCount - uploadedDocumentsCount);
  const completionStatus = linked.length === 0 ? "N/A" : completed === linked.length ? "Completed" : completed === 0 ? "Not Started" : "In Progress";
  return { completionStatus, uploadedDocumentsCount, pendingDocumentsCount, linkedCount: linked.length, completedCount: completed };
}

// ---- submit-for-approval gating ----
export function canSubmitGate(projectCode, gateCode) {
  const assignments = listAssignments(projectCode, gateCode);
  const mandatoryAssignments = assignments.filter((a) => a.mandatory);
  const reasons = [];
  if (mandatoryAssignments.some((a) => a.status !== "Completed")) reasons.push("All mandatory deliverables must be Completed.");
  const mandatoryChecklist = checklistItemsForGate(gateCode).filter((c) => c.mandatory);
  if (mandatoryChecklist.some((c) => computeChecklistStatus(projectCode, gateCode, c).completionStatus !== "Completed")) {
    reasons.push("All mandatory checklist items must be complete.");
  }
  if (mandatoryAssignments.some((a) => a.uploadedDocuments.length < a.requiredDocuments.length)) reasons.push("All required documents must be uploaded.");
  if (assignments.some((a) => a.status === "Rejected")) reasons.push("No deliverable may be in Rejected status.");
  if (assignments.some((a) => a.status === "Blocked")) reasons.push("No deliverable may be in Blocked status.");
  return { canSubmit: reasons.length === 0, reasons };
}

// ---- submit / respond / close ----
// approvalPanel: [{ userId, approvalOrder, comments }] — every userId must be a member of this
// project's team (data/projectMembers.json); role/department/name are resolved for display via
// orgDirectory.js, never stored here.
export function submitGateForApproval(projectCode, gateCode, approvalPanel, actor, actorRole) {
  const { canSubmit, reasons } = canSubmitGate(projectCode, gateCode);
  if (!canSubmit) throw new Error("Cannot submit: " + reasons.join(" "));
  if (!approvalPanel || !approvalPanel.length) throw new Error("Select at least one approver.");
  const offTeam = approvalPanel.find((ap) => !isOnProjectTeam(projectCode, ap.userId));
  if (offTeam) throw new Error("Every approver must be a member of this project's team.");

  const instances = allGateInstances();
  const idx = instances.findIndex((g) => g.projectCode === projectCode && g.gateCode === gateCode);
  if (idx === -1) throw new Error("Gate instance not found.");
  const before = JSON.parse(JSON.stringify(instances[idx]));
  const gi = instances[idx];
  gi.currentStatus = "UnderReview";
  gi.approvalPanel = approvalPanel;
  gi.approvalResponses = {};
  gi.submittedBy = actor;
  gi.approvalHistory = gi.approvalHistory || [];
  gi.approvalHistory.push({ timestamp: nowIso(), actorName: actor, approverUserId: null, decision: "Submitted", comments: `Submitted for approval to ${approvalPanel.length} member(s).` });
  persistGateInstances(instances);

  addAuditEntry({
    actor, actorRole, action: "Submit", entityType: "ProjectGateInstance", entityId: gi.id,
    projectCode, gateCode, summary: `Gate ${gateCode} (${projectCode}) submitted for approval to ${approvalPanel.length} member(s)`, before, after: gi,
  });

  // Approval-panel members are org-roster users (orgUsers.json), who have no account in the
  // admin console's own notification system (scoped to the 4-role login model in store/users.js)
  // — there's no toUserId to deliver to, so no notify() call here. The pending approval is
  // instead surfaced directly in the Gate page for whoever is using the console.
  return gi;
}

function activateNextGateInPlace(instances, projectCode, gateCode) {
  const template = templateFor(projectCode);
  if (!template) return null;
  const seq = template.defaultGateSequence;
  const idx = seq.indexOf(gateCode);
  if (idx === -1 || idx === seq.length - 1) return null;
  const nextCode = seq[idx + 1];
  const nextIdx = instances.findIndex((g) => g.projectCode === projectCode && g.gateCode === nextCode);
  if (nextIdx === -1) return null;
  instances[nextIdx].currentStatus = "Active";
  return nextCode;
}

function updateProjectOnGateAdvance(projectCode, approvedGateCode, nextGateCode) {
  const projects = listProjects();
  const idx = projects.findIndex((p) => p.code === projectCode);
  if (idx === -1) return;
  const p = projects[idx];
  const template = templateByType[p.projectTypeCode];
  const totalGates = template.defaultGateSequence.length;
  const approvedIdx = template.defaultGateSequence.indexOf(approvedGateCode);
  if (nextGateCode) {
    p.currentGate = nextGateCode;
    p.currentPhase = gateInfoByCode[nextGateCode] ? gateInfoByCode[nextGateCode].gateName : p.currentPhase;
    p.overallProgress = Math.round(((approvedIdx + 1) / totalGates) * 100);
  } else {
    // approved gate was the last in sequence -> program complete
    p.currentGate = null;
    p.currentPhase = "Program Complete";
    p.overallProgress = 100;
    p.status = "Completed";
  }
  persistProjects(projects);
}

// respondingUserId: the org-roster panel member (data/projectMembers.json team slot) this
// response is being recorded for. The admin console's own logged-in identity (actor/actorRole,
// the 4-role session model in store/users.js) is a separate system that has no member of its own
// in the 241-person org roster, so it can never *be* a panel member — the UI instead has whoever
// is at the console pick which still-pending team member's decision they're recording, and that
// choice is what respondingUserId carries. actor/actorRole are kept only for the console-side
// audit trail (who was operating the console when this was recorded).
export function respondToGateApproval(projectCode, gateCode, respondingUserId, actor, actorRole, decision, comments) {
  const instances = allGateInstances();
  const idx = instances.findIndex((g) => g.projectCode === projectCode && g.gateCode === gateCode);
  if (idx === -1) throw new Error("Gate instance not found.");
  const gi = instances[idx];
  if (gi.currentStatus !== "UnderReview") throw new Error("This gate is not awaiting approval.");
  const panelUserIds = (gi.approvalPanel || []).map((a) => a.userId);
  if (!panelUserIds.includes(respondingUserId)) throw new Error("Selected approver is not on the approval panel for this gate.");
  if (gi.approvalResponses && gi.approvalResponses[respondingUserId]) throw new Error("This approver has already responded.");

  const responderName = displayFor(respondingUserId).name;
  const before = JSON.parse(JSON.stringify(gi));
  gi.approvalResponses = gi.approvalResponses || {};
  gi.approvalResponses[respondingUserId] = decision;
  gi.approvalHistory = gi.approvalHistory || [];
  gi.approvalHistory.push({ timestamp: nowIso(), actorName: actor, approverUserId: respondingUserId, decision, comments: comments || "" });

  let nextGateCode = null;
  let advanced = false;
  if (decision === "Rejected") {
    gi.currentStatus = "Rejected";
  } else if (decision === "Approved") {
    const allApproved = panelUserIds.every((uid) => gi.approvalResponses[uid] === "Approved");
    if (allApproved) {
      gi.currentStatus = "Approved";
      nextGateCode = activateNextGateInPlace(instances, projectCode, gateCode);
      advanced = true;
    }
  }
  // "ClarificationRequested" changes nothing but the history — PMO stays in the driver's seat.

  persistGateInstances(instances);
  if (advanced) updateProjectOnGateAdvance(projectCode, gateCode, nextGateCode);

  addAuditEntry({
    actor, actorRole, action: decision, entityType: "ProjectGateInstance", entityId: gi.id,
    projectCode, gateCode, summary: `Gate ${gateCode} (${projectCode}) ${decision.replace(/([A-Z])/g, " $1").trim().toLowerCase()} by ${responderName}`, before, after: gi,
  });

  const submitterId = userIdByName(gi.submittedBy);
  if (submitterId) {
    notify({
      toUserId: submitterId,
      title: decision === "Approved" ? "Gate approved" : decision === "Rejected" ? "Gate rejected" : "Clarification requested",
      message: `Gate ${gateCode} for ${projectCode} — ${responderName} recorded: ${decision}.`,
      entityType: "ProjectGateInstance", entityId: gi.id, route: `#/gates/${projectCode}`,
    });
  }
  return gi;
}

export function closeGateInstance(projectCode, gateCode, actor, actorRole, comments) {
  const instances = allGateInstances();
  const idx = instances.findIndex((g) => g.projectCode === projectCode && g.gateCode === gateCode);
  if (idx === -1) throw new Error("Gate instance not found.");
  const gi = instances[idx];
  if (gi.currentStatus !== "Approved") throw new Error("Only an Approved gate can be closed.");
  const before = JSON.parse(JSON.stringify(gi));
  gi.currentStatus = "Closed";
  gi.approvalHistory = gi.approvalHistory || [];
  gi.approvalHistory.push({ timestamp: nowIso(), actorName: actor, approverUserId: null, decision: "Closed", comments: comments || "" });
  persistGateInstances(instances);
  addAuditEntry({
    actor, actorRole, action: "Close", entityType: "ProjectGateInstance", entityId: gi.id,
    projectCode, gateCode, summary: `Gate ${gateCode} (${projectCode}) closed by ${actor}`, before, after: gi,
  });
  return gi;
}

// ---- deliverable assignment mutations ----
function findAssignment(assignments, assignmentId) {
  const a = assignments.find((x) => x.assignmentId === assignmentId);
  if (!a) throw new Error("Deliverable assignment not found.");
  return a;
}

export function updateAssignmentStatus(assignmentId, status, actor, actorRole) {
  const assignments = allAssignments();
  const a = findAssignment(assignments, assignmentId);
  const before = { ...a };
  a.status = status;
  if (status === "Completed") {
    a.progress = 100;
    if (!a.completedDate) a.completedDate = nowIso().slice(0, 10);
    a.actualEnd = a.actualEnd || a.completedDate;
  }
  persistAssignments(assignments);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "ProjectDeliverableAssignment", entityId: assignmentId,
    projectCode: a.projectCode, gateCode: a.gateCode, summary: `${a.deliverableNo} (${a.deliverableName}) status set to ${status}`, before, after: a,
  });
  return a;
}

// Plain-field edits (planned/actual dates, remarks) that don't carry the "Completed" side-effects
// updateAssignmentStatus applies — kept as a separate mutator rather than overloading that one so
// a status change always goes through the explicit workflow above.
export function updateAssignmentFields(assignmentId, fields, actor, actorRole) {
  const assignments = allAssignments();
  const a = findAssignment(assignments, assignmentId);
  const before = { ...a };
  Object.assign(a, fields);
  persistAssignments(assignments);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "ProjectDeliverableAssignment", entityId: assignmentId,
    projectCode: a.projectCode, gateCode: a.gateCode, summary: `${a.deliverableNo} (${a.deliverableName}) updated by ${actor}`, before, after: a,
  });
  return a;
}

// userIds: full desired responsibleMemberUserIds list (project-team USR-XXXX ids). Notifies only
// newly-added members (org-roster people, no console login — see the notify() comment further up
// this file for why that notification has no bell-icon UI to land in today, but is still recorded).
export function assignResponsibleMembers(assignmentId, userIds, actor, actorRole) {
  const assignments = allAssignments();
  const a = findAssignment(assignments, assignmentId);
  const before = { ...a };
  const added = userIds.filter((id) => !(a.responsibleMemberUserIds || []).includes(id));
  a.responsibleMemberUserIds = userIds;
  if (a.status === "Not Started") a.status = "Assigned";
  persistAssignments(assignments);
  addAuditEntry({
    actor, actorRole, action: "Assign", entityType: "ProjectDeliverableAssignment", entityId: assignmentId,
    projectCode: a.projectCode, gateCode: a.gateCode,
    summary: `${actor} assigned ${a.deliverableName} (${a.deliverableCode}) to ${userIds.length} member(s).`,
    before, after: a,
  });
  added.forEach((userId) => notify({
    toUserId: userId, title: "Deliverable assigned",
    message: `You have been assigned Deliverable ${a.deliverableCode} for Project ${a.projectCode}.`,
    entityType: "ProjectDeliverableAssignment", entityId: assignmentId,
  }));
  return a;
}

// uploadedByUserId: the project-team member (data/projectMembers.json) credited with the
// upload — must belong to this assignment's project. actor/actorRole remain the console-session
// identity, kept only for the audit trail (see the note above userIdByName).
export function uploadDocument(assignmentId, fileName, uploadedByUserId, actor, actorRole) {
  const assignments = allAssignments();
  const a = findAssignment(assignments, assignmentId);
  if (!isOnProjectTeam(a.projectCode, uploadedByUserId)) throw new Error("Uploader must be a member of this project's team.");
  a.uploadedDocuments.push({ fileName, uploadedByUserId, uploadedAt: nowIso().slice(0, 10), version: a.uploadedDocuments.length + 1 });
  a.documentStatus = a.uploadedDocuments.length >= a.requiredDocuments.length ? "Complete" : "Partial";
  persistAssignments(assignments);
  addAuditEntry({
    actor, actorRole, action: "Upload", entityType: "ProjectDeliverableAssignment", entityId: assignmentId,
    projectCode: a.projectCode, gateCode: a.gateCode, summary: `Document "${fileName}" uploaded for ${a.deliverableNo}`, before: null, after: a,
  });
  return a;
}

export function replaceDocument(assignmentId, oldFileName, newFileName, uploadedByUserId, actor, actorRole) {
  const assignments = allAssignments();
  const a = findAssignment(assignments, assignmentId);
  if (!isOnProjectTeam(a.projectCode, uploadedByUserId)) throw new Error("Uploader must be a member of this project's team.");
  const doc = a.uploadedDocuments.find((d) => d.fileName === oldFileName);
  if (!doc) throw new Error("Document not found.");
  doc.fileName = newFileName;
  doc.uploadedByUserId = uploadedByUserId;
  doc.uploadedAt = nowIso().slice(0, 10);
  doc.version = (doc.version || 1) + 1;
  persistAssignments(assignments);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "ProjectDeliverableAssignment", entityId: assignmentId,
    projectCode: a.projectCode, gateCode: a.gateCode, summary: `Document replaced for ${a.deliverableNo}`, before: null, after: a,
  });
  return a;
}

export function removeDocument(assignmentId, fileName, actor, actorRole) {
  const assignments = allAssignments();
  const a = findAssignment(assignments, assignmentId);
  a.uploadedDocuments = a.uploadedDocuments.filter((d) => d.fileName !== fileName);
  a.documentStatus = a.uploadedDocuments.length === 0 ? "Pending" : a.uploadedDocuments.length >= a.requiredDocuments.length ? "Complete" : "Partial";
  persistAssignments(assignments);
  addAuditEntry({
    actor, actorRole, action: "Delete", entityType: "ProjectDeliverableAssignment", entityId: assignmentId,
    projectCode: a.projectCode, gateCode: a.gateCode, summary: `Document "${fileName}" removed from ${a.deliverableNo}`, before: null, after: a,
  });
  return a;
}

// ==========================================================
//  PROJECT GENERATION — the "Projects" module (views/projects.js) builds a brand-new project
//  from a Project Template. Reads the LIVE (localStorage-backed) template/gate-master/deliverable/
//  form stores — not the static _projectTemplates/gateInfoByCode snapshots above, which only exist
//  for the pre-existing gate-advancement logic (activateNextGateInPlace etc.) — so a Template a
//  PMO edited five minutes ago is what a new Project actually gets, matching how
//  projectTemplateAdmin.js's own availableGatesToAdd() already reads Gate Master live for the
//  same reason.
// ==========================================================
function parseDurationWeeks(duration) {
  const m = String(duration || "").match(/(\d+)\s*week/i);
  return m ? parseInt(m[1], 10) : 4;
}
function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Pure — computes exactly what a new project's Gate Instances + Deliverable Assignments will be,
// WITHOUT persisting anything. Called twice: once by the wizard's Step 3 preview (read-only
// render) and once by createProject() (which persists the identical result) — so the preview can
// never lie about what gets created, since it's the same code path either way.
// Returned deliverable assignments have no `assignmentId` yet — createProject() assigns real,
// globally-unique ones (sequential across ALL projects) right before persisting; a preview has no
// need for one.
export function planProjectFromTemplate(template, projectCode, startDateISO) {
  const gateInstances = [];
  const deliverableAssignments = [];
  let cursor = startDateISO;
  (template.defaultGateSequence || []).forEach((gateCode, i) => {
    const gc = template.gates.find((g) => g.gateCode === gateCode) ||
      { defaultDeliverables: [], mandatoryDeliverables: [], linkedForms: [], checklistDocuments: [] };
    const gm = getGateMasterRecord(gateCode);
    const weeks = parseDurationWeeks(gc.gateDuration || (gm && gm.defaultDuration));
    const plannedStart = cursor;
    const plannedFinish = addDaysISO(plannedStart, weeks * 7);
    const giId = `GI-${projectCode}-${gateCode.replace(/[^A-Za-z0-9]/g, "")}`;
    gateInstances.push({
      id: giId, projectCode, gateCode, sequence: i + 1,
      plannedStart, actualStart: i === 0 ? plannedStart : null,
      plannedFinish, actualFinish: null,
      currentStatus: i === 0 ? "Active" : "NotStarted", gateProgress: 0,
      approvalStatus: "NotStarted", gateVersion: 1, gateRemarks: "", gateOwnerUserId: null,
    });
    (gc.defaultDeliverables || []).forEach((deliverableNo) => {
      const d = getDeliverable(deliverableNo);
      if (!d) return;
      deliverableAssignments.push({
        projectCode, gateInstanceId: giId, gateCode, deliverableNo,
        deliverableCode: d.deliverableCode, deliverableName: d.deliverableName, department: d.department,
        mandatory: (gc.mandatoryDeliverables || []).includes(deliverableNo),
        linkedFormCode: d.linkedFormCode || null,
        plannedStart, actualStart: null, targetDate: plannedFinish, completedDate: null, actualEnd: null,
        status: "Not Started", progress: 0, dependencyAssignments: [],
        requiredDocuments: [`${d.deliverableCode}_Report.pdf`], uploadedDocuments: [], documentStatus: "Pending",
        remarks: "", approvalHistory: [], formStatus: d.linkedFormCode ? "Pending" : null,
        completionPct: 0, delayDays: 0, riskFlag: "Low", healthScore: 100, responsibleMemberUserIds: [],
      });
    });
    cursor = plannedFinish;
  });
  return { gateInstances, deliverableAssignments };
}

// Zeroed 7-key budget breakdown — matches data/projects.json's real shape; a new project hasn't
// broken its budget down by category yet, unlike the seeded historical ones.
function emptyBudgetBreakdown() {
  return { engineering: 0, tooling: 0, testing: 0, supplier: 0, manufacturing: 0, certification: 0, contingency: 0 };
}

export function createProject(projectInfo, templateCode, actor, actorRole) {
  const projects = listProjects();
  const code = (projectInfo.code || "").trim();
  if (!code) throw new Error("Project code is required.");
  if (projects.some((p) => p.code === code)) throw new Error(`Project code "${code}" already exists.`);
  if (!projectInfo.name || !projectInfo.name.trim()) throw new Error("Project name is required.");
  const template = getProjectTemplate(templateCode);
  if (!template) throw new Error("Selected template not found.");

  const gateCode0 = (template.defaultGateSequence || [])[0] || null;
  const gm0 = gateCode0 ? getGateMasterRecord(gateCode0) : null;
  const project = {
    id: nextSequenceCode(projects.map((p) => p.id), "PRJ-", 3),
    code, name: projectInfo.name.trim(),
    businessUnit: projectInfo.department || "—",
    platform: projectInfo.platform || "—",
    productFamily: projectInfo.platform || "—",
    projectTypeCode: projectInfo.category, templateCode: template.templateCode, templateVersion: template.version,
    budgetPlanned: Number(projectInfo.budget) || 0, budgetApproved: 0, budgetConsumed: 0,
    forecastCost: Number(projectInfo.budget) || 0, budgetBreakdown: emptyBudgetBreakdown(),
    startDate: projectInfo.startDate, targetSOP: projectInfo.targetEndDate, forecastSOP: projectInfo.targetEndDate,
    sopVarianceDays: 0,
    currentPhase: gm0 ? gm0.gateName : (gateCode0 || "—"), currentGate: gateCode0,
    overallProgress: 0, projectHealth: "Green", budgetHealth: "Green", scheduleHealth: "Green", riskHealth: "Green",
    status: "Active", location: projectInfo.location || "—", description: projectInfo.description || "",
    projectManagerUserId: projectInfo.projectManagerUserId || null,
    programManagerUserId: projectInfo.projectManagerUserId || null,
    sponsorUserId: null,
  };

  const { gateInstances: newGateInstances, deliverableAssignments: newAssignments } =
    planProjectFromTemplate(template, code, projectInfo.startDate);

  const allExistingAssignments = load(ENTITY_KEYS.DELIVERABLE_ASSIGNMENTS, []);
  const existingIds = allExistingAssignments.map((a) => a.assignmentId);
  newAssignments.forEach((a) => {
    a.assignmentId = nextSequenceCode(existingIds, "PDA-", 4);
    existingIds.push(a.assignmentId); // feeds the next iteration so ids within this same batch never collide
  });

  projects.push(project);
  persistProjects(projects);
  persistGateInstances([...allGateInstances(), ...newGateInstances]);
  persistAssignments([...allExistingAssignments, ...newAssignments]);

  addAuditEntry({
    actor, actorRole, action: "Create", entityType: "Project", entityId: code,
    summary: `Project ${code} "${project.name}" created from template ${template.templateCode} (${newGateInstances.length} gates, ${newAssignments.length} deliverables)`,
    before: null, after: project,
  });
  notify({
    toRole: actorRole, title: "Project created",
    message: `Project ${code} "${project.name}" has been created from ${template.templateName}.`,
    entityType: "Project", entityId: code,
  });
  return project;
}

export function cloneProject(sourceCode, overrides, actor, actorRole) {
  const source = getProject(sourceCode);
  if (!source) throw new Error("Source project not found.");
  const projectInfo = {
    code: overrides.code, name: overrides.name, category: source.projectTypeCode,
    platform: source.platform, department: source.businessUnit, budget: source.budgetPlanned,
    startDate: overrides.startDate || nowIso().slice(0, 10), targetEndDate: source.targetSOP,
    description: source.description, projectManagerUserId: source.projectManagerUserId,
    location: source.location,
  };
  const project = createProject(projectInfo, source.templateCode, actor, actorRole);
  addAuditEntry({
    actor, actorRole, action: "Clone", entityType: "Project", entityId: project.code,
    summary: `Project ${project.code} cloned from ${sourceCode}`, before: null, after: project,
  });
  return project;
}

export function updateProject(code, patch, actor, actorRole) {
  const projects = listProjects();
  const idx = projects.findIndex((p) => p.code === code);
  if (idx === -1) throw new Error("Project not found.");
  const before = { ...projects[idx] };
  projects[idx] = { ...projects[idx], ...patch };
  persistProjects(projects);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "Project", entityId: code,
    summary: `Project ${code} updated`, before, after: projects[idx],
  });
  return projects[idx];
}

// Never a hard delete — matches this codebase's established "gates are never hard-deleted"
// philosophy (gateMasterAdmin.js's own comment) for the identical reason: the code is referenced
// all over project-execution data. "Archived" is a new, additive status value.
export function archiveProject(code, actor, actorRole) {
  return updateProject(code, { status: "Archived" }, actor, actorRole);
}
