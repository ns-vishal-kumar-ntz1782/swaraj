import { load, save, seedOnce, ENTITY_KEYS } from "./db.js";
import { uid, nowIso } from "../utils.js";
import { addAuditEntry } from "./audit.js";
import { notify } from "./notifications.js";
import { BUSINESS_ROLES, can } from "../rbac.js";
import { GATE_CODES, GATE_NAMES } from "./gateTemplates.js";

export { GATE_CODES, GATE_NAMES };

const STATUSES = ["Draft", "Active", "UnderReview", "Approved", "Rejected", "Closed"];

function seedGates() {
  const today = new Date();
  const iso = (offsetDays) => new Date(today.getTime() + offsetDays * 86400000).toISOString().slice(0, 10);
  return [
    {
      id: uid("gate"), projectCode: "PRJ-100", code: "G1", name: GATE_NAMES.G1,
      description: "Initial concept sign-off for the PRJ-100 launch program.",
      plannedStart: iso(-40), plannedEnd: iso(-25), actualStart: iso(-39), actualEnd: iso(-24),
      owner: "R&D Head", status: "Approved",
      deliverableAssignments: [
        { no: "D001", mandatory: true, dueDate: iso(-28), status: "Completed", responsibleMembers: ["Rohit Verma"], actualCompletedDate: iso(-27) },
      ],
      formAssignments: [
        { code: "FT-001", mandatory: true, dueDate: iso(-28), status: "Completed", linkedDeliverable: "D001" },
      ],
      approvals: [
        { id: uid("apr"), approver: "Priya Menon", role: "PMO Manager", action: "Submitted", timestamp: iso(-26), comments: "Ready for review." },
        { id: uid("apr"), approver: "Alan Roy", role: "R&D Head", action: "Approved", timestamp: iso(-24), comments: "Concept approved." },
      ],
    },
    {
      id: uid("gate"), projectCode: "PRJ-100", code: "G2", name: GATE_NAMES.G2,
      description: "Feasibility study covering technical and financial viability.",
      plannedStart: iso(-24), plannedEnd: iso(-5), actualStart: iso(-23), actualEnd: "",
      owner: "PMO Manager", status: "UnderReview",
      deliverableAssignments: [
        { no: "D002", mandatory: true, dueDate: iso(-2), status: "Submitted", responsibleMembers: ["Neha Kapoor"], actualCompletedDate: "" },
        { no: "D003", mandatory: false, dueDate: iso(3), status: "InProgress", responsibleMembers: ["Rohit Verma"], actualCompletedDate: "" },
      ],
      formAssignments: [
        { code: "FT-002", mandatory: true, dueDate: iso(-2), status: "Submitted", linkedDeliverable: "D002" },
      ],
      approvals: [
        { id: uid("apr"), approver: "Priya Menon", role: "PMO Manager", action: "Submitted", timestamp: iso(-1), comments: "Feasibility package submitted for approval." },
      ],
    },
    {
      id: uid("gate"), projectCode: "PRJ-200", code: "G1", name: GATE_NAMES.G1,
      description: "Concept approval for PRJ-200 accessory line.",
      plannedStart: iso(-10), plannedEnd: iso(10), actualStart: iso(-9), actualEnd: "",
      owner: "R&D Head", status: "Active",
      deliverableAssignments: [
        { no: "D004", mandatory: true, dueDate: iso(6), status: "Pending", responsibleMembers: ["Rohit Verma"], actualCompletedDate: "" },
      ],
      formAssignments: [
        { code: "FT-001", mandatory: true, dueDate: iso(6), status: "Pending", linkedDeliverable: "D004" },
      ],
      approvals: [],
    },
    {
      id: uid("gate"), projectCode: "PRJ-200", code: "G2", name: GATE_NAMES.G2,
      description: "Feasibility review pending kick-off.",
      plannedStart: iso(11), plannedEnd: iso(30), actualStart: "", actualEnd: "",
      owner: "PMO Manager", status: "Draft",
      deliverableAssignments: [], formAssignments: [], approvals: [],
    },
  ];
}

