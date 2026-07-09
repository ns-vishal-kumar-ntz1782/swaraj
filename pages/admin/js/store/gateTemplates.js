// GateChecklistTemplateItem — admin-managed checklist per gate code (G1..G8), independent of live Gate instances.
import { load, save, seedOnce, ENTITY_KEYS } from "./db.js";
import { uid, nowIso } from "../utils.js";
import { addAuditEntry } from "./audit.js";

export const GATE_CODES = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"];
export const GATE_NAMES = {
  G1: "Concept Approval", G2: "Feasibility Review", G3: "Design Freeze",
  G4: "Prototype Validation", G5: "Process Validation", G6: "Pilot Production",
  G7: "Launch Readiness", G8: "Post-Launch Review",
};

function seedTemplates() {
  const items = [];
  GATE_CODES.forEach((code, gi) => {
    const defs = [
      { name: "Business case document", mandatory: true, responsibility: "PMO Manager" },
      { name: "Technical feasibility sign-off", mandatory: true, responsibility: "R&D Head" },
      { name: "Budget approval", mandatory: gi % 2 === 0, responsibility: "Finance Manager" },
      { name: "Risk assessment log", mandatory: false, responsibility: "Engineer" },
    ];
    defs.forEach((d, i) => {
      items.push({
        id: uid("gti"),
        gateCode: code,
        name: d.name,
        description: `${d.name} required for ${GATE_NAMES[code]} (${code}).`,
        mandatory: d.mandatory,
        targetDate: "",
        responsibility: d.responsibility,
        order: i,
      });
    });
  });
  return items;
}

export function ensureSeeded() {
  return seedOnce(ENTITY_KEYS.GATE_TEMPLATES, seedTemplates);
}

function all() {
  return load(ENTITY_KEYS.GATE_TEMPLATES, []);
}

export function listTemplateItems(gateCode) {
  const items = all();
  return gateCode ? items.filter((i) => i.gateCode === gateCode) : items;
}

export function createTemplateItem(data, actor, actorRole) {
  const items = all();
  const item = { id: uid("gti"), order: items.filter((i) => i.gateCode === data.gateCode).length, ...data };
  items.push(item);
  save(ENTITY_KEYS.GATE_TEMPLATES, items);
  addAuditEntry({
    actor, actorRole, action: "Create", entityType: "GateChecklistTemplate", entityId: item.id,
    gateCode: item.gateCode, summary: `Checklist item "${item.name}" added to ${item.gateCode}`, before: null, after: item,
  });
  return item;
}

export function updateTemplateItem(id, patch, actor, actorRole) {
  const items = all();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error("Checklist item not found.");
  const before = { ...items[idx] };
  items[idx] = { ...items[idx], ...patch };
  save(ENTITY_KEYS.GATE_TEMPLATES, items);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "GateChecklistTemplate", entityId: id,
    gateCode: items[idx].gateCode, summary: `Checklist item "${items[idx].name}" updated`, before, after: items[idx],
  });
  return items[idx];
}

export function deleteTemplateItem(id, actor, actorRole) {
  const items = all();
  const target = items.find((i) => i.id === id);
  if (!target) return;
  save(ENTITY_KEYS.GATE_TEMPLATES, items.filter((i) => i.id !== id));
  addAuditEntry({
    actor, actorRole, action: "Delete", entityType: "GateChecklistTemplate", entityId: id,
    gateCode: target.gateCode, summary: `Checklist item "${target.name}" removed from ${target.gateCode}`, before: target, after: null,
  });
}
