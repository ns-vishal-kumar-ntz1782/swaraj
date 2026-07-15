// Project Templates — one per Project Type (M2/M4/M6/EXP). This is the config a new Project
// bootstraps from: its Gate Sequence, per-gate Default/Mandatory/Optional Deliverables, Default
// Forms, Gate Duration, and Approval Rules. Seeded once from data/projectTemplates.json, edited
// only in localStorage from then on — the seed file itself is never rewritten.
import { load, save, seedOnce, ENTITY_KEYS, loadJsonSync } from "./db.js";
import { addAuditEntry } from "./audit.js";
import { uid } from "../utils.js";
import { listGates } from "./gateMasterAdmin.js";
import { listDeliverables, getDeliverable } from "./deliverables.js";
import { listAllForms, getForm } from "./forms.js";

const _projectMembers = loadJsonSync("projectMembers.json");

// Every project-team role slot that actually exists in the org data — used to populate the
// Approval Rules "required roles" picker without hardcoding a role list.
export const PROJECT_ROLE_SLOTS = [...new Set(_projectMembers.map((m) => m.projectRole))].sort();

// Delegates to the same live, localStorage-backed stores every other admin view reads (rather
// than a separate one-time raw JSON snapshot) — so a deliverable/form created, renamed, relinked,
// or deactivated anywhere in the console shows up here immediately, and so these rows carry the
// normalized `deliverableNo` field (deliverables.js's normalize()) the Deliverables sub-tab keys
// its per-row radio groups off. Previously this read the raw seed file directly, which only ever
// exposed the legacy `no` field — every row's `.deliverableNo` was silently `undefined`, which
// collapsed every deliverable's None/Optional/Mandatory radio into one shared group (they all
// shared the literal name "dstat-undefined") and made Save write to a bogus "undefined" key.
export function deliverablesForGate(gateCode) {
  return listDeliverables({ gateCode, active: true });
}
export function formsForGate(gateCode) {
  return listAllForms({ gateCode, active: true });
}
export function getDeliverableMeta(no) {
  return getDeliverable(no);
}
export function getFormMeta(code) {
  return getForm(code);
}

// Distinct non-null forms linked (via the Deliverable Library's own linkedFormCode) to whichever
// deliverables are actually included in this gate config — the single source of truth for "which
// forms does this gate use," now that a template's Forms sub-tab is read-only and derived rather
// than independently selected (see gc.linkedForms — kept in the data shape but no longer written
// to or read from for display).
export function linkedFormCodesForGate(gc) {
  const codes = gc.defaultDeliverables
    .map((no) => getDeliverable(no)?.linkedFormCode)
    .filter(Boolean);
  return [...new Set(codes)];
}

// Reads through to Gate Master's own live (localStorage-backed) list, not a static JSON snapshot
// — a gate created in Gate Master must be selectable here immediately, with no code change.
export function availableGatesToAdd(templateCode) {
  const t = getTemplate(templateCode);
  const inUse = new Set(t ? t.defaultGateSequence : []);
  return listGates({ includeInactive: false }).filter((g) => !inUse.has(g.gateCode));
}

export function ensureSeeded() {
  seedOnce(ENTITY_KEYS.PROJECT_TEMPLATES_ADMIN, () => loadJsonSync("projectTemplates.json"));
}

function all() {
  return load(ENTITY_KEYS.PROJECT_TEMPLATES_ADMIN, []);
}
function persist(list) {
  save(ENTITY_KEYS.PROJECT_TEMPLATES_ADMIN, list);
}

export function listTemplates() {
  return all();
}
export function getTemplate(templateCode) {
  return all().find((t) => t.templateCode === templateCode) || null;
}

function withTemplate(templateCode, mutate, action, summary, actor, actorRole) {
  const list = all();
  const idx = list.findIndex((t) => t.templateCode === templateCode);
  if (idx === -1) throw new Error("Template not found.");
  const before = JSON.parse(JSON.stringify(list[idx]));
  mutate(list[idx]);
  persist(list);
  addAuditEntry({
    actor, actorRole, action, entityType: "ProjectTemplate", entityId: templateCode,
    summary, before, after: list[idx],
  });
  return list[idx];
}

export function updateBasicInfo(templateCode, patch, actor, actorRole) {
  return withTemplate(templateCode, (t) => { t.templateName = patch.templateName; t.version = patch.version; },
    "Update", `Template ${templateCode} basic info updated`, actor, actorRole);
}

// Adds/removes a gate from the sequence — removing also drops its per-gate config; adding
// creates an empty config the PMO then customizes (deliverables/forms/checklist/duration all
// start empty, approval rules fall back to getApprovalRules()'s default).
function emptyGateConfig(gateCode) {
  return {
    gateCode, defaultDeliverables: [], mandatoryDeliverables: [], optionalDeliverables: [],
    linkedForms: [], checklistDocuments: [], gateDuration: "4 weeks",
  };
}
export function setGateSequence(templateCode, newSequence, actor, actorRole) {
  return withTemplate(templateCode, (t) => {
    t.defaultGateSequence = newSequence;
    t.gates = newSequence.map((gc) => t.gates.find((g) => g.gateCode === gc) || emptyGateConfig(gc));
  }, "Update", `Template ${templateCode} gate sequence updated`, actor, actorRole);
}

