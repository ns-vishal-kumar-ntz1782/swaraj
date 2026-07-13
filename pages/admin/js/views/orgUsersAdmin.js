import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import {
  listOrgUsers, getOrgUser, updateOrgUser, createOrgUser, setEmploymentStatus,
  DEPARTMENTS, BUSINESS_ROLES, SKILLS, EMPLOYMENT_STATUSES,
} from "../store/orgUsersAdmin.js";
import { getUserMemberships } from "../store/orgDirectory.js";
import { listAuditEntries } from "../store/audit.js";
import { renderRolesPanel } from "./orgRolesAdmin.js";
import {
  escapeHtml, fmtDateTime, relTime, openDrawer, confirmDialog, toast, paginate, paginationHtml, wirePagination,
  sortList, sortableTh, wireSortableTh, ICONS,
} from "../utils.js";

const PAGE_SIZE = 15;

// Only Active/Inactive are surfaced anywhere in the UI now — any stored value that isn't
// literally "Active" (including legacy "On Leave"/"Terminated" seed rows) reads as Inactive.
function statusLabel(status) {
  return status === "Active" ? "Active" : "Inactive";
}
function statusPill(status) {
  return status === "Active" ? "pill-green" : "pill-slate";
}

// ============================== LIST — combined "Users & Roles" page ==============================
export async function renderOrgUsersList() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Users & Roles");
  setActiveMenu("users");

  const canManage = can(user.businessRole, "orguser.manage");
  const state = {
    tab: "users", department: "", businessRole: "", employmentStatus: "", skill: "", minExperience: "", q: "",
    detailUserId: null, editing: false, page: 1, sortKey: "", sortDir: "asc",
  };

  function drawShell() {
    contentEl().innerHTML = `
      <div class="sg-tabs-row">
        <div class="sg-tabs" id="urTabs">
          <button class="sg-tab ${state.tab === "users" ? "active" : ""}" data-tab="users">Users</button>
          <button class="sg-tab ${state.tab === "roles" ? "active" : ""}" data-tab="roles">Roles</button>
        </div>
        <div class="sg-header-actions">${state.tab === "users" && canManage ? `<button class="btn btn-primary" id="btnCreate">+ New User</button>` : ""}</div>
      </div>
      <div id="urPanel" class="sg-subview"></div>
    `;
    document.querySelectorAll("#urTabs .sg-tab").forEach((tab) => {
      tab.addEventListener("click", () => { state.tab = tab.dataset.tab; state.detailUserId = null; state.editing = false; drawShell(); });
    });
    const panel = document.getElementById("urPanel");
    document.getElementById("btnCreate")?.addEventListener("click", () => openUserModal(null, () => { state.detailUserId = null; drawUsersPanel(panel); }));
    if (state.tab === "roles") renderRolesPanel(panel);
    else drawUsersPanel(panel);
  }

  function drawUsersPanel(panel) {
    if (state.detailUserId) { drawUserDetail(panel); return; }

    let list = listOrgUsers({
      department: state.department || undefined, businessRole: state.businessRole || undefined,
      employmentStatus: state.employmentStatus || undefined, skill: state.skill || undefined,
      minExperience: state.minExperience || undefined, q: state.q || undefined,
    });
    list = sortList(list, state.sortKey, state.sortDir);
    const all = listOrgUsers();
    const { pageItems, totalPages, page, total } = paginate(list, state.page, PAGE_SIZE);

    panel.innerHTML = `
      <div class="sg-kpi-filter-row">
        <div class="sg-kpi-strip compact">
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-blue">${ICONS.list}</span><div><div class="sg-kpi-label">Total</div><div class="sg-kpi-value">${all.length}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-green">${ICONS.check}</span><div><div class="sg-kpi-label">Active</div><div class="sg-kpi-value">${all.filter((u) => u.employmentStatus === "Active").length}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-slate">${ICONS.power}</span><div><div class="sg-kpi-label">Inactive</div><div class="sg-kpi-value">${all.filter((u) => u.employmentStatus !== "Active").length}</div></div></div>
        </div>
        <div class="sg-toolbar sg-toolbar-flex">
          <select id="fltDept"><option value="">All Departments</option>${DEPARTMENTS.map((d) => `<option value="${escapeHtml(d)}" ${state.department === d ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}</select>
          <select id="fltRole"><option value="">All Roles</option>${BUSINESS_ROLES.map((r) => `<option value="${escapeHtml(r)}" ${state.businessRole === r ? "selected" : ""}>${escapeHtml(r)}</option>`).join("")}</select>
          <select id="fltStatus"><option value="">All Statuses</option>${EMPLOYMENT_STATUSES.map((s) => `<option value="${escapeHtml(s)}" ${state.employmentStatus === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select>
          <select id="fltSkill"><option value="">All Skills</option>${SKILLS.map((s) => `<option value="${escapeHtml(s)}" ${state.skill === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select>
          <input type="number" id="fltExp" placeholder="Min. Experience (yrs)" min="0" value="${escapeHtml(state.minExperience)}" style="width:150px" />
          <input type="search" id="fltSearch" placeholder="Search users…" value="${escapeHtml(state.q)}" />
        </div>
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table">
          <thead><tr>
            ${sortableTh("Name", "fullName", state)}${sortableTh("Department", "department", state)}${sortableTh("Role", "businessRole", state)}${sortableTh("Designation", "designation", state)}<th>Reporting Manager</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${pageItems.length ? pageItems.map((u) => `
              <tr class="sg-row-clickable" data-id="${escapeHtml(u.id)}">
                <td><span class="sg-avatar-chip">${escapeHtml(u.avatarInitials)}</span> <span class="sg-link-text">${escapeHtml(u.fullName)}</span></td>
                <td>${escapeHtml(u.department)}</td>
                <td>${escapeHtml(u.businessRole)}</td>
                <td>${escapeHtml(u.designation)}</td>
                <td>${escapeHtml(u.reportingManager || "—")}</td>
                <td><span class="pill ${statusPill(u.employmentStatus)}">${statusLabel(u.employmentStatus)}</span></td>
              </tr>
            `).join("") : `<tr><td colspan="6" class="sg-empty-cell">No users match your filters.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${paginationHtml(page, totalPages, total, PAGE_SIZE)}
    `;

    panel.querySelector("#fltDept").addEventListener("change", (e) => { state.department = e.target.value; state.page = 1; drawUsersPanel(panel); });
    panel.querySelector("#fltRole").addEventListener("change", (e) => { state.businessRole = e.target.value; state.page = 1; drawUsersPanel(panel); });
    panel.querySelector("#fltStatus").addEventListener("change", (e) => { state.employmentStatus = e.target.value; state.page = 1; drawUsersPanel(panel); });
    panel.querySelector("#fltSkill").addEventListener("change", (e) => { state.skill = e.target.value; state.page = 1; drawUsersPanel(panel); });
    panel.querySelector("#fltExp").addEventListener("input", (e) => { state.minExperience = e.target.value; state.page = 1; drawUsersPanel(panel); });
    panel.querySelector("#fltSearch").addEventListener("input", (e) => { state.q = e.target.value; state.page = 1; drawUsersPanel(panel); });
    wirePagination(panel, (p) => { state.page = p; drawUsersPanel(panel); });
    wireSortableTh(panel, state, () => drawUsersPanel(panel));
    panel.querySelectorAll(".sg-row-clickable[data-id]").forEach((row) => row.addEventListener("click", () => {
      state.detailUserId = row.dataset.id;
      state.editing = false;
      drawUsersPanel(panel);
    }));
  }

  // ---- inline drill-down: same page, same tab, no route change ----
  function drawUserDetail(panel) {
    const u = getOrgUser(state.detailUserId);
    if (!u) { state.detailUserId = null; drawUsersPanel(panel); return; }
    const editing = state.editing;
    const memberships = getUserMemberships(u.id);
    const auditEntries = listAuditEntries({ entityType: "OrgUser" }).filter((e) => e.entityId === u.id);

    panel.innerHTML = `
      <p class="sg-subtle" style="margin:0 0 var(--space-6)">Users &amp; Roles / ${escapeHtml(u.fullName)}</p>
      <div class="sg-page-header">
        <div>
          <button class="btn btn-ghost btn-sm" id="btnBackToList" style="margin-bottom:var(--space-8)">← Back to list</button>
          <h1><span class="sg-avatar-chip lg">${escapeHtml(u.avatarInitials)}</span> ${escapeHtml(u.fullName)}</h1>
          <p class="sg-subtle">${escapeHtml(u.designation)} · ${escapeHtml(u.department)} · ${escapeHtml(u.employeeCode)}</p>
        </div>
        <div class="sg-header-actions">
          ${canManage && !editing ? `<button class="btn btn-ghost" id="btnEditUser">Edit</button>` : ""}
          ${canManage && !editing ? `<button class="btn btn-ghost danger" id="btnDeleteUser">Delete</button>` : ""}
          ${canManage && editing ? `<button class="btn btn-ghost" id="btnCancelEdit">Cancel</button>` : ""}
          ${canManage && editing ? `<button class="btn btn-primary" id="btnSaveEdit">Save</button>` : ""}
        </div>
      </div>
      ${editing ? renderEditFields(u) : renderReadFields(u)}
      <div class="sg-tabs" id="uTabs">
        <button class="sg-tab active" data-tab="skills">Skills</button>
        <button class="sg-tab" data-tab="projects">Project Memberships</button>
        <button class="sg-tab" data-tab="audit">Audit Trail</button>
      </div>
      <div class="sg-tab-panel" id="panel-skills"></div>
      <div class="sg-tab-panel" id="panel-projects" hidden></div>
      <div class="sg-tab-panel" id="panel-audit" hidden></div>
    `;

    document.getElementById("panel-skills").innerHTML = u.skills.length
      ? `<div class="sg-chip-row">${u.skills.map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join("")}</div>`
      : `<div class="sg-empty-state">No skills recorded.</div>`;

    document.getElementById("panel-projects").innerHTML = memberships.length
      ? `<div class="sg-table-wrap" style="flex:none;max-height:280px"><table class="sg-table"><thead><tr><th>Project</th><th>Project Role</th><th>Allocation</th><th>Since</th><th>Active</th></tr></thead><tbody>
          ${memberships.map((m) => `<tr><td>${escapeHtml(m.projectCode)}</td><td>${escapeHtml(m.projectRole)}</td><td>${m.allocationPct}%</td><td>${escapeHtml(m.startDate)}</td><td>${m.active ? "Yes" : "No"}</td></tr>`).join("")}
        </tbody></table></div>`
      : `<div class="sg-empty-state">Not currently staffed on any project.</div>`;

    document.getElementById("panel-audit").innerHTML = `
      <div class="sg-timeline no-grow">
        ${auditEntries.length ? auditEntries.map((e) => `
          <div class="sg-timeline-item">
            <div class="sg-timeline-dot pill-blue"></div>
            <div class="sg-timeline-body">
              <div class="sg-timeline-title">${escapeHtml(e.summary)}</div>
              <div class="sg-timeline-time">${escapeHtml(e.actor)} · ${relTime(e.timestamp)} · ${fmtDateTime(e.timestamp)}</div>
            </div>
          </div>
        `).join("") : `<div class="sg-empty-state">No changes recorded yet.</div>`}
      </div>
    `;

    panel.querySelectorAll("#uTabs .sg-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        panel.querySelectorAll("#uTabs .sg-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        panel.querySelectorAll(".sg-tab-panel").forEach((p) => (p.hidden = true));
        panel.querySelector(`#panel-${tab.dataset.tab}`).hidden = false;
      });
    });

    panel.querySelector("#btnBackToList").addEventListener("click", () => { state.detailUserId = null; state.editing = false; drawUsersPanel(panel); });
    panel.querySelector("#btnEditUser")?.addEventListener("click", () => { state.editing = true; drawUsersPanel(panel); });
    panel.querySelector("#btnCancelEdit")?.addEventListener("click", () => { state.editing = false; drawUsersPanel(panel); });
    panel.querySelector("#btnDeleteUser")?.addEventListener("click", async () => {
      if (!(await confirmDialog(`Delete ${u.fullName}? This marks them Inactive — their historical records and past assignments are preserved.`))) return;
      setEmploymentStatus(u.id, "Inactive", user.name, user.businessRole);
      toast("User deleted", "success");
      state.detailUserId = null;
      drawUsersPanel(panel);
    });
    panel.querySelector("#btnSaveEdit")?.addEventListener("click", () => {
      const payload = {
        fullName: panel.querySelector("#uName").value.trim(),
        email: panel.querySelector("#uEmail").value.trim(),
        phone: panel.querySelector("#uPhone").value.trim(),
        location: panel.querySelector("#uLocation").value.trim(),
        department: panel.querySelector("#uDept").value,
        businessRole: panel.querySelector("#uRole").value,
        designation: panel.querySelector("#uDesignation").value.trim(),
        experience: Number(panel.querySelector("#uExperience").value) || 0,
        skills: panel.querySelector("#uSkills").value.split(",").map((s) => s.trim()).filter(Boolean),
        reportingManager: panel.querySelector("#uManager").value.trim(),
        employmentStatus: panel.querySelector("#uStatus").value,
      };
      if (!payload.fullName || !payload.email) { toast("Name and email are required.", "error"); return; }
      updateOrgUser(u.id, payload, user.name, user.businessRole);
      toast("User updated", "success");
      state.editing = false;
      drawUsersPanel(panel);
    });
  }

  drawShell();
}

