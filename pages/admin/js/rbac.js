// ONE RBAC matrix. Every module in the app must check this matrix — no hardcoded role checks.
import { load, save, ENTITY_KEYS, loadJsonSync } from "./store/db.js";
import { addAuditEntry } from "./store/audit.js";

const _roles = loadJsonSync("roles.json");

export const ALL_MENUS = _roles.allMenus;

// Pages reachable without their own persistent nav tab — e.g. the form builder is only ever
// entered via the "+ Build Form" button inside Forms Library, never its own tab. A role gets
// the extra page automatically once it has both the parent menu and the gating button, so this
// never has to be hand-kept in sync with each role's button grants (see base() below).
export const EXTRA_PAGES = _roles.extraPages || {};

// Top-level app pages (Dashboard / Portfolio Tracker / Overall Budget / Admin Console) — reused
// from pagesCatalog's own key list so this never has to be hand-kept in sync with it.
export const OUTER_PAGES = (_roles.pagesCatalog || []).map((p) => p.key);
export const OUTER_PAGE_LABELS = Object.fromEntries((_roles.pagesCatalog || []).map((p) => [p.key, p.label]));

// Purely a sidebar grouping label — governance/admin screens vs. day-to-day workspace screens.
// Visibility is still driven entirely by RBAC.menus; this only decides which header a visible item sits under.
export const ADMIN_MENU_IDS = _roles.adminMenuIds;
export const WORKSPACE_MENU_IDS = ALL_MENUS.filter((m) => !ADMIN_MENU_IDS.includes(m));

export const ALL_BUTTONS = _roles.allButtons;

export const MENU_LABELS = { ..._roles.menuLabels, ...OUTER_PAGE_LABELS };

export const BUTTON_LABELS = _roles.buttonLabels;

// Purely a display grouping for the RBAC checklist UI — buttons are still one flat permission
// list underneath, this only decides which heading a button's checkbox renders under.
export const BUTTON_GROUPS = _roles.buttonGroups || {};

// Dashboard KPI/chart widgets (outer app root Dashboard) and Project Detail tabs (incl. the
// gate drill-down accordion inside the "gate-checklist" tab) — two more flat permission lists,
// same shape/pattern as menus/buttons above.
export const ALL_WIDGETS = _roles.allWidgets || [];
export const WIDGET_LABELS = _roles.widgetLabels || {};
export const ALL_PD_TABS = _roles.allPdTabs || [];
export const PD_TAB_LABELS = _roles.pdTabLabels || {};

// No stored "pages" array — page access is always derived live from menus/outerPages/buttons
// (see canOpenPage below), so a role's checkbox state can never drift out of sync with what's
// actually reachable in the nav.
function base(cfg) {
  const { menus, outerPages = [], widgets = [], pdTabs = [], buttons } = cfg;
  return { menus, outerPages, widgets, pdTabs, buttons };
}

export const DEFAULT_MATRIX = Object.fromEntries(
  Object.entries(_roles.defaultMatrix).map(([role, cfg]) => [role, base(cfg)])
);

// Self-healing merge: a matrix cached in localStorage from BEFORE a schema addition (e.g.
// outerPages/widgets/pdTabs were added to defaultMatrix after some browsers had already seeded
// the older shape) must not silently win with missing fields — that turns into "this role can
// open nothing" everywhere it's checked. Every read backfills any missing field, per role, from
// the shipped default, so a stale cache heals itself instead of needing a manual localStorage
// clear or a version bump that would also wipe unrelated saved customizations.
function repairMatrix(matrix) {
  const repaired = {};
  Object.keys(matrix).forEach((role) => {
    const saved = matrix[role] || {};
    const def = DEFAULT_MATRIX[role] || {};
    repaired[role] = {
      menus: saved.menus || def.menus || [],
      outerPages: saved.outerPages || def.outerPages || [],
      widgets: saved.widgets || def.widgets || [],
      pdTabs: saved.pdTabs || def.pdTabs || [],
      buttons: saved.buttons || def.buttons || [],
    };
  });
  // Roles that exist in the shipped defaults but were never saved at all yet (e.g. a role added
  // to roles.json after this browser's matrix was first seeded).
  Object.keys(DEFAULT_MATRIX).forEach((role) => {
    if (!repaired[role]) repaired[role] = JSON.parse(JSON.stringify(DEFAULT_MATRIX[role]));
  });
  return repaired;
}

export function getMatrix() {
  const saved = load(ENTITY_KEYS.RBAC, null);
  return saved ? repairMatrix(saved) : cloneDefault();
}

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_MATRIX));
}

export function ensureSeeded() {
  const saved = load(ENTITY_KEYS.RBAC, null);
  if (saved === null) {
    save(ENTITY_KEYS.RBAC, cloneDefault());
  } else {
    // Persist the healed shape too, so a stale cache is only ever repaired once instead of on
    // every single getMatrix() call for the lifetime of the browser profile.
    save(ENTITY_KEYS.RBAC, repairMatrix(saved));
  }
}

export function saveMatrix(matrix, actor, actorRole) {
  const before = getMatrix();
  save(ENTITY_KEYS.RBAC, matrix);
  addAuditEntry({
    actor, actorRole, action: "Update", entityType: "RBACMatrix", entityId: "matrix",
    summary: `RBAC matrix updated by ${actor}`, before, after: matrix,
  });
  return matrix;
}

export function resetRoleToDefault(role, actor, actorRole) {
  if (!DEFAULT_MATRIX[role]) throw new Error(`"${role}" has no shipped defaults to reset to (it's a custom or renamed role).`);
  const matrix = getMatrix();
  const before = JSON.parse(JSON.stringify(matrix));
  matrix[role] = JSON.parse(JSON.stringify(DEFAULT_MATRIX[role]));
  save(ENTITY_KEYS.RBAC, matrix);
  addAuditEntry({
    actor, actorRole, action: "Reset", entityType: "RBACMatrix", entityId: role,
    summary: `RBAC defaults restored for role "${role}" by ${actor}`, before, after: matrix,
  });
  return matrix;
}

function roleConfig(role) {
  const matrix = getMatrix();
  return matrix[role] || { menus: [], outerPages: [], widgets: [], pdTabs: [], buttons: [] };
}

export function canSeeMenu(role, menuId) {
  return roleConfig(role).menus.includes(menuId);
}
export function canOpenPage(role, pageId) {
  const cfg = roleConfig(role);
  if (cfg.outerPages.includes(pageId) || cfg.menus.includes(pageId)) return true;
  const rule = EXTRA_PAGES[pageId];
  return !!rule && cfg.menus.includes(rule.parentMenu) && cfg.buttons.includes(rule.requiresButton);
}
export function can(role, buttonId) {
  return roleConfig(role).buttons.includes(buttonId);
}
export function canSeeWidget(role, widgetId) {
  return (roleConfig(role).widgets || []).includes(widgetId);
}
export function canOpenPdTab(role, tabId) {
  return (roleConfig(role).pdTabs || []).includes(tabId);
}
export function menusFor(role) {
  const allowed = roleConfig(role).menus;
  return ALL_MENUS.filter((m) => allowed.includes(m));
}
