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
import { notificationsFor, unreadCountFor, markRead, markAllRead } from "../store/notifications.js";
import { relTime, escapeHtml } from "../utils.js";
import { navigate } from "../router.js";

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
        <div class="pd-actions">
          <button class="pd-icon-btn" id="sgNotifBtn" type="button" aria-label="Notifications" title="Notifications">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span class="sg-notif-badge" id="sgNotifBadge" hidden>0</span>
          </button>
          <div class="sg-notif-dropdown" id="sgNotifDropdown" hidden></div>
        </div>
      </div>
      <main class="adm-content" id="pageContent"></main>
    </div>
  `;

  // renderTopNav is a global from ../../../assets/js/shared.js (classic <script>, loaded
  // before this module — see index.html). Called with no options: same header as every page.
  renderTopNav("admin-console");
  wireSubHeader();
}

function wireSubHeader() {
  const notifBtn = document.getElementById("sgNotifBtn");
  const notifDd = document.getElementById("sgNotifDropdown");
  notifBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    notifDd.hidden = !notifDd.hidden;
    const avatarDd = document.getElementById("avatarDropdown");
    if (avatarDd) avatarDd.hidden = true;
    if (!notifDd.hidden) renderNotifDropdown();
  });
  document.addEventListener("click", () => { notifDd.hidden = true; });
  refreshNotifBadge();
}

function renderNotifDropdown() {
  const user = getActiveUser();
  const list = notificationsFor(user).slice(0, 12);
  const dd = document.getElementById("sgNotifDropdown");
  dd.innerHTML = `
    <div class="sg-notif-header">
      <strong>Notifications</strong>
      <button class="sg-link-btn" id="sgMarkAllRead" type="button">Mark all read</button>
    </div>
    <div class="sg-notif-list">
      ${list.length ? list.map((n) => `
        <button class="sg-notif-item ${n.read ? "" : "unread"}" data-id="${n.id}" data-route="${escapeHtml(n.route)}" type="button">
          <div class="sg-notif-title">${escapeHtml(n.title)}</div>
          <div class="sg-notif-msg">${escapeHtml(n.message)}</div>
          <div class="sg-notif-time">${relTime(n.createdAt)}</div>
        </button>
      `).join("") : `<div class="sg-notif-empty">No notifications yet.</div>`}
    </div>
  `;
  dd.querySelectorAll(".sg-notif-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      markRead(btn.dataset.id);
      refreshNotifBadge();
      if (btn.dataset.route) navigate(btn.dataset.route.replace(/^#/, ""));
    });
  });
  const markAllBtn = document.getElementById("sgMarkAllRead");
  if (markAllBtn) markAllBtn.addEventListener("click", () => { markAllRead(user); refreshNotifBadge(); renderNotifDropdown(); });
}

export function refreshNotifBadge() {
  const user = getActiveUser();
  if (!user) return;
  const count = unreadCountFor(user);
  const badge = document.getElementById("sgNotifBadge");
  if (!badge) return;
  badge.hidden = count === 0;
  badge.textContent = String(count);
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
