// Hash-based router for the admin section tabs. Enforces RBAC.pages here — a disallowed route
// redirects to /forbidden, it is never left to the page itself to "self-hide" the way in.
// Login itself is NOT part of this router — it lives at the project root (login.html); this
// console is only ever reached once guardPage("admin-console") has already confirmed a session.
import { getActiveUser } from "./store/users.js";
import { canOpenPage } from "./rbac.js";
import { parseQuery, confirmUnsavedChanges } from "./utils.js";

const routes = [];

// Unsaved-changes guard — one slot, since only one view is ever mounted at a time. A view calls
// registerUnsavedGuard({ isDirty, onSave }) near the top of its render function; handleRoute()
// unconditionally clears it right before rendering the next route, so no view has to remember to
// tear it down itself (there's no unmount hook to hang that off — re-render is a full innerHTML
// replace). isDirty()/onSave() are re-evaluated live off each view's own closure state.
let guard = null;
export function registerUnsavedGuard(g) { guard = g; }

// path is an Express-like pattern, e.g. "/gates/:id". pageId null => always allowed (login/forbidden).
export function registerRoute(path, pageId, view) {
  const paramNames = [];
  const regexStr = "^" + path.replace(/:[^/]+/g, (m) => { paramNames.push(m.slice(1)); return "([^/]+)"; }) + "$";
  routes.push({ path, pageId, view, regex: new RegExp(regexStr), paramNames });
}

function currentHash() {
  const raw = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  const [pathPart, queryPart] = raw.split("?");
  return { path: pathPart || "/", query: parseQuery(queryPart) };
}

export function navigate(path) {
  location.hash = path;
}

function matchRoute(path) {
  for (const r of routes) {
    const m = r.regex.exec(path);
    if (m) {
      const params = {};
      r.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
  }
  return null;
}

let onNavigateCallback = null;
export function onRouteChange(cb) {
  onNavigateCallback = cb;
}

let lastRenderedPath = null;   // concrete resolved path (e.g. "/forms/fill/PK-F01") of the last
                                // successfully rendered route — NOT a route's registered pattern.
let revertingForGuard = false; // true only while we're programmatically snapping the hash back
                                // after blocking a navigation; the resulting extra hashchange must
                                // be a pure no-op, not a second guard check or re-render.

export async function handleRoute() {
  const { path, query } = currentHash();

  if (revertingForGuard) { revertingForGuard = false; return; }

  const user = getActiveUser();
  if (!user) { window.location.replace("../../login.html"); return; }

  // Block navigating away from a dirty view. Works for every navigation path (sub-header tab
  // clicks are plain <a href="#/...">, not JS calls, so this can only live here — the one
  // chokepoint every hash change funnels through, including navigate()/back/forward/manual edits).
  if (guard && lastRenderedPath !== null && path !== lastRenderedPath && guard.isDirty()) {
    revertingForGuard = true;
    location.hash = lastRenderedPath; // snap the URL back; current view is never torn down/re-rendered
    const choice = await confirmUnsavedChanges();
    if (choice === "cancel") return;
    guard = null;
    if (choice === "discard") { navigate(path); return; }
    if (choice === "save") {
      const ok = await guard.onSave();
      if (ok) navigate(path);
      return;
    }
    return;
  }

  if (path === "/" || path === "") {
    navigate("/gate-master");
    return;
  }

  const matched = matchRoute(path);
  if (!matched) {
    navigate("/gate-master");
    return;
  }
  const { route, params } = matched;

  if (route.pageId !== null && !canOpenPage(user.businessRole, route.pageId)) {
    navigate("/forbidden");
    return;
  }

  guard = null; // always clear before a real render — the outgoing view's guard is now moot
  lastRenderedPath = path;
  if (onNavigateCallback) onNavigateCallback(route.path, route.pageId);
  await route.view(params, query);
  // Deliberately NOT re-recording the shared "last visited hub page" fallback (auth.js:
  // recordNavEntry/goBack) on every hash change here — a route can render an internal
  // not-found/error sub-state (bad form code, missing project, …) that the router has no
  // visibility into, and recording THAT as a fallback destination would make Back a no-op the
  // next time it's needed. renderTopNav() already records once per session when the Admin
  // shell first mounts; goBack()'s primary path (history.back()) is what tracks the CURRENT
  // sub-route accurately in the common case, since every hash change is its own history entry.
}

export function startRouter() {
  window.addEventListener("beforeunload", (e) => {
    if (guard && guard.isDirty()) { e.preventDefault(); e.returnValue = ""; }
  });
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}
