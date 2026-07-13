// Enterprise Users — the real 241-person workforce roster from data/orgUsers.json. This is a
// separate concern from store/users.js (the small login/session roster that RBAC keys off of):
// that store stays untouched and keeps powering getActiveUser()/RBAC exactly as before. Editing
// a person's record here is administrative record-keeping (like updating an HR system) — it does
// not retroactively rewrite historical execution data that already cached a display name, same
// as editing a Deliverable Library entry never rewrites past Deliverable Assignments.
import { load, save, seedOnce, ENTITY_KEYS, loadJsonSync } from "./db.js";
import { addAuditEntry } from "./audit.js";

const _seedUsers = loadJsonSync("orgUsers.json");
export const DEPARTMENTS = [...new Set(_seedUsers.map((u) => u.department))].sort();
export const BUSINESS_ROLES = [...new Set(_seedUsers.map((u) => u.businessRole))].sort();
export const SKILLS = [...new Set(_seedUsers.flatMap((u) => u.skills))].sort();
// Only Active/Inactive are offered going forward (per simplified status model). Legacy seed
// values ("On Leave", "Terminated", …) still exist on already-seeded records — this store never
// bulk-rewrites them — but the UI only ever writes "Active" or "Inactive" from here on, and
// displays anything that isn't literally "Active" as Inactive (see statusPill() in the view).
export const EMPLOYMENT_STATUSES = ["Active", "Inactive"];

export function ensureSeeded() {
  seedOnce(ENTITY_KEYS.ORG_USERS, () => loadJsonSync("orgUsers.json"));
}

function all() {
  return load(ENTITY_KEYS.ORG_USERS, []);
}
function persist(list) {
  save(ENTITY_KEYS.ORG_USERS, list);
}

export function listOrgUsers(filters = {}) {
  let list = all();
  const { department, businessRole, employmentStatus, minExperience, skill, reportingManager, q } = filters;
  if (department) list = list.filter((u) => u.department === department);
  if (businessRole) list = list.filter((u) => u.businessRole === businessRole);
  // "Inactive" matches any legacy status that isn't literally "Active" (On Leave, Terminated,
  // …) — same normalization the status pill uses, so the filter and the badge never disagree.
  if (employmentStatus === "Active") list = list.filter((u) => u.employmentStatus === "Active");
  else if (employmentStatus === "Inactive") list = list.filter((u) => u.employmentStatus !== "Active");
  if (minExperience) list = list.filter((u) => u.experience >= Number(minExperience));
  if (skill) list = list.filter((u) => u.skills.includes(skill));
  if (reportingManager) list = list.filter((u) => u.reportingManager === reportingManager);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((u) => [u.fullName, u.email, u.employeeCode, u.designation, u.department].some((f) => String(f).toLowerCase().includes(needle)));
  }
  return list.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function getOrgUser(id) {
  return all().find((u) => u.id === id) || null;
}

export function updateOrgUser(id, patch, actor, actorRole) {
  const list = all();
  const idx = list.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error("User not found.");
  const before = { ...list[idx] };
  list[idx] = { ...list[idx], ...patch };
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "OrgUser", entityId: id,
    summary: `User ${list[idx].fullName} (${id}) updated`, before, after: list[idx],
  });
  return list[idx];
}

export function setEmploymentStatus(id, status, actor, actorRole) {
  return updateOrgUser(id, { employmentStatus: status }, actor, actorRole);
}

function nextUserId(list) {
  let max = 0;
  for (const u of list) {
    const m = String(u.id).match(/^USR-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `USR-${String(max + 1).padStart(4, "0")}`;
}

export function createOrgUser(data, actor, actorRole) {
  const list = all();
  const id = nextUserId(list);
  const user = {
    id, employeeCode: `EMP-${String(list.length + 1).padStart(5, "0")}`,
    fullName: data.fullName.trim(), email: data.email.trim(), phone: data.phone || "",
    department: data.department, businessRole: data.businessRole, designation: data.designation || data.businessRole,
    experience: Number(data.experience) || 0, skills: data.skills || [], location: data.location || "",
    reportingManager: data.reportingManager || "", employmentStatus: "Active",
    avatarInitials: data.fullName.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
  };
  list.push(user);
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Create", entityType: "OrgUser", entityId: id,
    summary: `User ${user.fullName} (${id}) added to the roster`, before: null, after: user,
  });
  return user;
}
