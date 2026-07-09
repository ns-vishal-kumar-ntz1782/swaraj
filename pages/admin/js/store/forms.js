// Forms Library: seeded FormTemplates + user-built BuiltForms, unified through the same "form code" space.
import { load, save, seedOnce, ENTITY_KEYS } from "./db.js";
import { uid, nowIso, nextSequenceCode, parseCsv } from "../utils.js";
import { addAuditEntry } from "./audit.js";

export const FIELD_TYPES = ["text", "textarea", "number", "date", "select", "checkbox", "radio", "email", "phone"];

function seedTemplates() {
  return [
    {
      code: "FT-001", name: "Concept Review Form", type: "Review", stage: "G1", owner: "R&D Head",
      fieldsSchema: [
        { id: "projectName", label: "Project Name", type: "text", required: true },
        { id: "summary", label: "Concept Summary", type: "textarea", required: true },
        { id: "riskLevel", label: "Risk Level", type: "select", required: true, options: ["Low", "Medium", "High"] },
        { id: "targetDate", label: "Target Decision Date", type: "date", required: false },
        { id: "approverComments", label: "Approver Comments", type: "textarea", required: false },
      ],
    },
    {
      code: "FT-002", name: "Feasibility Assessment", type: "Assessment", stage: "G2", owner: "PMO Manager",
      fieldsSchema: [
        { id: "technicalFeasibility", label: "Technical Feasibility", type: "radio", required: true, options: ["Yes", "No", "Partial"] },
        { id: "costEstimate", label: "Cost Estimate", type: "number", required: true },
        { id: "currency", label: "Currency", type: "select", required: false, options: ["INR", "USD", "EUR"] },
        { id: "notes", label: "Notes", type: "textarea", required: false },
      ],
    },
    {
      code: "FT-003", name: "Design Review Checklist", type: "Checklist", stage: "G3", owner: "Engineer",
      fieldsSchema: [
        { id: "designDocLink", label: "Design Document Link", type: "text", required: true },
        { id: "reviewedBy", label: "Reviewed By", type: "text", required: true },
        { id: "passed", label: "Review Passed", type: "checkbox", required: false },
        { id: "comments", label: "Comments", type: "textarea", required: false },
      ],
    },
    {
      code: "FT-004", name: "Budget Approval Request", type: "Approval", stage: "G2", owner: "Finance Manager",
      fieldsSchema: [
        { id: "requestedAmount", label: "Requested Amount", type: "number", required: true },
        { id: "justification", label: "Justification", type: "textarea", required: true },
        { id: "department", label: "Department", type: "select", required: true, options: ["R&D", "Engineering", "Manufacturing", "Finance"] },
        { id: "contactEmail", label: "Contact Email", type: "email", required: false },
      ],
    },
    {
      code: "FT-005", name: "Prototype Test Report", type: "Report", stage: "G4", owner: "Engineer",
      fieldsSchema: [
        { id: "testDate", label: "Test Date", type: "date", required: true },
        { id: "testResult", label: "Test Result", type: "radio", required: true, options: ["Pass", "Fail"] },
        { id: "defectCount", label: "Defect Count", type: "number", required: false },
        { id: "attachmentsNote", label: "Attachments Note", type: "textarea", required: false },
        { id: "contactPhone", label: "Contact Phone", type: "phone", required: false },
      ],
    },
    {
      code: "FT-006", name: "Launch Readiness Sign-off", type: "Signoff", stage: "G7", owner: "CEO",
      fieldsSchema: [
        { id: "readinessScore", label: "Readiness Score (%)", type: "number", required: true },
        { id: "signOffDate", label: "Sign-off Date", type: "date", required: true },
        { id: "finalComments", label: "Final Comments", type: "textarea", required: false },
        { id: "approved", label: "Approved for Launch", type: "checkbox", required: false },
      ],
    },
  ];
}

export function ensureSeeded() {
  seedOnce(ENTITY_KEYS.FORM_TEMPLATES, seedTemplates);
  seedOnce(ENTITY_KEYS.BUILT_FORMS, () => []);
}

function templates() { return load(ENTITY_KEYS.FORM_TEMPLATES, []); }
function builtForms() { return load(ENTITY_KEYS.BUILT_FORMS, []); }

