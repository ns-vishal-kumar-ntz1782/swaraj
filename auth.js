// ==========================================================
//  AUTH / RBAC — shared by every page. Load order matters:
//  mockData.js (defines pagesCatalog) → auth.js → then a page's own
//  guardPage(...) call, all as blocking <script> tags in <head> so an
//  unauthorized visitor never sees a flash of protected content.
// ==========================================================

// APP_ROOT = the project root URL, computed from auth.js's OWN resolved script URL. Pages at
// different depths load auth.js via different relative paths (auth.js, ../../auth.js, …), but
// they all resolve to the same file at the root — so stripping the filename gives a root that
// works identically under file:// (opening index.html directly) and http(s):// (a web server).
// Every cross-page navigation and nav link is built as APP_ROOT + "path/to/page.html".
const APP_ROOT = (function () {
  const self = document.currentScript
    || [...document.getElementsByTagName("script")].find(s => /(^|\/)auth\.js(\?|#|$)/.test(s.getAttribute("src") || ""));
  return self && self.src ? self.src.replace(/auth\.js(\?[^#]*)?(#.*)?$/, "") : "";
})();

function appUrl(path) { return APP_ROOT + String(path).replace(/^\//, ""); }

function getCurrentRole() {
  return sessionStorage.getItem("snpdRole");
}

function pageAllowsRole(pageKey, role) {
  const page = pagesCatalog.find(p => p.key === pageKey);
  return !!page && page.roles.includes(role);
}

// Pages the current role IS allowed to see — nav components filter on this so a role never
// gets shown a link that just bounces it away again.
function accessiblePages(role) {
  return pagesCatalog.filter(p => p.roles.includes(role));
}

// Call at the very top of every protected page, before anything else renders:
//   guardPage("admin-users");
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