export function ensureSeeded() {
  return seedOnce(ENTITY_KEYS.GATES, seedGates);
}

function all() {
  return load(ENTITY_KEYS.GATES, []);
}
function persist(gates) {
  save(ENTITY_KEYS.GATES, gates);
}

export function listGates(filters = {}) {
  let gates = all();
  const { projectCode, code, status, owner, q } = filters;
  if (projectCode) gates = gates.filter((g) => g.projectCode === projectCode);
  if (code) gates = gates.filter((g) => g.code === code);
  if (status) gates = gates.filter((g) => g.status === status);
  if (owner) gates = gates.filter((g) => g.owner === owner);
  if (q) {
    const needle = q.toLowerCase();
    gates = gates.filter((g) => [g.projectCode, g.code, g.name, g.owner].some((f) => String(f).toLowerCase().includes(needle)));
  }
  return gates.sort((a, b) => (a.projectCode + a.code).localeCompare(b.projectCode + b.code));
}

export function getGate(id) {
  return all().find((g) => g.id === id) || null;
}

export function distinctProjectCodes() {
  return Array.from(new Set(all().map((g) => g.projectCode))).sort();
}

export function createGate(data, actor, actorRole) {
  const gates = all();
  if (!data.projectCode || !data.code || !data.name) throw new Error("Project code, gate code and name are required.");
  if (!GATE_CODES.includes(data.code)) throw new Error("Gate code must be one of " + GATE_CODES.join(", "));
  if (gates.some((g) => g.projectCode === data.projectCode && g.code === data.code)) {
    throw new Error(`Gate ${data.code} already exists for project ${data.projectCode}.`);
  }
  if (data.plannedStart && data.plannedEnd && data.plannedEnd < data.plannedStart) {
    throw new Error("Planned end date cannot be before planned start date.");
  }
  const gate = {
    id: uid("gate"),
    projectCode: data.projectCode,
    code: data.code,
    name: data.name,
    description: data.description || "",
    plannedStart: data.plannedStart || "",
    plannedEnd: data.plannedEnd || "",
    actualStart: data.actualStart || "",
    actualEnd: data.actualEnd || "",
    owner: data.owner || "",
    status: "Draft",
    deliverableAssignments: [],
    formAssignments: [],
    approvals: [],
    checklist: [],
  };
  gates.push(gate);
  persist(gates);
  addAuditEntry({
    actor, actorRole, action: "Create", entityType: "Gate", entityId: gate.id, projectCode: gate.projectCode, gateCode: gate.code,
    summary: `Gate ${gate.code} (${gate.name}) created for ${gate.projectCode}`, before: null, after: gate,
  });
  return gate;
}

function mutateGate(id, mutator, actor, actorRole, actionLabel, summary) {
  const gates = all();
  const idx = gates.findIndex((g) => g.id === id);
  if (idx === -1) throw new Error("Gate not found.");
  const before = JSON.parse(JSON.stringify(gates[idx]));
  mutator(gates[idx]);
  persist(gates);
  addAuditEntry({
    actor, actorRole, action: actionLabel, entityType: "Gate", entityId: id,
    projectCode: gates[idx].projectCode, gateCode: gates[idx].code,
    summary, before, after: gates[idx],
  });
  return gates[idx];
}

export function updateGate(id, patch, actor, actorRole) {
  if (patch.plannedStart && patch.plannedEnd && patch.plannedEnd < patch.plannedStart) {
    throw new Error("Planned end date cannot be before planned start date.");
  }
  return mutateGate(id, (g) => Object.assign(g, patch), actor, actorRole, "Update",
    `Gate ${getGate(id)?.code} details updated`);
}

