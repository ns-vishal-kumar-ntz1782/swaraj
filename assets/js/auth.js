// ==========================================================
//  AUTH / RBAC — shared by every page. Load order matters:
//  mockData.js (defines pagesCatalog) → auth.js → then a page's own
//  guardPage(...) call, all as blocking <script> tags in <head> so an
//  unauthorized visitor never sees a flash of protected content.
// ==========================================================

// APP_ROOT = the project root URL, computed from auth.js's OWN resolved script URL. Pages at
// different depths load auth.js via different relative paths (assets/js/auth.js,
// ../../assets/js/auth.js, …), but they all resolve to the same file at assets/js/ — so
// stripping that fixed "assets/js/auth.js" suffix gives a root that works identically under
// file:// (opening index.html directly) and http(s):// (a web server).
// Every cross-page navigation and nav link is built as APP_ROOT + "path/to/page.html".
const APP_ROOT = (function () {
  const self = document.currentScript
    || [...document.getElementsByTagName("script")].find(s => /(^|\/)assets\/js\/auth\.js(\?|#|$)/.test(s.getAttribute("src") || ""));
  return self && self.src ? self.src.replace(/assets\/js\/auth\.js(\?[^#]*)?(#.*)?$/, "") : "";
})();

function appUrl(path) { return APP_ROOT + String(path).replace(/^\//, ""); }

function getCurrentRole() {
  return sessionStorage.getItem("snpdRole");
}

// Same localStorage record pages/admin/js/store/db.js writes to (NS "spd", entity
// "rbac_matrix", version "v1") — the plain-script outer pages read it directly since they
// don't load the Admin Console's ES modules. Falls back to roles.json's shipped defaults
// (rbacDefaultMatrix, from app-config.js) when nothing has been saved yet in this browser.
function readSavedRbacMatrix() {
  try {
    const raw = localStorage.getItem("spd.rbac_matrix.v1");
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// One role's effective { pages, widgets, pdTabs } — from the saved matrix if the Admin Console
// has ever been opened/saved in this browser, else derived from the shipped default. "pages" is
// always computed from outerPages+menus live (never stored) — same rule as canOpenPage() in
// pages/admin/js/rbac.js, so the two can never drift out of sync with each other.
//
// Merged PER FIELD (not "saved object wins outright") so a matrix cached in this browser from
// BEFORE outerPages/widgets/pdTabs existed on defaultMatrix doesn't silently produce empty
// permissions everywhere (which is what turns into a login/home redirect loop) — any field
// missing from the cached role object falls back to the shipped default for just that field.
function outerRoleConfig(businessRole) {
  if (!businessRole) return { pages: [], widgets: [], pdTabs: [] };
  const saved = readSavedRbacMatrix();
  const savedCfg = saved && saved[businessRole];
  const defaultCfg = rbacDefaultMatrix[businessRole];
  if (!savedCfg && !defaultCfg) return { pages: [], widgets: [], pdTabs: [] };
  const outerPages = (savedCfg && savedCfg.outerPages) || (defaultCfg && defaultCfg.outerPages) || [];
  const menus = (savedCfg && savedCfg.menus) || (defaultCfg && defaultCfg.menus) || [];
  const widgets = (savedCfg && savedCfg.widgets) || (defaultCfg && defaultCfg.widgets) || [];
  const pdTabs = (savedCfg && savedCfg.pdTabs) || (defaultCfg && defaultCfg.pdTabs) || [];
  return { pages: [...outerPages, ...menus], widgets, pdTabs };
}

// Root login role (CEO/PMO/RD/SA) → the business role the RBAC Matrix actually configures.
function currentBusinessRole() {
  const rootRole = getCurrentRole();
  return rootRole ? (rootRoleToBusinessRole[rootRole] || null) : null;
}

function pageAllowsRole(pageKey, role) {
  const businessRole = rootRoleToBusinessRole[role] || null;
  return outerRoleConfig(businessRole).pages.includes(pageKey);
}

// Pages the current role IS allowed to see — nav components filter on this so a role never
// gets shown a link that just bounces it away again.
function accessiblePages(role) {
  const businessRole = rootRoleToBusinessRole[role] || null;
  const allowed = outerRoleConfig(businessRole).pages;
  return pagesCatalog.filter(p => allowed.includes(p.key));
}

// Dashboard widgets and Project Detail tabs — same RBAC matrix, finer-grained than page access.
// Both read the CURRENT session's role directly (no role param) since every call site checks
// "can I, right now, see this" rather than looking up an arbitrary other role.
function canSeeWidget(widgetId) {
  return outerRoleConfig(currentBusinessRole()).widgets.includes(widgetId);
}
function canOpenPdTab(tabId) {
  return outerRoleConfig(currentBusinessRole()).pdTabs.includes(tabId);
}

// Hides any dashboard widget <article id="...Widget"> the current role isn't permitted to see.
// Call once, after the widgets exist in the DOM (dashboard.js's init(), before chart building —
// no point building a chart inside a widget that's about to be hidden).
function applyWidgetVisibility() {
  document.querySelectorAll("article.widget[id]").forEach((el) => {
    if (!canSeeWidget(el.id)) el.hidden = true;
  });
}

// Hides any Project Detail tab button/panel (data-tab="snapshot" etc.) the current role isn't
// permitted to open, and — if the tab that would otherwise be active by default got hidden —
// activates the first tab that's still visible. Call once from project-detail.js's init(),
// before initTabs() wires click handlers.
function applyPdTabVisibility() {
  const tabButtons = [...document.querySelectorAll(".pd-tab[data-tab]")];
  let activeHidden = false;
  tabButtons.forEach((btn) => {
    const tab = btn.dataset.tab;
    const allowed = canOpenPdTab(tab);
    btn.hidden = !allowed;
    if (!allowed) {
      const panel = document.getElementById("tab-" + tab);
      if (panel) panel.hidden = true;
      if (btn.classList.contains("pd-tab-active")) activeHidden = true;
    }
  });
  if (activeHidden) {
    const firstVisible = tabButtons.find((b) => !b.hidden);
    if (firstVisible) firstVisible.click();
  }
}

// Call at the very top of every protected page, before anything else renders:
//   guardPage("admin-console");
// No role at all -> straight to login. Logged in but not permitted for THIS page -> back to
// the dashboard (not login — the user IS authenticated, just not authorized for this route).
function guardPage(pageKey) {
  const role = getCurrentRole();
  if (!role) { window.location.replace(appUrl("login.html")); return; }
  if (pageKey && !pageAllowsRole(pageKey, role)) { window.location.replace(appUrl("index.html")); return; }
}

function logoutAndRedirect() {
  sessionStorage.removeItem("snpdRole");
  window.location.href = appUrl("login.html");
}
