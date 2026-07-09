// ONE RBAC matrix. Every module in the app must check this matrix — no hardcoded role checks.
import { load, save, ENTITY_KEYS } from "./store/db.js";
import { addAuditEntry } from "./store/audit.js";

export const BUSINESS_ROLES = [
  "R&D Head",
  "PMO Manager",
  "CEO",
  "Finance Manager",
  "System Administrator",
  "Engineer",
];

export const ALL_MENUS = [
  "gates", "gate-templates", "deliverables", "forms",
  "form-builder", "actions", "audit", "users", "rbac-admin",
];

// Page/route ids enforced by the router. Detail routes reuse their parent's page id.
export const ALL_PAGES = [...ALL_MENUS];

// Purely a sidebar grouping label — governance/admin screens vs. day-to-day workspace screens.
// Visibility is still driven entirely by RBAC.menus; this only decides which header a visible item sits under.
export const ADMIN_MENU_IDS = ["gate-templates", "users", "rbac-admin"];
export const WORKSPACE_MENU_IDS = ALL_MENUS.filter((m) => !ADMIN_MENU_IDS.includes(m));

export const ALL_BUTTONS = [
  "gate.create", "gate.edit", "gate.approve", "gate.delete",
  "gatetemplate.manage",
  "deliverable.create", "deliverable.edit", "deliverable.complete", "deliverable.library.manage",
  "form.library.manage", "form.builder.use", "form.submission.approve", "form.submission.fill",
  "action.manage",
  "user.manage", "rbac.manage",
];

export const MENU_LABELS = {
  "gates": "Gate Master",
  "gate-templates": "Checklist Templates",
  "deliverables": "Deliverable Library",
  "forms": "Forms Library",
  "form-builder": "Form Builder",
  "actions": "Action Register",
  "audit": "Activity Log",
  "users": "Users & Roles",
  "rbac-admin": "RBAC Matrix",
};

export const BUTTON_LABELS = {
  "gate.create": "Create Gate",
  "gate.edit": "Edit Gate",
  "gate.approve": "Approve/Reject Gate",
  "gate.delete": "Delete Gate",
  "gatetemplate.manage": "Manage Checklist Templates",
  "deliverable.create": "Create Deliverable",
  "deliverable.edit": "Edit Deliverable",
  "deliverable.complete": "Complete Deliverable (owner)",
  "deliverable.library.manage": "Manage Deliverable Library (import/link)",
  "form.library.manage": "Manage Forms Library (import/delete)",
  "form.builder.use": "Use Form Builder",
  "form.submission.approve": "Approve Form Submission",
  "form.submission.fill": "Fill / Submit Form",
  "action.manage": "Manage Action Items",
  "user.manage": "Manage Users",
  "rbac.manage": "Manage RBAC Matrix",
};

function base(menus, buttons) {
  return { menus, pages: [...menus], buttons };
}

export const DEFAULT_MATRIX = {
  "System Administrator": base([...ALL_MENUS], [...ALL_BUTTONS]),

  "CEO": base(
    ["gates", "deliverables", "forms", "actions", "audit"],
    ["gate.approve", "form.submission.approve"]
  ),

  "R&D Head": base(
    ["gates", "deliverables", "forms", "actions", "audit"],
    ["gate.create", "gate.edit", "gate.approve", "deliverable.edit", "deliverable.complete", "form.submission.approve", "form.submission.fill", "action.manage"]
  ),

  "PMO Manager": base(
    ["gates", "deliverables", "forms", "form-builder", "actions", "audit"],
    ["gate.create", "gate.edit", "gate.approve", "deliverable.create", "deliverable.edit", "form.builder.use", "form.submission.approve", "form.submission.fill", "action.manage"]
  ),

  "Finance Manager": base(
    ["gates", "deliverables", "forms", "actions", "audit"],
    ["gate.approve", "form.submission.approve", "form.submission.fill", "action.manage"]
  ),

  "Engineer": base(
    ["gates", "deliverables", "forms", "actions"],
    ["deliverable.complete", "form.submission.fill", "action.manage"]
  ),
};

export function getMatrix() {
  return load(ENTITY_KEYS.RBAC, null) || cloneDefault();
}

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_MATRIX));
}

export function ensureSeeded() {
  if (load(ENTITY_KEYS.RBAC, null) === null) {
    save(ENTITY_KEYS.RBAC, cloneDefault());
  }
}

export function saveMatrix(matrix, actor, actorRole) {
  const before = getMatrix();
  save(ENTITY_KEYS.RBAC, matrix);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "RBACMatrix", entityId: "matrix",
    summary: `RBAC matrix updated by ${actor}`, before, after: matrix,
  });
  return matrix;
}

export function resetRoleToDefault(role, actor, actorRole) {
  const matrix = getMatrix();
  const before = JSON.parse(JSON.stringify(matrix));
  matrix[role] = JSON.parse(JSON.stringify(DEFAULT_MATRIX[role]));
  save(ENTITY_KEYS.RBAC, matrix);
  addAuditEntry({
    actor, actorRole, action: "Reset", entityType: "RBACMatrix", entityId: role,
    summary: `RBAC defaults restored for role "${role}" by ${actor}`, before, after: matrix,
  });
  return matrix;
}

function roleConfig(role) {
  const matrix = getMatrix();
  return matrix[role] || { menus: [], pages: [], buttons: [] };
}

export function canSeeMenu(role, menuId) {
  return roleConfig(role).menus.includes(menuId);
}
export function canOpenPage(role, pageId) {
  return roleConfig(role).pages.includes(pageId);
}
export function can(role, buttonId) {
  return roleConfig(role).buttons.includes(buttonId);
}
export function menusFor(role) {
  const allowed = roleConfig(role).menus;
  return ALL_MENUS.filter((m) => allowed.includes(m));
}
