// Projects — list every real project, open one (hands off entirely to the existing Project
// Detail page, never a second implementation), and create/clone/archive. Structural template is
// views/deliverables.js (KPI strip / filter row / sortable+paginated table / openDrawer create),
// reused verbatim rather than reinvented.
import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import { listProjects, createProject, cloneProject, archiveProject, planProjectFromTemplate, skipGate } from "../store/projectExecution.js";
import { listTemplates, getTemplate } from "../store/projectTemplateAdmin.js";
import { getGate as getGateMasterRecord } from "../store/gateMasterAdmin.js";
import { getForm } from "../store/forms.js";
import { listAllUsers, displayFor } from "../store/orgDirectory.js";
import {
  escapeHtml, openModal, openDrawer, confirmDialog, toast, paginate, paginationHtml, wirePagination,
  sortList, sortableTh, wireSortableTh, iconBtn, ICONS, statusPillClass, fmtDate, nowIso,
} from "../utils.js";

const PAGE_SIZE = 15;
// Real distinct values from data/projects.json / orgUsers.json — nothing invented.
const CATEGORY_OPTIONS = ["M2", "M4", "M6", "Exploration"];
const PLATFORM_OPTIONS = ["Compact", "Heavy", "Utility"];
const DEPARTMENT_OPTIONS = [...new Set(listAllUsers().map((u) => u.department))].sort();

function healthPillClass(h) {
  return h === "Green" ? "pill-green" : h === "Amber" ? "pill-amber" : h === "Red" ? "pill-red" : "pill-slate";
}
function redirectToProject(code) {
  window.location.href = "../project-detail/index.html?id=" + encodeURIComponent(code);
}
function parseDurationWeeks(duration) {
  const m = String(duration || "").match(/(\d+)\s*week/i);
  return m ? parseInt(m[1], 10) : 4;
}

