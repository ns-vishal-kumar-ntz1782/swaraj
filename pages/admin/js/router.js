// Hash-based router for the admin section tabs. Enforces RBAC.pages here — a disallowed route
// redirects to /forbidden, it is never left to the page itself to "self-hide" the way in.
// Login itself is NOT part of this router — it lives at the project root (login.html); this
// console is only ever reached once guardPage("admin-console") has already confirmed a session.
import { getActiveUser } from "./store/users.js";
import { canOpenPage } from "./rbac.js";
import { parseQuery } from "./utils.js";

const routes = [];

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

export async function handleRoute() {
  const { path, query } = currentHash();
  const user = getActiveUser();
  if (!user) { window.location.replace("../../login.html"); return; }

  if (path === "/" || path === "") {
    navigate("/gates");
    return;
  }

  const matched = matchRoute(path);
  if (!matched) {
    navigate("/gates");
    return;
  }
  const { route, params } = matched;

  if (route.pageId !== null && !canOpenPage(user.businessRole, route.pageId)) {
    navigate("/forbidden");
    return;
  }

  if (onNavigateCallback) onNavigateCallback(route.path, route.pageId);
  await route.view(params, query);
}

export function startRouter() {
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}
