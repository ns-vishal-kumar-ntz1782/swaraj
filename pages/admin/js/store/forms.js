// Forms Library — the master catalog (45 seeded forms) from data/formsLibrary.json. A catalog
// entry's actual field structure (fieldsSchema/sections) is pure metadata-free in that file — it
// lives in a separate localStorage-only overlay keyed by formCode, authored via the Form Builder.
// This mirrors a real enterprise system: a form can exist in the catalog before anyone has built
// its schema yet ("Not built" state), same seed-then-overlay pattern as every other store here.
import { load, save, seedOnce, ENTITY_KEYS, loadJsonSync } from "./db.js";
import { uid, nowIso, parseCsv } from "../utils.js";
import { addAuditEntry } from "./audit.js";
import { listGates } from "./gateMasterAdmin.js";
import { listDeliverables } from "./deliverables.js";

export const FIELD_TYPES = [
  "text", "textarea", "number", "date", "select", "checkbox", "radio",
  "attachment", "table", "signature", "section", "instruction",
];
export const CONTROL_FIELD_TYPES = FIELD_TYPES.filter((t) => t !== "section"); // "section" is structural, not a palette-dropped field
export const VALIDATABLE_TYPES = ["text", "textarea", "number", "date"]; // regex pattern applies to these

// Reads Gate Master's own live (localStorage-backed) list every call — same rule as everywhere
// else, no hardcoded gate list.
export function stages() {
  return listGates({ includeInactive: false }).map((g) => g.gateCode);
}

export function ensureSeeded() {
  seedOnce(ENTITY_KEYS.FORM_TEMPLATES, () => loadJsonSync("formsLibrary.json"));
  seedOnce(ENTITY_KEYS.FORM_SCHEMAS, () => loadJsonSync("formSchemas.json"));
}

function catalog() { return load(ENTITY_KEYS.FORM_TEMPLATES, []); }
function persistCatalog(list) { save(ENTITY_KEYS.FORM_TEMPLATES, list); }
function schemas() { return load(ENTITY_KEYS.FORM_SCHEMAS, {}); }
function persistSchemas(map) { save(ENTITY_KEYS.FORM_SCHEMAS, map); }

export const CATEGORIES = [...new Set(loadJsonSync("formsLibrary.json").map((f) => f.formCategory))].sort();

// Unified row: catalog metadata + whatever schema (if any) has been authored for it.
export function listAllForms(filters = {}) {
  const schemaMap = schemas();
  let list = catalog().map((f) => {
    const schema = schemaMap[f.formCode];
    return {
      ...f,
      sections: schema?.sections || [],
      fieldCount: (schema?.sections || []).reduce((s, sec) => s + sec.fields.length, 0),
      built: !!schema,
      schemaVersion: schema?.version || null,
      schemaStatus: schema?.status || null,
      versionHistory: schema?.versionHistory || [],
    };
  });
  const { gateCode, formCategory, active, q } = filters;
  if (gateCode) list = list.filter((f) => f.gateCode === gateCode);
  if (formCategory) list = list.filter((f) => f.formCategory === formCategory);
  if (active === true || active === false) list = list.filter((f) => f.active === active);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((f) => [f.formCode, f.formName, f.description, f.formCategory].some((v) => String(v).toLowerCase().includes(needle)));
  }
  return list.sort((a, b) => a.formCode.localeCompare(b.formCode));
}

export function getForm(code) {
  return listAllForms().find((f) => f.formCode === code) || null;
}

// Delegates to the Deliverable Library's own live store (rather than a one-time raw JSON
// snapshot) so a link changed in that view's own Linked Form picker is reflected here immediately.
export function linkedDeliverablesFor(formCode) {
  return listDeliverables({ linkedFormCode: formCode });
}

