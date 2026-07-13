import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import { listRoles, createRole, updateRole, deleteRole } from "../store/roles.js";
import { escapeHtml, openDrawer, confirmDialog, toast } from "../utils.js";

const PROTECTED_ROLE = "System Administrator";

export async function renderRolesAdmin() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Roles");
  setActiveMenu("roles");

  const canManage = can(user.businessRole, "role.manage");

  function draw() {
    const roles = listRoles();
    contentEl().innerHTML = `
      <div class="sg-page-header">
        <h1>Roles</h1>
        ${canManage ? `<button class="btn btn-primary" id="btnAddRole">+ Add Role</button>` : ""}
      </div>
      <p class="sg-subtle">The catalog of business roles assignable under <a href="#/users">Users</a> and configurable under <a href="#/rbac-admin">RBAC Matrix</a>.</p>
      <div class="sg-table-wrap">
      <table class="sg-table">
        <thead><tr><th>Name</th><th>Description</th>${canManage ? "<th></th>" : ""}</tr></thead>
        <tbody>
          ${roles.map((r) => `
            <tr>
              <td><span class="chip">${escapeHtml(r.name)}</span></td>
              <td>${escapeHtml(r.description || "—")}</td>
              ${canManage ? `<td class="sg-row-actions">
                <button class="btn btn-ghost btn-sm" data-act="edit" data-name="${escapeHtml(r.name)}" ${r.name === PROTECTED_ROLE ? `disabled title="${PROTECTED_ROLE} cannot be renamed"` : ""}>Edit</button>
                <button class="btn btn-ghost btn-sm danger" data-act="delete" data-name="${escapeHtml(r.name)}" ${r.name === PROTECTED_ROLE ? `disabled title="${PROTECTED_ROLE} cannot be deleted"` : ""}>Delete</button>
              </td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
      </div>
    `;

    const addBtn = document.getElementById("btnAddRole");
    if (addBtn) addBtn.addEventListener("click", () => openRoleModal(null));
    document.querySelectorAll('button[data-act="edit"]').forEach((btn) => {
      btn.addEventListener("click", () => openRoleModal(roles.find((r) => r.name === btn.dataset.name)));
    });
    document.querySelectorAll('button[data-act="delete"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const target = roles.find((r) => r.name === btn.dataset.name);
        if (await confirmDialog(`Delete role "${target.name}"?`)) {
          try {
            deleteRole(target.name, user.name, user.businessRole);
            toast("Role deleted", "success");
            draw();
          } catch (err) {
            toast(err.message, "error");
          }
        }
      });
    });
  }

  function openRoleModal(target) {
    const editing = !!target;
    openDrawer({
      width: "35%",
      title: editing ? "Edit Role" : "Add Role",
      bodyHtml: `
        <div class="sg-form-grid one-col">
          <label>Name<input type="text" id="rName" value="${escapeHtml(target?.name || "")}" required /></label>
          <label>Description<textarea id="rDescription">${escapeHtml(target?.description || "")}</textarea></label>
        </div>
        <div class="sg-form-error" id="rFormError" hidden></div>
      `,
      footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">${editing ? "Save" : "Add"}</button>`,
      onMount: (backdrop, close, requestClose) => {
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", requestClose);
        backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
          const errEl = document.getElementById("rFormError");
          const payload = {
            name: document.getElementById("rName").value.trim(),
            description: document.getElementById("rDescription").value.trim(),
          };
          if (!payload.name) {
            errEl.textContent = "Role name is required.";
            errEl.hidden = false;
            return;
          }
          try {
            if (editing) updateRole(target.name, payload, user.name, user.businessRole);
            else createRole(payload, user.name, user.businessRole);
            close();
            toast(editing ? "Role updated" : "Role created", "success");
            draw();
          } catch (err) {
            errEl.textContent = err.message;
            errEl.hidden = false;
          }
        });
      },
    });
  }

  draw();
}
