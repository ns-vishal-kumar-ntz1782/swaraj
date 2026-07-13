// Enterprise Roles — the 23-role organizational catalog from data/orgRoles.json (department +
// hierarchy). This is deliberately separate from store/roles.js, the small 6-role catalog RBAC's
// permission matrix is keyed against — that one keeps governing "what can the logged-in console
// operator do" unchanged; this one is the HR-style "what roles exist in the company" catalog.
import { load, save, seedOnce, ENTITY_KEYS, loadJsonSync } from "./db.js";
import { addAuditEntry } from "./audit.js";
import { listOrgUsers } from "./orgUsersAdmin.js";

const _orgDepartments = loadJsonSync("orgDepartments.json");
export const DEPARTMENTS = _orgDepartments.map((d) => d.name).sort();

export function ensureSeeded() {
  seedOnce(ENTITY_KEYS.ORG_ROLES, () => loadJsonSync("orgRoles.json"));
}

function all() {
  return load(ENTITY_KEYS.ORG_ROLES, []);
}
function persist(list) {
  save(ENTITY_KEYS.ORG_ROLES, list);
}

export function listOrgRoles() {
  return all().slice().sort((a, b) => a.hierarchyLevel - b.hierarchyLevel || a.name.localeCompare(b.name));
}
export function getOrgRole(code) {
  return all().find((r) => r.code === code) || null;
}
export function peopleCountForRole(roleName) {
  return listOrgUsers({ businessRole: roleName }).length;
}

function nextRoleId(list) {
  let max = 0;
  for (const r of list) {
    const m = String(r.id).match(/^ROLE-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `ROLE-${String(max + 1).padStart(2, "0")}`;
}

export function createOrgRole(data, actor, actorRole) {
  const list = all();
  if (list.some((r) => r.code.toLowerCase() === data.code.toLowerCase())) throw new Error(`Role code "${data.code}" already exists.`);
  const role = {
    id: nextRoleId(list), code: data.code.trim(), name: data.name.trim(),
    department: data.department, hierarchyLevel: Number(data.hierarchyLevel) || 5, description: data.description || "",
  };
  list.push(role);
  persist(list);
  addAuditEntry({ actor, actorRole, action: "Create", entityType: "OrgRole", entityId: role.code, summary: `Role "${role.name}" created`, before: null, after: role });
  return role;
}

export function updateOrgRole(code, patch, actor, actorRole) {
  const list = all();
  const idx = list.findIndex((r) => r.code === code);
  if (idx === -1) throw new Error("Role not found.");
  const before = { ...list[idx] };
  list[idx] = { ...list[idx], ...patch, code: list[idx].code, id: list[idx].id };
  persist(list);
  addAuditEntry({ actor, actorRole, action: "Update", entityType: "OrgRole", entityId: code, summary: `Role "${code}" updated`, before, after: list[idx] });
  return list[idx];
}

export function deleteOrgRole(code, actor, actorRole) {
  const role = getOrgRole(code);
  if (!role) return;
  if (peopleCountForRole(role.name) > 0) throw new Error(`Cannot delete "${role.name}" — ${peopleCountForRole(role.name)} people are currently assigned to it.`);
  const list = all().filter((r) => r.code !== code);
  persist(list);
  addAuditEntry({ actor, actorRole, action: "Delete", entityType: "OrgRole", entityId: code, summary: `Role "${role.name}" deleted`, before: role, after: null });
}

export function cloneOrgRole(code, actor, actorRole) {
  const source = getOrgRole(code);
  if (!source) throw new Error("Role not found.");
  const list = all();
  let n = 2;
  let newCode = `${source.code}-${n}`;
  while (list.some((r) => r.code === newCode)) { n++; newCode = `${source.code}-${n}`; }
  const clone = { ...source, id: nextRoleId(list), code: newCode, name: `${source.name} (Copy)` };
  list.push(clone);
  persist(list);
  addAuditEntry({ actor, actorRole, action: "Create", entityType: "OrgRole", entityId: newCode, summary: `Role "${source.name}" cloned as "${clone.name}"`, before: null, after: clone });
  return clone;
}
