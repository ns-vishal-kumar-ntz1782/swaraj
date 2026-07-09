import { getActiveUser } from "../store/users.js";
import {
  BUSINESS_ROLES, ALL_MENUS, ALL_PAGES, ALL_BUTTONS,
  MENU_LABELS, BUTTON_LABELS, getMatrix, saveMatrix, resetRoleToDefault, can,
} from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu, invalidateShell } from "./shell.js";
import { escapeHtml, confirmDialog, toast } from "../utils.js";

export async function renderRbacAdmin() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("RBAC Matrix");
  setActiveMenu("rbac-admin");

  const canEditMatrix = can(user.businessRole, "rbac.manage");
  const state = { role: BUSINESS_ROLES[0], matrix: getMatrix() };

  function draw() {
    const cfg = state.matrix[state.role] || { menus: [], pages: [], buttons: [] };
    contentEl().innerHTML = `
      <div class="sg-page-header">
        <h1>RBAC Matrix</h1>
        ${canEditMatrix ? `<div class="sg-header-actions">
          <button class="btn btn-ghost" id="btnResetRole">Reset "${escapeHtml(state.role)}" to Default</button>
          <button class="btn btn-primary" id="btnSaveMatrix">Save Changes</button>
        </div>` : `<p class="sg-subtle">Read-only — you do not have rbac.manage permission.</p>`}
      </div>
      <div class="sg-tabs" id="roleTabs">
        ${BUSINESS_ROLES.map((r) => `<button class="sg-tab ${r === state.role ? "active" : ""}" data-role="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join("")}
      </div>
      <div class="sg-rbac-grid">
        ${matrixSection("menus", "Sidebar Menus", ALL_MENUS, MENU_LABELS, cfg.menus)}
        ${matrixSection("pages", "Allowed Pages/Routes", ALL_PAGES, MENU_LABELS, cfg.pages)}
        ${matrixSection("buttons", "Action Permissions", ALL_BUTTONS, BUTTON_LABELS, cfg.buttons)}
      </div>
    `;

    document.querySelectorAll("#roleTabs .sg-tab").forEach((tab) => {
      tab.addEventListener("click", () => { state.role = tab.dataset.role; draw(); });
    });

    if (canEditMatrix) {
      document.querySelectorAll(".sg-rbac-check").forEach((cb) => {
        cb.addEventListener("change", () => {
          const group = cb.dataset.group;
          const value = cb.dataset.value;
          const arr = state.matrix[state.role][group];
          if (cb.checked) { if (!arr.includes(value)) arr.push(value); }
          else { state.matrix[state.role][group] = arr.filter((v) => v !== value); }
        });
      });
      document.getElementById("btnSaveMatrix").addEventListener("click", () => {
        saveMatrix(state.matrix, user.name, user.businessRole);
        invalidateShell();
        toast("RBAC matrix saved", "success");
        draw();
      });
      document.getElementById("btnResetRole").addEventListener("click", async () => {
        if (await confirmDialog(`Reset "${state.role}" permissions to their defaults?`)) {
          state.matrix = resetRoleToDefault(state.role, user.name, user.businessRole);
          invalidateShell();
          toast("Role reset to default", "success");
          draw();
        }
      });
    }
  }

  function matrixSection(group, title, all, labels, active) {
    return `
      <div class="sg-rbac-section">
        <h3>${escapeHtml(title)}</h3>
        <div class="sg-rbac-checklist">
          ${all.map((id) => `
            <label class="sg-check-inline">
              <input type="checkbox" class="sg-rbac-check" data-group="${group}" data-value="${id}" ${active.includes(id) ? "checked" : ""} ${canEditMatrix ? "" : "disabled"} />
              ${escapeHtml(labels[id] || id)}
            </label>
          `).join("")}
        </div>
      </div>
    `;
  }

  draw();
}
