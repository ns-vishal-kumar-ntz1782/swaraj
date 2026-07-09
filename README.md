# SNPD — Structured New Product Development Platform

A CEO/portfolio dashboard, portfolio tracker, project detail drill-down, and a role-based Admin
Console for managing stage gates, deliverables, forms, and users. Plain HTML/CSS/JavaScript —
no framework, no build step, no `npm install` required.

## Run it

You **must** serve this over HTTP — do not double-click `login.html` or any page. The Admin
Console is built from ES modules, and browsers refuse to load those over `file://`; you'll get
a blank page (or an on-screen warning) if you open the files directly.

```bash
node server.js
# or: npm start
```

Then open **http://localhost:5173/login.html** in your browser. (Pass a different port as an
argument: `node server.js 8080`.)

No dependencies to install — `server.js` is a zero-dependency static file server using only
Node's built-in `http`/`fs` modules. Any Node.js ≥ 18 works. If you'd rather not use Node, any
static server works identically, e.g. `python3 -m http.server 5173`.

## Logging in

Login is email-based (no real password check). Use the demo buttons on the sign-in screen, or
type one of these emails directly:

| Role | Email | Lands on |
|---|---|---|
| CEO | `ceo@swaraj.mahindra.com` | Dashboard |
| PMO Manager | `pmo.manager@swaraj.mahindra.com` | Dashboard |
| R&D Head | `rnd.head@swaraj.mahindra.com` | Dashboard |
| Super Admin | `admin@swaraj.mahindra.com` | Admin Console |

Every role lands on the main Dashboard after login **except** Super Admin, who goes straight to
the Admin Console. All four share the exact same header component — logo, search, as-on-date,
fiscal-year selector, fullscreen toggle, export, avatar/logout — only the tab list in the middle
changes per page (and the Admin Console adds a notification bell next to the avatar).

## Project structure

```
├── login.html                 entry point — email lookup, sets the session, role-based redirect
├── index.html                 main Dashboard (charts, drill-downs)
├── server.js                  zero-dependency dev server (node server.js)
├── assets/
│   ├── css/                   styles.css (design tokens + dashboard), project-detail.css
│   └── js/
│       ├── mockData.js        role directory, page/route catalog, seed portfolio data
│       ├── mock-data.js       generated per-project detail dataset
│       ├── auth.js            session, route guard (guardPage), APP_ROOT path resolution
│       ├── shared.js          the ONE header component every page renders (renderTopNav)
│       ├── script.js          index.html's dashboard logic (charts, drill-downs, viewport fit)
│       ├── project-detail.js, charts.js, timeline.js
├── pages/
│   ├── portfolio-tracker/     portfolio table + filters
│   ├── overall-budget/        budget rollups
│   ├── project-detail/        drill-down opened from a dashboard chart (?id=<project>)
│   └── admin/                 Admin Console — Super Admin only
│       ├── index.html         shell: shared header (top-nav tabs, no sidebar) + module app
│       ├── admin-console.css  component styles, fixed-viewport layout (tables scroll, page doesn't)
│       └── js/                app.js, router.js, rbac.js, store/*, views/* (ES modules)
```

## Access control

`assets/js/mockData.js`'s `pagesCatalog` is the single source of truth for who can open which
page — every protected page calls `guardPage("<key>")` at the very top of `<head>`, before
anything renders, and the header only shows tabs a role is actually allowed to follow
(`accessiblePages(role)`), so the nav never promises access the guard would then deny.

The **Admin Console** (`pages/admin/`) is a separate, RBAC-driven app: one matrix (menus, pages,
buttons, widgets) per business role, editable at Users & Roles / RBAC Matrix once inside. It
reads *who's* logged in from the same session `login.html` sets (`sessionStorage.snpdRole`) — it
does not have its own login screen. Its own data (gates, deliverables, forms, actions, audit log,
notifications) is namespaced in `localStorage` under `spd.*.v1` keys, separate from the
dashboard's mock data.

## Troubleshooting

- **Blank page / "needs to be served over HTTP"** — you opened a file directly. Run `node
  server.js` and use the `http://localhost:5173/...` URL it prints instead.
- **Logged in but redirected straight back to the Dashboard** — your role isn't listed for that
  page in `pagesCatalog` (`assets/js/mockData.js`). Add it there, don't just add a nav link.
- **Changes to a page not showing up** — hard-refresh; there's no build cache, but browsers do
  cache static JS/CSS aggressively during local dev.
