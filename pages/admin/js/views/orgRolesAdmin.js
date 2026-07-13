// Roles panel — embedded as the "Roles" tab inside the combined Users & Roles page
// (views/orgUsersAdmin.js). Not a standalone route/page of its own.
import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { listOrgRoles, createOrgRole, updateOrgRole, deleteOrgRole, cloneOrgRole, peopleCountForRole, DEPARTMENTS } from "../store/orgRolesAdmin.js";
import { escapeHtml, openDrawer, confirmDialog, toast, iconBtn } from "../utils.js";

export function renderRolesPanel(container) {
  const user = getActiveUser();
  if (!user) return;
  const canManage = can(user.businessRole, "orgrole.manage");

  function draw() {
    const roles = listOrgRoles();

    container.innerHTML = `
      <div class="sg-panel-toolbar" style="justify-content:space-between;align-items:center">
        <p class="sg-subtle" style="margin:0">The enterprise role catalog — defines organizational roles, department ownership and reporting hierarchy. Console permission roles (who can do what in this admin module) are managed separately, inside RBAC.</p>
        ${canManage ? `<button class="btn btn-primary" id="btnCreateRole">+ New Role</button>` : ""}
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table sg-table-fixed">
          <colgroup>
            <col style="width:90px" /><col style="width:170px" /><col style="width:150px" /><col style="width:80px" /><col /><col style="width:80px" /><col style="width:96px" />
          </colgroup>
          <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Hierarchy</th><th>Description</th><th># People</th><th>Actions</th></tr></thead>
          <tbody>
            ${roles.map((r) => `
              <tr>
                <td><strong>${escapeHtml(r.code)}</strong></td>
                <td class="sg-link-text" data-act="edit" data-code="${escapeHtml(r.code)}">${escapeHtml(r.name)}</td>
                <td>${escapeHtml(r.department)}</td>
                <td>L${r.hierarchyLevel}</td>
                <td class="sg-subtle sg-cell-truncate" title="${escapeHtml(r.description)}">${escapeHtml(r.description)}</td>
                <td>${peopleCountForRole(r.name)}</td>
                <td class="sg-row-actions">
                  ${canManage ? iconBtn("edit", { act: "edit", id: r.code, title: "Edit role" }) : ""}
                  ${canManage ? iconBtn("clone", { act: "clone", id: r.code, title: "Clone role" }) : ""}
                  ${canManage ? iconBtn("delete", { act: "delete", id: r.code, title: "Delete role", cls: "danger" }) : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelector("#btnCreateRole")?.addEventListener("click", () => openRoleModal(null, draw));
    container.querySelectorAll('[data-act="edit"]').forEach((btn) => btn.addEventListener("click", () => openRoleModal(roles.find((r) => r.code === btn.dataset.code || r.code === btn.dataset.id), draw)));
    container.querySelectorAll('[data-act="clone"]').forEach((btn) => btn.addEventListener("click", () => {
      const clone = cloneOrgRole(btn.dataset.id, user.name, user.businessRole);
      toast(`Cloned as ${clone.code}`, "success");
      draw();
    }));
    container.querySelectorAll('[data-act="delete"]').forEach((btn) => btn.addEventListener("click", async () => {
      const r = roles.find((x) => x.code === btn.dataset.id);
      if (!(await confirmDialog(`Delete role "${r.name}"?`))) return;
      try {
        deleteOrgRole(r.code, user.name, user.businessRole);
        toast("Role deleted", "success");
        draw();
      } catch (err) {
        toast(err.message, "error");
      }
    }));
  }

  draw();
}

function openRoleModal(role, onDone) {
  const editing = !!role;
  const user = getActiveUser();
  openDrawer({
    width: "40%",
    title: editing ? `Edit Role — ${role.name}` : "New Role",
    bodyHtml: `
      <div class="sg-form-grid">
        <label>Role Code<input type="text" id="rCode" value="${escapeHtml(role?.code || "")}" ${editing ? "disabled" : ""} required /></label>
        <label>Role Name<input type="text" id="rName" value="${escapeHtml(role?.name || "")}" required /></label>
        <label>Department<select id="rDept">${DEPARTMENTS.map((d) => `<option value="${escapeHtml(d)}" ${role?.department === d ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}</select></label>
        <label>Hierarchy Level (1 = most senior)<input type="number" id="rHierarchy" min="1" max="10" value="${role?.hierarchyLevel ?? 5}" /></label>
        <label class="span-2">Description<textarea id="rDesc" rows="3">${escapeHtml(role?.description || "")}</textarea></label>
      </div>
    `,
    footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">${editing ? "Save" : "Create"}</button>`,
    onMount: (backdrop, close, requestClose) => {
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", requestClose);
      backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
        const payload = {
          code: document.getElementById("rCode").value.trim(),
          name: document.getElementById("rName").value.trim(),
          department: document.getElementById("rDept").value,
          hierarchyLevel: Number(document.getElementById("rHierarchy").value) || 5,
          description: document.getElementById("rDesc").value.trim(),
        };
        if (!payload.code || !payload.name) { toast("Role code and name are required.", "error"); return; }
        try {
          if (editing) updateOrgRole(role.code, payload, user.name, user.businessRole);
          else createOrgRole(payload, user.name, user.businessRole);
          close();
          toast(editing ? "Role updated" : "Role created", "success");
          onDone();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    },
  });
}