function renderReadFields(u) {
  return `
    <div class="sg-detail-grid">
      <div class="sg-detail-card"><div class="sg-kpi-label">Email</div>${escapeHtml(u.email)}</div>
      <div class="sg-detail-card"><div class="sg-kpi-label">Phone</div>${escapeHtml(u.phone || "—")}</div>
      <div class="sg-detail-card"><div class="sg-kpi-label">Location</div>${escapeHtml(u.location || "—")}</div>
      <div class="sg-detail-card"><div class="sg-kpi-label">Experience</div>${u.experience} yrs</div>
      <div class="sg-detail-card"><div class="sg-kpi-label">Reporting Manager</div>${escapeHtml(u.reportingManager || "—")}</div>
      <div class="sg-detail-card"><div class="sg-kpi-label">Status</div><span class="pill ${statusPill(u.employmentStatus)}">${statusLabel(u.employmentStatus)}</span></div>
    </div>
  `;
}

function renderEditFields(u) {
  return `
    <div class="sg-form-grid" style="margin-bottom:var(--space-14)">
      <label>Full Name<input type="text" id="uName" value="${escapeHtml(u.fullName)}" required /></label>
      <label>Email<input type="email" id="uEmail" value="${escapeHtml(u.email)}" required /></label>
      <label>Phone<input type="text" id="uPhone" value="${escapeHtml(u.phone || "")}" /></label>
      <label>Location<input type="text" id="uLocation" value="${escapeHtml(u.location || "")}" /></label>
      <label>Department<select id="uDept">${DEPARTMENTS.map((d) => `<option value="${escapeHtml(d)}" ${u.department === d ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}</select></label>
      <label>Business Role<select id="uRole">${BUSINESS_ROLES.map((r) => `<option value="${escapeHtml(r)}" ${u.businessRole === r ? "selected" : ""}>${escapeHtml(r)}</option>`).join("")}</select></label>
      <label>Designation<input type="text" id="uDesignation" value="${escapeHtml(u.designation || "")}" /></label>
      <label>Experience (yrs)<input type="number" id="uExperience" min="0" value="${u.experience ?? 0}" /></label>
      <label>Reporting Manager<input type="text" id="uManager" value="${escapeHtml(u.reportingManager || "")}" /></label>
      <label>Status<select id="uStatus">${EMPLOYMENT_STATUSES.map((s) => `<option value="${escapeHtml(s)}" ${statusLabel(u.employmentStatus) === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select></label>
      <label class="span-2">Skills (comma-separated)<input type="text" id="uSkills" value="${escapeHtml((u.skills || []).join(", "))}" /></label>
    </div>
  `;
}

// Only reached for "+ New User" — editing an existing user happens inline in the drill-down.
function openUserModal(_unused, onDone) {
  const user = getActiveUser();
  openDrawer({
    title: "New User",
    width: "55%",
    bodyHtml: `
      <div class="sg-form-grid">
        <label>Full Name<input type="text" id="nuName" /></label>
        <label>Email<input type="email" id="nuEmail" /></label>
        <label>Phone<input type="text" id="nuPhone" /></label>
        <label>Location<input type="text" id="nuLocation" /></label>
        <label>Department<select id="nuDept">${DEPARTMENTS.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("")}</select></label>
        <label>Business Role<select id="nuRole">${BUSINESS_ROLES.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("")}</select></label>
        <label>Designation<input type="text" id="nuDesignation" /></label>
        <label>Experience (yrs)<input type="number" id="nuExperience" min="0" value="0" /></label>
        <label class="span-2">Skills (comma-separated)<input type="text" id="nuSkills" /></label>
        <label>Reporting Manager<input type="text" id="nuManager" /></label>
      </div>
    `,
    footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Create</button>`,
    onMount: (backdrop, close, requestClose) => {
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", requestClose);
      backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
        const payload = {
          fullName: document.getElementById("nuName").value.trim(),
          email: document.getElementById("nuEmail").value.trim(),
          phone: document.getElementById("nuPhone").value.trim(),
          location: document.getElementById("nuLocation").value.trim(),
          department: document.getElementById("nuDept").value,
          businessRole: document.getElementById("nuRole").value,
          designation: document.getElementById("nuDesignation").value.trim(),
          experience: Number(document.getElementById("nuExperience").value) || 0,
          skills: document.getElementById("nuSkills").value.split(",").map((s) => s.trim()).filter(Boolean),
          reportingManager: document.getElementById("nuManager").value.trim(),
        };
        if (!payload.fullName || !payload.email) { toast("Name and email are required.", "error"); return; }
        createOrgUser(payload, user.name, user.businessRole);
        close();
        toast("User created", "success");
        onDone();
      });
    },
  });
}
