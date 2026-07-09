// ==========================================================
//  SHARED — the ONE top header component used by every page. Only the middle nav-tabs list
//  differs per page (driven by pagesCatalog / an explicit customTabs override); everything
//  else — brand, search, as-on-date, FY dropdown, fullscreen toggle, export, avatar/logout —
//  is identical everywhere because it's the exact same rendered markup and wiring.
//  Load order: mockData.js → auth.js → shared.js → the page's own script.
// ==========================================================

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// Renders the full header into <div id="topnav-root"></div>.
//   activePageKey  — must match a key in pagesCatalog (or a customTabs entry) to highlight it.
//   opts.customTabs — optional [{key,label,href}] to use INSTEAD of accessiblePages(role); the
//                     admin console uses this for its section list.
//   opts.extraRight — optional raw HTML string inserted just before the avatar (e.g. the admin
//                     console's notification bell) — the only thing allowed to vary beyond tabs.
function renderTopNav(activePageKey, opts = {}) {
  const root = document.getElementById("topnav-root");
  if (!root) return;

  const role     = getCurrentRole();
  const roleInfo = roleDirectory[role] || roleDirectory.CEO;
  const tabs     = opts.customTabs || accessiblePages(role);
  const tabsHtml = tabs.map(t =>
    `<a class="tab${t.key === activePageKey ? " tab-active" : ""}" href="${esc(t.href || appUrl(t.path))}">${esc(t.label)}</a>`
  ).join("");

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
        <span class="nav-asofdate" id="navAsOfDate">As on date: 07 Jul 2026</span>
        <div class="date-fy-wrap" id="dateFyWrap">
          <button class="fy-btn outline-btn" id="fyBtn" type="button" aria-haspopup="true" aria-expanded="false">
            <span id="fyLabel">2026-2027</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="fy-dropdown" id="fyDropdown" hidden>
            <div class="fy-dropdown-section-title">Fiscal Year</div>
            <button class="fy-option fy-option-active" type="button" data-fy="2026-2027" data-date="07 Jul 2026">FY: 2026-2027</button>
            <button class="fy-option" type="button" data-fy="2025-2026" data-date="31 Mar 2026">FY: 2025-2026</button>
            <button class="fy-option" type="button" data-fy="2024-2025" data-date="31 Mar 2025">FY: 2024-2025</button>
            <button class="fy-option" type="button" data-fy="2027-2028" data-date="07 Jul 2026">FY: 2027-2028 (Planned)</button>
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
      avatarDropdown.hidden = !willOpen;
      avatarBtn.setAttribute("aria-expanded", String(willOpen));
    });
  }
  document.getElementById("logoutBtn")?.addEventListener("click", logoutAndRedirect);

  // ── Close dropdowns on outside click / Escape ──
  document.addEventListener("click", () => { closeFyDropdown(); closeAvatarDropdown(); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!fyDropdown.hidden) closeFyDropdown();
    else if (!avatarDropdown.hidden) closeAvatarDropdown();
    else if (searchInputWrap?.classList.contains("open")) closeSearch();
  });
}
