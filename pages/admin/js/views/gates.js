import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import {
  listGates, getGate, createGate, updateGate, distinctProjectCodes,
  addDeliverableAssignment, updateDeliverableAssignment, addFormAssignment, updateFormAssignment,
  activateGate, submitGateForApproval, approveGate, rejectGate, sendBackGate, closeGate,
  uploadChecklistDoc, approveChecklistDoc, readinessScore, GATE_CODES,
} from "../store/gates.js";
import { listDeliverables } from "../store/deliverables.js";
import { listAllForms } from "../store/forms.js";
import { listTemplateItems } from "../store/gateTemplates.js";
import { listUsers } from "../store/users.js";
import { escapeHtml, fmtDate, fmtDateTime, statusPillClass, openModal, confirmDialog, toast, parseQuery } from "../utils.js";
import { navigate } from "../router.js";

const DELIVERABLE_STATUSES = ["Pending", "InProgress", "Submitted", "Completed"];
const GATE_STATUSES = ["Draft", "Active", "UnderReview", "Approved", "Rejected", "Closed"];

// ============================== LIST ==============================
export async function renderGateList(params, query) {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Gate Master");
  setActiveMenu("gates");

  const state = { projectCode: "", status: "", q: query.q || "" };

  function draw() {
    const gates = listGates({ projectCode: state.projectCode || undefined, status: state.status || undefined, q: state.q || undefined });
    const projects = distinctProjectCodes();
    const kpis = {
      total: listGates().length,
      active: listGates({ status: "Active" }).length,
      review: listGates({ status: "UnderReview" }).length,
      approved: listGates({ status: "Approved" }).length,
    };

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <h1>Gate Master</h1>
        ${can(user.businessRole, "gate.create") ? `<button class="btn btn-primary" id="btnCreateGate">+ Create Gate</button>` : ""}
      </div>
      <div class="sg-kpi-strip">
        <div class="sg-kpi-card"><div class="sg-kpi-label">Total Gates</div><div class="sg-kpi-value">${kpis.total}</div></div>
        <div class="sg-kpi-card"><div class="sg-kpi-label">Active</div><div class="sg-kpi-value">${kpis.active}</div></div>
        <div class="sg-kpi-card"><div class="sg-kpi-label">Under Review</div><div class="sg-kpi-value">${kpis.review}</div></div>
        <div class="sg-kpi-card"><div class="sg-kpi-label">Approved</div><div class="sg-kpi-value">${kpis.approved}</div></div>
      </div>
      <div class="sg-toolbar">
        <select id="fltProject"><option value="">All Projects</option>${projects.map((p) => `<option value="${escapeHtml(p)}" ${state.projectCode === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}</select>
        <select id="fltStatus"><option value="">All Statuses</option>${GATE_STATUSES.map((s) => `<option value="${s}" ${state.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        <input type="search" id="fltSearch" placeholder="Search project, code, name, owner…" value="${escapeHtml(state.q)}" />
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table">
          <thead><tr><th>Project</th><th>Gate</th><th>Name</th><th>Owner</th><th>Status</th><th>Planned Start</th><th>Planned End</th><th>Readiness</th><th></th></tr></thead>
          <tbody>
            ${gates.length ? gates.map((g) => `
              <tr class="sg-row-clickable" data-id="${g.id}">
                <td>${escapeHtml(g.projectCode)}</td>
                <td><strong>${escapeHtml(g.code)}</strong></td>
                <td>${escapeHtml(g.name)}</td>
                <td>${escapeHtml(g.owner)}</td>
                <td><span class="pill ${statusPillClass(g.status)}">${g.status}</span></td>
                <td>${fmtDate(g.plannedStart)}</td>
                <td>${fmtDate(g.plannedEnd)}</td>
                <td><div class="sg-mini-bar"><div class="sg-mini-bar-fill" style="width:${readinessScore(g)}%"></div></div><span class="sg-mini-bar-label">${readinessScore(g)}%</span></td>
                <td><a class="btn btn-ghost btn-sm" href="#/gates/${g.id}">Open</a></td>
              </tr>
            `).join("") : `<tr><td colspan="9" class="sg-empty-cell">No gates match your filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("fltProject").addEventListener("change", (e) => { state.projectCode = e.target.value; draw(); });
    document.getElementById("fltStatus").addEventListener("change", (e) => { state.status = e.target.value; draw(); });
    document.getElementById("fltSearch").addEventListener("input", (e) => { state.q = e.target.value; draw(); });
    document.querySelectorAll(".sg-row-clickable").forEach((row) => {
      row.addEventListener("click", (e) => { if (e.target.tagName !== "A") navigate(`/gates/${row.dataset.id}`); });
    });
    const createBtn = document.getElementById("btnCreateGate");
    if (createBtn) createBtn.addEventListener("click", () => openCreateGateModal(user, draw));
  }

  draw();
}

function openCreateGateModal(user, onDone) {
  const owners = listUsers();
  openModal({
    title: "Create Gate",
    bodyHtml: `
      <div class="sg-form-grid">
        <label>Project Code<input type="text" id="gProjectCode" placeholder="PRJ-300" required /></label>
        <label>Gate Code<select id="gCode">${GATE_CODES.map((c) => `<option value="${c}">${c}</option>`).join("")}</select></label>
        <label class="span-2">Gate Name<input type="text" id="gName" required /></label>
        <label class="span-2">Description<textarea id="gDescription" rows="2"></textarea></label>
        <label>Owner<select id="gOwner">${owners.map((o) => `<option value="${escapeHtml(o.businessRole)}">${escapeHtml(o.name)} (${escapeHtml(o.businessRole)})</option>`).join("")}</select></label>
        <label>Planned Start<input type="date" id="gPlannedStart" /></label>
        <label>Planned End<input type="date" id="gPlannedEnd" /></label>
      </div>
      <div class="sg-form-error" id="gFormError" hidden></div>
    `,
    footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Create Gate</button>`,
    onMount: (backdrop, close) => {
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", close);
      backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
        const errEl = document.getElementById("gFormError");
        try {
          const gate = createGate({
            projectCode: document.getElementById("gProjectCode").value.trim(),
            code: document.getElementById("gCode").value,
            name: document.getElementById("gName").value.trim(),
            description: document.getElementById("gDescription").value.trim(),
            owner: document.getElementById("gOwner").value,
            plannedStart: document.getElementById("gPlannedStart").value,
            plannedEnd: document.getElementById("gPlannedEnd").value,
          }, user.name, user.businessRole);
          close();
          toast(`Gate ${gate.code} created for ${gate.projectCode}`, "success");
          onDone();
        } catch (err) {
          errEl.textContent = err.message;
          errEl.hidden = false;
        }
      });
    },
  });
}

// ============================== WORKSPACE ==============================
export async function renderGateWorkspace(params) {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setActiveMenu("gates");

  const gate = getGate(params.id);
  if (!gate) {
    contentEl().innerHTML = `<div class="sg-empty-state">Gate not found. <a href="#/gates">Back to Gate Master</a></div>`;
    return;
  }
  setBreadcrumb(`Gate Master / ${gate.projectCode} / ${gate.code}`);

  function draw() {
    const g = getGate(params.id);
    const canEdit = can(user.businessRole, "gate.edit");
    const canApprove = can(user.businessRole, "gate.approve");
    const score = readinessScore(g);
    const checklistItems = listTemplateItems(g.code);
    const checklist = g.checklist || [];

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <div>
          <h1>${escapeHtml(g.code)} — ${escapeHtml(g.name)}</h1>
          <p class="sg-subtle">${escapeHtml(g.projectCode)} · Owner: ${escapeHtml(g.owner)} · <span class="pill ${statusPillClass(g.status)}">${g.status}</span></p>
        </div>
        <div class="sg-header-actions" id="gateActions"></div>
      </div>

      <div class="sg-readiness-card">
        <div class="sg-readiness-label">Readiness Score</div>
        <div class="sg-mini-bar lg"><div class="sg-mini-bar-fill" style="width:${score}%"></div></div>
        <div class="sg-readiness-pct">${score}%</div>
      </div>

      <p class="sg-description">${escapeHtml(g.description || "No description provided.")}</p>

      <div class="sg-tabs" id="gateTabs">
        <button class="sg-tab active" data-tab="deliverables">Deliverables</button>
        <button class="sg-tab" data-tab="forms">Forms</button>
        <button class="sg-tab" data-tab="checklist">Checklist Documents</button>
        <button class="sg-tab" data-tab="approvals">Approval Timeline</button>
      </div>

      <div class="sg-tab-panel" id="panel-deliverables"></div>
      <div class="sg-tab-panel" id="panel-forms" hidden></div>
      <div class="sg-tab-panel" id="panel-checklist" hidden></div>
      <div class="sg-tab-panel" id="panel-approvals" hidden></div>
    `;

    renderActions(g, canEdit, canApprove);
    renderDeliverablesPanel(g, canEdit);
    renderFormsPanel(g, canEdit);
    renderChecklistPanel(g, checklistItems, checklist, canEdit || canApprove);
    renderApprovalsPanel(g);

    document.querySelectorAll(".sg-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".sg-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        document.querySelectorAll(".sg-tab-panel").forEach((p) => (p.hidden = true));
        document.getElementById(`panel-${tab.dataset.tab}`).hidden = false;
      });
    });
  }

  function renderActions(g, canEdit, canApprove) {
    const wrap = document.getElementById("gateActions");
    const buttons = [];
    if (g.status === "Draft" && canEdit) buttons.push(`<button class="btn btn-secondary" data-act="activate">Activate</button>`);
    if (g.status === "Active" && canEdit) buttons.push(`<button class="btn btn-primary" data-act="submit">Submit for Approval</button>`);
    if (g.status === "Rejected" && canEdit) buttons.push(`<button class="btn btn-primary" data-act="submit">Resubmit for Approval</button>`);
    if (g.status === "UnderReview" && canApprove) {
      buttons.push(`<button class="btn btn-primary" data-act="approve">Approve</button>`);
      buttons.push(`<button class="btn btn-danger" data-act="reject">Reject</button>`);
      buttons.push(`<button class="btn btn-ghost" data-act="sendback">Send Back</button>`);
    }
    if (g.status === "Approved" && canApprove) buttons.push(`<button class="btn btn-secondary" data-act="close">Close Gate</button>`);
    wrap.innerHTML = buttons.join("");
    wrap.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => handleGateAction(btn.dataset.act, g));
    });
  }

  async function handleGateAction(act, g) {
    const needsComment = ["submit", "approve", "reject", "sendback", "close"].includes(act);
    let comments = "";
    if (needsComment) {
      comments = await promptComment(act);
      if (comments === null) return;
    }
    try {
      if (act === "activate") activateGate(g.id, user.name, user.businessRole);
      if (act === "submit") submitGateForApproval(g.id, user.name, user.businessRole, comments);
      if (act === "approve") approveGate(g.id, user.name, user.businessRole, comments);
      if (act === "reject") rejectGate(g.id, user.name, user.businessRole, comments);
      if (act === "sendback") sendBackGate(g.id, user.name, user.businessRole, comments);
      if (act === "close") closeGate(g.id, user.name, user.businessRole, comments);
      toast("Gate updated", "success");
      draw();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function promptComment(act) {
    return new Promise((resolve) => {
      openModal({
        title: `${act[0].toUpperCase()}${act.slice(1)} — comments`,
        bodyHtml: `<label>Comments<textarea id="cmtInput" rows="3" placeholder="Optional comments"></textarea></label>`,
        footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="ok">Confirm</button>`,
        onMount: (backdrop, close) => {
          backdrop.querySelector('[data-act="cancel"]').addEventListener("click", () => { close(); resolve(null); });
          backdrop.querySelector('[data-act="ok"]').addEventListener("click", () => {
            const v = document.getElementById("cmtInput").value.trim();
            close(); resolve(v);
          });
        },
      });
    });
  }

  function renderDeliverablesPanel(g, canEdit) {
    const panel = document.getElementById("panel-deliverables");
    panel.innerHTML = `
      <div class="sg-panel-toolbar">
        ${canEdit ? `<button class="btn btn-secondary btn-sm" id="btnAddDeliverable">+ Assign Deliverable</button>` : ""}
      </div>
      <table class="sg-table">
        <thead><tr><th>No</th><th>Mandatory</th><th>Due Date</th><th>Status</th><th>Responsible</th><th>Completed</th></tr></thead>
        <tbody>
          ${g.deliverableAssignments.length ? g.deliverableAssignments.map((d) => `
            <tr>
              <td>${escapeHtml(d.no)}</td>
              <td>${d.mandatory ? "Yes" : "No"}</td>
              <td>${fmtDate(d.dueDate)}</td>
              <td>
                ${canEdit ? `<select class="sg-inline-select" data-no="${d.no}" data-field="status">${DELIVERABLE_STATUSES.map((s) => `<option value="${s}" ${d.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>`
                          : `<span class="pill ${statusPillClass(d.status)}">${d.status}</span>`}
              </td>
              <td>${escapeHtml((d.responsibleMembers || []).join(", "))}</td>
              <td>${fmtDate(d.actualCompletedDate)}</td>
            </tr>
          `).join("") : `<tr><td colspan="6" class="sg-empty-cell">No deliverables assigned yet.</td></tr>`}
        </tbody>
      </table>
    `;
    if (canEdit) {
      const addBtn = document.getElementById("btnAddDeliverable");
      if (addBtn) addBtn.addEventListener("click", () => openAssignDeliverableModal(g));
      panel.querySelectorAll('select[data-field="status"]').forEach((sel) => {
        sel.addEventListener("change", () => {
          try {
            const patch = { status: sel.value };
            if (sel.value === "Completed") patch.actualCompletedDate = new Date().toISOString().slice(0, 10);
            updateDeliverableAssignment(g.id, sel.dataset.no, patch, user.name, user.businessRole);
            toast("Deliverable status updated", "success");
            draw();
          } catch (err) { toast(err.message, "error"); }
        });
      });
    }
  }

  function openAssignDeliverableModal(g) {
    const catalogue = listDeliverables().filter((d) => !g.deliverableAssignments.some((a) => a.no === d.no));
    if (!catalogue.length) { toast("All catalogue deliverables are already assigned to this gate.", "info"); return; }
    openModal({
      title: "Assign Deliverable",
      bodyHtml: `
        <div class="sg-form-grid">
          <label class="span-2">Deliverable<select id="dNo">${catalogue.map((d) => `<option value="${d.no}">${d.no} — ${escapeHtml(d.name)}</option>`).join("")}</select></label>
          <label>Mandatory<select id="dMandatory"><option value="true">Yes</option><option value="false">No</option></select></label>
          <label>Due Date<input type="date" id="dDueDate" /></label>
          <label class="span-2">Responsible Members (comma-separated)<input type="text" id="dResp" placeholder="Name A, Name B" /></label>
        </div>
      `,
      footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Assign</button>`,
      onMount: (backdrop, close) => {
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", close);
        backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
          addDeliverableAssignment(g.id, {
            no: document.getElementById("dNo").value,
            mandatory: document.getElementById("dMandatory").value === "true",
            dueDate: document.getElementById("dDueDate").value,
            responsibleMembers: document.getElementById("dResp").value.split(",").map((s) => s.trim()).filter(Boolean),
          }, user.name, user.businessRole);
          close();
          toast("Deliverable assigned", "success");
          draw();
        });
      },
    });
  }

  function renderFormsPanel(g, canEdit) {
    const panel = document.getElementById("panel-forms");
    panel.innerHTML = `
      <div class="sg-panel-toolbar">
        ${canEdit ? `<button class="btn btn-secondary btn-sm" id="btnAddForm">+ Assign Form</button>` : ""}
      </div>
      <table class="sg-table">
        <thead><tr><th>Code</th><th>Mandatory</th><th>Due Date</th><th>Status</th><th>Linked Deliverable</th></tr></thead>
        <tbody>
          ${g.formAssignments.length ? g.formAssignments.map((f) => `
            <tr>
              <td>${escapeHtml(f.code)}</td>
              <td>${f.mandatory ? "Yes" : "No"}</td>
              <td>${fmtDate(f.dueDate)}</td>
              <td>
                ${canEdit ? `<select class="sg-inline-select" data-code="${f.code}" data-field="status">${DELIVERABLE_STATUSES.map((s) => `<option value="${s}" ${f.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>`
                          : `<span class="pill ${statusPillClass(f.status)}">${f.status}</span>`}
              </td>
              <td>${escapeHtml(f.linkedDeliverable || "—")}</td>
            </tr>
          `).join("") : `<tr><td colspan="5" class="sg-empty-cell">No forms assigned yet.</td></tr>`}
        </tbody>
      </table>
    `;
    if (canEdit) {
      const addBtn = document.getElementById("btnAddForm");
      if (addBtn) addBtn.addEventListener("click", () => openAssignFormModal(g));
      panel.querySelectorAll('select[data-field="status"]').forEach((sel) => {
        sel.addEventListener("change", () => {
          try {
            updateFormAssignment(g.id, sel.dataset.code, { status: sel.value }, user.name, user.businessRole);
            toast("Form status updated", "success");
            draw();
          } catch (err) { toast(err.message, "error"); }
        });
      });
    }
  }

  function openAssignFormModal(g) {
    const forms = listAllForms().filter((f) => !g.formAssignments.some((a) => a.code === f.code));
    if (!forms.length) { toast("All forms are already assigned to this gate.", "info"); return; }
    openModal({
      title: "Assign Form",
      bodyHtml: `
        <div class="sg-form-grid">
          <label class="span-2">Form<select id="fCode">${forms.map((f) => `<option value="${f.code}">${f.code} — ${escapeHtml(f.name)}</option>`).join("")}</select></label>
          <label>Mandatory<select id="fMandatory"><option value="true">Yes</option><option value="false">No</option></select></label>
          <label>Due Date<input type="date" id="fDueDate" /></label>
          <label class="span-2">Linked Deliverable<select id="fLinked"><option value="">None</option>${g.deliverableAssignments.map((d) => `<option value="${d.no}">${d.no}</option>`).join("")}</select></label>
        </div>
      `,
      footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Assign</button>`,
      onMount: (backdrop, close) => {
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", close);
        backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
          addFormAssignment(g.id, {
            code: document.getElementById("fCode").value,
            mandatory: document.getElementById("fMandatory").value === "true",
            dueDate: document.getElementById("fDueDate").value,
            linkedDeliverable: document.getElementById("fLinked").value,
          }, user.name, user.businessRole);
          close();
          toast("Form assigned", "success");
          draw();
        });
      },
    });
  }

  function renderChecklistPanel(g, items, checklist, canManage) {
    const panel = document.getElementById("panel-checklist");
    if (!items.length) {
      panel.innerHTML = `<div class="sg-empty-state">No checklist template defined for ${escapeHtml(g.code)}. Ask a System Administrator to configure one under Checklist Templates.</div>`;
      return;
    }
    panel.innerHTML = `
      <table class="sg-table">
        <thead><tr><th>Item</th><th>Mandatory</th><th>Responsibility</th><th>Document</th><th>Approval</th><th></th></tr></thead>
        <tbody>
          ${items.map((item) => {
            const c = checklist.find((x) => x.templateItemId === item.id);
            return `
              <tr>
                <td>${escapeHtml(item.name)}<div class="sg-subtle">${escapeHtml(item.description || "")}</div></td>
                <td>${item.mandatory ? "Yes" : "No"}</td>
                <td>${escapeHtml(item.responsibility)}</td>
                <td>${c && c.fileName ? `📄 ${escapeHtml(c.fileName)}<div class="sg-subtle">${fmtDateTime(c.uploadedAt)}</div>` : `<span class="sg-subtle">Not uploaded</span>`}</td>
                <td>${c && c.approved ? `<span class="pill pill-green">Approved</span><div class="sg-subtle">${escapeHtml(c.approvedBy)}</div>` : `<span class="pill pill-slate">Pending</span>`}</td>
                <td>
                  ${canManage ? `<button class="btn btn-ghost btn-sm" data-act="upload" data-item="${item.id}">Upload</button>` : ""}
                  ${canManage && c && c.fileName && !c.approved ? `<button class="btn btn-ghost btn-sm" data-act="approve" data-item="${item.id}">Approve</button>` : ""}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
    panel.querySelectorAll('button[data-act="upload"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const fileName = window.prompt("Enter a file name to simulate an upload:", "document.pdf");
        if (!fileName) return;
        uploadChecklistDoc(g.id, btn.dataset.item, fileName, user.name, user.businessRole);
        toast("Document uploaded", "success");
        draw();
      });
    });
    panel.querySelectorAll('button[data-act="approve"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        try {
          approveChecklistDoc(g.id, btn.dataset.item, user.name, user.businessRole);
          toast("Document approved", "success");
          draw();
        } catch (err) { toast(err.message, "error"); }
      });
    });
  }

  function renderApprovalsPanel(g) {
    const panel = document.getElementById("panel-approvals");
    panel.innerHTML = `
      <div class="sg-timeline">
        ${g.approvals.length ? g.approvals.slice().reverse().map((a) => `
          <div class="sg-timeline-item">
            <div class="sg-timeline-dot ${statusPillClass(a.action)}"></div>
            <div class="sg-timeline-body">
              <div class="sg-timeline-title">${escapeHtml(a.action)} by ${escapeHtml(a.approver)} <span class="sg-subtle">(${escapeHtml(a.role)})</span></div>
              <div class="sg-timeline-time">${fmtDateTime(a.timestamp)}</div>
              ${a.comments ? `<div class="sg-timeline-comments">${escapeHtml(a.comments)}</div>` : ""}
            </div>
          </div>
        `).join("") : `<div class="sg-empty-state">No approval activity yet.</div>`}
      </div>
    `;
  }

  draw();
}
