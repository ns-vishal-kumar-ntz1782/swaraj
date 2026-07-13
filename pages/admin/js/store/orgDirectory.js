// Organization directory — the join layer between a bare userId (stored everywhere in the
// execution data) and the human-readable info it resolves to. Pure reference data, loaded
// straight from data/*.json like stages.js/checklistItems.json — no localStorage needed, since
// nothing here is ever mutated by the app.
import { loadJsonSync } from "./db.js";

const _users = loadJsonSync("orgUsers.json");
const _projectMembers = loadJsonSync("projectMembers.json");

const userById = Object.fromEntries(_users.map((u) => [u.id, u]));
const teamByProject = {};
for (const pm of _projectMembers) (teamByProject[pm.projectCode] = teamByProject[pm.projectCode] || []).push(pm);

export function getUser(userId) {
  return userById[userId] || null;
}

// {name, role, department, email, avatarInitials, designation} for a bare userId — the shape
// every view needs to render a person without ever touching a raw name/role string.
export function displayFor(userId) {
  const u = userById[userId];
  if (!u) return { name: "Unknown", role: "", department: "", email: "", avatarInitials: "?", designation: "" };
  return { name: u.fullName, role: u.businessRole, department: u.department, email: u.email, avatarInitials: u.avatarInitials, designation: u.designation };
}

export function getProjectTeam(projectCode) {
  return (teamByProject[projectCode] || []).map((pm) => ({ ...pm, user: userById[pm.userId] || null }));
}

export function isOnProjectTeam(projectCode, userId) {
  return (teamByProject[projectCode] || []).some((pm) => pm.userId === userId);
}

// Reverse lookup — every project a given user is staffed on, for a person's own profile view.
export function getUserMemberships(userId) {
  return _projectMembers.filter((pm) => pm.userId === userId);
}

export function listAllUsers() {
  return _users;
}
