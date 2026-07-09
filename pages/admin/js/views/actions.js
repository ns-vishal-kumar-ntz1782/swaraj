import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import {
  listActions, createAction, updateAction, addComment,
  ACTION_STATUSES, ACTION_PRIORITIES,
} from "../store/actions.js";
import { distinctProjectCodes, listGates, GATE_CODES } from "../store/gates.js";
import { listUsers } from "../store/users.js";
import { escapeHtml, fmtDate, fmtDateTime, statusPillClass, openModal, confirmDialog, toast } from "../utils.js";

export async function renderActions(params, query) {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Action Register");
  setActiveMenu("actions");

  const canManage = can(user.businessRole, "action.manage");
  const state = { projectCode: query.projectCode || "", status: "", q: "" };

  function draw() {
    const actions = listActions({ projectCode: state.projectCode || undefined, status: state.status || undefined, q: state.q || undefined });
    const projects = distinctProjectCodes();
    const kpis = {
      total: listActions().length,
      open: listActions().filter((a) => !["Completed", "Closed"].includes(a.status)).length,
      overdue: listActions().filter((a) => a.targetDate && a.targetDate < new Date().toISOString().slice(0, 10) && !["Completed", "Closed"].includes(a.status)).length,
      escalated: listActions({ status: "Escalated" }).length,
    };

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <h1>Action Register</h1>
        ${canManage ? `<button class="btn btn-primary" id="btnCreateAction">+ New Action</button>` : ""}
      </div>
      <div class="sg-kpi-strip">
        <div class="sg-kpi-card"><div class="sg-kpi-label">Total</div><div class="sg-kpi-value">${kpis.total}</div></div>
        <div class="sg-kpi-card"><div class="sg-kpi-label">Open</div><div class="sg-kpi-value">${kpis.open}</div></div>
        <div class="sg-kpi-card"><div class="sg-kpi-label">Overdue</div><div class="sg-kpi-value">${kpis.overdue}</div></div>
        <div class="sg-kpi-card"><div class="sg-kpi-label">Escalated</div><div class="sg-kpi-value">${kpis.escalated}</div></div>
      </div>
      <div class="sg-toolbar">
        <select id="fltProject"><option value="">All Projects</option>${projects.map((p) => `<option value="${escapeHtml(p)}" ${state.projectCode === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}</select>
        <select id="fltStatus"><option value="">All Statuses</option>${ACTION_STATUSES.map((s) => `<option value="${s}" ${state.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        <input type="search" id="fltSearch" placeholder="Search actions…" value="${escapeHtml(state.q)}" />
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table">
          <thead><tr><th>#</th><th>Title</th><th>Project</th><th>Gate</th><th>Assigned To</th><th>Priority</th><th>Target</th><th>Status</th></tr></thead>
          <tbody>
            ${actions.length ? actions.map((a) => `
              <tr class="sg-row-clickable" data-id="${a.id}">
                <td>${escapeHtml(a.number)}</td>
                <td>${escapeHtml(a.title)}</td>
                <td>${escapeHtml(a.projectCode || "—")}</td>
                <td>${escapeHtml(a.gateCode || "—")}</td>
                <td>${escapeHtml(a.assignedTo)}</td>
                <td>${escapeHtml(a.priority)}</td>
                <td>${fmtDate(a.targetDate)}</td>
                <td><span class="pill ${statusPillClass(a.status)}">${a.status}</span></td>
              </tr>
            `).join("") : `<tr><td colspan="8" class="sg-empty-cell">No action items match your filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("fltProject").addEventListener("change", (e) => { state.projectCode = e.target.value; draw(); });
    document.getElementById("fltStatus").addEventListener("change", (e) => { state.status = e.target.value; draw(); });
    document.getElementById("fltSearch").addEventListener("input", (e) => { state.q = e.target.value; draw(); });
    document.querySelectorAll(".sg-row-clickable").forEach((row) => {
      row.addEventListener("click", () => openDetailModal(actions.find((a) => a.id === row.dataset.id)));
    });
    const createBtn = document.getElementById("btnCreateAction");
    if (createBtn) createBtn.addEventListener("click", () => openCreateModal());
  }

  function openCreateModal() {
    const projects = distinctProjectCodes();
    const users = listUsers();
    openModal({
      title: "New Action Item",
      bodyHtml: `
        <div class="sg-form-grid">
          <label class="span-2">Title<input type="text" id="aTitle" required /></label>
          <label class="span-2">Description<textarea id="aDescription" rows="2"></textarea></label>
          <label>Project<select id="aProject"><option value="">None</option>${projects.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}</select></label>
          <label>Gate Code<select id="aGate"><option value="">None</option>${GATE_CODES.map((g) => `<option value="${g}">${g}</option>`).join("")}</select></label>
          <label>Assigned To<select id="aAssignee">${users.map((u) => `<option value="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`).join("")}</select></label>
          <label>Priority<select id="aPriority">${ACTION_PRIORITIES.map((p) => `<option value="${p}" ${p === "Medium" ? "selected" : ""}>${p}</option>`).join("")}</select></label>
          <label>Start Date<input type="date" id="aStart" /></label>
          <label>Target Date<input type="date" id="aTarget" /></label>
        </div>
      `,
      footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Create</button>`,
      onMount: (backdrop, close) => {
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", close);
        backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
          const title = document.getElementById("aTitle").value.trim();
          if (!title) { toast("Title is required.", "error"); return; }
          createAction({
            title, description: document.getElementById("aDescription").value.trim(),
            projectCode: document.getElementById("aProject").value, gateCode: document.getElementById("aGate").value,
            assignedTo: document.getElementById("aAssignee").value, priority: document.getElementById("aPriority").value,
            startDate: document.getElementById("aStart").value, targetDate: document.getElementById("aTarget").value,
          }, user.name, user.businessRole);
          close();
          toast("Action item created", "success");
          draw();
        });
      },
    });
  }

  function openDetailModal(action) {
    openModal({
      title: `${action.number} — ${action.title}`,
      size: "lg",
      bodyHtml: `
        <p class="sg-subtle">${escapeHtml(action.description || "No description.")}</p>
        <div class="sg-form-grid">
          <label>Status<select id="dStatus" ${canManage ? "" : "disabled"}>${ACTION_STATUSES.map((s) => `<option value="${s}" ${action.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          <label>Priority<span class="chip">${escapeHtml(action.priority)}</span></label>
          <label>Assigned To<span class="chip">${escapeHtml(action.assignedTo)}</span></label>
          <label>Target Date<span class="chip">${fmtDate(action.targetDate)}</span></label>
        </div>
        <h3 class="sg-section-title">Comments</h3>
        <div class="sg-comment-list">
          ${action.comments.length ? action.comments.map((c) => `
            <div class="sg-comment"><strong>${escapeHtml(c.author)}</strong> <span class="sg-subtle">${fmtDateTime(c.timestamp)}</span><p>${escapeHtml(c.text)}</p></div>
          `).join("") : `<p class="sg-subtle">No comments yet.</p>`}
        </div>
        ${canManage ? `<textarea id="newComment" rows="2" placeholder="Add a comment…"></textarea>` : ""}
      `,
      footerHtml: `
        <button class="btn btn-ghost" data-act="close-modal">Close</button>
        ${canManage ? `<button class="btn btn-ghost" data-act="comment">Add Comment</button>
        <button class="btn btn-primary" data-act="save">Save Status</button>` : ""}
      `,
      onMount: (backdrop, close) => {
        backdrop.querySelector('[data-act="close-modal"]').addEventListener("click", close);
        const commentBtn = backdrop.querySelector('[data-act="comment"]');
        if (commentBtn) commentBtn.addEventListener("click", () => {
          const text = document.getElementById("newComment").value.trim();
          if (!text) return;
          addComment(action.id, text, user.name, user.businessRole);
          close();
          toast("Comment added", "success");
          draw();
        });
        const saveBtn = backdrop.querySelector('[data-act="save"]');
        if (saveBtn) saveBtn.addEventListener("click", () => {
          updateAction(action.id, { status: document.getElementById("dStatus").value }, user.name, user.businessRole);
          close();
          toast("Action updated", "success");
          draw();
        });
      },
    });
  }

  draw();
}
