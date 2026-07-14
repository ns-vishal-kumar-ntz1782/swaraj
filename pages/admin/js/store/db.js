// Namespaced localStorage persistence layer.
const NS = "spd";
const VERSION = "v1";

// Project-root data/ folder, resolved from this module's own URL so it works regardless of
// how deep the loading page is — same trick assets/js/auth.js uses for APP_ROOT.
export const DATA_ROOT = new URL("../../../../data/", import.meta.url).href;

// Synchronous XHR (not fetch) so every seedX() factory that reads a data/*.json file can stay
// a plain synchronous function — the whole admin bootstrap (app.js's seedAll()) depends on
// seeding running in a fixed synchronous order, so this avoids having to convert it to async.
export function loadJsonSync(relPath) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", DATA_ROOT + relPath, false);
  xhr.send(null);
  return JSON.parse(xhr.responseText);
}

function key(entity) {
  return `${NS}.${entity}.${VERSION}`;
}

export function load(entity, fallback) {
  try {
    const raw = localStorage.getItem(key(entity));
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to load ${entity}`, e);
    return fallback;
  }
}

export function save(entity, data) {
  localStorage.setItem(key(entity), JSON.stringify(data));
  return data;
}

export function seedOnce(entity, factory) {
  const existing = load(entity, null);
  if (existing !== null) return existing;
  const seeded = factory();
  save(entity, seeded);
  return seeded;
}

export function clearAll() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(`${NS}.`))
    .forEach((k) => localStorage.removeItem(k));
}

export const ENTITY_KEYS = {
  USERS: "users",
  ROLES: "roles",
  RBAC: "rbac_matrix",
  GATES: "gates",
  GATE_TEMPLATES: "gate_templates",
  DELIVERABLES: "deliverables",
  DELIVERABLE_FORM_LINKS: "deliverable_form_links",
  FORM_TEMPLATES: "form_templates",
  BUILT_FORMS: "built_forms",
  FORM_SUBMISSIONS: "form_submissions",
  ACTIONS: "actions",
  AUDIT: "audit_log",
  NOTIFICATIONS: "notifications",
  SESSION: "session",
  PROJECTS_EXEC: "projects_exec",
  GATE_INSTANCES: "project_gate_instances",
  DELIVERABLE_ASSIGNMENTS: "project_deliverable_assignments",
  GATE_MASTER: "gate_master",
  PROJECT_TEMPLATES_ADMIN: "project_templates_admin",
  FORM_SCHEMAS: "form_schemas",
  SKIPPED_GATES: "skipped_gates",
  ORG_USERS: "org_users",
  ORG_ROLES: "org_roles",
  ACTION_REGISTER: "action_register",
  GATE_CHECKLIST_TEMPLATES: "gate_checklist_templates",
};
