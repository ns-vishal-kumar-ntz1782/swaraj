// Admin shell: the MAIN header (#topnav-root) is rendered by shared.js's renderTopNav — the
// exact same global function, with the exact same default site-wide tabs (Dashboard/Portfolio
// Tracker/Overall Budget/Admin Console), that every other page uses. No customization here at
// all, so it is byte-for-byte identical to the header on index.html/project-detail/etc.
//
// The 10 admin sections live in a SEPARATE sub-header row below it — the same pattern
// project-detail.html already uses for its own Snapshot/Deliverables/Gate Checklist/… tabs
// (.pd-subhead / .pd-tabs-row / .pd-tab), reused here rather than reinvented. There is
// deliberately no sidebar; that was replaced by this two-row top nav per request.
import { getActiveUser } from "../store/users.js";
import { menusFor, MENU_LABELS } from "../rbac.js";
import { escapeHtml } from "../utils.js";

let shellBuilt = false;
let currentUserId = null;

function root() {
  return document.getElementById("appRoot");
}

export function contentEl() {
  return document.getElementById("pageContent");
}

export function ensureShell() {
  const user = getActiveUser();
  if (!user) { window.location.replace("../../login.html"); return; }
  if (shellBuilt && currentUserId === user.id) return;
  shellBuilt = true;
  currentUserId = user.id;
  const menus = menusFor(user.businessRole);

  root().innerHTML = `
    <div class="app-shell">
      <div id="topnav-root"></div>
      <div class="pd-subhead">
        <nav class="pd-tabs-row" id="admSubTabs">
          ${menus.map((m) => `<a class="pd-tab" href="#/${m}" data-menu="${m}">${escapeHtml(MENU_LABELS[m])}</a>`).join("")}
        </nav>
      </div>
      <main class="adm-content" id="pageContent"></main>
    </div>
  `;

  // renderTopNav is a global from ../../../assets/js/shared.js (classic <script>, loaded
  // before this module — see index.html). Called with no options: same header as every page —
  // including its one notification bell (#navNotifBtn), which is the only notification bell
  // anywhere in the app now; the admin console no longer renders a second one of its own.
  renderTopNav("admin-console");
}

export function setBreadcrumb() {
  // No-op: kept so ported views that still call setBreadcrumb() don't need editing — the
  // admin shell shows the active section via the sub-header tab highlight instead.
}

export function setActiveMenu(menuId) {
  document.querySelectorAll("#admSubTabs .pd-tab").forEach((a) => {
    a.classList.toggle("pd-tab-active", a.dataset.menu === menuId);
  });
}

export function invalidateShell() {
  shellBuilt = false;
}