// ============================== LIST ==============================
export async function renderProjectsList() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Projects");
  setActiveMenu("projects");

  const canManage = can(user.businessRole, "project.manage");
  const state = { category: "", platform: "", status: "", q: "", page: 1, sortKey: "", sortDir: "asc" };

  function draw() {
    const all = listProjects();
    const kpis = {
      total: all.length,
      active: all.filter((p) => p.status === "Active").length,
      completed: all.filter((p) => p.status === "Completed").length,
      archived: all.filter((p) => p.status === "Archived").length,
    };
    let list = all.filter((p) =>
      (!state.category || p.projectTypeCode === state.category) &&
      (!state.platform || p.platform === state.platform) &&
      (!state.status || p.status === state.status) &&
      (!state.q || (p.code + " " + p.name).toLowerCase().includes(state.q.toLowerCase()))
    );
    list = sortList(list, state.sortKey, state.sortDir);
    const { pageItems, totalPages, page, total } = paginate(list, state.page, PAGE_SIZE);

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <div>
          <h1>Projects</h1>
          <p class="sg-subtle">Every project in the portfolio. Opening a project takes you to its full execution workspace — Snapshot, Deliverables, Gate Checklist, Gantt.</p>
        </div>
        <div class="sg-header-actions">
          ${canManage ? `<button class="btn btn-primary" id="btnNewProject">+ New Project</button>` : ""}
        </div>
      </div>
      <div class="sg-kpi-filter-row">
        <div class="sg-kpi-strip compact">
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-blue">${ICONS.list}</span><div><div class="sg-kpi-label">Total</div><div class="sg-kpi-value">${kpis.total}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-green">${ICONS.check}</span><div><div class="sg-kpi-label">Active</div><div class="sg-kpi-value">${kpis.active}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-blue">${ICONS.flag}</span><div><div class="sg-kpi-label">Completed</div><div class="sg-kpi-value">${kpis.completed}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-red">${ICONS.archive}</span><div><div class="sg-kpi-label">Archived</div><div class="sg-kpi-value">${kpis.archived}</div></div></div>
        </div>
        <div class="sg-toolbar sg-toolbar-flex">
          <select id="fltCategory"><option value="">All Categories</option>${CATEGORY_OPTIONS.map((c) => `<option value="${c}" ${state.category === c ? "selected" : ""}>${c}</option>`).join("")}</select>
          <select id="fltPlatform"><option value="">All Platforms</option>${PLATFORM_OPTIONS.map((p) => `<option value="${p}" ${state.platform === p ? "selected" : ""}>${p}</option>`).join("")}</select>
          <select id="fltStatus"><option value="">All Statuses</option>${["Active", "Completed", "Archived"].map((s) => `<option value="${s}" ${state.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <input type="search" id="fltSearch" placeholder="Search project code or name…" value="${escapeHtml(state.q)}" />
        </div>
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table">
          <thead><tr>
            ${sortableTh("Code", "code", state)}${sortableTh("Name", "name", state)}${sortableTh("Category", "projectTypeCode", state)}${sortableTh("Platform", "platform", state)}
            <th>Project Manager</th>${sortableTh("Current Gate", "currentGate", state)}${sortableTh("Progress", "overallProgress", state)}<th>Health</th>${sortableTh("Status", "status", state)}
            ${sortableTh("Start Date", "startDate", state)}${sortableTh("Target End", "targetSOP", state)}<th>Actions</th>
          </tr></thead>
          <tbody>
            ${pageItems.length ? pageItems.map((p) => `
              <tr data-code="${escapeHtml(p.code)}">
                <td>${escapeHtml(p.code)}</td>
                <td class="sg-link-text" data-act="open" data-code="${escapeHtml(p.code)}">${escapeHtml(p.name)}</td>
                <td>${escapeHtml(p.projectTypeCode)}</td>
                <td>${escapeHtml(p.platform)}</td>
                <td>${escapeHtml(p.projectManagerUserId ? displayFor(p.projectManagerUserId).name : "Unassigned")}</td>
                <td>${escapeHtml(p.currentGate || "—")}</td>
                <td>${p.overallProgress ?? 0}%</td>
                <td><span class="pill ${healthPillClass(p.projectHealth)}">${escapeHtml(p.projectHealth || "—")}</span></td>
                <td><span class="pill ${statusPillClass(p.status)}">${escapeHtml(p.status)}</span></td>
                <td>${fmtDate(p.startDate)}</td>
                <td>${fmtDate(p.targetSOP)}</td>
                <td class="sg-row-actions">
                  ${iconBtn("external", { act: "open", id: p.code, title: "Open project" })}
                  ${canManage ? iconBtn("clone", { act: "clone", id: p.code, title: "Clone project" }) : ""}
                  ${canManage && p.status !== "Archived" ? iconBtn("archive", { act: "archive", id: p.code, title: "Archive project" }) : ""}
                </td>
              </tr>
            `).join("") : `<tr><td colspan="12" class="sg-empty-cell">No projects match your filters.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${paginationHtml(page, totalPages, total, PAGE_SIZE)}
    `;

    document.getElementById("fltCategory").addEventListener("change", (e) => { state.category = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltPlatform").addEventListener("change", (e) => { state.platform = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltStatus").addEventListener("change", (e) => { state.status = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltSearch").addEventListener("input", (e) => { state.q = e.target.value; state.page = 1; draw(); });
    wirePagination(contentEl(), (p) => { state.page = p; draw(); });
    wireSortableTh(contentEl(), state, draw);

    document.getElementById("btnNewProject")?.addEventListener("click", () => openCreateWizard(user, redirectToProject));
    document.querySelectorAll('[data-act="open"]').forEach((el) => el.addEventListener("click", () => redirectToProject(el.dataset.code)));
    document.querySelectorAll('[data-act="clone"]').forEach((el) => el.addEventListener("click", () => openCloneModal(el.dataset.id, user, redirectToProject)));
    document.querySelectorAll('[data-act="archive"]').forEach((el) => el.addEventListener("click", async () => {
      const ok = await confirmDialog(`Archive project ${el.dataset.id}? It will be hidden from active workflows but not deleted — it can still be opened directly.`);
      if (!ok) return;
      archiveProject(el.dataset.id, user.name, user.businessRole);
      toast("Project archived", "success");
      draw();
    }));
  }

  draw();
}

// ============================== CLONE ==============================
function openCloneModal(sourceCode, user, onDone) {
  const source = listProjects().find((p) => p.code === sourceCode);
  if (!source) return;
  openModal({
    title: `Clone ${source.code}`,
    bodyHtml: `
      <div class="sg-form-grid one-col">
        <label>New Project Code<input type="text" id="clCode" placeholder="e.g. PJ01016" /></label>
        <label>New Project Name<input type="text" id="clName" value="${escapeHtml(source.name + " (Copy)")}" /></label>
        <label>Start Date<input type="date" id="clStart" value="${nowIso().slice(0, 10)}" /></label>
      </div>
      <p class="sg-subtle" style="margin:var(--space-8) 0 0">Everything else (Category, Platform, Department, Budget, Template) is copied from ${escapeHtml(source.code)}.</p>
      <div class="sg-form-error" id="clError" hidden></div>
    `,
    footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Clone</button>`,
    onMount: (backdrop, close) => {
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", close);
      backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
        const code = backdrop.querySelector("#clCode").value.trim();
        const name = backdrop.querySelector("#clName").value.trim();
        const startDate = backdrop.querySelector("#clStart").value;
        const errEl = backdrop.querySelector("#clError");
        if (!code || !name) { errEl.textContent = "Code and name are required."; errEl.hidden = false; return; }
        try {
          const project = cloneProject(sourceCode, { code, name, startDate }, user.name, user.businessRole);
          close();
          onDone(project.code);
        } catch (err) {
          errEl.textContent = err.message; errEl.hidden = false;
        }
      });
    },
  });
}

