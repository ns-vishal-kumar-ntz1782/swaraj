// Enterprise Action Register — 200 seeded records from data/actionRegister.json, already fully
// userId-based (assignedByUserId/assignedToUserId/watcherUserIds/escalationOwnerUserId/comment
// userId) from an earlier refactor pass. Seeded once, mutated only in localStorage from then on.
import { load, save, seedOnce, ENTITY_KEYS, loadJsonSync } from "./db.js";
import { uid, nowIso } from "../utils.js";
import { addAuditEntry } from "./audit.js";
import { getUser } from "./orgDirectory.js";

export const STATUSES = ["Open", "Assigned", "In Progress", "Blocked", "Waiting for Input", "Completed", "Closed", "Cancelled"];
export const PRIORITIES = ["Low", "Medium", "High", "Critical"];
export const CATEGORIES = [...new Set(loadJsonSync("actionRegister.json").map((a) => a.category))].sort();
// "Meeting Type" in the UI — which real meeting/event/review this action came out of. Stored as
// `source` (the field already existed on every seeded record, e.g. "Design Review", "Management
// Meeting", "Gate Review" — it was just never exposed as an editable field before).
export const MEETING_TYPES = [...new Set(loadJsonSync("actionRegister.json").map((a) => a.source))].sort();
const OPEN_STATUSES = ["Open", "Assigned", "In Progress", "Blocked", "Waiting for Input"];

export function ensureSeeded() {
  seedOnce(ENTITY_KEYS.ACTION_REGISTER, () => loadJsonSync("actionRegister.json"));
}

function all() {
  return load(ENTITY_KEYS.ACTION_REGISTER, []);
}
function persist(list) {
  save(ENTITY_KEYS.ACTION_REGISTER, list);
}

function departmentOf(action) {
  const u = getUser(action.assignedToUserId);
  return u ? u.department : "";
}

export function listActions(filters = {}) {
  let list = all();
  const { projectCode, gateCode, assignedToUserId, priority, department, status, source, dueBefore, dueAfter, escalated, hasReminder, q } = filters;
  if (projectCode) list = list.filter((a) => a.projectCode === projectCode);
  if (gateCode) list = list.filter((a) => a.gateCode === gateCode);
  if (assignedToUserId) list = list.filter((a) => a.assignedToUserId === assignedToUserId);
  if (priority) list = list.filter((a) => a.priority === priority);
  if (source) list = list.filter((a) => a.source === source);
  if (department) list = list.filter((a) => departmentOf(a) === department);
  if (status) list = list.filter((a) => a.status === status);
  if (dueBefore) list = list.filter((a) => a.targetDate && a.targetDate <= dueBefore);
  if (dueAfter) list = list.filter((a) => a.targetDate && a.targetDate >= dueAfter);
  if (escalated === true) list = list.filter((a) => !!a.escalationLevel);
  if (hasReminder === true) list = list.filter((a) => a.reminderEnabled);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((a) => [a.actionNumber, a.title, a.description, a.projectCode].some((f) => String(f).toLowerCase().includes(needle)));
  }
  return list.sort((a, b) => (a.targetDate || "").localeCompare(b.targetDate || ""));
}

export function getAction(id) {
  return all().find((a) => a.id === id) || null;
}
export function isOverdue(a) {
  return a.targetDate && a.targetDate < nowIso().slice(0, 10) && OPEN_STATUSES.includes(a.status);
}

export function updateAction(id, patch, actor, actorRole) {
  const list = all();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error("Action not found.");
  const before = { ...list[idx] };
  list[idx] = { ...list[idx], ...patch };
  if (patch.status === "Completed" || patch.status === "Closed") list[idx].actualCompletionDate = list[idx].actualCompletionDate || nowIso().slice(0, 10);
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "Action", entityId: id, projectCode: list[idx].projectCode,
    summary: `Action ${list[idx].actionNumber} updated`, before, after: list[idx],
  });
  return list[idx];
}

// commentUserId defaults to the action's own assignee — the person actually working the action
// is who a comment is naturally attributed to (same deterministic-attribution pattern used for
// deliverable document uploads, since the admin console's own session identity isn't itself a
// member of the 241-person org roster).
export function addComment(id, text, commentUserId, actor, actorRole) {
  const list = all();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error("Action not found.");
  const before = { ...list[idx] };
  const comment = { commentId: `${list[idx].id}-CMT-${String(list[idx].comments.length + 1).padStart(2, "0")}`, userId: commentUserId, comment: text, timestamp: nowIso().slice(0, 10) };
  list[idx].comments = [...list[idx].comments, comment];
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Comment", entityType: "Action", entityId: id, projectCode: list[idx].projectCode,
    summary: `Comment added to action ${list[idx].actionNumber}`, before, after: list[idx],
  });
  return list[idx];
}

function nextActionId(list) {
  let max = 0;
  for (const a of list) {
    const m = String(a.id).match(/^ACT-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return { id: `ACT-${String(max + 1).padStart(4, "0")}`, actionNumber: `AR-${String(max + 1).padStart(4, "0")}` };
}

export function createAction(data, actor, actorRole) {
  const list = all();
  const { id, actionNumber } = nextActionId(list);
  const action = {
    id, actionNumber, projectCode: data.projectCode || "", gateCode: data.gateCode || "",
    deliverableAssignmentId: null, checklistItemId: null, relatedRisk: null, relatedIssue: null,
    title: data.title.trim(), description: data.description || "", category: data.category || CATEGORIES[0],
    priority: data.priority || "Medium", severity: data.severity || "Minor", source: data.source || "Manual Entry",
    status: "Open", createdDate: nowIso().slice(0, 10), assignedDate: nowIso().slice(0, 10),
    targetDate: data.targetDate || "", actualCompletionDate: null, reminderDate: null, escalationDate: null,
    comments: [], attachments: [], reminderEnabled: false, reminderFrequency: null,
    escalationLevel: null, escalatedTo: null, escalationReason: null, dependsOnActionIds: [],
    assignedByUserId: data.assignedByUserId, assignedToUserId: data.assignedToUserId,
    watcherUserIds: data.watcherUserIds || [], escalationOwnerUserId: null,
    remarks: data.remarks || "",
  };
  list.push(action);
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Create", entityType: "Action", entityId: id, projectCode: action.projectCode,
    summary: `Action ${actionNumber} "${action.title}" created`, before: null, after: action,
  });
  return action;
}