export function deleteGate(id, actor, actorRole) {
  const gates = all();
  const target = gates.find((g) => g.id === id);
  if (!target) return;
  persist(gates.filter((g) => g.id !== id));
  addAuditEntry({
    actor, actorRole, action: "Delete", entityType: "Gate", entityId: id,
    projectCode: target.projectCode, gateCode: target.code,
    summary: `Gate ${target.code} (${target.projectCode}) deleted`, before: target, after: null,
  });
}

export function activateGate(id, actor, actorRole) {
  return mutateGate(id, (g) => { g.status = "Active"; }, actor, actorRole, "Activate",
    `Gate ${getGate(id)?.code} activated`);
}

// ---- deliverable / form assignments ----
export function addDeliverableAssignment(gateId, assignment, actor, actorRole) {
  return mutateGate(gateId, (g) => {
    g.deliverableAssignments.push({
      no: assignment.no, mandatory: !!assignment.mandatory, dueDate: assignment.dueDate || "",
      status: assignment.status || "Pending", responsibleMembers: assignment.responsibleMembers || [],
      actualCompletedDate: "",
    });
  }, actor, actorRole, "Update", `Deliverable ${assignment.no} assigned to gate ${getGate(gateId)?.code}`);
}

export function updateDeliverableAssignment(gateId, no, patch, actor, actorRole) {
  return mutateGate(gateId, (g) => {
    const da = g.deliverableAssignments.find((d) => d.no === no);
    if (!da) throw new Error("Deliverable assignment not found.");
    Object.assign(da, patch);
  }, actor, actorRole, "Update", `Deliverable ${no} assignment updated on gate ${getGate(gateId)?.code}`);
}

export function addFormAssignment(gateId, assignment, actor, actorRole) {
  return mutateGate(gateId, (g) => {
    g.formAssignments.push({
      code: assignment.code, mandatory: !!assignment.mandatory, dueDate: assignment.dueDate || "",
      status: assignment.status || "Pending", linkedDeliverable: assignment.linkedDeliverable || "",
    });
  }, actor, actorRole, "Update", `Form ${assignment.code} assigned to gate ${getGate(gateId)?.code}`);
}

export function updateFormAssignment(gateId, code, patch, actor, actorRole) {
  return mutateGate(gateId, (g) => {
    const fa = g.formAssignments.find((f) => f.code === code);
    if (!fa) throw new Error("Form assignment not found.");
    Object.assign(fa, patch);
  }, actor, actorRole, "Update", `Form ${code} assignment updated on gate ${getGate(gateId)?.code}`);
}

// ---- approval state machine ----
function rolesWithButton(buttonId) {
  return BUSINESS_ROLES.filter((role) => can(role, buttonId));
}

export function submitGateForApproval(id, actor, actorRole, comments) {
  const gate = getGate(id);
  if (!gate) throw new Error("Gate not found.");
  if (!["Active", "Rejected"].includes(gate.status)) throw new Error("Only an Active or Rejected gate can be submitted for approval.");
  const updated = mutateGate(id, (g) => {
    g.status = "UnderReview";
    g.approvals.push({ id: uid("apr"), approver: actor, role: actorRole, action: "Submitted", timestamp: nowIso(), comments: comments || "" });
  }, actor, actorRole, "Submit", `Gate ${gate.code} (${gate.projectCode}) submitted for approval`);
  rolesWithButton("gate.approve").forEach((role) => {
    notify({ toRole: role, title: "Gate awaiting approval", message: `Gate ${gate.code} for ${gate.projectCode} needs your approval.`, entityType: "Gate", entityId: id, route: `#/gates/${id}` });
  });
  return updated;
}

export function approveGate(id, actor, actorRole, comments) {
  const gate = getGate(id);
  if (!gate) throw new Error("Gate not found.");
  if (gate.status !== "UnderReview") throw new Error("Only a gate UnderReview can be approved.");
  const updated = mutateGate(id, (g) => {
    g.status = "Approved";
    g.approvals.push({ id: uid("apr"), approver: actor, role: actorRole, action: "Approved", timestamp: nowIso(), comments: comments || "" });
  }, actor, actorRole, "Approve", `Gate ${gate.code} (${gate.projectCode}) approved by ${actor}`);
  notify({ toRole: gate.owner && BUSINESS_ROLES.includes(gate.owner) ? gate.owner : null, title: "Gate approved", message: `Gate ${gate.code} for ${gate.projectCode} was approved.`, entityType: "Gate", entityId: id, route: `#/gates/${id}` });
  return updated;
}

