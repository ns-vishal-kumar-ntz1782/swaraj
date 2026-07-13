// Gate Checklist Templates — the master checklist an admin defines once per gate (not per Project
// Template, not per project): "what documents must exist to approve a G1/G2/... gate." One shared
// definition per gateCode, seeded with realistic defaults, editable/resettable, applies to every
// project that opens that gate. Distinct from Project Templates' own per-template
// `checklistDocuments` (which are upload-requirement configs scoped to one template's gate) —
// this is the simpler, gate-wide checklist-item list the admin actually asked for here.
import { load, save, seedOnce, ENTITY_KEYS, loadJsonSync } from "./db.js";
import { addAuditEntry } from "./audit.js";

const _projectMembers = loadJsonSync("projectMembers.json");
export const RESPONSIBILITY_OPTIONS = [...new Set(_projectMembers.map((m) => m.projectRole))].sort();

export const FILE_TYPE_OPTIONS = ["pdf", "docx", "xlsx", "png", "jpg"];
export const STATUS_OPTIONS = ["Draft", "Published", "Archived"];

// Matches the exact example given for the first gate (Pre-KO), plus reasonable defaults for the
// rest of the standard 6-gate sequence. A gate created later in Gate Master starts with an empty
// checklist — nothing hardcoded gets force-fed onto a gate the admin didn't ask for defaults on.
const DEFAULTS_BY_GATE = {
  "Pre-KO": [
    ["Design Review Document", "Initial concept and design intent.", true],
    ["Market Requirement Document", "Voice of customer, target segment.", true],
    ["Product Concept Approval", "Sponsor sign-off on concept.", true],
  ],
  "CVPA": [
    ["Concept Design Review Report", "Styling and engineering concept review findings.", true],
    ["Program Cost Estimate", "Program-level cost roll-up for the CVPA review.", true],
    ["Vehicle Program Approval Record", "Formal sign-off to proceed to Virtual Validation.", true],
    ["Styling Theme Approval", "Sign-off on the selected styling direction.", false],
  ],
  "VV": [
    ["Vehicle Validation Report", "Consolidated CAE/simulation validation results.", true],
    ["DFMEA", "Design Failure Mode and Effects Analysis.", true],
    ["PV Test Report", "Performance validation results against the DVP&R plan.", true],
    ["Vehicle Approval", "Engineering approval to proceed beyond Virtual Validation.", true],
    ["Engineering Review", "Cross-functional engineering review minutes.", false],
  ],
  "PC": [
    ["Prototype Build Report", "Build log and deviation summary.", true],
    ["Tooling Trial Report", "First-off tooling trial and dimensional conformance.", true],
    ["Supplier PPAP Package", "Supplier Production Part Approval Process submission.", true],
    ["Manufacturing Feasibility Report", "Confirms the process plan meets target rate.", false],
  ],
  "PR": [
    ["Field Trial Report", "Results and issue log from pre-production field trials.", true],
    ["Homologation Certificate", "Regulatory certification confirming compliance.", true],
    ["PPAP Approval", "Final PPAP sign-off for production-intent parts.", true],
    ["Production Process Sign-off", "Manufacturing's readiness sign-off for volume production.", true],
  ],
  "PPO": [
    ["Launch Readiness Checklist", "Final cross-functional launch readiness confirmation.", true],
    ["Production Ramp-up Report", "Tracks output and yield through ramp-up.", true],
    ["Program Closure Report", "Formal program closure record.", true],
  ],
};

function buildDefaultItems(gateCode) {
  const defs = DEFAULTS_BY_GATE[gateCode] || [];
  return defs.map(([title, description, mandatory], i) => ({
    id: `GCT-${gateCode}-${Math.random().toString(36).slice(2, 8)}`,
    gateCode, title, description, mandatory,
    targetDate: "", responsibility: "", // kept for schema compatibility — no longer editable here, see Deliverables
    documentCategory: "", allowedFileTypes: ["pdf"], maxFileSizeMB: 10, versionRequired: true, remarks: "",
    status: "Published", // shipped defaults are already in effect
    displayOrder: i + 1,
  }));
}

export function ensureSeeded() {
  seedOnce(ENTITY_KEYS.GATE_CHECKLIST_TEMPLATES, () => {
    const map = {};
    for (const gateCode of Object.keys(DEFAULTS_BY_GATE)) map[gateCode] = buildDefaultItems(gateCode);
    return map;
  });
}

function all() {
  return load(ENTITY_KEYS.GATE_CHECKLIST_TEMPLATES, {});
}
function persist(map) {
  save(ENTITY_KEYS.GATE_CHECKLIST_TEMPLATES, map);
}

export function itemsForGate(gateCode) {
  const map = all();
  return (map[gateCode] || []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
}

// Batch-replaces every item for one gate in a single write — the view stages add/edit/remove/
// reorder locally and only calls this once, on "Save Changes".
export function saveGateChecklist(gateCode, items, actor, actorRole) {
  const map = all();
  const before = map[gateCode] || [];
  map[gateCode] = items.map((item, i) => ({ ...item, gateCode, displayOrder: i + 1 }));
  persist(map);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "GateChecklistTemplate", entityId: gateCode,
    summary: `Gate Checklist Template for "${gateCode}" saved (${map[gateCode].length} item(s))`,
    before, after: map[gateCode],
  });
  return map[gateCode];
}

// Publishes ONLY the given gate's checklist — every staged item's status flips to "Published",
// then persists exactly like saveGateChecklist (same batch-replace, same audit trail shape, just
// a distinct action/summary so Publish and a plain field edit read differently in the log).
export function publishGateChecklist(gateCode, items, actor, actorRole) {
  const map = all();
  const before = map[gateCode] || [];
  map[gateCode] = items.map((item, i) => ({ ...item, gateCode, status: "Published", displayOrder: i + 1 }));
  persist(map);
  addAuditEntry({
    actor, actorRole, action: "Publish", entityType: "GateChecklistTemplate", entityId: gateCode,
    summary: `Gate Checklist Template for "${gateCode}" published (${map[gateCode].length} item(s))`,
    before, after: map[gateCode],
  });
  return map[gateCode];
}

export function resetGateToDefaults(gateCode, actor, actorRole) {
  const map = all();
  const before = map[gateCode] || [];
  map[gateCode] = buildDefaultItems(gateCode);
  persist(map);
  addAuditEntry({
    actor, actorRole, action: "Reset", entityType: "GateChecklistTemplate", entityId: gateCode,
    summary: `Gate Checklist Template for "${gateCode}" reset to defaults`,
    before, after: map[gateCode],
  });
  return map[gateCode];
}

export function newBlankItem(gateCode, displayOrder) {
  return {
    id: `GCT-${gateCode}-${Math.random().toString(36).slice(2, 8)}`, gateCode, title: "", description: "", mandatory: true,
    targetDate: "", responsibility: "",
    documentCategory: "", allowedFileTypes: ["pdf"], maxFileSizeMB: 10, versionRequired: true, remarks: "",
    status: "Draft", displayOrder,
  };
}
