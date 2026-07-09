// Single unified audit log. Every mutating action across every store appends one entry here.
import { load, save, ENTITY_KEYS } from "./db.js";
import { uid, nowIso } from "../utils.js";

function all() {
  return load(ENTITY_KEYS.AUDIT, []);
}

export function addAuditEntry({ actor, actorRole, action, entityType, entityId, projectCode, gateCode, summary, before, after }) {
  const entries = all();
  const entry = {
    id: uid("aud"),
    timestamp: nowIso(),
    actor: actor || "system",
    actorRole: actorRole || "—",
    action,
    entityType,
    entityId: entityId || "",
    projectCode: projectCode || "",
    gateCode: gateCode || "",
    summary,
    before: before ?? null,
    after: after ?? null,
  };
  entries.unshift(entry);
  save(ENTITY_KEYS.AUDIT, entries);
  return entry;
}

export function listAuditEntries(filters = {}) {
  let entries = all();
  const { entityType, actor, role, projectCode, from, to, q } = filters;
  if (entityType) entries = entries.filter((e) => e.entityType === entityType);
  if (actor) entries = entries.filter((e) => e.actor === actor);
  if (role) entries = entries.filter((e) => e.actorRole === role);
  if (projectCode) entries = entries.filter((e) => e.projectCode === projectCode);
  if (from) entries = entries.filter((e) => e.timestamp >= from);
  if (to) entries = entries.filter((e) => e.timestamp <= to);
  if (q) {
    const needle = q.toLowerCase();
    entries = entries.filter((e) =>
      [e.summary, e.actor, e.actorRole, e.entityType, e.entityId, e.projectCode, e.gateCode, e.action]
        .filter(Boolean).some((f) => String(f).toLowerCase().includes(needle))
    );
  }
  return entries;
}

export function distinctActors() {
  return Array.from(new Set(all().map((e) => e.actor))).sort();
}
export function distinctProjects() {
  return Array.from(new Set(all().map((e) => e.projectCode).filter(Boolean))).sort();
}