export function reorderGateInSequence(templateCode, gateCode, direction, actor, actorRole) {
  const t = getTemplate(templateCode);
  const seq = t.defaultGateSequence.slice();
  const idx = seq.indexOf(gateCode);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapWith < 0 || swapWith >= seq.length) return t;
  [seq[idx], seq[swapWith]] = [seq[swapWith], seq[idx]];
  return setGateSequence(templateCode, seq, actor, actorRole);
}

// Re-seeds one template from the pristine data/projectTemplates.json — the seed file itself is
// never rewritten, so this always restores the shipped starting point, same pattern Gate
// Checklist's resetGateToDefaults uses.
export function resetTemplateToDefaults(templateCode, actor, actorRole) {
  const list = all();
  const idx = list.findIndex((t) => t.templateCode === templateCode);
  if (idx === -1) throw new Error("Template not found.");
  const before = JSON.parse(JSON.stringify(list[idx]));
  const seedTemplate = loadJsonSync("projectTemplates.json").find((t) => t.templateCode === templateCode);
  if (!seedTemplate) throw new Error("No shipped default exists for this template.");
  list[idx] = JSON.parse(JSON.stringify(seedTemplate));
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Reset", entityType: "ProjectTemplate", entityId: templateCode,
    summary: `Template ${templateCode} reset to its shipped defaults`, before, after: list[idx],
  });
  return list[idx];
}

export function addGateToSequence(templateCode, gateCode, actor, actorRole) {
  const t = getTemplate(templateCode);
  if (t.defaultGateSequence.includes(gateCode)) throw new Error(`${gateCode} is already part of this template.`);
  return setGateSequence(templateCode, [...t.defaultGateSequence, gateCode], actor, actorRole);
}

export function removeGateFromSequence(templateCode, gateCode, actor, actorRole) {
  const t = getTemplate(templateCode);
  return setGateSequence(templateCode, t.defaultGateSequence.filter((gc) => gc !== gateCode), actor, actorRole);
}

// "Dependency" is deliberately not a separate stored field — a gate depends on whichever gate
// immediately precedes it in defaultGateSequence, so reordering the sequence IS reconfiguring
// dependencies. This mirrors how the live Gate Checklist workflow already advances gates in
// strict sequence order (see activateNextGateInPlace in store/projectExecution.js).
export function dependencyLabel(templateCode, gateCode) {
  const t = getTemplate(templateCode);
  const idx = t.defaultGateSequence.indexOf(gateCode);
  return idx <= 0 ? "None — first gate in sequence" : `Depends on ${t.defaultGateSequence[idx - 1]} (must complete first)`;
}

// statusByNo: { [deliverableNo]: "mandatory"|"optional"|"none" } — "none" removes it from the
// default set too.
// The Deliverables sub-tab stages every radio change locally and calls this once on "Save
// Deliverables", the same explicit-save pattern the Forms and Approval &amp; Duration sub-tabs
// already use, instead of writing to the store on every single radio click.
export function setDeliverableStatuses(templateCode, gateCode, statusByNo, actor, actorRole) {
  return withTemplate(templateCode, (t) => {
    const gc = t.gates.find((g) => g.gateCode === gateCode);
    if (!gc) throw new Error("Gate not part of this template's sequence.");
    Object.entries(statusByNo).forEach(([deliverableNo, status]) => {
      gc.mandatoryDeliverables = gc.mandatoryDeliverables.filter((n) => n !== deliverableNo);
      gc.optionalDeliverables = gc.optionalDeliverables.filter((n) => n !== deliverableNo);
      gc.defaultDeliverables = gc.defaultDeliverables.filter((n) => n !== deliverableNo);
      if (status === "mandatory") { gc.mandatoryDeliverables.push(deliverableNo); gc.defaultDeliverables.push(deliverableNo); }
      else if (status === "optional") { gc.optionalDeliverables.push(deliverableNo); gc.defaultDeliverables.push(deliverableNo); }
    });
  }, "Update", `Template ${templateCode} / ${gateCode}: deliverables updated (${Object.keys(statusByNo).length})`, actor, actorRole);
}

export function setLinkedForms(templateCode, gateCode, formCodes, actor, actorRole) {
  return withTemplate(templateCode, (t) => {
    const gc = t.gates.find((g) => g.gateCode === gateCode);
    if (!gc) throw new Error("Gate not part of this template's sequence.");
    gc.linkedForms = formCodes;
  }, "Update", `Template ${templateCode} / ${gateCode}: linked forms updated`, actor, actorRole);
}

export function setGateDuration(templateCode, gateCode, duration, actor, actorRole) {
  return withTemplate(templateCode, (t) => {
    const gc = t.gates.find((g) => g.gateCode === gateCode);
    if (!gc) throw new Error("Gate not part of this template's sequence.");
    gc.gateDuration = duration;
  }, "Update", `Template ${templateCode} / ${gateCode}: duration set to ${duration}`, actor, actorRole);
}