// Unified view: every row has {code, name, type, stage, owner, fieldsSchema, source}
export function listAllForms() {
  const t = templates().map((f) => ({ ...f, source: "Seeded" }));
  const b = builtForms().map((f) => ({
    code: f.code, name: f.name, type: f.type, stage: f.stage, owner: f.owner,
    fieldsSchema: flattenSections(f.sections), source: "Built", sections: f.sections, createdAt: f.createdAt,
  }));
  return [...t, ...b].sort((a, b2) => a.code.localeCompare(b2.code));
}

function flattenSections(sections) {
  return (sections || []).flatMap((s) => s.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, required: f.required })));
}

export function getForm(code) {
  return listAllForms().find((f) => f.code === code) || null;
}

export function getBuiltForm(code) {
  return builtForms().find((f) => f.code === code) || null;
}

export function saveBuiltForm(data, actor, actorRole) {
  const list = builtForms();
  if (data.code) {
    const idx = list.findIndex((f) => f.code === data.code);
    if (idx === -1) throw new Error("Form not found.");
    const before = { ...list[idx] };
    list[idx] = { ...list[idx], ...data };
    save(ENTITY_KEYS.BUILT_FORMS, list);
    addAuditEntry({ actor, actorRole, action: "Update", entityType: "Form", entityId: data.code, summary: `Form ${data.code} "${data.name}" updated`, before, after: list[idx] });
    return list[idx];
  }
  const code = nextSequenceCode(list.map((f) => f.code), "FB00", 1);
  const form = {
    code, name: data.name, type: data.type || "Custom", stage: data.stage || "G1",
    owner: data.owner || "", sections: data.sections || [], createdAt: nowIso(),
  };
  list.push(form);
  save(ENTITY_KEYS.BUILT_FORMS, list);
  addAuditEntry({ actor, actorRole, action: "Create", entityType: "Form", entityId: form.code, summary: `Custom form ${form.code} "${form.name}" built`, before: null, after: form });
  return form;
}

export function deleteForm(code, actor, actorRole) {
  const list = builtForms();
  const target = list.find((f) => f.code === code);
  if (target) {
    save(ENTITY_KEYS.BUILT_FORMS, list.filter((f) => f.code !== code));
    addAuditEntry({ actor, actorRole, action: "Delete", entityType: "Form", entityId: code, summary: `Custom form ${code} "${target.name}" deleted`, before: target, after: null });
    return;
  }
  const t = templates();
  const tTarget = t.find((f) => f.code === code);
  if (tTarget) {
    save(ENTITY_KEYS.FORM_TEMPLATES, t.filter((f) => f.code !== code));
    addAuditEntry({ actor, actorRole, action: "Delete", entityType: "Form", entityId: code, summary: `Seeded form ${code} "${tTarget.name}" deleted`, before: tTarget, after: null });
  }
}

// ---- import: real CSV/JSON parsing for form templates ----
export function importForms(fileText, fileName, actor, actorRole) {
  let rows;
  if (fileName.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(fileText);
    rows = Array.isArray(parsed) ? parsed : parsed.forms || [];
  } else {
    rows = parseCsv(fileText);
  }
  const list = templates();
  let created = 0, updated = 0;
  rows.forEach((row) => {
    const name = row.name || row.Name;
    if (!name) return;
    let fieldsSchema = row.fieldsSchema;
    if (typeof fieldsSchema === "string") {
      try { fieldsSchema = JSON.parse(fieldsSchema); } catch { fieldsSchema = []; }
    }
    const payload = {
      name, type: row.type || row.Type || "Custom", stage: row.stage || row.Stage || "G1",
      owner: row.owner || row.Owner || "", fieldsSchema: fieldsSchema || [],
    };
    const code = row.code || row.Code;
    const existing = code && list.find((f) => f.code === code);
    if (existing) { Object.assign(existing, payload); updated++; }
    else {
      const newCode = code || nextSequenceCode(list.map((f) => f.code), "FT-", 3);
      list.push({ code: newCode, ...payload });
      created++;
    }
  });
  save(ENTITY_KEYS.FORM_TEMPLATES, list);
  addAuditEntry({ actor, actorRole, action: "BulkImport", entityType: "Form", entityId: "bulk", summary: `Form library import from "${fileName}": ${created} created, ${updated} updated`, before: null, after: { created, updated } });
  return { created, updated };
}