// ============================== CREATE WIZARD ==============================
// Hosted in one openDrawer — its own header/backdrop/ESC/slide-in chrome, reused rather than
// building a new modal shell. isDirty()/onSaveFromWarning() plug into the drawer's existing
// unsaved-changes guard: "Save" from that 3-way prompt is only meaningful once a template has
// been chosen (Step 2+), in which case it just finishes the job — same outcome as the Preview
// step's own "Create Project" button. Before that point it explains why and keeps the drawer open.
function openCreateWizard(user, onCreated) {
  const state = {
    step: 1,
    info: {
      code: "", name: "", category: CATEGORY_OPTIONS[0], platform: PLATFORM_OPTIONS[0],
      department: DEPARTMENT_OPTIONS[0], projectManagerUserId: "", projectManagerLabel: "",
      budget: "", startDate: nowIso().slice(0, 10), targetEndDate: "", description: "",
    },
    templateCode: "",
    skippedGates: new Set(),
    touched: false,
  };
  let backdropRef = null;

  function readStep1() {
    const pmRaw = backdropRef.querySelector("#wPm").value.trim();
    const m = pmRaw.match(/\(([^)]+)\)\s*$/);
    return {
      code: backdropRef.querySelector("#wCode").value.trim(),
      name: backdropRef.querySelector("#wName").value.trim(),
      category: backdropRef.querySelector("#wCategory").value,
      platform: backdropRef.querySelector("#wPlatform").value,
      department: backdropRef.querySelector("#wDept").value,
      projectManagerUserId: m ? m[1] : "",
      projectManagerLabel: pmRaw,
      budget: backdropRef.querySelector("#wBudget").value,
      startDate: backdropRef.querySelector("#wStart").value,
      targetEndDate: backdropRef.querySelector("#wTarget").value,
      description: backdropRef.querySelector("#wDesc").value.trim(),
    };
  }

  function stepIndicatorHtml() {
    const labels = ["Project Info", "Select Template", "Configure Gates", "Preview", "Create"];
    return `<div class="sg-wizard-steps">${labels.map((label, i) => {
      const n = i + 1;
      const cls = n < state.step ? "done" : n === state.step ? "active" : "";
      const connector = i < labels.length - 1 ? `<div class="sg-wizard-step-connector ${n < state.step ? "done" : ""}"></div>` : "";
      return `<div class="sg-wizard-step ${cls}"><span class="sg-wizard-step-circle">${n < state.step ? "✓" : n}</span><span class="sg-wizard-step-label">${escapeHtml(label)}</span></div>${connector}`;
    }).join("")}</div>`;
  }

  function step1Html() {
    const pmOptions = listAllUsers().map((u) => `<option value="${escapeHtml(u.fullName)} (${escapeHtml(u.id)})">`).join("");
    return `
      <div class="drawer-section">
        <h4 class="drawer-section-title">Project Information</h4>
        <div class="sg-form-grid">
          <label>Project Code<input type="text" id="wCode" value="${escapeHtml(state.info.code)}" placeholder="e.g. PJ01016" required /></label>
          <label>Project Name<input type="text" id="wName" value="${escapeHtml(state.info.name)}" required /></label>
          <label>Category<select id="wCategory">${CATEGORY_OPTIONS.map((c) => `<option value="${c}" ${state.info.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
          <label>Platform<select id="wPlatform">${PLATFORM_OPTIONS.map((p) => `<option value="${p}" ${state.info.platform === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
          <label>Department<select id="wDept">${DEPARTMENT_OPTIONS.map((d) => `<option value="${escapeHtml(d)}" ${state.info.department === d ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}</select></label>
          <label>Project Manager<input type="text" id="wPm" list="wPmList" value="${escapeHtml(state.info.projectManagerLabel)}" placeholder="Search by name…" /></label>
          <datalist id="wPmList">${pmOptions}</datalist>
          <label>Budget (₹ Lakh)<input type="number" id="wBudget" value="${escapeHtml(state.info.budget)}" min="0" step="0.1" /></label>
          <label>Start Date<input type="date" id="wStart" value="${escapeHtml(state.info.startDate)}" /></label>
          <label>Target End Date<input type="date" id="wTarget" value="${escapeHtml(state.info.targetEndDate)}" /></label>
          <label class="span-2">Description<textarea id="wDesc" rows="3">${escapeHtml(state.info.description)}</textarea></label>
        </div>
        <div class="sg-form-error" id="wStepError" hidden></div>
      </div>
    `;
  }

  function step2Html() {
    const templates = listTemplates().filter((t) => t.active !== false);
    return `
      <div class="drawer-section">
        <h4 class="drawer-section-title">Select an Active Project Template</h4>
        <p class="sg-subtle" style="margin-top:0">Pre-selected to match this project's Category — pick a different one if needed.</p>
        <div class="sg-tpl-pick-grid">
          ${templates.map((t) => {
            const gateCount = t.defaultGateSequence.length;
            const delivCount = t.gates.reduce((s, g) => s + (g.defaultDeliverables || []).length, 0);
            const formCount = t.gates.reduce((s, g) => s + (g.linkedForms || []).length, 0);
            const checklistCount = t.gates.reduce((s, g) => s + (g.checklistDocuments || []).length, 0);
            const weeks = t.defaultGateSequence.reduce((s, gc) => {
              const gcfg = t.gates.find((g) => g.gateCode === gc);
              const gm = getGateMasterRecord(gc);
              return s + parseDurationWeeks(gcfg?.gateDuration || (gm && gm.defaultDuration));
            }, 0);
            const selected = state.templateCode === t.templateCode;
            return `
              <button type="button" class="sg-tpl-pick-card ${selected ? "selected" : ""}" data-act="pick-template" data-code="${escapeHtml(t.templateCode)}">
                ${selected ? `<span class="sg-tpl-pick-check">${ICONS.check}</span>` : ""}
                <div class="sg-tpl-pick-name">${escapeHtml(t.templateName)}</div>
                <div class="sg-tpl-pick-statgrid">
                  <div class="sg-tpl-pick-stat"><strong>${gateCount}</strong><span>Gates</span></div>
                  <div class="sg-tpl-pick-stat"><strong>${delivCount}</strong><span>Deliverables</span></div>
                  <div class="sg-tpl-pick-stat"><strong>${formCount}</strong><span>Forms</span></div>
                  <div class="sg-tpl-pick-stat"><strong>${checklistCount}</strong><span>Checklist Docs</span></div>
                </div>
                <div class="sg-tpl-pick-duration">~${weeks} weeks estimated</div>
              </button>
            `;
          }).join("")}
        </div>
        <div class="sg-form-error" id="wStepError" hidden></div>
      </div>
    `;
  }

  // "Configure Gates" — lets a PMO mark a gate as not applicable to this project (e.g. a child/
  // derivative project that doesn't need every gate its parent does) before the project is even
  // created. Unchecking a gate here doesn't change what createProject() generates — every gate
  // instance is still created for every gate in the template (see planProjectFromTemplate) — it
  // just queues a skipGate() call, made right after creation succeeds, in doCreate() below. That
  // keeps this the same non-destructive registry overlay used everywhere else in this feature.
  function step3Html() {
    const template = getTemplate(state.templateCode);
    if (!template) return `<div class="drawer-section"><p class="sg-subtle">Go back and select a template.</p></div>`;
    return `
      <div class="drawer-section">
        <h4 class="drawer-section-title">Configure Gates</h4>
        <p class="sg-subtle" style="margin-top:0">Uncheck any gate that doesn't apply to this project. A skipped gate requires no deliverables or approval, and is excluded from progress and compliance calculations.</p>
        <div class="sg-gate-toggle-list">
          ${template.defaultGateSequence.map((gateCode) => {
            const gm = getGateMasterRecord(gateCode);
            const checked = !state.skippedGates.has(gateCode);
            return `
              <label class="sg-gate-toggle-row ${checked ? "" : "sg-gate-toggle-skipped"}">
                <input type="checkbox" data-act="toggle-gate" data-gate="${escapeHtml(gateCode)}" ${checked ? "checked" : ""} />
                <span class="sg-gate-toggle-name"><strong>${escapeHtml(gateCode)}</strong> — ${escapeHtml(gm ? gm.gateName : "")}</span>
                ${checked ? "" : `<span class="pill pill-slate sg-gate-toggle-pill">Not required — will be skipped</span>`}
              </label>
            `;
          }).join("")}
        </div>
        <div class="sg-form-error" id="wStepError" hidden></div>
      </div>
    `;
  }

  function step4Html() {
    const template = getTemplate(state.templateCode);
    if (!template) return `<div class="drawer-section"><p class="sg-subtle">Go back and select a template.</p></div>`;
    const { gateInstances, deliverableAssignments } = planProjectFromTemplate(template, state.info.code || "NEW", state.info.startDate || nowIso().slice(0, 10));
    const totalDeliverables = deliverableAssignments.length;
    const totalForms = new Set(deliverableAssignments.map((a) => a.linkedFormCode).filter(Boolean)).size;
    const totalChecklistDocs = template.gates.reduce((s, g) => s + (g.checklistDocuments || []).length, 0);
    return `
      <div class="drawer-section">
        <h4 class="drawer-section-title">Project Structure Preview</h4>
        <p class="sg-subtle" style="margin-top:0">This is exactly what "Create Project" will generate. Gate Checklist availability and the project Timeline follow automatically once these Gates and Deliverables exist — they are not separate items to configure.</p>
        <div class="sg-preview-summary">
          <div class="sg-preview-summary-item"><strong>${template.defaultGateSequence.length}</strong><span>Gates</span></div>
          <div class="sg-preview-summary-item"><strong>${totalDeliverables}</strong><span>Deliverables</span></div>
          <div class="sg-preview-summary-item"><strong>${totalForms}</strong><span>Forms</span></div>
          <div class="sg-preview-summary-item"><strong>${totalChecklistDocs}</strong><span>Checklist Docs</span></div>
        </div>
        <div class="sg-preview-gate-list">
          ${template.defaultGateSequence.map((gateCode, i) => {
            const gi = gateInstances[i];
            const gc = template.gates.find((g) => g.gateCode === gateCode) || {};
            const gateAssignments = deliverableAssignments.filter((a) => a.gateCode === gateCode);
            const formCodes = [...new Set(gateAssignments.map((a) => a.linkedFormCode).filter(Boolean))];
            const checklistDocs = gc.checklistDocuments || [];
            const skipped = state.skippedGates.has(gateCode);
            if (skipped) {
              return `
                <div class="sg-preview-gate sg-preview-gate-skipped">
                  <div class="sg-preview-gate-head">
                    <div class="sg-preview-gate-title"><span class="sg-preview-gate-num">${i + 1}</span><strong>${escapeHtml(gateCode)}</strong></div>
                    <span class="pill pill-slate">Skipped — not required</span>
                  </div>
                </div>
              `;
            }
            return `
              <div class="sg-preview-gate">
                <div class="sg-preview-gate-head">
                  <div class="sg-preview-gate-title"><span class="sg-preview-gate-num">${i + 1}</span><strong>${escapeHtml(gateCode)}</strong></div>
                  <span class="sg-preview-gate-dates">${escapeHtml(gi.plannedStart)} → ${escapeHtml(gi.plannedFinish)}</span>
                </div>
                <div class="sg-preview-gate-body">
                  <div class="sg-preview-row">
                    <span class="sg-preview-row-label">${gateAssignments.length} Deliverable${gateAssignments.length === 1 ? "" : "s"}</span>
                    ${gateAssignments.length ? `<div class="sg-preview-chips">${gateAssignments.map((a) => `<span class="chip">${escapeHtml(a.deliverableName)}</span>`).join("")}</div>` : `<span class="sg-preview-empty">None</span>`}
                  </div>
                  <div class="sg-preview-row">
                    <span class="sg-preview-row-label">${formCodes.length} Form${formCodes.length === 1 ? "" : "s"}</span>
                    ${formCodes.length ? `<div class="sg-preview-chips">${formCodes.map((f) => { const fm = getForm(f); return `<span class="chip chip-form" title="${escapeHtml(fm ? fm.formName : "")}">${escapeHtml(f)}</span>`; }).join("")}</div>` : `<span class="sg-preview-empty">None</span>`}
                  </div>
                  ${checklistDocs.length ? `
                    <div class="sg-preview-row">
                      <span class="sg-preview-row-label">${checklistDocs.length} Checklist Document${checklistDocs.length === 1 ? "" : "s"}</span>
                      <div class="sg-preview-chips">${checklistDocs.map((c) => `<span class="chip chip-checklist">${escapeHtml(c.documentName)}</span>`).join("")}</div>
                    </div>
                  ` : ""}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderFooter() {
    const footer = backdropRef.querySelector(".drawer-footer");
    footer.innerHTML = `
      ${state.step > 1 ? `<button class="btn btn-ghost" data-act="back">Back</button>` : `<button class="btn btn-ghost" data-act="cancel">Cancel</button>`}
      ${state.step < 4 ? `<button class="btn btn-primary" data-act="next">Next</button>` : `<button class="btn btn-primary" data-act="create">Create Project</button>`}
    `;
    footer.querySelector('[data-act="cancel"]')?.addEventListener("click", () => wizardApi.requestClose());
    footer.querySelector('[data-act="back"]')?.addEventListener("click", () => { state.step -= 1; render(); });
    footer.querySelector('[data-act="next"]')?.addEventListener("click", onNext);
    footer.querySelector('[data-act="create"]')?.addEventListener("click", () => doCreate());
  }

  function wireStep() {
    if (state.step === 1) {
      backdropRef.querySelectorAll("#wCode,#wName,#wCategory,#wPlatform,#wDept,#wPm,#wBudget,#wStart,#wTarget,#wDesc").forEach((el) => {
        el.addEventListener("input", () => { state.touched = true; });
        el.addEventListener("change", () => { state.touched = true; });
      });
    } else if (state.step === 2) {
      backdropRef.querySelectorAll('[data-act="pick-template"]').forEach((btn) => {
        btn.addEventListener("click", () => {
          if (state.templateCode !== btn.dataset.code) state.skippedGates = new Set();
          state.templateCode = btn.dataset.code; state.touched = true; render();
        });
      });
    } else if (state.step === 3) {
      backdropRef.querySelectorAll('[data-act="toggle-gate"]').forEach((cb) => {
        cb.addEventListener("change", () => {
          if (cb.checked) state.skippedGates.delete(cb.dataset.gate);
          else state.skippedGates.add(cb.dataset.gate);
          state.touched = true;
          render();
        });
      });
    }
  }

  function render() {
    const body = backdropRef.querySelector(".drawer-body");
    body.innerHTML = stepIndicatorHtml() + (state.step === 1 ? step1Html() : state.step === 2 ? step2Html() : state.step === 3 ? step3Html() : step4Html());
    wireStep();
    renderFooter();
  }

  function onNext() {
    const errEl = backdropRef.querySelector("#wStepError");
    if (state.step === 1) {
      const vals = readStep1();
      if (!vals.code || !vals.name || !vals.startDate || !vals.targetEndDate) {
        errEl.textContent = "Project Code, Name, Start Date and Target End Date are required."; errEl.hidden = false; return;
      }
      if (listProjects().some((p) => p.code === vals.code)) {
        errEl.textContent = `Project code "${vals.code}" already exists.`; errEl.hidden = false; return;
      }
      state.info = { ...state.info, ...vals };
      if (!state.templateCode) {
        const match = listTemplates().find((t) => t.projectType === vals.category);
        if (match) state.templateCode = match.templateCode;
      }
      state.step = 2;
      render();
      return;
    }
    if (state.step === 2) {
      if (!state.templateCode) { errEl.textContent = "Select a template to continue."; errEl.hidden = false; return; }
      state.step = 3;
      render();
      return;
    }
    if (state.step === 3) {
      const template = getTemplate(state.templateCode);
      if (template && state.skippedGates.size >= template.defaultGateSequence.length) {
        errEl.textContent = "At least one gate must remain active — a project can't skip every gate."; errEl.hidden = false; return;
      }
      state.step = 4;
      render();
    }
  }

  function doCreate() {
    if (!state.templateCode) { toast("Select a template first.", "error"); return; }
    try {
      const project = createProject(state.info, state.templateCode, user.name, user.businessRole);
      state.skippedGates.forEach((gateCode) => {
        skipGate(project.code, gateCode, user.name, user.businessRole, "Marked not required during project creation.");
      });
      state.step = 5;
      wizardApi.close();
      onCreated(project.code);
      return true;
    } catch (err) {
      toast(err.message, "error");
      return false;
    }
  }

  const wizardApi = openDrawer({
    title: "New Project",
    width: "90%",
    bodyHtml: `<div></div>`,
    footerHtml: `<div></div>`,
    isDirty: () => state.touched,
    onSaveFromWarning: async () => {
      if (state.step < 4 || !state.templateCode) {
        toast("Finish all 4 steps before saving — or Discard to abandon this project.", "error");
        return false;
      }
      return doCreate();
    },
    onMount: (backdrop) => {
      backdropRef = backdrop;
      render();
    },
  });
}