// Approval Rules aren't in the original seed shape — this adds the field the first time a
// template's gate is edited, defaulting sensibly rather than requiring a data migration.
export function setApprovalRules(templateCode, gateCode, rules, actor, actorRole) {
  return withTemplate(templateCode, (t) => {
    const gc = t.gates.find((g) => g.gateCode === gateCode);
    if (!gc) throw new Error("Gate not part of this template's sequence.");
    gc.approvalRules = { minApprovers: rules.minApprovers, requiredRoles: rules.requiredRoles };
  }, "Update", `Template ${templateCode} / ${gateCode}: approval rules updated`, actor, actorRole);
}
export function getApprovalRules(gc) {
  return gc.approvalRules || { minApprovers: 2, requiredRoles: [] };
}

// ---- Checklist Documents — owned by the gate, not referenced from any shared catalog (there is
// deliberately no separate Checklist Document Library module) ----
export const FILE_TYPE_OPTIONS = ["pdf", "docx", "xlsx", "pptx", "jpg", "png", "dwg"];

export function addChecklistDocument(templateCode, gateCode, data, actor, actorRole) {
  return withTemplate(templateCode, (t) => {
    const gc = t.gates.find((g) => g.gateCode === gateCode);
    if (!gc) throw new Error("Gate not part of this template's sequence.");
    gc.checklistDocuments = gc.checklistDocuments || [];
    const seq = gc.checklistDocuments.length + 1;
    gc.checklistDocuments.push({
      checklistId: `CKD-${templateCode}-${gateCode}-${uid("").slice(0, 6)}`,
      documentCode: data.documentCode.trim(),
      documentName: data.documentName.trim(),
      description: data.description || "",
      mandatory: !!data.mandatory,
      version: data.version || "1.0",
      allowedFileTypes: data.allowedFileTypes && data.allowedFileTypes.length ? data.allowedFileTypes : ["pdf"],
      maxFileSizeMB: Number(data.maxFileSizeMB) || 10,
      status: data.status || "Active",
      displayOrder: seq,
    });
  }, "Update", `Template ${templateCode} / ${gateCode}: checklist document "${data.documentName}" added`, actor, actorRole);
}

export function updateChecklistDocument(templateCode, gateCode, checklistId, patch, actor, actorRole) {
  return withTemplate(templateCode, (t) => {
    const gc = t.gates.find((g) => g.gateCode === gateCode);
    if (!gc) throw new Error("Gate not part of this template's sequence.");
    const doc = (gc.checklistDocuments || []).find((c) => c.checklistId === checklistId);
    if (!doc) throw new Error("Checklist document not found.");
    Object.assign(doc, patch);
  }, "Update", `Template ${templateCode} / ${gateCode}: checklist document updated`, actor, actorRole);
}

export function removeChecklistDocument(templateCode, gateCode, checklistId, actor, actorRole) {
  return withTemplate(templateCode, (t) => {
    const gc = t.gates.find((g) => g.gateCode === gateCode);
    if (!gc) throw new Error("Gate not part of this template's sequence.");
    gc.checklistDocuments = (gc.checklistDocuments || []).filter((c) => c.checklistId !== checklistId);
    gc.checklistDocuments.forEach((c, i) => { c.displayOrder = i + 1; });
  }, "Update", `Template ${templateCode} / ${gateCode}: checklist document removed`, actor, actorRole);
}

// Drag-and-drop reorder — sets displayOrder directly from the dropped array position, replacing
// the old up/down-swap-only reorderChecklistDocument for drag call sites (that function stays,
// still used nowhere now that the view drags instead, but left intact rather than removed since
// deleting a working, harmless export isn't this task's concern).
export function reorderChecklistDocuments(templateCode, gateCode, orderedChecklistIds, actor, actorRole) {
  return withTemplate(templateCode, (t) => {
    const gc = t.gates.find((g) => g.gateCode === gateCode);
    if (!gc) throw new Error("Gate not part of this template's sequence.");
    const byId = Object.fromEntries((gc.checklistDocuments || []).map((c) => [c.checklistId, c]));
    gc.checklistDocuments = orderedChecklistIds.map((id, i) => ({ ...byId[id], displayOrder: i + 1 }));
  }, "Update", `Template ${templateCode} / ${gateCode}: checklist documents reordered`, actor, actorRole);
}

export function reorderChecklistDocument(templateCode, gateCode, checklistId, direction, actor, actorRole) {
  return withTemplate(templateCode, (t) => {
    const gc = t.gates.find((g) => g.gateCode === gateCode);
    if (!gc) throw new Error("Gate not part of this template's sequence.");
    const docs = (gc.checklistDocuments || []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = docs.findIndex((c) => c.checklistId === checklistId);
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || swapWith < 0 || swapWith >= docs.length) return;
    const a = docs[idx].displayOrder;
    docs[idx].displayOrder = docs[swapWith].displayOrder;
    docs[swapWith].displayOrder = a;
    gc.checklistDocuments = docs;
  }, "Update", `Template ${templateCode} / ${gateCode}: checklist document reordered`, actor, actorRole);
}
