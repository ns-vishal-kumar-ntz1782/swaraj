import { load, save, seedOnce, ENTITY_KEYS } from "./db.js";
import { nextSequenceCode, nowIso, parseCsv } from "../utils.js";
import { addAuditEntry } from "./audit.js";

const STAGES = ["Pre-KO", "CVPA", "VV", "PC", "PR", "PPO"];
export { STAGES };

function seedDeliverables() {
  return [
    { no: "D001", name: "Concept Design Brief", stage: "Pre-KO", owner: "Rohit Verma", dept: "R&D", due: "2026-06-01", rag: "green", status: "Completed", version: "1.2", priority: "High" },
    { no: "D002", name: "Feasibility Cost Model", stage: "CVPA", owner: "Neha Kapoor", dept: "Finance", due: "2026-07-05", rag: "amber", status: "Submitted", version: "1.0", priority: "High" },
    { no: "D003", name: "Risk Register", stage: "CVPA", owner: "Rohit Verma", dept: "R&D", due: "2026-07-12", rag: "green", status: "InProgress", version: "0.3", priority: "Medium" },
    { no: "D004", name: "Design Verification Plan", stage: "VV", owner: "Rohit Verma", dept: "Engineering", due: "2026-07-20", rag: "red", status: "Pending", version: "0.1", priority: "Critical" },
    { no: "D005", name: "Process Control Plan", stage: "PC", owner: "Neha Kapoor", dept: "Manufacturing", due: "2026-08-01", rag: "green", status: "Pending", version: "0.1", priority: "Medium" },
  ];
}

function seedLinks() {
  return { D001: ["FT-001"], D002: ["FT-002"], D003: [], D004: ["FT-001"], D005: [] };
}

export function ensureSeeded() {
  seedOnce(ENTITY_KEYS.DELIVERABLES, seedDeliverables);
  seedOnce(ENTITY_KEYS.DELIVERABLE_FORM_LINKS, seedLinks);
}

function all() {
  return load(ENTITY_KEYS.DELIVERABLES, []);
}
function persist(list) {
  save(ENTITY_KEYS.DELIVERABLES, list);
}

export function listDeliverables(filters = {}) {
  let list = all();
  const { stage, status, rag, owner, q } = filters;
  if (stage) list = list.filter((d) => d.stage === stage);
  if (status) list = list.filter((d) => d.status === status);
  if (rag) list = list.filter((d) => d.rag === rag);
  if (owner) list = list.filter((d) => d.owner === owner);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((d) => [d.no, d.name, d.owner, d.dept].some((f) => String(f).toLowerCase().includes(needle)));
  }
  return list.sort((a, b) => a.no.localeCompare(b.no));
}

export function getDeliverable(no) {
  return all().find((d) => d.no === no) || null;
}

export function createDeliverable(data, actor, actorRole) {
  const list = all();
  const no = nextSequenceCode(list.map((d) => d.no), "D", 3);
  const deliverable = {
    no, name: data.name, stage: data.stage || STAGES[0], owner: data.owner || "",
    dept: data.dept || "", due: data.due || "", rag: data.rag || "green",
    status: data.status || "Pending", version: data.version || "1.0", priority: data.priority || "Medium",
  };
  list.push(deliverable);
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Create", entityType: "Deliverable", entityId: no,
    summary: `Deliverable ${no} "${deliverable.name}" created`, before: null, after: deliverable,
  });
  return deliverable;
}

export function updateDeliverable(no, patch, actor, actorRole) {
  const list = all();
  const idx = list.findIndex((d) => d.no === no);
  if (idx === -1) throw new Error("Deliverable not found.");
  const before = { ...list[idx] };
  list[idx] = { ...list[idx], ...patch };
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "Deliverable", entityId: no,
    summary: `Deliverable ${no} updated`, before, after: list[idx],
  });
  return list[idx];
}

export function completeDeliverable(no, actor, actorRole) {
  const deliverable = getDeliverable(no);
  if (!deliverable) throw new Error("Deliverable not found.");
  if (deliverable.owner !== actor) throw new Error("Only the assigned owner can mark this deliverable complete.");
  return updateDeliverable(no, { status: "Completed", rag: "green" }, actor, actorRole);
}

export function deleteDeliverable(no, actor, actorRole) {
  const list = all();
  const target = list.find((d) => d.no === no);
  if (!target) return;
  persist(list.filter((d) => d.no !== no));
  addAuditEntry({
    actor, actorRole, action: "Delete", entityType: "Deliverable", entityId: no,
    summary: `Deliverable ${no} "${target.name}" deleted`, before: target, after: null,
  });
}

// ---- bulk import: real CSV / JSON parsing ----
export function bulkImport(fileText, fileName, actor, actorRole) {
  let rows;
  if (fileName.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(fileText);
    rows = Array.isArray(parsed) ? parsed : parsed.deliverables || [];
  } else {
    rows = parseCsv(fileText);
  }
  const list = all();
  let created = 0, updated = 0;
  rows.forEach((row) => {
    const name = row.name || row.Name;
    if (!name) return;
    const existingNo = row.no || row.No;
    const payload = {
      name, stage: row.stage || row.Stage || STAGES[0], owner: row.owner || row.Owner || "",
      dept: row.dept || row.Dept || row.department || "", due: row.due || row.Due || "",
      rag: (row.rag || row.RAG || "green").toLowerCase(), status: row.status || row.Status || "Pending",
      version: row.version || row.Version || "1.0", priority: row.priority || row.Priority || "Medium",
    };
    const existing = existingNo && list.find((d) => d.no === existingNo);
    if (existing) {
      Object.assign(existing, payload);
      updated++;
    } else {
      const no = nextSequenceCode(list.map((d) => d.no), "D", 3);
      list.push({ no, ...payload });
      created++;
    }
  });
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "BulkImport", entityType: "Deliverable", entityId: "bulk",
    summary: `Bulk import from "${fileName}": ${created} created, ${updated} updated`, before: null, after: { created, updated },
  });
  return { created, updated };
}

// ---- deliverable <-> form links (System Administrator only, enforced by caller via RBAC) ----
export function getFormLinks(no) {
  const map = load(ENTITY_KEYS.DELIVERABLE_FORM_LINKS, {});
  return map[no] || [];
}
export function getAllFormLinks() {
  return load(ENTITY_KEYS.DELIVERABLE_FORM_LINKS, {});
}
export function setFormLinks(no, formCodes, actor, actorRole) {
  const map = load(ENTITY_KEYS.DELIVERABLE_FORM_LINKS, {});
  const before = map[no] || [];
  map[no] = formCodes;
  save(ENTITY_KEYS.DELIVERABLE_FORM_LINKS, map);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "Deliverable", entityId: no,
    summary: `Form links for deliverable ${no} updated (${formCodes.join(", ") || "none"})`, before, after: formCodes,
  });
  return map[no];
}