function nextFormCode(list) {
  let max = 0;
  for (const f of list) {
    const m = String(f.formCode).match(/^FRM-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `FRM-${String(max + 1).padStart(3, "0")}`;
}

export function createCatalogEntry(data, actor, actorRole) {
  const list = catalog();
  const formCode = nextFormCode(list);
  const entry = {
    id: `FL-${String(list.length + 1).padStart(3, "0")}`, formCode,
    formName: data.formName.trim(), description: data.description || "",
    gateCode: data.gateCode || stages()[0], formCategory: data.formCategory || "General",
    estimatedCompletionTime: data.estimatedCompletionTime || "1 day", version: "1.0", active: true,
  };
  list.push(entry);
  persistCatalog(list);
  addAuditEntry({ actor, actorRole, action: "Create", entityType: "Form", entityId: formCode, summary: `Form ${formCode} "${entry.formName}" added to library`, before: null, after: entry });
  return entry;
}

export function updateCatalogEntry(formCode, patch, actor, actorRole) {
  const list = catalog();
  const idx = list.findIndex((f) => f.formCode === formCode);
  if (idx === -1) throw new Error("Form not found.");
  const before = { ...list[idx] };
  list[idx] = { ...list[idx], ...patch };
  persistCatalog(list);
  addAuditEntry({ actor, actorRole, action: "Update", entityType: "Form", entityId: formCode, summary: `Form ${formCode} updated`, before, after: list[idx] });
  return list[idx];
}

export function setFormActive(formCode, active, actor, actorRole) {
  return updateCatalogEntry(formCode, { active }, actor, actorRole);
}

export const FORM_STATUS_OPTIONS = ["Draft", "Published", "Archived", "Activated"];

// Saves the field schema for a form, bumping its version and appending a version-history entry.
// Each history entry carries its own sections snapshot (needed for Restore Version) plus the
// status it was saved under and an optional change summary — additive to the existing
// {version, savedAt, savedBy} shape, so older entries without these fields still read fine.
export function saveFormSchema(formCode, sections, actor, actorRole, opts = {}) {
  const { status = "Draft", changeSummary = "" } = opts;
  const map = schemas();
  const before = map[formCode] ? JSON.parse(JSON.stringify(map[formCode])) : null;
  const prevVersion = before?.version || "0.0";
  const [maj, min] = prevVersion.split(".").map(Number);
  const nextVersion = `${maj}.${min + 1}`;
  const history = (before?.versionHistory || []).concat([{
    version: nextVersion, savedAt: nowIso(), savedBy: actor, status, changeSummary,
    sections: JSON.parse(JSON.stringify(sections)),
  }]);
  map[formCode] = { sections, version: nextVersion, status, versionHistory: history };
  persistSchemas(map);
  updateCatalogEntry(formCode, { version: nextVersion }, actor, actorRole);
  addAuditEntry({ actor, actorRole, action: "Update", entityType: "FormSchema", entityId: formCode, summary: `Form ${formCode} schema saved as v${nextVersion} (${status})`, before, after: map[formCode] });
  return map[formCode];
}

// Restore = a forward-only new save copying a prior version's sections snapshot — history is
// never rewritten, a restore just becomes the newest entry (matches how saveFormSchema already
// only ever appends).
export function restoreFormSchemaVersion(formCode, version, actor, actorRole) {
  const schema = schemas()[formCode];
  if (!schema) throw new Error("Form has no schema yet.");
  const target = (schema.versionHistory || []).find((v) => v.version === version);
  if (!target || !target.sections) throw new Error("That version has no restorable snapshot.");
  return saveFormSchema(formCode, target.sections, actor, actorRole, {
    status: target.status || "Draft",
    changeSummary: `Restored from v${version}`,
  });
}

export function getFormSchema(formCode) {
  return schemas()[formCode] || null;
}

// Duplicates a form's catalog entry + schema under a brand-new formCode.
export function duplicateForm(formCode, actor, actorRole) {
  const source = getForm(formCode);
  if (!source) throw new Error("Form not found.");
  const list = catalog();
  const newCode = nextFormCode(list);
  const entry = {
    id: `FL-${String(list.length + 1).padStart(3, "0")}`, formCode: newCode,
    formName: `${source.formName} (Copy)`, description: source.description,
    gateCode: source.gateCode, formCategory: source.formCategory,
    estimatedCompletionTime: source.estimatedCompletionTime, version: "1.0", active: true,
  };
  list.push(entry);
  persistCatalog(list);
  if (source.sections.length) {
    const map = schemas();
    const clonedSections = JSON.parse(JSON.stringify(source.sections)).map((s) => ({ ...s, id: uid("sec") }));
    map[newCode] = {
      sections: clonedSections, version: "1.0", status: "Draft",
      versionHistory: [{ version: "1.0", savedAt: nowIso(), savedBy: actor, status: "Draft", changeSummary: `Cloned from ${formCode}`, sections: clonedSections }],
    };
    persistSchemas(map);
  }
  addAuditEntry({ actor, actorRole, action: "Create", entityType: "Form", entityId: newCode, summary: `Form ${formCode} duplicated as ${newCode}`, before: null, after: entry });
  return entry;
}

// ---- import: catalog metadata only (schemas are always authored through the Builder) ----
export function importForms(fileText, fileName, actor, actorRole) {
  let rows;
  if (fileName.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(fileText);
    rows = Array.isArray(parsed) ? parsed : parsed.forms || [];
  } else {
    rows = parseCsv(fileText);
  }
  const list = catalog();
  let created = 0, updated = 0;
  rows.forEach((row) => {
    const formName = row.formName || row.Name || row.name;
    if (!formName) return;
    const payload = {
      formName, description: row.description || row.Description || "",
      gateCode: row.gateCode || row.Stage || row.stage || stages()[0],
      formCategory: row.formCategory || row.Category || "General",
      estimatedCompletionTime: row.estimatedCompletionTime || row.Duration || "1 day",
      active: String(row.active ?? row.Active ?? "true").toLowerCase() !== "false",
    };
    const code = row.formCode || row.Code || row.code;
    const existing = code && list.find((f) => f.formCode === code);
    if (existing) { Object.assign(existing, payload); updated++; }
    else {
      const newCode = code || nextFormCode(list);
      list.push({ id: `FL-${String(list.length + 1).padStart(3, "0")}`, formCode: newCode, version: "1.0", ...payload });
      created++;
    }
  });
  persistCatalog(list);
  addAuditEntry({ actor, actorRole, action: "BulkImport", entityType: "Form", entityId: "bulk", summary: `Form library import from "${fileName}": ${created} created, ${updated} updated`, before: null, after: { created, updated } });
  return { created, updated };
}
