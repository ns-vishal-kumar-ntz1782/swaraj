import { load, save, seedOnce, ENTITY_KEYS } from "./db.js";
import { uid, nowIso } from "../utils.js";
import { addAuditEntry } from "./audit.js";
import { BUSINESS_ROLES } from "../rbac.js";

function seedUsers() {
  return [
    { id: uid("usr"), name: "Alan Roy", email: "rndhead@spd.com", businessRole: "R&D Head", createdAt: nowIso() },
    { id: uid("usr"), name: "Priya Menon", email: "pmo@spd.com", businessRole: "PMO Manager", createdAt: nowIso() },
    { id: uid("usr"), name: "Karan Shah", email: "ceo@spd.com", businessRole: "CEO", createdAt: nowIso() },
    { id: uid("usr"), name: "Divya Iyer", email: "finance@spd.com", businessRole: "Finance Manager", createdAt: nowIso() },
    { id: uid("usr"), name: "Sysadmin", email: "admin@spd.com", businessRole: "System Administrator", createdAt: nowIso() },
    { id: uid("usr"), name: "Rohit Verma", email: "engineer@spd.com", businessRole: "Engineer", createdAt: nowIso() },
    { id: uid("usr"), name: "Neha Kapoor", email: "engineer2@spd.com", businessRole: "Engineer", createdAt: nowIso() },
  ];
}

export function ensureSeeded() {
  return seedOnce(ENTITY_KEYS.USERS, seedUsers);
}

export function listUsers() {
  return load(ENTITY_KEYS.USERS, []);
}

export function getUserByEmail(email) {
  return listUsers().find((u) => u.email.toLowerCase() === String(email || "").toLowerCase()) || null;
}

export function getUserById(id) {
  return listUsers().find((u) => u.id === id) || null;
}

export function createUser({ name, email, businessRole }, actor, actorRole) {
  if (!BUSINESS_ROLES.includes(businessRole)) throw new Error("A valid business role is required.");
  if (getUserByEmail(email)) throw new Error("A user with this email already exists.");
  const users = listUsers();
  const user = { id: uid("usr"), name, email, businessRole, createdAt: nowIso() };
  users.push(user);
  save(ENTITY_KEYS.USERS, users);
  addAuditEntry({
    actor, actorRole, action: "Create", entityType: "User", entityId: user.id,
    summary: `User "${name}" (${email}) created with role ${businessRole}`, before: null, after: user,
  });
  return user;
}

export function updateUser(id, patch, actor, actorRole) {
  const users = listUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error("User not found.");
  if (patch.businessRole && !BUSINESS_ROLES.includes(patch.businessRole)) throw new Error("A valid business role is required.");
  const before = { ...users[idx] };
  users[idx] = { ...users[idx], ...patch };
  save(ENTITY_KEYS.USERS, users);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "User", entityId: id,
    summary: `User "${users[idx].name}" updated`, before, after: users[idx],
  });
  return users[idx];
}

export function deleteUser(id, actor, actorRole) {
  const users = listUsers();
  const target = users.find((u) => u.id === id);
  if (!target) return;
  const filtered = users.filter((u) => u.id !== id);
  save(ENTITY_KEYS.USERS, filtered);
  addAuditEntry({
    actor, actorRole, action: "Delete", entityType: "User", entityId: id,
    summary: `User "${target.name}" (${target.email}) deleted`, before: target, after: null,
  });
}

// ---- identity ----
// Login itself lives at the project root (login.html / auth.js, sessionStorage "snpdRole").
// This admin console never shows its own login screen — guardPage("admin-console") already
// keeps anyone but Super Admin out before this module ever runs. We just read who's signed in.
const ROOT_ROLE_TO_BUSINESS_ROLE = {
  SA: "System Administrator",
  CEO: "CEO",
  PMO: "PMO Manager",
  RD: "R&D Head",
};

export function getActiveUser() {
  const roleKey = sessionStorage.getItem("snpdRole");
  if (!roleKey) return null;
  const businessRole = ROOT_ROLE_TO_BUSINESS_ROLE[roleKey] || "System Administrator";
  const info = (typeof roleDirectory !== "undefined" && roleDirectory[roleKey]) || {};
  return { id: `root-${roleKey}`, name: info.name || businessRole, email: info.email || "", businessRole };
}
