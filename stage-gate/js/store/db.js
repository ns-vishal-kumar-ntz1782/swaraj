// Namespaced localStorage persistence layer.
const NS = "spd";
const VERSION = "v1";

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
};