export function rejectGate(id, actor, actorRole, comments) {
  const gate = getGate(id);
  if (!gate) throw new Error("Gate not found.");
  if (gate.status !== "UnderReview") throw new Error("Only a gate UnderReview can be rejected.");
  const updated = mutateGate(id, (g) => {
    g.status = "Rejected";
    g.approvals.push({ id: uid("apr"), approver: actor, role: actorRole, action: "Rejected", timestamp: nowIso(), comments: comments || "" });
  }, actor, actorRole, "Reject", `Gate ${gate.code} (${gate.projectCode}) rejected by ${actor}`);
  return updated;
}

export function sendBackGate(id, actor, actorRole, comments) {
  const gate = getGate(id);
  if (!gate) throw new Error("Gate not found.");
  if (gate.status !== "UnderReview") throw new Error("Only a gate UnderReview can be sent back.");
  const updated = mutateGate(id, (g) => {
    g.status = "Active";
    g.approvals.push({ id: uid("apr"), approver: actor, role: actorRole, action: "SentBack", timestamp: nowIso(), comments: comments || "" });
  }, actor, actorRole, "SendBack", `Gate ${gate.code} (${gate.projectCode}) sent back by ${actor}`);
  return updated;
}

export function closeGate(id, actor, actorRole, comments) {
  const gate = getGate(id);
  if (!gate) throw new Error("Gate not found.");
  if (gate.status !== "Approved") throw new Error("Only an Approved gate can be closed.");
  const updated = mutateGate(id, (g) => {
    g.status = "Closed";
    g.approvals.push({ id: uid("apr"), approver: actor, role: actorRole, action: "Closed", timestamp: nowIso(), comments: comments || "" });
  }, actor, actorRole, "Close", `Gate ${gate.code} (${gate.projectCode}) closed by ${actor}`);
  return updated;
}

// ---- checklist-template-driven document panel (uploads simulated as filenames) ----
export function uploadChecklistDoc(gateId, templateItemId, fileName, actor, actorRole) {
  return mutateGate(gateId, (g) => {
    if (!g.checklist) g.checklist = [];
    let entry = g.checklist.find((c) => c.templateItemId === templateItemId);
    if (!entry) { entry = { templateItemId, fileName: "", uploadedAt: "", approved: false, approvedBy: "", approvedAt: "" }; g.checklist.push(entry); }
    entry.fileName = fileName;
    entry.uploadedAt = nowIso();
    entry.approved = false;
    entry.approvedBy = "";
    entry.approvedAt = "";
  }, actor, actorRole, "Update", `Checklist document "${fileName}" uploaded on gate ${getGate(gateId)?.code}`);
}

export function approveChecklistDoc(gateId, templateItemId, actor, actorRole) {
  return mutateGate(gateId, (g) => {
    const entry = (g.checklist || []).find((c) => c.templateItemId === templateItemId);
    if (!entry) throw new Error("No document uploaded for this checklist item yet.");
    entry.approved = true;
    entry.approvedBy = actor;
    entry.approvedAt = nowIso();
  }, actor, actorRole, "Approve", `Checklist document approved on gate ${getGate(gateId)?.code}`);
}

export function readinessScore(gate) {
  const items = [
    ...gate.deliverableAssignments.filter((d) => d.mandatory),
    ...gate.formAssignments.filter((f) => f.mandatory),
  ];
  if (!items.length) return 100;
  const done = items.filter((i) => i.status === "Completed" || i.status === "Submitted").length;
  return Math.round((done / items.length) * 100);
}
