// Live console audit log — every mutating action taken through this admin console appends one
// entry here, keyed by the session actor's name (the login/session identity system).
import { load, save, seedOnce, ENTITY_KEYS, loadJsonSync } from "./db.js";
import { uid, nowIso } from "../utils.js";

export function ensureSeeded() {
  return seedOnce(ENTITY_KEYS.AUDIT, () => loadJsonSync("activity-log.json"));
}

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

// Enterprise seed audit trail (1,702 historical records) — read-only, never mutated, kept
// separate from the live console trail above since it's keyed by org-roster userId rather than
// the console's own session-actor name. Normalized to the same row shape for display, tagged
// with `source` so the two provenances are never silently conflated.
const _enterpriseLog = loadJsonSync("projectAuditLog.json");

export function listEnterpriseAuditEntries(filters = {}) {
  let entries = _enterpriseLog.map((e) => ({
    id: e.auditId, timestamp: e.timestamp, actorUserId: e.performedByUserId, action: e.action,
    entityType: e.entity, entityId: e.entityId, projectCode: e.projectCode, gateCode: "",
    summary: `${e.action} on ${e.entity} ${e.entityId}`, before: e.before, after: e.after, source: "Enterprise Log",
  }));
  const { entityType, projectCode, from, to, q } = filters;
  if (entityType) entries = entries.filter((e) => e.entityType === entityType);
  if (projectCode) entries = entries.filter((e) => e.projectCode === projectCode);
  if (from) entries = entries.filter((e) => e.timestamp >= from);
  if (to) entries = entries.filter((e) => e.timestamp <= to);
  if (q) {
    const needle = q.toLowerCase();
    entries = entries.filter((e) => [e.summary, e.entityType, e.entityId, e.projectCode, e.action].filter(Boolean).some((f) => String(f).toLowerCase().includes(needle)));
  }
  return entries;
}
export function enterpriseEntityTypes() {
  return [...new Set(_enterpriseLog.map((e) => e.entity))].sort();
}
export function enterpriseProjects() {
  return [...new Set(_enterpriseLog.map((e) => e.projectCode).filter(Boolean))].sort();
}
