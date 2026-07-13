// ==========================================================
//  SHARED — the ONE top header component used by every page. Only the middle nav-tabs list
//  differs per page (driven by pagesCatalog / an explicit customTabs override); everything
//  else — brand, search, as-on-date, FY dropdown, fullscreen toggle, export, avatar/logout —
//  is identical everywhere because it's the exact same rendered markup and wiring.
//  Load order: mockData.js → auth.js → shared.js → the page's own script.
// ==========================================================

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// "As on date" in the header must track the real current date (India Standard Time), not a
// fixed snapshot — computed fresh on every render rather than hardcoded, in the same "DD Mon
// YYYY" format the rest of the header already uses (e.g. "07 Jul 2026").
function todayISTLabel() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("day")} ${get("month")} ${get("year")}`;
}

// Renders the full header into <div id="topnav-root"></div>.
//   activePageKey  — must match a key in pagesCatalog (or a customTabs entry) to highlight it.
//   opts.customTabs — optional [{key,label,href}] to use INSTEAD of accessiblePages(role); the
//                     admin console uses this for its section list.
//   opts.extraRight — optional raw HTML string inserted just before the avatar — the only thing
//                     allowed to vary beyond tabs. Unused today (no caller currently passes it).
function renderTopNav(activePageKey, opts = {}) {
  const root = document.getElementById("topnav-root");
  if (!root) return;

  const role     = getCurrentRole();
  const roleInfo = roleDirectory[role] || roleDirectory.CEO;
  const tabs     = opts.customTabs || accessiblePages(role);
  const tabsHtml = tabs.map(t =>
    `<a class="tab${t.key === activePageKey ? " tab-active" : ""}" href="${esc(t.href || appUrl(t.path))}">${esc(t.label)}</a>`
  ).join("");
  const asOfDate = todayISTLabel();

  root.innerHTML =
    `<header class="topnav">
      <div class="brand"><a href="${esc(appUrl("index.html"))}"><img src="https://www.figma.com/api/mcp/asset/2fafd961-c024-4b01-a88b-ea751bdfef9b" alt="Swaraj" /></a></div>
      <nav class="nav-tabs" id="navTabs">${tabsHtml}</nav>
      <div class="topnav-spacer"></div>
      <div class="nav-right">
        <div class="nav-search-wrap">
          <button class="icon-btn nav-search-btn" id="navSearchBtn" type="button" aria-label="Search" aria-expanded="false">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <div class="nav-search-input-wrap" id="navSearchInputWrap">
            <input type="text" id="searchInput" class="nav-search-input" placeholder="Search projects, gates, types…" autocomplete="off" />
            <button type="button" id="searchClose" class="nav-search-clear" aria-label="Close search">✕</button>
          </div>
        </div>
        <span class="nav-asofdate" id="navAsOfDate">As on date: ${esc(asOfDate)}</span>
        <div class="date-fy-wrap" id="dateFyWrap">
          <button class="fy-btn outline-btn" id="fyBtn" type="button" aria-haspopup="true" aria-expanded="false">
            <span id="fyLabel">2026-2027</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="fy-dropdown" id="fyDropdown" hidden>
            <div class="fy-dropdown-section-title">Fiscal Year</div>
            <button class="fy-option fy-option-active" type="button" data-fy="2026-2027" data-date="${esc(asOfDate)}">FY: 2026-2027</button>
            <button class="fy-option" type="button" data-fy="2025-2026" data-date="31 Mar 2026">FY: 2025-2026</button>
            <button class="fy-option" type="button" data-fy="2024-2025" data-date="31 Mar 2025">FY: 2024-2025</button>
            <button class="fy-option" type="button" data-fy="2027-2028" data-date="${esc(asOfDate)}">FY: 2027-2028 (Planned)</button>
          </div>
        </div>
        <button class="icon-btn" id="navMaxBtn" type="button" aria-label="Toggle fullscreen" title="Toggle fullscreen">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
        <button class="outline-btn export-btn" id="navExportBtn" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Export</span>
        </button>
        ${opts.extraRight || ""}
        <button class="icon-btn nav-ai-btn" id="navAiBtn" type="button" aria-label="AI Insights" title="AI Insights">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"/></svg>
        </button>
        <div class="nav-notif-wrap" id="navNotifWrap">
          <button class="icon-btn nav-notif-btn" id="navNotifBtn" type="button" aria-label="Notifications" aria-expanded="false" aria-haspopup="true" title="Notifications">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span class="nav-notif-badge" id="navNotifBadge" hidden>0</span>
          </button>
          <div class="nav-notif-dropdown" id="navNotifDropdown" hidden></div>
        </div>
        <div class="avatar-wrap" id="avatarWrap">
          <button class="avatar" id="roleAvatar" type="button" aria-haspopup="true" aria-expanded="false">${esc(roleInfo.avatar)}</button>
          <div class="avatar-dropdown" id="avatarDropdown" hidden>
            <div class="avatar-dropdown-name" id="avatarDropdownName">${esc(roleInfo.name)}</div>
            <div class="avatar-dropdown-email" id="avatarDropdownEmail">${esc(roleInfo.email)}</div>
            <div class="avatar-dropdown-divider"></div>
            <button class="avatar-dropdown-logout" id="logoutBtn" type="button">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>`;

  wireTopNav();
}

function wireTopNav() {
  // ── Browser fullscreen ──
  const navMax = document.getElementById("navMaxBtn");
  if (navMax) {
    navMax.addEventListener("click", () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.();
    });
    document.addEventListener("fullscreenchange", () => {
      navMax.title = document.fullscreenElement ? "Exit fullscreen" : "Toggle fullscreen";
    });
  }

  // ── Inline search: expands leftward from the icon within the header ──
  const searchBtn       = document.getElementById("navSearchBtn");
  const searchInputWrap = document.getElementById("navSearchInputWrap");
  const searchInput     = document.getElementById("searchInput");
  const searchClose     = document.getElementById("searchClose");

  function openSearch() {
    searchInputWrap.classList.add("open");
    searchBtn.setAttribute("aria-expanded", "true");
    setTimeout(() => searchInput?.focus(), 250);
  }
  function closeSearch() {
    searchInputWrap.classList.remove("open");
    searchBtn.setAttribute("aria-expanded", "false");
    if (searchInput) searchInput.value = "";
  }
  if (searchBtn && searchInputWrap) {
    searchBtn.addEventListener("click", e => {
      e.stopPropagation();
      searchInputWrap.classList.contains("open") ? closeSearch() : openSearch();
    });
    searchClose?.addEventListener("click", e => { e.stopPropagation(); closeSearch(); });
    document.addEventListener("click", e => {
      if (searchInputWrap.classList.contains("open") && !searchInputWrap.contains(e.target) && e.target !== searchBtn)
        closeSearch();
    });
  }

  // ── FY / as-on-date dropdown (cosmetic — updates its own label + date only) ──
  const fyBtn      = document.getElementById("fyBtn");
  const fyDropdown = document.getElementById("fyDropdown");
  const fyLabel    = document.getElementById("fyLabel");
  const asOfDateEl = document.getElementById("navAsOfDate");

  function closeFyDropdown() {
    fyDropdown.hidden = true;
    fyBtn.setAttribute("aria-expanded", "false");
  }
  if (fyBtn && fyDropdown) {
    fyBtn.addEventListener("click", e => {
      e.stopPropagation();
      const willOpen = fyDropdown.hidden;
      closeAvatarDropdown();
      closeNotifDropdown();
      fyDropdown.hidden = !willOpen;
      fyBtn.setAttribute("aria-expanded", String(willOpen));
    });
    fyDropdown.querySelectorAll(".fy-option").forEach(opt => {
      opt.addEventListener("click", () => {
        fyDropdown.querySelectorAll(".fy-option").forEach(o => o.classList.remove("fy-option-active"));
        opt.classList.add("fy-option-active");
        fyLabel.textContent = opt.dataset.fy ? "FY: " + opt.dataset.fy : opt.textContent;
        if (asOfDateEl) asOfDateEl.textContent = "As on date: " + opt.dataset.date;
        closeFyDropdown();
      });
    });
  }

  // ── Export (no page-specific export logic exists yet, so this is a friendly stub) ──
  document.getElementById("navExportBtn")?.addEventListener("click", () => {
    alert("Export isn't wired up yet on this page.");
  });

  // ── AI button — forward to page's own AI handler if available ──
  document.getElementById("navAiBtn")?.addEventListener("click", () => {
    if (typeof window.__navAiHandler === "function") {
      window.__navAiHandler();
    } else {
      const d = window.__pd;
      if (d) {
        const late = (d.gates||[]).filter(g=>g.delayDays>15).length;
        alert(`AI Summary: ${d.projectName} (${d.projectCode})\nHealth: ${d.healthScore}% | Gate: ${d.currentGate}\nCompliance: ${d.compliancePct.toFixed(1)}% | ${late} gate(s) delayed >15 days\nDeliverables: ${d.deliverables.done}/${d.deliverables.total}`);
      }
    }
  });

  // ── Notification dropdown — the one bell in the whole app; reads the same localStorage key
  // the admin console's own store/notifications.js writes to, replicated here as plain reads
  // (not an ES-module import) since this file is a classic <script> loaded on every page, some
  // of which never load any admin module. User scoping mirrors the admin console's own
  // getActiveUser() exactly (id "root-<role>"), so toUserId/toRole targeting resolves the same
  // way everywhere a notification might be read. ──
  const notifBtn = document.getElementById("navNotifBtn");
  const notifDropdown = document.getElementById("navNotifDropdown");
  const notifBadge = document.getElementById("navNotifBadge");

  function currentNotifUser() {
    const role = (typeof getCurrentRole === "function") ? getCurrentRole() : null;
    if (!role) return null;
    const businessRole = (typeof currentBusinessRole === "function") ? currentBusinessRole() : null;
    return { id: "root-" + role, businessRole };
  }
  function allNotifications() {
    try {
      const raw = localStorage.getItem("spd.notifications.v1");
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }
  function saveNotifications(list) { localStorage.setItem("spd.notifications.v1", JSON.stringify(list)); }
  function notificationsForCurrentUser() {
    const user = currentNotifUser();
    if (!user) return [];
    return allNotifications().filter(n => n.toUserId === user.id || (n.toRole && n.toRole === user.businessRole));
  }
  function refreshNotifBadge() {
    if (!notifBadge) return;
    const unread = notificationsForCurrentUser().filter(n => !n.read).length;
    notifBadge.hidden = unread === 0;
    notifBadge.textContent = String(unread);
  }
  function closeNotifDropdown() {
    if (!notifDropdown) return;
    notifDropdown.hidden = true;
    notifBtn?.setAttribute("aria-expanded", "false");
  }
  function relNotifTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    return Math.round(hrs / 24) + "d ago";
  }
  function renderNotifDropdown() {
    if (!notifDropdown) return;
    const list = notificationsForCurrentUser().slice(0, 12);
    notifDropdown.innerHTML = `
      <div class="nav-notif-header">
        <strong>Notifications</strong>
        <button class="nav-notif-markall" id="navMarkAllRead" type="button">Mark all read</button>
      </div>
      <div class="nav-notif-list">
        ${list.length ? list.map(n => `
          <button class="nav-notif-item ${n.read ? "" : "unread"}" data-id="${esc(n.id)}" data-route="${esc(n.route || "")}" type="button">
            <div class="nav-notif-title">${esc(n.title || "")}</div>
            <div class="nav-notif-msg">${esc(n.message || "")}</div>
            <div class="nav-notif-time">${relNotifTime(n.createdAt)}</div>
          </button>
        `).join("") : `<div class="nav-notif-empty">No notifications yet.</div>`}
      </div>
    `;
    notifDropdown.querySelectorAll(".nav-notif-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const list2 = allNotifications();
        const n = list2.find(x => x.id === btn.dataset.id);
        if (n) { n.read = true; saveNotifications(list2); }
        refreshNotifBadge();
        closeNotifDropdown();
        const route = btn.dataset.route;
        if (route && route.startsWith("#/")) window.location.href = appUrl("pages/admin/index.html") + route;
      });
    });
    document.getElementById("navMarkAllRead")?.addEventListener("click", () => {
      const user = currentNotifUser();
      if (!user) return;
      const list2 = allNotifications();
      list2.forEach(n => { if ((n.toUserId === user.id || (n.toRole && n.toRole === user.businessRole)) && !n.read) n.read = true; });
      saveNotifications(list2);
      refreshNotifBadge();
      renderNotifDropdown();
    });
  }
  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener("click", e => {
      e.stopPropagation();
      const willOpen = notifDropdown.hidden;
      closeFyDropdown();
      closeAvatarDropdown();
      if (willOpen) renderNotifDropdown();
      notifDropdown.hidden = !willOpen;
      notifBtn.setAttribute("aria-expanded", String(willOpen));
    });
  }
  refreshNotifBadge();
  setInterval(refreshNotifBadge, 5000);

  // ── Avatar dropdown (role info + logout) ──
  const avatarBtn      = document.getElementById("roleAvatar");
  const avatarDropdown = document.getElementById("avatarDropdown");

  function closeAvatarDropdown() {
    avatarDropdown.hidden = true;
    avatarBtn.setAttribute("aria-expanded", "false");
  }
  if (avatarBtn && avatarDropdown) {
    avatarBtn.addEventListener("click", e => {
      e.stopPropagation();
      const willOpen = avatarDropdown.hidden;
      closeFyDropdown();
      closeNotifDropdown();
      avatarDropdown.hidden = !willOpen;
      avatarBtn.setAttribute("aria-expanded", String(willOpen));
    });
  }
  document.getElementById("logoutBtn")?.addEventListener("click", logoutAndRedirect);

  // ── Close dropdowns on outside click / Escape ──
  document.addEventListener("click", () => { closeFyDropdown(); closeAvatarDropdown(); closeNotifDropdown(); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!fyDropdown.hidden) closeFyDropdown();
    else if (!avatarDropdown.hidden) closeAvatarDropdown();
    else if (notifDropdown && !notifDropdown.hidden) closeNotifDropdown();
    else if (searchInputWrap?.classList.contains("open")) closeSearch();
  });
}
