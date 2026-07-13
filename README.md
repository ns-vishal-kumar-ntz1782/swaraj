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
├── data/                      every mock/seed data record in the app, as JSON — projects.json,
│                              portfolio.json, gates.json, deliverables.json, forms.json,
│                              users.json, roles.json, templates.json, actions.json,
│                              activity-log.json, approvals.json. Loaded via a synchronous XHR
│                              at the top of the JS file that owns that data (app-config.js,
│                              project-detail-seed.js, portfolio.js, or the relevant admin
│                              store/*.js module) — nothing downstream had to change, since
│                              every consumer still just reads the same global/export names.
├── styles/                    centralized design system — every color, typography, spacing,
│   │                          shadow, radius, and transition value used anywhere in the app,
│   │                          as a CSS custom property. Change a value once here, it updates
│   │                          everywhere that value is used.
│   ├── variables.css          the :root token definitions (colors, type scale, spacing scale,
│   │                          shadows, radii, transitions) — nothing else in styles/ or
│   │                          assets/css/ declares a raw color/px/shadow literal, it's all var()
│   ├── theme.css               resets + base element theming (body, button)
│   ├── layout.css              .app-shell/.viewport-fit + the .topnav header component tree
│   └── components.css          common, reusable, additive components (buttons, pills, cards,
│                                tables, modal) — available on every page, not yet adopted by
│                                any existing page's own bespoke rules
├── assets/
│   ├── css/
│   │   ├── styles.css         entry point — @imports styles/*.css + this page's own
│   │   │                      dashboard.css, in order; every page's <link> still just points
│   │   │                      here, nothing else had to change
│   │   └── dashboard.css      index.html-only widget/drill-down/badge rules
│   └── js/
│       ├── auth.js            session, route guard (guardPage), APP_ROOT path resolution
│       ├── shared.js          the ONE header component every page renders (renderTopNav)
│       ├── dashboard.js       index.html's dashboard logic (charts, drill-downs, viewport fit)
│       ├── data/
│       │   ├── app-config.js         role directory, page/route catalog, seed portfolio data
│       │   └── project-detail-seed.js  generated per-project detail dataset
│       └── lib/                common utilities (escapeHtml, ragColor, fmtDate, openModal) —
│                                new/additive, not wired into any existing page's own logic
├── pages/
│   ├── portfolio-tracker/     portfolio table + filters
│   ├── overall-budget/        budget rollups
│   ├── project-detail/        drill-down opened from a dashboard chart (?id=<project>);
│   │                          project-detail.css/.js, charts.js, timeline.js live here now,
│   │                          colocated with their page like portfolio-tracker already was
│   └── admin/                 Admin Console — Super Admin only
│       ├── index.html         shell: shared header (top-nav tabs, no sidebar) + module app
│       ├── admin-console.css  component styles, fixed-viewport layout (tables scroll, page doesn't)
│       └── js/                app.js, router.js, rbac.js, store/*, views/* (ES modules)
```

## Access control

`assets/js/data/app-config.js`'s `pagesCatalog` is the single source of truth for who can open
which page — every protected page calls `guardPage("<key>")` at the very top of `<head>`, before
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
