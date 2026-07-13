import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import { listActions, getAction, createAction, updateAction, addComment, isOverdue, STATUSES, PRIORITIES, CATEGORIES, MEETING_TYPES } from "../store/actions.js";
import { listProjects } from "../store/projectExecution.js";
import { displayFor, getProjectTeam } from "../store/orgDirectory.js";
import { DEPARTMENTS } from "../store/orgUsersAdmin.js";
import {
  escapeHtml, fmtDate, fmtDateTime, statusPillClass, openDrawer, toast, paginate, paginationHtml, wirePagination,
  sortList, sortableTh, wireSortableTh, ICONS,
} from "../utils.js";

const PAGE_SIZE = 20;

function priorityPill(p) {
  return p === "Critical" ? "pill-red" : p === "High" ? "pill-amber" : p === "Medium" ? "pill-blue" : "pill-slate";
}

export async function renderActions(params, query) {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Action Register");
  setActiveMenu("actions");

  const canManage = can(user.businessRole, "action.manage");
  const projects = listProjects();
  const state = { projectCode: query.projectCode || "", gateCode: "", priority: "", status: "", meetingType: "", q: "", page: 1, sortKey: "", sortDir: "asc" };

  function draw() {
    let actions = listActions({
      projectCode: state.projectCode || undefined, gateCode: state.gateCode || undefined,
      priority: state.priority || undefined, source: state.meetingType || undefined,
      status: state.status || undefined, q: state.q || undefined,
    });
    actions = sortList(actions, state.sortKey, state.sortDir);
    const all = listActions();
    const kpis = {
      total: all.length,
      open: all.filter((a) => !["Completed", "Closed", "Cancelled"].includes(a.status)).length,
      overdue: all.filter(isOverdue).length,
      escalated: all.filter((a) => !!a.escalationLevel).length,
    };
    const gatesForFilter = state.projectCode
      ? [...new Set(all.filter((a) => a.projectCode === state.projectCode).map((a) => a.gateCode))]
      : [...new Set(all.map((a) => a.gateCode))];
    const { pageItems, totalPages, page, total } = paginate(actions, state.page, PAGE_SIZE);

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <div>
          <h1>Action Register</h1>
          <p class="sg-subtle">Enterprise action tracking across every project and gate.</p>
        </div>
        ${canManage ? `<button class="btn btn-primary" id="btnCreateAction">+ New Action</button>` : ""}
      </div>
      <div class="sg-kpi-filter-row">
        <div class="sg-kpi-strip compact">
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-blue">${ICONS.list}</span><div><div class="sg-kpi-label">Total</div><div class="sg-kpi-value">${kpis.total}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-green">${ICONS.check}</span><div><div class="sg-kpi-label">Open</div><div class="sg-kpi-value">${kpis.open}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-red">${ICONS.clock}</span><div><div class="sg-kpi-label">Overdue</div><div class="sg-kpi-value">${kpis.overdue}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-amber">${ICONS.alert}</span><div><div class="sg-kpi-label">Escalated</div><div class="sg-kpi-value">${kpis.escalated}</div></div></div>
        </div>
        <div class="sg-toolbar sg-toolbar-flex">
          <select id="fltProject"><option value="">All Projects</option>${projects.map((p) => `<option value="${escapeHtml(p.code)}" ${state.projectCode === p.code ? "selected" : ""}>${escapeHtml(p.code)}</option>`).join("")}</select>
          <select id="fltGate"><option value="">All Gates</option>${gatesForFilter.map((g) => `<option value="${escapeHtml(g)}" ${state.gateCode === g ? "selected" : ""}>${escapeHtml(g)}</option>`).join("")}</select>
          <select id="fltMeetingType"><option value="">All Meeting Types</option>${MEETING_TYPES.map((m) => `<option value="${escapeHtml(m)}" ${state.meetingType === m ? "selected" : ""}>${escapeHtml(m)}</option>`).join("")}</select>
          <select id="fltPriority"><option value="">All Priorities</option>${PRIORITIES.map((p) => `<option value="${p}" ${state.priority === p ? "selected" : ""}>${p}</option>`).join("")}</select>
          <select id="fltStatus"><option value="">All Statuses</option>${STATUSES.map((s) => `<option value="${s}" ${state.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <input type="search" id="fltSearch" placeholder="Search actions…" value="${escapeHtml(state.q)}" />
        </div>
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table">
          <thead><tr>
            ${sortableTh("#", "actionNumber", state)}${sortableTh("Action to be Taken", "title", state)}<th>Project</th><th>Meeting Type</th><th>Responsibility</th>${sortableTh("Priority", "priority", state)}${sortableTh("Meeting / Target Date", "targetDate", state)}<th>Status</th><th>Remarks</th>
          </tr></thead>
          <tbody>
            ${pageItems.length ? pageItems.map((a) => `
              <tr class="sg-row-clickable" data-id="${escapeHtml(a.id)}">
                <td class="sg-link-text">${escapeHtml(a.actionNumber)}</td>
                <td class="sg-link-text">${escapeHtml(a.title)}</td>
                <td>${escapeHtml(a.projectCode || "—")}</td>
                <td>${escapeHtml(a.source || "—")}</td>
                <td>${escapeHtml(displayFor(a.assignedToUserId).name)}</td>
                <td><span class="pill ${priorityPill(a.priority)}">${escapeHtml(a.priority)}</span></td>
                <td>${fmtDate(a.targetDate)}</td>
                <td><span class="pill ${statusPillClass(a.status)}">${escapeHtml(a.status)}</span>${isOverdue(a) ? ` <span class="pill pill-red">Overdue</span>` : ""}${a.escalationLevel ? ` <span class="pill pill-amber">Escalated</span>` : ""}</td>
                <td class="sg-subtle" style="max-width:200px;white-space:normal">${escapeHtml(a.remarks || "—")}</td>
              </tr>
            `).join("") : `<tr><td colspan="9" class="sg-empty-cell">No action items match your filters.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${paginationHtml(page, totalPages, total, PAGE_SIZE)}
    `;

    document.getElementById("fltProject").addEventListener("change", (e) => { state.projectCode = e.target.value; state.gateCode = ""; state.page = 1; draw(); });
    document.getElementById("fltGate").addEventListener("change", (e) => { state.gateCode = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltMeetingType").addEventListener("change", (e) => { state.meetingType = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltPriority").addEventListener("change", (e) => { state.priority = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltStatus").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltSearch").addEventListener("input", (e) => { state.q = e.target.value; state.page = 1; draw(); });
    wirePagination(contentEl(), (p) => { state.page = p; draw(); });
    wireSortableTh(contentEl(), state, draw);
    document.querySelectorAll(".sg-row-clickable").forEach((row) => {
      row.addEventListener("click", () => openDetailDrawer(getAction(row.dataset.id)));
    });
    document.getElementById("btnCreateAction")?.addEventListener("click", () => openCreateDrawer());
  }

  function openCreateDrawer() {
    const team = state.projectCode ? getProjectTeam(state.projectCode) : [];
    openDrawer({
      title: "New Action Item",
      width: "45%",
      bodyHtml: `
        <div class="sg-form-grid">
          <label class="span-2">Action to be Taken<input type="text" id="aTitle" required /></label>
          <label class="span-2">Description<textarea id="aDescription" rows="2"></textarea></label>
          <label>Project<select id="aProject"><option value="">None</option>${projects.map((p) => `<option value="${escapeHtml(p.code)}" ${state.projectCode === p.code ? "selected" : ""}>${escapeHtml(p.code)}</option>`).join("")}</select></label>
          <label>Meeting Type<select id="aMeetingType" required>${MEETING_TYPES.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("")}</select></label>
          <label>Category<select id="aCategory">${CATEGORIES.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select></label>
          <label>Responsibility<select id="aAssignee" required>${team.length ? team.map((m) => `<option value="${escapeHtml(m.userId)}">${escapeHtml(m.user ? m.user.fullName : m.userName)} — ${escapeHtml(m.projectRole)}</option>`).join("") : `<option value="">Select a project first</option>`}</select></label>
          <label>Priority<select id="aPriority">${PRIORITIES.map((p) => `<option value="${p}" ${p === "Medium" ? "selected" : ""}>${p}</option>`).join("")}</select></label>
          <label>Meeting / Target Date<input type="date" id="aTarget" /></label>
          <label class="span-2">Remarks<textarea id="aRemarks" rows="2" placeholder="Add remarks…"></textarea></label>
        </div>
      `,
      footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Create</button>`,
      onMount: (backdrop, close, requestClose) => {
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", requestClose);
        document.getElementById("aProject").addEventListener("change", (e) => {
          const newTeam = e.target.value ? getProjectTeam(e.target.value) : [];
          document.getElementById("aAssignee").innerHTML = newTeam.length
            ? newTeam.map((m) => `<option value="${escapeHtml(m.userId)}">${escapeHtml(m.user ? m.user.fullName : m.userName)} — ${escapeHtml(m.projectRole)}</option>`).join("")
            : `<option value="">Select a project first</option>`;
        });
        backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
          const title = document.getElementById("aTitle").value.trim();
          const assignedToUserId = document.getElementById("aAssignee").value;
          if (!title) { toast("Title is required.", "error"); return; }
          if (!assignedToUserId) { toast("Pick a project so an assignee can be selected from its team.", "error"); return; }
          createAction({
            title, description: document.getElementById("aDescription").value.trim(),
            projectCode: document.getElementById("aProject").value, category: document.getElementById("aCategory").value,
            source: document.getElementById("aMeetingType").value,
            assignedToUserId, assignedByUserId: assignedToUserId, priority: document.getElementById("aPriority").value,
            targetDate: document.getElementById("aTarget").value,
            remarks: document.getElementById("aRemarks").value.trim(),
          }, user.name, user.businessRole);
          close();
          toast("Action item created", "success");
          draw();
        });
      },
    });
  }

  function openDetailDrawer(action) {
    const assignee = displayFor(action.assignedToUserId);
    const assigner = displayFor(action.assignedByUserId);
    let backdropRef = null;
    openDrawer({
      title: `${action.actionNumber} — ${action.title}`,
      width: "60%",
      isDirty: () => {
        if (!backdropRef) return false;
        const statusEl = backdropRef.querySelector("#dStatus");
        const remarksEl = backdropRef.querySelector("#dRemarks");
        const commentEl = backdropRef.querySelector("#newComment");
        return (statusEl && statusEl.value !== action.status) || (remarksEl && remarksEl.value !== (action.remarks || ""))
          || (commentEl && commentEl.value.trim() !== "");
      },
      bodyHtml: `
        <p class="sg-subtle">${escapeHtml(action.description || "No description.")}</p>
        <div class="sg-detail-grid">
          <div class="sg-detail-card"><div class="sg-kpi-label">Status</div><span class="pill ${statusPillClass(action.status)}">${escapeHtml(action.status)}</span></div>
          <div class="sg-detail-card"><div class="sg-kpi-label">Priority</div><span class="pill ${priorityPill(action.priority)}">${escapeHtml(action.priority)}</span></div>
          <div class="sg-detail-card"><div class="sg-kpi-label">Meeting Type</div>${escapeHtml(action.source || "—")}</div>
          <div class="sg-detail-card"><div class="sg-kpi-label">Responsibility</div>${escapeHtml(assignee.name)} <span class="sg-subtle">(${escapeHtml(assignee.department)})</span></div>
          <div class="sg-detail-card"><div class="sg-kpi-label">Assigned By</div>${escapeHtml(assigner.name)}</div>
          <div class="sg-detail-card"><div class="sg-kpi-label">Meeting / Target Date</div>${fmtDate(action.targetDate)}</div>
          <div class="sg-detail-card"><div class="sg-kpi-label">Escalation</div>${action.escalationLevel ? `Level ${action.escalationLevel}${action.escalatedTo ? " → " + escapeHtml(displayFor(action.escalatedTo).name) : ""}` : "None"}</div>
          <div class="sg-detail-card"><div class="sg-kpi-label">Reminder</div>${action.reminderEnabled ? `${escapeHtml(action.reminderFrequency || "Set")} · ${fmtDate(action.reminderDate)}` : "Off"}</div>
          <div class="sg-detail-card"><div class="sg-kpi-label">Watchers</div>${action.watcherUserIds.map((id) => escapeHtml(displayFor(id).name)).join(", ") || "—"}</div>
        </div>
        ${canManage ? `<label>Status<select id="dStatus">${STATUSES.map((s) => `<option value="${s}" ${action.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label style="display:block;margin-top:8px">Remarks<textarea id="dRemarks" rows="2" style="width:100%" placeholder="Add remarks…">${escapeHtml(action.remarks || "")}</textarea></label>`
        : `<div class="sg-detail-card"><div class="sg-kpi-label">Remarks</div>${escapeHtml(action.remarks || "—")}</div>`}
        <h3 class="sg-section-title">Timeline &amp; Comments</h3>
        <div class="adm-scroll" style="max-height:260px">
          <div class="sg-timeline no-grow">
            <div class="sg-timeline-item"><div class="sg-timeline-dot pill-blue"></div><div class="sg-timeline-body"><div class="sg-timeline-title">Created</div><div class="sg-timeline-time">${fmtDate(action.createdDate)}</div></div></div>
            ${action.comments.map((c) => `
              <div class="sg-timeline-item">
                <div class="sg-timeline-dot pill-slate"></div>
                <div class="sg-timeline-body">
                  <div class="sg-timeline-title">${escapeHtml(displayFor(c.userId).name)}</div>
                  <div class="sg-timeline-time">${fmtDate(c.timestamp)}</div>
                  <div class="sg-timeline-comments">${escapeHtml(c.comment)}</div>
                </div>
              </div>
            `).join("")}
            ${action.actualCompletionDate ? `<div class="sg-timeline-item"><div class="sg-timeline-dot pill-green"></div><div class="sg-timeline-body"><div class="sg-timeline-title">Completed</div><div class="sg-timeline-time">${fmtDate(action.actualCompletionDate)}</div></div></div>` : ""}
          </div>
        </div>
        ${canManage ? `<textarea id="newComment" rows="2" placeholder="Add a comment…" style="width:100%;margin-top:8px"></textarea>` : ""}
      `,
      footerHtml: `
        <button class="btn btn-ghost" data-act="close-modal">Close</button>
        ${canManage ? `<button class="btn btn-ghost" data-act="comment">Add Comment</button>
        <button class="btn btn-primary" data-act="save">Save Changes</button>` : ""}
      `,
      onMount: (backdrop, close, requestClose) => {
        backdropRef = backdrop;
        backdrop.querySelector('[data-act="close-modal"]').addEventListener("click", requestClose);
        backdrop.querySelector('[data-act="comment"]')?.addEventListener("click", () => {
          const text = document.getElementById("newComment").value.trim();
          if (!text) return;
          addComment(action.id, text, action.assignedToUserId, user.name, user.businessRole);
          close();
          toast("Comment added", "success");
          draw();
        });
        backdrop.querySelector('[data-act="save"]')?.addEventListener("click", () => {
          updateAction(action.id, {
            status: document.getElementById("dStatus").value,
            remarks: document.getElementById("dRemarks").value.trim(),
          }, user.name, user.businessRole);
          close();
          toast("Action updated", "success");
          draw();
        });
      },
    });
  }

  draw();
}
