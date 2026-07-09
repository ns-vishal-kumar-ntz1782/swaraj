import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import {
  listDeliverables, getDeliverable, createDeliverable, updateDeliverable, deleteDeliverable,
  completeDeliverable, bulkImport, STAGES, getFormLinks, setFormLinks,
} from "../store/deliverables.js";
import { listAllForms } from "../store/forms.js";
import { listAuditEntries } from "../store/audit.js";
import { escapeHtml, fmtDate, fmtDateTime, statusPillClass, openModal, confirmDialog, toast, relTime } from "../utils.js";
import { navigate } from "../router.js";

const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["Pending", "InProgress", "Submitted", "Completed"];
const RAGS = ["green", "amber", "red"];

// ============================== LIBRARY ==============================
export async function renderDeliverableLibrary() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Deliverable Library");
  setActiveMenu("deliverables");

  const canManage = can(user.businessRole, "deliverable.library.manage");
  const canCreate = can(user.businessRole, "deliverable.create") || canManage;
  const state = { stage: "", rag: "", q: "" };

  function draw() {
    const list = listDeliverables({ stage: state.stage || undefined, rag: state.rag || undefined, q: state.q || undefined });
    const kpis = {
      total: listDeliverables().length,
      red: listDeliverables({ rag: "red" }).length,
      completed: listDeliverables({ status: "Completed" }).length,
    };

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <h1>Deliverable Library</h1>
        <div class="sg-header-actions">
          ${canManage ? `<button class="btn btn-ghost" id="btnImport">Bulk Import</button>` : ""}
          ${canManage ? `<button class="btn btn-ghost" id="btnLinks">Form Links</button>` : ""}
          ${canCreate ? `<button class="btn btn-primary" id="btnCreate">+ New Deliverable</button>` : ""}
        </div>
      </div>
      <div class="sg-kpi-strip">
        <div class="sg-kpi-card"><div class="sg-kpi-label">Total Deliverables</div><div class="sg-kpi-value">${kpis.total}</div></div>
        <div class="sg-kpi-card"><div class="sg-kpi-label">At Risk (Red)</div><div class="sg-kpi-value">${kpis.red}</div></div>
        <div class="sg-kpi-card"><div class="sg-kpi-label">Completed</div><div class="sg-kpi-value">${kpis.completed}</div></div>
      </div>
      <div class="sg-toolbar">
        <select id="fltStage"><option value="">All Stages</option>${STAGES.map((s) => `<option value="${s}" ${state.stage === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        <select id="fltRag"><option value="">All RAG</option>${RAGS.map((r) => `<option value="${r}" ${state.rag === r ? "selected" : ""}>${r.toUpperCase()}</option>`).join("")}</select>
        <input type="search" id="fltSearch" placeholder="Search deliverables…" value="${escapeHtml(state.q)}" />
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table">
          <thead><tr><th>No</th><th>Name</th><th>Stage</th><th>Owner</th><th>Dept</th><th>Due</th><th>RAG</th><th>Status</th><th>Priority</th></tr></thead>
          <tbody>
            ${list.length ? list.map((d) => `
              <tr class="sg-row-clickable" data-no="${d.no}">
                <td>${escapeHtml(d.no)}</td>
                <td>${escapeHtml(d.name)}</td>
                <td>${escapeHtml(d.stage)}</td>
                <td>${escapeHtml(d.owner)}</td>
                <td>${escapeHtml(d.dept)}</td>
                <td>${fmtDate(d.due)}</td>
                <td><span class="pill ${statusPillClass(d.rag)}">${d.rag.toUpperCase()}</span></td>
                <td><span class="pill ${statusPillClass(d.status)}">${d.status}</span></td>
                <td>${escapeHtml(d.priority)}</td>
              </tr>
            `).join("") : `<tr><td colspan="9" class="sg-empty-cell">No deliverables match your filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("fltStage").addEventListener("change", (e) => { state.stage = e.target.value; draw(); });
    document.getElementById("fltRag").addEventListener("change", (e) => { state.rag = e.target.value; draw(); });
    document.getElementById("fltSearch").addEventListener("input", (e) => { state.q = e.target.value; draw(); });
    document.querySelectorAll(".sg-row-clickable").forEach((row) => {
      row.addEventListener("click", () => navigate(`/deliverables/${row.dataset.no}`));
    });
    const createBtn = document.getElementById("btnCreate");
    if (createBtn) createBtn.addEventListener("click", () => openDeliverableModal(null, draw));
    const importBtn = document.getElementById("btnImport");
    if (importBtn) importBtn.addEventListener("click", () => openImportModal(draw));
    const linksBtn = document.getElementById("btnLinks");
    if (linksBtn) linksBtn.addEventListener("click", () => openFormLinksModal());
  }

  draw();
}

function openDeliverableModal(deliverable, onDone) {
  const editing = !!deliverable;
  const user = getActiveUser();
  openModal({
    title: editing ? `Edit ${deliverable.no}` : "New Deliverable",
    bodyHtml: `
      <div class="sg-form-grid">
        <label class="span-2">Name<input type="text" id="dName" value="${escapeHtml(deliverable?.name || "")}" required /></label>
        <label>Stage<select id="dStage">${STAGES.map((s) => `<option value="${s}" ${deliverable?.stage === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label>Priority<select id="dPriority">${PRIORITIES.map((p) => `<option value="${p}" ${deliverable?.priority === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
        <label>Owner<input type="text" id="dOwner" value="${escapeHtml(deliverable?.owner || "")}" /></label>
        <label>Department<input type="text" id="dDept" value="${escapeHtml(deliverable?.dept || "")}" /></label>
        <label>Due Date<input type="date" id="dDue" value="${deliverable?.due || ""}" /></label>
        <label>RAG<select id="dRag">${RAGS.map((r) => `<option value="${r}" ${deliverable?.rag === r ? "selected" : ""}>${r.toUpperCase()}</option>`).join("")}</select></label>
        <label>Status<select id="dStatus">${STATUSES.map((s) => `<option value="${s}" ${deliverable?.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label>Version<input type="text" id="dVersion" value="${escapeHtml(deliverable?.version || "1.0")}" /></label>
      </div>
    `,
    footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">${editing ? "Save" : "Create"}</button>`,
    onMount: (backdrop, close) => {
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", close);
      backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
        const payload = {
          name: document.getElementById("dName").value.trim(),
          stage: document.getElementById("dStage").value,
          priority: document.getElementById("dPriority").value,
          owner: document.getElementById("dOwner").value.trim(),
          dept: document.getElementById("dDept").value.trim(),
          due: document.getElementById("dDue").value,
          rag: document.getElementById("dRag").value,
          status: document.getElementById("dStatus").value,
          version: document.getElementById("dVersion").value.trim(),
        };
        if (!payload.name) { toast("Name is required.", "error"); return; }
        if (editing) updateDeliverable(deliverable.no, payload, user.name, user.businessRole);
        else createDeliverable(payload, user.name, user.businessRole);
        close();
        toast(editing ? "Deliverable updated" : "Deliverable created", "success");
        onDone();
      });
    },
  });
}

function openImportModal(onDone) {
  const user = getActiveUser();
  openModal({
    title: "Bulk Import Deliverables",
    bodyHtml: `
      <p class="sg-subtle">Upload a CSV or JSON file. Columns/keys: name, stage, owner, dept, due, rag, status, version, priority. Include "no" to update an existing deliverable.</p>
      <input type="file" id="importFile" accept=".csv,.json,application/json,text/csv" />
      <div class="sg-form-error" id="importError" hidden></div>
    `,
    footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Import</button>`,
    onMount: (backdrop, close) => {
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", close);
      backdrop.querySelector('[data-act="save"]').addEventListener("click", async () => {
        const fileInput = document.getElementById("importFile");
        const errEl = document.getElementById("importError");
        const file = fileInput.files[0];
        if (!file) { errEl.textContent = "Choose a file first."; errEl.hidden = false; return; }
        try {
          const text = await file.text();
          const { created, updated } = bulkImport(text, file.name, user.name, user.businessRole);
          close();
          toast(`Import complete: ${created} created, ${updated} updated`, "success");
          onDone();
        } catch (err) {
          errEl.textContent = "Could not parse file: " + err.message;
          errEl.hidden = false;
        }
      });
    },
  });
}

function openFormLinksModal() {
  const user = getActiveUser();
  const deliverables = listDeliverables();
  const forms = listAllForms();
  openModal({
    title: "Deliverable → Form Links",
    size: "lg",
    bodyHtml: `
      <div class="sg-links-editor">
        ${deliverables.map((d) => `
          <div class="sg-links-row">
            <div class="sg-links-name"><strong>${escapeHtml(d.no)}</strong> ${escapeHtml(d.name)}</div>
            <div class="sg-links-checks">
              ${forms.map((f) => `
                <label class="sg-check-chip">
                  <input type="checkbox" data-no="${d.no}" data-form="${f.code}" ${getFormLinks(d.no).includes(f.code) ? "checked" : ""} />
                  ${escapeHtml(f.code)}
                </label>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `,
    footerHtml: `<button class="btn btn-ghost" data-act="cancel">Close</button><button class="btn btn-primary" data-act="save">Save Links</button>`,
    onMount: (backdrop, close) => {
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", close);
      backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
        deliverables.forEach((d) => {
          const checked = Array.from(backdrop.querySelectorAll(`input[data-no="${d.no}"]:checked`)).map((el) => el.dataset.form);
          setFormLinks(d.no, checked, user.name, user.businessRole);
        });
        close();
        toast("Form links saved", "success");
      });
    },
  });
}

// ============================== DETAIL ==============================
export async function renderDeliverableDetail(params) {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setActiveMenu("deliverables");

  const canManage = can(user.businessRole, "deliverable.library.manage") || can(user.businessRole, "deliverable.edit");

  function draw() {
    const d = getDeliverable(params.no);
    if (!d) {
      contentEl().innerHTML = `<div class="sg-empty-state">Deliverable not found. <a href="#/deliverables">Back to Library</a></div>`;
      return;
    }
    setBreadcrumb(`Deliverable Library / ${d.no}`);
    const links = getFormLinks(d.no);
    const isOwner = d.owner === user.name;
    const auditEntries = listAuditEntries({ entityType: "Deliverable" }).filter((e) => e.entityId === d.no);

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <div>
          <h1>${escapeHtml(d.no)} — ${escapeHtml(d.name)}</h1>
          <p class="sg-subtle">${escapeHtml(d.stage)} · Owner: ${escapeHtml(d.owner)} · v${escapeHtml(d.version)}</p>
        </div>
        <div class="sg-header-actions">
          ${canManage ? `<button class="btn btn-ghost" id="btnEditDeliverable">Edit</button>` : ""}
          ${isOwner && d.status !== "Completed" ? `<button class="btn btn-primary" id="btnComplete">Mark Complete</button>` : ""}
        </div>
      </div>
      <div class="sg-detail-grid">
        <div class="sg-detail-card"><div class="sg-kpi-label">Status</div><span class="pill ${statusPillClass(d.status)}">${d.status}</span></div>
        <div class="sg-detail-card"><div class="sg-kpi-label">RAG</div><span class="pill ${statusPillClass(d.rag)}">${d.rag.toUpperCase()}</span></div>
        <div class="sg-detail-card"><div class="sg-kpi-label">Priority</div>${escapeHtml(d.priority)}</div>
        <div class="sg-detail-card"><div class="sg-kpi-label">Due Date</div>${fmtDate(d.due)}</div>
        <div class="sg-detail-card"><div class="sg-kpi-label">Department</div>${escapeHtml(d.dept)}</div>
      </div>
      <div class="sg-tabs" id="dTabs">
        <button class="sg-tab active" data-tab="links">Linked Forms</button>
        <button class="sg-tab" data-tab="audit">Audit Trail</button>
      </div>
      <div class="sg-tab-panel" id="panel-links"></div>
      <div class="sg-tab-panel" id="panel-audit" hidden></div>
    `;

    document.getElementById("panel-links").innerHTML = links.length
      ? `<div class="sg-chip-row">${links.map((code) => `<a class="chip" href="#/forms">${escapeHtml(code)}</a>`).join("")}</div>`
      : `<div class="sg-empty-state">No forms linked to this deliverable.</div>`;

    document.getElementById("panel-audit").innerHTML = `
      <div class="sg-timeline">
        ${auditEntries.length ? auditEntries.map((e) => `
          <div class="sg-timeline-item">
            <div class="sg-timeline-dot pill-blue"></div>
            <div class="sg-timeline-body">
              <div class="sg-timeline-title">${escapeHtml(e.summary)}</div>
              <div class="sg-timeline-time">${escapeHtml(e.actor)} (${escapeHtml(e.actorRole)}) · ${relTime(e.timestamp)} · ${fmtDateTime(e.timestamp)}</div>
            </div>
          </div>
        `).join("") : `<div class="sg-empty-state">No audit history for this deliverable yet.</div>`}
      </div>
    `;

    document.querySelectorAll("#dTabs .sg-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll("#dTabs .sg-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        document.querySelectorAll(".sg-tab-panel").forEach((p) => (p.hidden = true));
        document.getElementById(`panel-${tab.dataset.tab}`).hidden = false;
      });
    });

    const editBtn = document.getElementById("btnEditDeliverable");
    if (editBtn) editBtn.addEventListener("click", () => openDeliverableModal(d, draw));
    const completeBtn = document.getElementById("btnComplete");
    if (completeBtn) completeBtn.addEventListener("click", () => {
      try {
        completeDeliverable(d.no, user.name, user.businessRole);
        toast("Deliverable marked complete", "success");
        draw();
      } catch (err) { toast(err.message, "error"); }
    });
  }

  draw();
}
