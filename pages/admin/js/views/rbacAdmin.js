import { getActiveUser } from "../store/users.js";
import {
  ALL_MENUS, ALL_BUTTONS, BUTTON_GROUPS, MENU_LABELS, BUTTON_LABELS,
  OUTER_PAGES, OUTER_PAGE_LABELS, ALL_WIDGETS, WIDGET_LABELS, ALL_PD_TABS, PD_TAB_LABELS,
  DEFAULT_MATRIX, getMatrix, saveMatrix, resetRoleToDefault, can,
} from "../rbac.js";
import { listRoleNames } from "../store/roles.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu, invalidateShell } from "./shell.js";
import { escapeHtml, confirmDialog, toast } from "../utils.js";

// Configure-Access-for-Role: one role visible at a time (dropdown), permissions grouped into
// four tabs instead of one giant scrolling matrix. Every card toggles one flat permission array
// on the selected role — same underlying RBAC matrix as before, just far fewer things on screen
// at once.
const TABS = [
  { id: "widgets", label: "Dashboard Widgets" },
  { id: "menus", label: "Menu Items" },
  { id: "pages", label: "Pages" },
  { id: "buttons", label: "Actions & Permissions" },
];

function buildCatalog() {
  return {
    widgets: [
      { title: "Dashboard Widgets", key: "widgets", ids: ALL_WIDGETS, labels: WIDGET_LABELS },
    ],
    menus: [
      { title: "Top Navigation", key: "outerPages", ids: OUTER_PAGES, labels: OUTER_PAGE_LABELS },
      { title: "Admin Console Sidebar", key: "menus", ids: ALL_MENUS, labels: MENU_LABELS },
    ],
    pages: [
      { title: "Project Detail — Tabs & Gate Drill-down", key: "pdTabs", ids: ALL_PD_TABS, labels: PD_TAB_LABELS },
    ],
    buttons: Object.entries(BUTTON_GROUPS).map(([title, ids]) => ({
      title, key: "buttons", ids: ids.filter((id) => ALL_BUTTONS.includes(id)), labels: BUTTON_LABELS,
    })),
  };
}

export async function renderRbacAdmin() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("RBAC Matrix");
  setActiveMenu("rbac-admin");

  const canEditMatrix = can(user.businessRole, "rbac.manage");
  const roleNames = listRoleNames();
  const catalog = buildCatalog();
  const state = { matrix: getMatrix(), role: roleNames[0], tab: "widgets" };

  function emptyCfg() {
    return { menus: [], outerPages: [], widgets: [], pdTabs: [], buttons: [] };
  }

  function draw() {
    const cfg = state.matrix[state.role] || emptyCfg();
    const hasDefault = !!DEFAULT_MATRIX[state.role];
    const opensNothing = cfg.menus.length === 0 && cfg.outerPages.length === 0;
    const groups = catalog[state.tab];

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <div>
          <h1>RBAC Matrix</h1>
          <p class="sg-subtle">Configure what each role can see and do, across the outer app and the Admin Console — one matrix, one source of truth.</p>
        </div>
      </div>

      <div class="sg-rbac-toolbar">
        <div class="sg-rbac-role-picker">
          <label for="rbacRoleSelect">Configure Access for Role</label>
          <select id="rbacRoleSelect">
            ${roleNames.map((r) => `<option value="${escapeHtml(r)}" ${r === state.role ? "selected" : ""}>${escapeHtml(r)}</option>`).join("")}
          </select>
          ${opensNothing ? `<span class="pill pill-red" title="This role has no menus or top-navigation pages — it cannot open any part of the app">Opens nothing</span>` : ""}
        </div>
        ${canEditMatrix ? `
          <div class="sg-header-actions">
            ${hasDefault ? `<button class="btn btn-ghost" id="btnResetRole"><span class="sg-rbac-reset-icon">↺</span> Reset to Default</button>` : ""}
            <button class="btn btn-primary" id="btnSaveMatrix">Save Changes</button>
          </div>
        ` : `<p class="sg-subtle">Read-only — you do not have rbac.manage permission.</p>`}
      </div>

      <div class="sg-tabs sg-rbac-tabs">
        ${TABS.map((t) => `<button class="sg-tab ${state.tab === t.id ? "active" : ""}" data-tab="${t.id}" type="button">${escapeHtml(t.label)}</button>`).join("")}
      </div>

      <div class="sg-rbac-panel adm-scroll">
        ${groups.map((g) => `
          <h3 class="sg-rbac-group-title">${escapeHtml(g.title)}</h3>
          <div class="sg-rbac-grid">
            ${g.ids.length ? g.ids.map((id) => {
              const checked = (cfg[g.key] || []).includes(id);
              return `
                <label class="sg-rbac-card ${checked ? "checked" : ""}">
                  <input type="checkbox" class="sg-rbac-check" data-key="${g.key}" data-id="${escapeHtml(id)}" ${checked ? "checked" : ""} ${canEditMatrix ? "" : "disabled"} />
                  <span class="sg-rbac-card-label">${escapeHtml(g.labels[id] || id)}</span>
                  <span class="sg-rbac-card-code">${escapeHtml(id)}</span>
                </label>
              `;
            }).join("") : `<p class="sg-subtle">Nothing to configure in this category.</p>`}
          </div>
        `).join("")}
      </div>

      <p class="sg-subtle sg-rbac-footnote">Changes apply the next time a session resolves its role (next login or page load). Business roles map 1:1 from the demo login's root role (CEO / PMO Manager / R&amp;D Head / Super Admin); Finance Manager and Engineer have no demo login yet but are pre-configured here for when Users &amp; Roles assigns them to a real account.</p>
    `;

    wireEvents();
  }

  function wireEvents() {
    document.getElementById("rbacRoleSelect").addEventListener("change", (e) => {
      state.role = e.target.value;
      draw();
    });
    document.querySelectorAll(".sg-rbac-tabs .sg-tab").forEach((btn) => {
      btn.addEventListener("click", () => { state.tab = btn.dataset.tab; draw(); });
    });

    if (!canEditMatrix) return;

    document.querySelectorAll(".sg-rbac-check").forEach((cb) => {
      cb.addEventListener("change", () => {
        const key = cb.dataset.key;
        const id = cb.dataset.id;
        if (!state.matrix[state.role]) state.matrix[state.role] = emptyCfg();
        const cfg = state.matrix[state.role];
        const arr = cfg[key] || (cfg[key] = []);
        if (cb.checked) { if (!arr.includes(id)) arr.push(id); }
        else { cfg[key] = arr.filter((v) => v !== id); }
        cb.closest(".sg-rbac-card").classList.toggle("checked", cb.checked);
      });
    });

    document.getElementById("btnSaveMatrix").addEventListener("click", () => {
      saveMatrix(state.matrix, user.name, user.businessRole);
      invalidateShell();
      toast("RBAC matrix saved", "success");
      draw();
    });

    document.getElementById("btnResetRole")?.addEventListener("click", async () => {
      if (await confirmDialog(`Reset "${state.role}" permissions to their defaults?`)) {
        state.matrix = resetRoleToDefault(state.role, user.name, user.businessRole);
        invalidateShell();
        toast("Role reset to default", "success");
        draw();
      }
    });
  }

  draw();
}
