// Deliverable Library — the master catalog of all deliverables (81 seeded), one record per
// deliverable regardless of which project ever uses it. Seeded once from data/deliverableLibrary.json,
// mutated only in localStorage from then on. Project-specific deliverable *assignments* (status,
// progress, documents, approvals) are a completely separate concept living in
// store/projectExecution.js / data/projectDeliverableAssignments.json — this module never touches that.
import { load, save, seedOnce, ENTITY_KEYS, loadJsonSync } from "./db.js";
import { nowIso, parseCsv } from "../utils.js";
import { addAuditEntry } from "./audit.js";
import { listGates } from "./gateMasterAdmin.js";

const _formsLibrary = loadJsonSync("formsLibrary.json");

// Reads Gate Master's own live (localStorage-backed) list every call — a gate created or
// deactivated there must be reflected here immediately, with no hardcoded gate list anywhere.
export function stages() {
  return listGates({ includeInactive: false }).map((g) => g.gateCode);
}
export const CATEGORIES = [...new Set(loadJsonSync("deliverableLibrary.json").map((d) => d.category))].sort();
export const DEPARTMENTS = [...new Set(loadJsonSync("deliverableLibrary.json").map((d) => d.department))].sort();

export function listFormOptions() {
  return _formsLibrary.filter((f) => f.active);
}

// data/deliverableLibrary.json ships with legacy field names (`no`, `estimatedDurationDays`)
// that predate this store's `deliverableNo`/`estimatedDuration` shape. Normalize on both the
// initial seed AND every read, so a browser that already seeded the raw (un-normalized) shape
// into localStorage before this fix self-heals instead of crashing every load.
function normalize(d) {
  if (d.deliverableNo && d.estimatedDuration) return d;
  return {
    ...d,
    deliverableNo: d.deliverableNo || d.no,
    estimatedDuration: d.estimatedDuration || (d.estimatedDurationDays != null ? `${d.estimatedDurationDays} days` : "5 days"),
  };
}

export function ensureSeeded() {
  seedOnce(ENTITY_KEYS.DELIVERABLES, () => loadJsonSync("deliverableLibrary.json").map(normalize));
}

function all() {
  const list = load(ENTITY_KEYS.DELIVERABLES, []);
  const healed = list.map(normalize);
  if (healed.some((d, i) => d !== list[i])) persist(healed);
  return healed;
}
function persist(list) {
  save(ENTITY_KEYS.DELIVERABLES, list);
}

export function listDeliverables(filters = {}) {
  let list = all();
  const { gateCode, category, department, active, linkedFormCode, q } = filters;
  if (gateCode) list = list.filter((d) => d.gateCode === gateCode);
  if (category) list = list.filter((d) => d.category === category);
  if (department) list = list.filter((d) => d.department === department);
  if (active === true || active === false) list = list.filter((d) => d.active === active);
  if (linkedFormCode) list = list.filter((d) => d.linkedFormCode === linkedFormCode);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((d) => [d.deliverableNo, d.deliverableCode, d.deliverableName, d.department, d.category].some((f) => String(f).toLowerCase().includes(needle)));
  }
  return list.sort((a, b) => String(a.deliverableNo || "").localeCompare(String(b.deliverableNo || "")));
}

export function getDeliverable(no) {
  return all().find((d) => d.deliverableNo === no) || null;
}

// ---- parent/child hierarchy — one level only (a child can't itself have children), so every
// deliverable is either top-level or a direct child of a top-level one in the SAME gate. Kept to
// one level deliberately: it's exactly what "1.1 / 2.1" numbering needs, and avoids the cycle- and
// deep-tree bookkeeping a multi-level model would require for no real requirement here. ----
export function topLevelOptionsFor(gateCode, excludeNo) {
  return all().filter((d) => d.gateCode === gateCode && d.deliverableNo !== excludeNo && !d.parentDeliverableCode);
}

// Stable hierarchical numbering (1, 1.1, 1.2, 2, 2.1…), computed per gate from the store's own
// canonical deliverableNo order — independent of whatever sort/filter/page the view is currently
// showing, so the label never changes just because the user re-sorted the table.
export function hierarchyLabels() {
  const byGate = new Map();
  all().slice().sort((a, b) => String(a.deliverableNo || "").localeCompare(String(b.deliverableNo || ""), undefined, { numeric: true }))
    .forEach((d) => {
      if (!byGate.has(d.gateCode)) byGate.set(d.gateCode, []);
      byGate.get(d.gateCode).push(d);
    });
  const labels = new Map(); // deliverableNo -> { label, parentNo, parentName }
  byGate.forEach((rows) => {
    const byNo = new Map(rows.map((d) => [d.deliverableNo, d]));
    // Pass 1: top-level items get their number first — a child's deliverableNo can sort earlier
    // than its parent's (e.g. parent "D010", child "D005"), so children can't be numbered in the
    // same single pass without risking an unresolved parent label.
    let topIdx = 0;
    rows.forEach((d) => {
      if (!d.parentDeliverableCode || !byNo.has(d.parentDeliverableCode)) {
        topIdx += 1;
        labels.set(d.deliverableNo, { label: String(topIdx), parentNo: null, parentName: null });
      }
    });
    // Pass 2: children, now that every top-level label in this gate is resolved.
    const childIdx = new Map(); // parentNo -> count so far
    rows.forEach((d) => {
      const parent = d.parentDeliverableCode && byNo.get(d.parentDeliverableCode);
      if (!parent) return;
      const n = (childIdx.get(parent.deliverableNo) || 0) + 1;
      childIdx.set(parent.deliverableNo, n);
      const parentLabel = labels.get(parent.deliverableNo);
      labels.set(d.deliverableNo, {
        label: `${parentLabel.label}.${n}`,
        parentNo: parent.deliverableNo, parentName: parent.deliverableName,
      });
    });
  });
  return labels;
}

