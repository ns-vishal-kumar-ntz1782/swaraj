// ==========================================================
//  GATE SKIP REGISTRY — outer-app (classic-script) accessor.
//
//  A "skipped" gate is never a mutation of the underlying gate-instance/deliverable-assignment
//  records (real projects' data lives in read-only data/*.json; Admin-Console-created projects
//  live in a separate localStorage store) — it's one small registry entry, read identically by
//  the outer app (this file) and the Admin Console (pages/admin/js/store/projectExecution.js's
//  skipGate/isGateSkipped, same localStorage key/shape). Every page that needs to know whether a
//  gate is skipped resolves it once at data-load time (see app-config.js/project-detail-seed.js)
//  rather than checking the registry at every render call.
// ==========================================================
const GATE_SKIP_STORAGE_KEY = "spd.skipped_gates.v1";

function _loadSkippedGates() {
  try {
    const raw = localStorage.getItem(GATE_SKIP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function _saveSkippedGates(list) {
  localStorage.setItem(GATE_SKIP_STORAGE_KEY, JSON.stringify(list));
}

function isGateSkipped(projectCode, gateCode) {
  return _loadSkippedGates().some(s => s.projectCode === projectCode && s.gateCode === gateCode);
}

function getSkippedGateCodes(projectCode) {
  return new Set(_loadSkippedGates().filter(s => s.projectCode === projectCode).map(s => s.gateCode));
}

// actor/actorRole: same (name, business-role-label) pair every store mutator in this app audits
// with. reason is optional/free-text — shown on the Timeline's Skipped gate node.
function skipGate(projectCode, gateCode, actor, actorRole, reason) {
  const all = _loadSkippedGates();
  if (all.some(s => s.projectCode === projectCode && s.gateCode === gateCode)) return all; // already skipped
  const entry = { projectCode, gateCode, skippedBy: actor, skippedByRole: actorRole, skippedAt: new Date().toISOString(), reason: reason || "" };
  const next = [...all, entry];
  _saveSkippedGates(next);
  return next;
}

function getSkipDetail(projectCode, gateCode) {
  return _loadSkippedGates().find(s => s.projectCode === projectCode && s.gateCode === gateCode) || null;
}

// Reverses skipGate — removes the registry entry only, same "never mutate the underlying gate
// instance" contract skipGate itself follows, so the gate instantly resolves back to whatever
// real status its own records already say.
function unskipGate(projectCode, gateCode) {
  const all = _loadSkippedGates();
  const next = all.filter(s => !(s.projectCode === projectCode && s.gateCode === gateCode));
  _saveSkippedGates(next);
  return next;
}
