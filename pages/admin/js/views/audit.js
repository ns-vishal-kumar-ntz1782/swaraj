import { getActiveUser } from "../store/users.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import { listAuditEntries, distinctActors, distinctProjects } from "../store/audit.js";
import { BUSINESS_ROLES } from "../rbac.js";
import { escapeHtml, fmtDateTime, relTime, openModal } from "../utils.js";

const ENTITY_TYPES = ["Gate", "Deliverable", "Form", "FormSubmission", "Action", "User", "Role", "RBACMatrix", "GateChecklistTemplate"];

export async function renderAudit() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Activity Log");
  setActiveMenu("audit");

  const state = { entityType: "", actor: "", role: "", projectCode: "", from: "", to: "", q: "" };

  function draw() {
    const entries = listAuditEntries({
      entityType: state.entityType || undefined, actor: state.actor || undefined, role: state.role || undefined,
      projectCode: state.projectCode || undefined, from: state.from || undefined, to: state.to || undefined, q: state.q || undefined,
    });
    const actors = distinctActors();
    const projects = distinctProjects();

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <h1>Activity Log</h1>
        <p class="sg-subtle">${entries.length} entr${entries.length === 1 ? "y" : "ies"}</p>
      </div>
      <div class="sg-toolbar wrap">
        <select id="fltEntity"><option value="">All Entity Types</option>${ENTITY_TYPES.map((t) => `<option value="${t}" ${state.entityType === t ? "selected" : ""}>${t}</option>`).join("")}</select>
        <select id="fltActor"><option value="">All Actors</option>${actors.map((a) => `<option value="${escapeHtml(a)}" ${state.actor === a ? "selected" : ""}>${escapeHtml(a)}</option>`).join("")}</select>
        <select id="fltRole"><option value="">All Roles</option>${BUSINESS_ROLES.map((r) => `<option value="${escapeHtml(r)}" ${state.role === r ? "selected" : ""}>${escapeHtml(r)}</option>`).join("")}</select>
        <select id="fltProject"><option value="">All Projects</option>${projects.map((p) => `<option value="${escapeHtml(p)}" ${state.projectCode === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}</select>
        <input type="date" id="fltFrom" title="From date" value="${state.from}" />
        <input type="date" id="fltTo" title="To date" value="${state.to}" />
        <input type="search" id="fltSearch" placeholder="Search summary, actor, entity…" value="${escapeHtml(state.q)}" />
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table">
          <thead><tr><th>When</th><th>Actor</th><th>Role</th><th>Action</th><th>Entity</th><th>Project</th><th>Summary</th></tr></thead>
          <tbody>
            ${entries.length ? entries.map((e) => `
              <tr class="sg-row-clickable" data-id="${e.id}">
                <td title="${fmtDateTime(e.timestamp)}">${relTime(e.timestamp)}</td>
                <td>${escapeHtml(e.actor)}</td>
                <td>${escapeHtml(e.actorRole)}</td>
                <td><span class="chip">${escapeHtml(e.action)}</span></td>
                <td>${escapeHtml(e.entityType)}${e.entityId ? ` · ${escapeHtml(e.entityId)}` : ""}</td>
                <td>${escapeHtml(e.projectCode || "—")}</td>
                <td>${escapeHtml(e.summary)}</td>
              </tr>
            `).join("") : `<tr><td colspan="7" class="sg-empty-cell">No activity matches your filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("fltEntity").addEventListener("change", (e) => { state.entityType = e.target.value; draw(); });
    document.getElementById("fltActor").addEventListener("change", (e) => { state.actor = e.target.value; draw(); });
    document.getElementById("fltRole").addEventListener("change", (e) => { state.role = e.target.value; draw(); });
    document.getElementById("fltProject").addEventListener("change", (e) => { state.projectCode = e.target.value; draw(); });
    document.getElementById("fltFrom").addEventListener("change", (e) => { state.from = e.target.value; draw(); });
    document.getElementById("fltTo").addEventListener("change", (e) => { state.to = e.target.value; draw(); });
    document.getElementById("fltSearch").addEventListener("input", (e) => { state.q = e.target.value; draw(); });
    document.querySelectorAll(".sg-row-clickable").forEach((row) => {
      row.addEventListener("click", () => openEntryModal(entries.find((e) => e.id === row.dataset.id)));
    });
  }

  function openEntryModal(entry) {
    openModal({
      title: `${entry.entityType} · ${entry.action}`,
      size: "lg",
      bodyHtml: `
        <p><strong>${escapeHtml(entry.summary)}</strong></p>
        <p class="sg-subtle">${escapeHtml(entry.actor)} (${escapeHtml(entry.actorRole)}) · ${fmtDateTime(entry.timestamp)}</p>
        <div class="sg-diff-grid">
          <div><h4>Before</h4><pre class="sg-code-block">${escapeHtml(JSON.stringify(entry.before, null, 2))}</pre></div>
          <div><h4>After</h4><pre class="sg-code-block">${escapeHtml(JSON.stringify(entry.after, null, 2))}</pre></div>
        </div>
      `,
      footerHtml: `<button class="btn btn-ghost" data-act="close">Close</button>`,
      onMount: (backdrop, close) => backdrop.querySelector('[data-act="close"]').addEventListener("click", close),
    });
  }

  draw();
}
