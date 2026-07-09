import { load, save, seedOnce, ENTITY_KEYS } from "./db.js";
import { uid, nowIso, nextSequenceCode } from "../utils.js";
import { addAuditEntry } from "./audit.js";

const STATUSES = ["Open", "InProgress", "OnHold", "Completed", "Closed", "Escalated"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
export { STATUSES as ACTION_STATUSES, PRIORITIES as ACTION_PRIORITIES };

function seedActions() {
  const today = new Date();
  const iso = (offset) => new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);
  return [
    {
      id: uid("act"), number: "AR-0001", projectCode: "PRJ-100", gateCode: "G2",
      title: "Resolve feasibility cost variance", description: "Reconcile the cost model gap flagged during feasibility review.",
      assignedTo: "Neha Kapoor", startDate: iso(-5), priority: "High", targetDate: iso(3),
      status: "InProgress", comments: [], createdBy: "Priya Menon", createdAt: nowIso(),
    },
    {
      id: uid("act"), number: "AR-0002", projectCode: "PRJ-200", gateCode: "G1",
      title: "Complete risk assessment log", description: "Populate the risk register for the PRJ-200 concept gate.",
      assignedTo: "Rohit Verma", startDate: iso(-2), priority: "Medium", targetDate: iso(7),
      status: "Open", comments: [], createdBy: "Alan Roy", createdAt: nowIso(),
    },
  ];
}

export function ensureSeeded() {
  return seedOnce(ENTITY_KEYS.ACTIONS, seedActions);
}

function all() { return load(ENTITY_KEYS.ACTIONS, []); }
function persist(list) { save(ENTITY_KEYS.ACTIONS, list); }

export function listActions(filters = {}) {
  let list = all();
  const { projectCode, gateCode, status, assignedTo, priority, q } = filters;
  if (projectCode) list = list.filter((a) => a.projectCode === projectCode);
  if (gateCode) list = list.filter((a) => a.gateCode === gateCode);
  if (status) list = list.filter((a) => a.status === status);
  if (assignedTo) list = list.filter((a) => a.assignedTo === assignedTo);
  if (priority) list = list.filter((a) => a.priority === priority);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((a) => [a.number, a.title, a.assignedTo, a.projectCode].some((f) => String(f).toLowerCase().includes(needle)));
  }
  return list.sort((a, b) => b.number.localeCompare(a.number));
}

export function getAction(id) {
  return all().find((a) => a.id === id) || null;
}

export function createAction(data, actor, actorRole) {
  const list = all();
  const number = nextSequenceCode(list.map((a) => a.number.replace("AR-", "")), "", 4);
  const action = {
    id: uid("act"), number: `AR-${number}`, projectCode: data.projectCode || "", gateCode: data.gateCode || "",
    title: data.title, description: data.description || "", assignedTo: data.assignedTo || "",
    startDate: data.startDate || "", priority: data.priority || "Medium", targetDate: data.targetDate || "",
    status: "Open", comments: [], createdBy: actor, createdAt: nowIso(),
  };
  list.push(action);
  persist(list);
  addAuditEntry({ actor, actorRole, action: "Create", entityType: "Action", entityId: action.id, projectCode: action.projectCode, gateCode: action.gateCode, summary: `Action ${action.number} "${action.title}" created`, before: null, after: action });
  return action;
}

export function updateAction(id, patch, actor, actorRole) {
  const list = all();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error("Action item not found.");
  const before = { ...list[idx] };
  list[idx] = { ...list[idx], ...patch };
  persist(list);
  addAuditEntry({ actor, actorRole, action: "Update", entityType: "Action", entityId: id, projectCode: list[idx].projectCode, gateCode: list[idx].gateCode, summary: `Action ${list[idx].number} updated`, before, after: list[idx] });
  return list[idx];
}

export function addComment(id, text, actor, actorRole) {
  const list = all();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error("Action item not found.");
  const before = { ...list[idx] };
  list[idx].comments.push({ id: uid("cmt"), text, author: actor, timestamp: nowIso() });
  persist(list);
  addAuditEntry({ actor, actorRole, action: "Comment", entityType: "Action", entityId: id, projectCode: list[idx].projectCode, gateCode: list[idx].gateCode, summary: `Comment added to ${list[idx].number}`, before, after: list[idx] });
  return list[idx];
}

export function closeAction(id, actor, actorRole) {
  return updateAction(id, { status: "Closed" }, actor, actorRole);
}

export function deleteAction(id, actor, actorRole) {
  const list = all();
  const target = list.find((a) => a.id === id);
  if (!target) return;
  persist(list.filter((a) => a.id !== id));
  addAuditEntry({ actor, actorRole, action: "Delete", entityType: "Action", entityId: id, projectCode: target.projectCode, gateCode: target.gateCode, summary: `Action ${target.number} deleted`, before: target, after: null });
}
