// Business role catalog — what Users assigns and RBAC Matrix configures. Role *names* are used
// as the key everywhere else in the app already (User.businessRole, RBAC matrix keys, form
// submission role checks), so this store keys roles by name rather than a separate id, to avoid
// having to thread a new id through every existing consumer.
import { load, save, seedOnce, ENTITY_KEYS, loadJsonSync } from "./db.js";
import { addAuditEntry } from "./audit.js";
import { getMatrix, saveMatrix } from "../rbac.js";

// Reads/writes the USERS entity directly (not via store/users.js's public API) specifically to
// avoid a circular import — store/users.js needs listRoleNames() from this file for its own
// businessRole validation, so this file can't import store/users.js back.
function allUsers() {
  return load(ENTITY_KEYS.USERS, []);
}

// The one role every admin session ultimately depends on (store/users.js's getActiveUser()
// falls back to it, and it's who unlocks this whole console) — renaming or deleting it risks
// locking every Super Admin out, so it can never be edited or removed via this store.
const PROTECTED_ROLE = "System Administrator";

function seedRoles() {
  return loadJsonSync("roles.json").businessRoles.map((name) => ({ name, description: "" }));
}

export function ensureSeeded() {
  return seedOnce(ENTITY_KEYS.ROLES, seedRoles);
}

export function listRoles() {
  return load(ENTITY_KEYS.ROLES, []);
}

export function listRoleNames() {
  return listRoles().map((r) => r.name);
}

export function getRole(name) {
  return listRoles().find((r) => r.name === name) || null;
}

function assertUniqueName(name, excluding) {
  if (listRoles().some((r) => r.name === name && r.name !== excluding)) {
    throw new Error(`A role named "${name}" already exists.`);
  }
}

export function createRole({ name, description }, actor, actorRole) {
  name = (name || "").trim();
  if (!name) throw new Error("Role name is required.");
  assertUniqueName(name);
  const roles = listRoles();
  const role = { name, description: description || "" };
  roles.push(role);
  save(ENTITY_KEYS.ROLES, roles);

  // Give the new role an (empty) row in the live matrix so it shows up in RBAC Matrix
  // immediately, instead of falling through to roleConfig()'s {menus:[],pages:[],buttons:[]}
  // default the first time someone opens that tab.
  const matrix = getMatrix();
  matrix[name] = { menus: [], pages: [], buttons: [] };
  saveMatrix(matrix, actor, actorRole);

  addAuditEntry({
    actor, actorRole, action: "Create", entityType: "Role", entityId: name,
    summary: `Role "${name}" created`, before: null, after: role,
  });
  return role;
}

export function updateRole(oldName, { name, description }, actor, actorRole) {
  if (oldName === PROTECTED_ROLE) throw new Error(`"${PROTECTED_ROLE}" cannot be renamed.`);
  const roles = listRoles();
  const idx = roles.findIndex((r) => r.name === oldName);
  if (idx === -1) throw new Error("Role not found.");
  name = (name || "").trim();
  if (!name) throw new Error("Role name is required.");
  const before = { ...roles[idx] };
  const renaming = name !== oldName;
  if (renaming) assertUniqueName(name, oldName);

  roles[idx] = { name, description: description || "" };
  save(ENTITY_KEYS.ROLES, roles);

  if (renaming) {
    // Cascade the rename everywhere a role name is stored as a raw string, in one pass each —
    // a silent dangling reference to the old name would otherwise strand those users/permissions.
    const users = allUsers();
    let reassigned = 0;
    const updatedUsers = users.map((u) => {
      if (u.businessRole !== oldName) return u;
      reassigned++;
      return { ...u, businessRole: name };
    });
    if (reassigned) save(ENTITY_KEYS.USERS, updatedUsers);

    const matrix = getMatrix();
    if (matrix[oldName]) {
      matrix[name] = matrix[oldName];
      delete matrix[oldName];
      saveMatrix(matrix, actor, actorRole);
    }

    addAuditEntry({
      actor, actorRole, action: "Update", entityType: "Role", entityId: name,
      summary: `Role "${oldName}" renamed to "${name}"${reassigned ? ` (${reassigned} user(s) reassigned)` : ""}`,
      before, after: roles[idx],
    });
  } else {
    addAuditEntry({
      actor, actorRole, action: "Update", entityType: "Role", entityId: name,
      summary: `Role "${name}" updated`, before, after: roles[idx],
    });
  }
  return roles[idx];
}

export function deleteRole(name, actor, actorRole) {
  if (name === PROTECTED_ROLE) throw new Error(`"${PROTECTED_ROLE}" cannot be deleted.`);
  const inUse = allUsers().filter((u) => u.businessRole === name).length;
  if (inUse) throw new Error(`Cannot delete role: ${inUse} user(s) are assigned this role.`);

  const roles = listRoles();
  const target = roles.find((r) => r.name === name);
  if (!target) return;
  save(ENTITY_KEYS.ROLES, roles.filter((r) => r.name !== name));

  const matrix = getMatrix();
  if (matrix[name]) {
    delete matrix[name];
    saveMatrix(matrix, actor, actorRole);
  }

  addAuditEntry({
    actor, actorRole, action: "Delete", entityType: "Role", entityId: name,
    summary: `Role "${name}" deleted`, before: target, after: null,
  });
}
