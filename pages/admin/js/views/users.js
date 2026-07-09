import { getActiveUser, listUsers, createUser, updateUser, deleteUser } from "../store/users.js";
import { can, BUSINESS_ROLES } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import { escapeHtml, openModal, confirmDialog, toast, fmtDate } from "../utils.js";

export async function renderUsersAdmin() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Users & Roles");
  setActiveMenu("users");

  const canManage = can(user.businessRole, "user.manage");

  function draw() {
    const users = listUsers();
    contentEl().innerHTML = `
      <div class="sg-page-header">
        <h1>Users &amp; Roles</h1>
        ${canManage ? `<button class="btn btn-primary" id="btnAddUser">+ Add User</button>` : ""}
      </div>
      <p class="sg-subtle">Each user is assigned exactly one business role. That role drives every permission in the app via the RBAC matrix — configure roles under <a href="#/rbac-admin">RBAC Matrix</a>.</p>
      <div class="sg-table-wrap">
      <table class="sg-table">
        <thead><tr><th>Name</th><th>Email</th><th>Business Role</th><th>Created</th>${canManage ? "<th></th>" : ""}</tr></thead>
        <tbody>
          ${users.map((u) => `
            <tr>
              <td>${escapeHtml(u.name)}</td>
              <td>${escapeHtml(u.email)}</td>
              <td><span class="chip">${escapeHtml(u.businessRole)}</span></td>
              <td>${fmtDate(u.createdAt)}</td>
              ${canManage ? `<td class="sg-row-actions">
                <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${u.id}">Edit</button>
                <button class="btn btn-ghost btn-sm danger" data-act="delete" data-id="${u.id}" ${u.id === user.id ? "disabled title=\"Cannot delete your own account\"" : ""}>Delete</button>
              </td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
      </div>
    `;

    const addBtn = document.getElementById("btnAddUser");
    if (addBtn) addBtn.addEventListener("click", () => openUserModal(null));
    document.querySelectorAll('button[data-act="edit"]').forEach((btn) => {
      btn.addEventListener("click", () => openUserModal(users.find((u) => u.id === btn.dataset.id)));
    });
    document.querySelectorAll('button[data-act="delete"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const target = users.find((u) => u.id === btn.dataset.id);
        if (await confirmDialog(`Delete user "${target.name}"?`)) {
          deleteUser(target.id, user.name, user.businessRole);
          toast("User deleted", "success");
          draw();
        }
      });
    });
  }

  function openUserModal(target) {
    const editing = !!target;
    openModal({
      title: editing ? "Edit User" : "Add User",
      bodyHtml: `
        <div class="sg-form-grid one-col">
          <label>Name<input type="text" id="uName" value="${escapeHtml(target?.name || "")}" required /></label>
          <label>Email<input type="email" id="uEmail" value="${escapeHtml(target?.email || "")}" required /></label>
          <label>Business Role<select id="uRole" required>
            <option value="">Select a role…</option>
            ${BUSINESS_ROLES.map((r) => `<option value="${escapeHtml(r)}" ${target?.businessRole === r ? "selected" : ""}>${escapeHtml(r)}</option>`).join("")}
          </select></label>
        </div>
        <div class="sg-form-error" id="uFormError" hidden></div>
      `,
      footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">${editing ? "Save" : "Add"}</button>`,
      onMount: (backdrop, close) => {
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", close);
        backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
          const errEl = document.getElementById("uFormError");
          const payload = {
            name: document.getElementById("uName").value.trim(),
            email: document.getElementById("uEmail").value.trim(),
            businessRole: document.getElementById("uRole").value,
          };
          if (!payload.name || !payload.email || !payload.businessRole) {
            errEl.textContent = "Name, email and a business role are required.";
            errEl.hidden = false;
            return;
          }
          try {
            if (editing) updateUser(target.id, payload, user.name, user.businessRole);
            else createUser(payload, user.name, user.businessRole);
            close();
            toast(editing ? "User updated" : "User created", "success");
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
