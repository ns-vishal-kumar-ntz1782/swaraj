// ==========================================================
//  SHARED — reused by every page outside the main dashboard (index.html keeps its own
//  richer header, already built and tested; this is for the pages that come after it).
//  Load order: mockData.js → auth.js → shared.js → the page's own script.
// ==========================================================

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// Renders a lightweight top nav (logo, role-filtered tabs, avatar + logout) into
// <div id="topnav-root"></div>. `activePageKey` must match a key in pagesCatalog.
function renderTopNav(activePageKey) {
  const root = document.getElementById("topnav-root");
  if (!root) return;

  const role     = getCurrentRole();
  const roleInfo = roleDirectory[role] || roleDirectory.CEO;
  const tabsHtml = accessiblePages(role).map(p =>
    `<a class="tab${p.key === activePageKey ? " tab-active" : ""}" href="${appUrl(p.path)}">${esc(p.label)}</a>`
  ).join("");

  root.innerHTML =
    `<header class="topnav">
      <div class="brand"><img src="https://www.figma.com/api/mcp/asset/2fafd961-c024-4b01-a88b-ea751bdfef9b" alt="Swaraj" /></div>
      <nav class="nav-tabs">${tabsHtml}</nav>
      <div class="topnav-spacer"></div>
      <div class="nav-right">
        <div class="avatar-wrap" id="avatarWrap">
          <button class="avatar" id="roleAvatar" type="button" aria-haspopup="true" aria-expanded="false">${esc(roleInfo.avatar)}</button>
          <div class="avatar-dropdown" id="avatarDropdown" hidden>
            <div class="avatar-dropdown-name">${esc(roleInfo.name)}</div>
            <div class="avatar-dropdown-email">${esc(roleInfo.email)}</div>
            <div class="avatar-dropdown-divider"></div>
            <button class="avatar-dropdown-logout" id="logoutBtn" type="button">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>`;

  const avatarBtn      = document.getElementById("roleAvatar");
  const avatarDropdown = document.getElementById("avatarDropdown");
  avatarBtn.addEventListener("click", e => {
    e.stopPropagation();
    avatarDropdown.hidden = !avatarDropdown.hidden;
    avatarBtn.setAttribute("aria-expanded", String(!avatarDropdown.hidden));
  });
  document.addEventListener("click", () => {
    avatarDropdown.hidden = true;
    avatarBtn.setAttribute("aria-expanded", "false");
  });
  document.getElementById("logoutBtn").addEventListener("click", logoutAndRedirect);
}
