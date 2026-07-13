import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import {
  listAuditEntries, distinctProjects,
  listEnterpriseAuditEntries, enterpriseProjects,
} from "../store/audit.js";
import { listRoleNames } from "../store/roles.js";
import { displayFor } from "../store/orgDirectory.js";
import {
  escapeHtml, fmtDateTime, relTime, openDrawer, toast, paginate, paginationHtml, wirePagination,
  sortList, sortableTh, wireSortableTh, ICONS,
} from "../utils.js";

const PAGE_SIZE = 25;

export async function renderAudit() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Activity Log");
  setActiveMenu("audit");

  const canExport = can(user.businessRole, "audit.export");
  const state = { source: "", role: "", projectCode: "", from: "", to: "", q: "", page: 1, sortKey: "", sortDir: "asc" };

  function mergedEntries() {
    const live = listAuditEntries({
      role: state.role || undefined,
      projectCode: state.projectCode || undefined, from: state.from || undefined, to: state.to || undefined, q: state.q || undefined,
    }).map((e) => ({ ...e, source: "Console Action", actorName: e.actor }));
    // Role is a console-session concept — the enterprise log has no actorRole at all, and its
    // actorName comes from a completely different identity space (the 241-person org roster, not
    // the 6-role login model this dropdown lists) — so an enterprise row can never genuinely
    // match it. Excluding enterprise rows once Role is set avoids a filter that silently does
    // nothing against the 1,702 rows that dominate the unfiltered view.
    const enterprise = state.role ? [] : listEnterpriseAuditEntries({
      projectCode: state.projectCode || undefined,
      from: state.from || undefined, to: state.to || undefined, q: state.q || undefined,
    }).map((e) => ({ ...e, actorName: displayFor(e.actorUserId).name }));
    let all = state.source === "console" ? live : state.source === "enterprise" ? enterprise : [...live, ...enterprise];
    return all.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  }

  function draw() {
    let entries = mergedEntries();
    const todayStr = new Date().toISOString().slice(0, 10);
    const kpis = {
      total: entries.length,
      console: entries.filter((e) => e.source === "Console Action").length,
      enterprise: entries.filter((e) => e.source !== "Console Action").length,
      today: entries.filter((e) => (e.timestamp || "").slice(0, 10) === todayStr).length,
    };
    entries = sortList(entries, state.sortKey, state.sortDir);
    const allProjects = [...new Set([...distinctProjects(), ...enterpriseProjects()])].sort();
    const { pageItems, totalPages, page, total } = paginate(entries, state.page, PAGE_SIZE);

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <div>
          <h1>Activity Log</h1>
          <p class="sg-subtle">${entries.length} entr${entries.length === 1 ? "y" : "ies"} — live console actions merged with the enterprise historical audit trail. Read only.</p>
        </div>
        ${canExport ? `<button class="btn btn-ghost" id="btnExport">Export CSV</button>` : ""}
      </div>
      <div class="sg-kpi-filter-row">
        <div class="sg-kpi-strip compact">
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-blue">${ICONS.list}</span><div><div class="sg-kpi-label">Total</div><div class="sg-kpi-value">${kpis.total}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-green">${ICONS.check}</span><div><div class="sg-kpi-label">Console Actions</div><div class="sg-kpi-value">${kpis.console}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-slate">${ICONS.list}</span><div><div class="sg-kpi-label">Enterprise Log</div><div class="sg-kpi-value">${kpis.enterprise}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-amber">${ICONS.clock}</span><div><div class="sg-kpi-label">Today</div><div class="sg-kpi-value">${kpis.today}</div></div></div>
        </div>
        <div class="sg-toolbar sg-toolbar-flex">
          <select id="fltSource"><option value="">All Sources</option><option value="console" ${state.source === "console" ? "selected" : ""}>Console Actions</option><option value="enterprise" ${state.source === "enterprise" ? "selected" : ""}>Enterprise Log</option></select>
          <select id="fltRole"><option value="">All Console Roles</option>${listRoleNames().map((r) => `<option value="${escapeHtml(r)}" ${state.role === r ? "selected" : ""}>${escapeHtml(r)}</option>`).join("")}</select>
          <select id="fltProject"><option value="">All Projects</option>${allProjects.map((p) => `<option value="${escapeHtml(p)}" ${state.projectCode === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}</select>
          <input type="date" id="fltFrom" title="From date" value="${state.from}" />
          <input type="date" id="fltTo" title="To date" value="${state.to}" />
          <input type="search" id="fltSearch" placeholder="Search summary, user, entity…" value="${escapeHtml(state.q)}" />
        </div>
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table">
          <thead><tr>
            ${sortableTh("When", "timestamp", state)}${sortableTh("User", "actorName", state)}${sortableTh("Action", "action", state)}<th>Entity</th><th>Project</th><th>Summary</th><th>Source</th>
          </tr></thead>
          <tbody>
            ${pageItems.length ? pageItems.map((e) => `
              <tr class="sg-row-clickable" data-id="${escapeHtml(e.id)}" data-source="${e.source === "Console Action" ? "console" : "enterprise"}">
                <td title="${fmtDateTime(e.timestamp)}">${relTime(e.timestamp)}</td>
                <td>${escapeHtml(e.actorName)}</td>
                <td><span class="chip">${escapeHtml(e.action)}</span></td>
                <td>${escapeHtml(e.entityType)}${e.entityId ? ` · ${escapeHtml(e.entityId)}` : ""}</td>
                <td>${escapeHtml(e.projectCode || "—")}</td>
                <td class="sg-link-text">${escapeHtml(e.summary)}</td>
                <td><span class="pill ${e.source === "Console Action" ? "pill-blue" : "pill-slate"}">${e.source}</span></td>
              </tr>
            `).join("") : `<tr><td colspan="7" class="sg-empty-cell">No activity matches your filters.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${paginationHtml(page, totalPages, total, PAGE_SIZE)}
    `;

    document.getElementById("fltSource").addEventListener("change", (e) => { state.source = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltRole").addEventListener("change", (e) => { state.role = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltProject").addEventListener("change", (e) => { state.projectCode = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltFrom").addEventListener("change", (e) => { state.from = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltTo").addEventListener("change", (e) => { state.to = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltSearch").addEventListener("input", (e) => { state.q = e.target.value; state.page = 1; draw(); });
    wirePagination(contentEl(), (p) => { state.page = p; draw(); });
    wireSortableTh(contentEl(), state, draw);
    document.querySelectorAll(".sg-row-clickable").forEach((row) => {
      row.addEventListener("click", () => openEntryDrawer(entries.find((e) => e.id === row.dataset.id)));
    });
    document.getElementById("btnExport")?.addEventListener("click", () => exportCsv(entries));
  }

  function openEntryDrawer(entry) {
    openDrawer({
      title: `${entry.entityType} · ${entry.action}`,
      width: "60%",
      bodyHtml: `
        <p><strong>${escapeHtml(entry.summary)}</strong></p>
        <p class="sg-subtle">${escapeHtml(entry.actorName)} · ${fmtDateTime(entry.timestamp)} · <span class="pill ${entry.source === "Console Action" ? "pill-blue" : "pill-slate"}">${entry.source}</span></p>
        <div class="sg-diff-grid">
          <div><h4>Before</h4><pre class="sg-code-block">${escapeHtml(JSON.stringify(entry.before, null, 2))}</pre></div>
          <div><h4>After</h4><pre class="sg-code-block">${escapeHtml(JSON.stringify(entry.after, null, 2))}</pre></div>
        </div>
      `,
      footerHtml: `<button class="btn btn-ghost" data-act="close">Close</button>`,
      onMount: (backdrop, close) => backdrop.querySelector('[data-act="close"]').addEventListener("click", close),
    });
  }

  function exportCsv(entries) {
    const header = ["Timestamp", "User", "Action", "EntityType", "EntityId", "ProjectCode", "Summary", "Source"];
    const rows = entries.map((e) => [e.timestamp, e.actorName, e.action, e.entityType, e.entityId, e.projectCode, e.summary, e.source]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "activity-log.csv"; a.click();
    URL.revokeObjectURL(url);
    toast("Activity log exported", "success");
  }

  draw();
}
