// Gate Master — the canonical list of gates every Project Template sequences from. Seeded once
// from data/gateMaster.json, mutated only in localStorage from then on (same pattern as every
// other store in this app). Gates are never hard-deleted (their gateCode is referenced all over
// project-execution data) — "disable" just flips `active` so it drops out of pickers everywhere
// else without breaking history.
import { load, save, seedOnce, ENTITY_KEYS, loadJsonSync } from "./db.js";
import { addAuditEntry } from "./audit.js";
import { nextSequenceCode } from "../utils.js";

export function ensureSeeded() {
  seedOnce(ENTITY_KEYS.GATE_MASTER, () => loadJsonSync("gateMaster.json"));
}

function all() {
  return load(ENTITY_KEYS.GATE_MASTER, []);
}
function persist(list) {
  save(ENTITY_KEYS.GATE_MASTER, list);
}

export function listGates({ includeInactive = true } = {}) {
  const list = all().slice().sort((a, b) => a.displayOrder - b.displayOrder);
  return includeInactive ? list : list.filter((g) => g.active);
}
export function getGate(gateCode) {
  return all().find((g) => g.gateCode === gateCode) || null;
}

export function createGate(data, actor, actorRole) {
  const list = all();
  if (list.some((g) => g.gateCode === data.gateCode)) throw new Error(`Gate code "${data.gateCode}" already exists.`);
  const id = nextSequenceCode(list.map((g) => g.id), "GT-", 2);
  const gate = {
    id, gateCode: data.gateCode.trim(), gateName: data.gateName.trim(),
    description: data.description || "", displayOrder: list.length + 1,
    defaultDuration: data.defaultDuration || "4 weeks",
    active: data.active !== false,
  };
  list.push(gate);
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Create", entityType: "GateMaster", entityId: gate.gateCode,
    summary: `Gate "${gate.gateCode} — ${gate.gateName}" created`, before: null, after: gate,
  });
  return gate;
}

export function updateGate(gateCode, patch, actor, actorRole) {
  const list = all();
  const idx = list.findIndex((g) => g.gateCode === gateCode);
  if (idx === -1) throw new Error("Gate not found.");
  const before = { ...list[idx] };
  list[idx] = { ...list[idx], ...patch, gateCode: list[idx].gateCode, id: list[idx].id };
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "GateMaster", entityId: gateCode,
    summary: `Gate "${gateCode}" updated`, before, after: list[idx],
  });
  return list[idx];
}

export function setGateActive(gateCode, active, actor, actorRole) {
  return updateGate(gateCode, { active }, actor, actorRole);
}

// Persists a full reordering in one write — the view stages ▲/▼ moves locally (no store call
// per click) and only calls this once, when "Save Order" is clicked, so a half-finished reorder
// never lands in localStorage.
export function saveGateOrder(orderedGateCodes, actor, actorRole) {
  const list = all();
  const before = list.map((g) => ({ gateCode: g.gateCode, displayOrder: g.displayOrder }));
  orderedGateCodes.forEach((code, i) => {
    const g = list.find((x) => x.gateCode === code);
    if (g) g.displayOrder = i + 1;
  });
  persist(list);
  addAuditEntry({
    actor, actorRole, action: "Reorder", entityType: "GateMaster", entityId: "order",
    summary: `Gate order saved: ${orderedGateCodes.join(" → ")}`,
    before, after: list.map((g) => ({ gateCode: g.gateCode, displayOrder: g.displayOrder })),
  });
  return listGates();
}