function assertUniqueCode(list, deliverableCode, excludeNo) {
  const clash = list.find((d) => d.deliverableCode.toLowerCase() === deliverableCode.toLowerCase() && d.deliverableNo !== excludeNo);
  if (clash) throw new Error(`Deliverable code "${deliverableCode}" is already used by ${clash.deliverableNo} — codes must be unique.`);
}

function nextDeliverableNo(list) {
  let max = 0;
  for (const d of list) {
    const m = String(d.deliverableNo).match(/^D(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `D${String(max + 1).padStart(3, "0")}`;
}

export function createDeliverable(data, actor, actorRole) {
  const list = all();
  if (!data.deliverableCode) throw new Error("Deliverable code is required.");
  assertUniqueCode(list, data.deliverableCode, null);
  const deliverable = {
    id: `DEL-${String(list.length + 1).padStart(3, "0")}`,
    deliverableNo: nextDeliverableNo(list),
    deliverableCode: data.deliverableCode.trim(),
    deliverableName: data.deliverableName.trim(),
    description: data.description || "",
    gateCode: data.gateCode || stages()[0],
    department: data.department || "",
    category: data.category || "",
    estimatedDuration: data.estimatedDuration || "5 days",
    mandatory: !!data.mandatory,
    linkedFormCode: data.linkedFormCode || null,
    version: data.version || "1.0",
    active: data.active !== false,
    parentDeliverableCode: data.parentDeliverableCode || null,
  };
  list.push(deliverable);
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Create", entityType: "Deliverable", entityId: deliverable.deliverableNo,
    summary: `Deliverable ${deliverable.deliverableNo} "${deliverable.deliverableName}" created`, before: null, after: deliverable,
  });
  return deliverable;
}

export function updateDeliverable(no, patch, actor, actorRole) {
  const list = all();
  const idx = list.findIndex((d) => d.deliverableNo === no);
  if (idx === -1) throw new Error("Deliverable not found.");
  if (patch.deliverableCode) assertUniqueCode(list, patch.deliverableCode, no);
  if (patch.parentDeliverableCode) {
    if (patch.parentDeliverableCode === no) throw new Error("A deliverable can't be its own parent.");
    const parent = list.find((d) => d.deliverableNo === patch.parentDeliverableCode);
    if (!parent) throw new Error("Selected parent deliverable not found.");
    if (parent.parentDeliverableCode) throw new Error("The selected parent is itself a child — only one level of nesting is supported.");
    if (parent.gateCode !== (patch.gateCode || list[idx].gateCode)) throw new Error("Parent must be in the same gate/stage.");
    if (list.some((d) => d.parentDeliverableCode === no)) throw new Error("This deliverable already has children — it can't also become a child (only one level of nesting is supported).");
  }
  const before = { ...list[idx] };
  list[idx] = { ...list[idx], ...patch };
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "Deliverable", entityId: no,
    summary: `Deliverable ${no} updated`, before, after: list[idx],
  });
  return list[idx];
}

export function setDeliverableActive(no, active, actor, actorRole) {
  return updateDeliverable(no, { active }, actor, actorRole);
}

// ---- bulk import: real CSV / JSON parsing, duplicate-code rejection ----
export function bulkImport(fileText, fileName, actor, actorRole) {
  let rows;
  if (fileName.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(fileText);
    rows = Array.isArray(parsed) ? parsed : parsed.deliverables || [];
  } else {
    rows = parseCsv(fileText);
  }
  const list = all();
  const errors = [];
  let created = 0, updated = 0;
  rows.forEach((row, i) => {
    const deliverableCode = row.deliverableCode || row.Code || row.code;
    const deliverableName = row.deliverableName || row.Name || row.name;
    if (!deliverableCode || !deliverableName) { errors.push(`Row ${i + 1}: deliverableCode and deliverableName are required.`); return; }
    const existing = list.find((d) => d.deliverableCode.toLowerCase() === deliverableCode.toLowerCase());
    const clashOtherRow = list.find((d) => d.deliverableCode.toLowerCase() === deliverableCode.toLowerCase() && existing && d.deliverableNo !== existing.deliverableNo);
    if (clashOtherRow) { errors.push(`Row ${i + 1}: duplicate deliverable code "${deliverableCode}".`); return; }
    const payload = {
      deliverableCode: deliverableCode.trim(), deliverableName: deliverableName.trim(),
      description: row.description || row.Description || "",
      gateCode: row.gateCode || row.Stage || row.stage || stages()[0],
      department: row.department || row.Department || "",
      category: row.category || row.Category || "",
      estimatedDuration: row.estimatedDuration || row.Duration || "5 days",
      mandatory: String(row.mandatory ?? row.Mandatory ?? "false").toLowerCase() === "true",
      linkedFormCode: row.linkedFormCode || row.LinkedForm || null,
      version: row.version || row.Version || "1.0",
      active: String(row.active ?? row.Active ?? "true").toLowerCase() !== "false",
    };
    if (existing) {
      Object.assign(existing, payload);
      updated++;
    } else {
      list.push({ id: `DEL-${String(list.length + 1).padStart(3, "0")}`, deliverableNo: nextDeliverableNo(list), ...payload });
      created++;
    }
  });
  if (errors.length && created === 0 && updated === 0) throw new Error(errors.join(" "));
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "BulkImport", entityType: "Deliverable", entityId: "bulk",
    summary: `Bulk import from "${fileName}": ${created} created, ${updated} updated${errors.length ? `, ${errors.length} row(s) skipped` : ""}`,
    before: null, after: { created, updated, errors },
  });
  return { created, updated, errors };
}
