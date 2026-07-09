import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import { listAllForms, getForm, getBuiltForm, saveBuiltForm, deleteForm, importForms, FIELD_TYPES } from "../store/forms.js";
import {
  listSubmissions, getSubmission, saveDraft, submitSubmission, startReview, approveSubmission, rejectSubmission,
} from "../store/formSubmissions.js";
import { distinctProjectCodes } from "../store/gates.js";
import { listDeliverables } from "../store/deliverables.js";
import { escapeHtml, fmtDateTime, relTime, statusPillClass, openModal, confirmDialog, toast, uid } from "../utils.js";
import { navigate } from "../router.js";

const FIELD_TYPE_LABELS = {
  text: "Text", textarea: "Text Area", number: "Number", date: "Date", select: "Dropdown",
  checkbox: "Checkbox", radio: "Radio", email: "Email", phone: "Phone",
};

// ============================== LIBRARY ==============================
export async function renderFormsLibrary() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Forms Library");
  setActiveMenu("forms");

  const canManageLib = can(user.businessRole, "form.library.manage");
  const canBuild = can(user.businessRole, "form.builder.use");
  const canFill = can(user.businessRole, "form.submission.fill");

  function draw() {
    const forms = listAllForms();
    const mySubmissions = listSubmissions({ filledBy: user.name }).slice(0, 8);

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <h1>Forms Library</h1>
        <div class="sg-header-actions">
          ${canManageLib ? `<button class="btn btn-ghost" id="btnImportForms">Import</button>` : ""}
          ${canBuild ? `<a class="btn btn-primary" href="#/form-builder">+ Build Form</a>` : ""}
        </div>
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table">
          <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Stage</th><th>Owner</th><th>Fields</th><th>Source</th><th></th></tr></thead>
          <tbody>
            ${forms.map((f) => `
              <tr>
                <td>${escapeHtml(f.code)}</td>
                <td>${escapeHtml(f.name)}</td>
                <td>${escapeHtml(f.type)}</td>
                <td>${escapeHtml(f.stage)}</td>
                <td>${escapeHtml(f.owner)}</td>
                <td>${f.fieldsSchema.length}</td>
                <td><span class="pill ${f.source === "Built" ? "pill-blue" : "pill-slate"}">${f.source}</span></td>
                <td class="sg-row-actions">
                  ${canFill ? `<a class="btn btn-ghost btn-sm" href="#/forms/fill/${encodeURIComponent(f.code)}">Fill</a>` : ""}
                  ${canBuild && f.source === "Built" ? `<a class="btn btn-ghost btn-sm" href="#/form-builder?code=${encodeURIComponent(f.code)}">Edit</a>` : ""}
                  ${canManageLib ? `<button class="btn btn-ghost btn-sm danger" data-act="delete" data-code="${f.code}">Delete</button>` : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <h2 class="sg-section-title">My Submissions</h2>
      <div class="sg-table-wrap">
        <table class="sg-table">
          <thead><tr><th>Form</th><th>Project</th><th>Status</th><th>Submitted</th><th></th></tr></thead>
          <tbody>
            ${mySubmissions.length ? mySubmissions.map((s) => `
              <tr class="sg-row-clickable" data-id="${s.id}">
                <td>${escapeHtml(s.formCode)}</td>
                <td>${escapeHtml(s.projectCode || "—")}</td>
                <td><span class="pill ${statusPillClass(s.status)}">${s.status}</span></td>
                <td>${s.submittedAt ? relTime(s.submittedAt) : "—"}</td>
                <td><a class="btn btn-ghost btn-sm" href="#/forms/submission/${s.id}">Open</a></td>
              </tr>
            `).join("") : `<tr><td colspan="5" class="sg-empty-cell">You haven't filled any forms yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('button[data-act="delete"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (await confirmDialog(`Delete form ${btn.dataset.code} from the library?`)) {
          deleteForm(btn.dataset.code, user.name, user.businessRole);
          toast("Form deleted", "success");
          draw();
        }
      });
    });
    document.querySelectorAll(".sg-row-clickable").forEach((row) => {
      row.addEventListener("click", (e) => { if (e.target.tagName !== "A") navigate(`/forms/submission/${row.dataset.id}`); });
    });
    const importBtn = document.getElementById("btnImportForms");
    if (importBtn) importBtn.addEventListener("click", () => openImportModal(draw));
  }

  draw();
}

function openImportModal(onDone) {
  const user = getActiveUser();
  openModal({
    title: "Import Form Templates",
    bodyHtml: `
      <p class="sg-subtle">Upload CSV or JSON. Keys: code, name, type, stage, owner, fieldsSchema (JSON array of {id,label,type,required}).</p>
      <input type="file" id="importFormsFile" accept=".csv,.json,application/json,text/csv" />
      <div class="sg-form-error" id="importFormsError" hidden></div>
    `,
    footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Import</button>`,
    onMount: (backdrop, close) => {
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", close);
      backdrop.querySelector('[data-act="save"]').addEventListener("click", async () => {
        const fileInput = document.getElementById("importFormsFile");
        const errEl = document.getElementById("importFormsError");
        const file = fileInput.files[0];
        if (!file) { errEl.textContent = "Choose a file first."; errEl.hidden = false; return; }
        try {
          const text = await file.text();
          const { created, updated } = importForms(text, file.name, user.name, user.businessRole);
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

// ============================== BUILDER ==============================
export async function renderFormBuilder(params, query) {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Form Builder");
  setActiveMenu("form-builder");

  const existing = query.code ? getBuiltForm(query.code) : null;
  const state = {
    code: existing?.code || null,
    name: existing?.name || "",
    type: existing?.type || "Custom",
    stage: existing?.stage || "G1",
    owner: existing?.owner || user.businessRole,
    sections: existing ? JSON.parse(JSON.stringify(existing.sections)) : [{ id: uid("sec"), title: "Section 1", fields: [] }],
    selectedFieldId: null,
    preview: false,
  };

  function findField(fieldId) {
    for (const sec of state.sections) {
      const f = sec.fields.find((x) => x.id === fieldId);
      if (f) return { section: sec, field: f };
    }
    return null;
  }

  function draw() {
    contentEl().innerHTML = `
      <div class="sg-page-header">
        <h1>${existing ? `Edit ${escapeHtml(state.code)}` : "Build New Form"}</h1>
        <div class="sg-header-actions">
          <button class="btn btn-ghost" id="btnTogglePreview">${state.preview ? "Back to Editor" : "Live Preview"}</button>
          <button class="btn btn-primary" id="btnSaveForm">Save Form</button>
        </div>
      </div>
      <div class="sg-form-grid sg-builder-meta">
        <label>Form Name<input type="text" id="fbName" value="${escapeHtml(state.name)}" /></label>
        <label>Type<input type="text" id="fbType" value="${escapeHtml(state.type)}" /></label>
        <label>Stage<input type="text" id="fbStage" value="${escapeHtml(state.stage)}" /></label>
        <label>Owner<input type="text" id="fbOwner" value="${escapeHtml(state.owner)}" /></label>
      </div>
      ${state.preview ? renderPreview() : renderEditor()}
    `;

    document.getElementById("btnTogglePreview").addEventListener("click", () => { syncMeta(); state.preview = !state.preview; draw(); });
    document.getElementById("btnSaveForm").addEventListener("click", () => {
      syncMeta();
      if (!state.name.trim()) { toast("Form name is required.", "error"); return; }
      if (!state.sections.some((s) => s.fields.length)) { toast("Add at least one field before saving.", "error"); return; }
      const saved = saveBuiltForm({ code: state.code, name: state.name, type: state.type, stage: state.stage, owner: state.owner, sections: state.sections }, user.name, user.businessRole);
      toast(`Form ${saved.code} saved`, "success");
      navigate("/forms");
    });

    if (!state.preview) wireEditorEvents();
  }

  function syncMeta() {
    state.name = document.getElementById("fbName")?.value ?? state.name;
    state.type = document.getElementById("fbType")?.value ?? state.type;
    state.stage = document.getElementById("fbStage")?.value ?? state.stage;
    state.owner = document.getElementById("fbOwner")?.value ?? state.owner;
  }

  function renderEditor() {
    const selected = state.selectedFieldId ? findField(state.selectedFieldId) : null;
    return `
      <div class="sg-builder-layout">
        <div class="sg-builder-palette">
          <h3>Field Palette</h3>
          <p class="sg-subtle">Drag a field type into a section.</p>
          ${FIELD_TYPES.map((t) => `<div class="sg-palette-item" draggable="true" data-type="${t}">${FIELD_TYPE_LABELS[t]}</div>`).join("")}
          <button class="btn btn-ghost btn-sm sg-add-section" id="btnAddSection">+ Add Section</button>
        </div>
        <div class="sg-builder-canvas">
          ${state.sections.map((sec) => `
            <div class="sg-builder-section" data-section="${sec.id}">
              <div class="sg-builder-section-header">
                <input type="text" class="sg-section-title-input" data-section="${sec.id}" value="${escapeHtml(sec.title)}" />
                ${state.sections.length > 1 ? `<button class="btn btn-ghost btn-sm danger" data-act="delete-section" data-section="${sec.id}">Remove Section</button>` : ""}
              </div>
              <div class="sg-builder-dropzone" data-section="${sec.id}">
                ${sec.fields.length ? sec.fields.map((f) => `
                  <div class="sg-builder-field ${state.selectedFieldId === f.id ? "selected" : ""}" data-field="${f.id}">
                    <span class="sg-builder-field-type">${FIELD_TYPE_LABELS[f.type]}</span>
                    <span class="sg-builder-field-label">${escapeHtml(f.label)}${f.required ? " *" : ""}</span>
                    <button class="sg-builder-field-remove" data-act="delete-field" data-field="${f.id}" title="Remove">✕</button>
                  </div>
                `).join("") : `<div class="sg-builder-dropzone-empty">Drop fields here</div>`}
              </div>
            </div>
          `).join("")}
        </div>
        <div class="sg-builder-inspector">
          <h3>Field Inspector</h3>
          ${selected ? renderInspector(selected.field) : `<p class="sg-subtle">Select a field to edit its properties.</p>`}
        </div>
      </div>
    `;
  }

  function renderInspector(field) {
    return `
      <div class="sg-form-grid one-col">
        <label>Label<input type="text" id="insLabel" value="${escapeHtml(field.label)}" /></label>
        <label>Placeholder<input type="text" id="insPlaceholder" value="${escapeHtml(field.placeholder || "")}" /></label>
        <label>Hint<input type="text" id="insHint" value="${escapeHtml(field.hint || "")}" /></label>
        <label>Span (1-4)<input type="number" id="insSpan" min="1" max="4" value="${field.span || 2}" /></label>
        <label class="sg-check-inline"><input type="checkbox" id="insRequired" ${field.required ? "checked" : ""} /> Required</label>
        ${["select", "radio"].includes(field.type) ? `<label>Options (comma-separated)<input type="text" id="insOptions" value="${escapeHtml((field.options || []).join(", "))}" /></label>` : ""}
      </div>
    `;
  }

  function renderPreview() {
    return `
      <div class="sg-form-preview">
        ${state.sections.map((sec) => `
          <fieldset class="sg-preview-section">
            <legend>${escapeHtml(sec.title)}</legend>
            <div class="sg-preview-grid">
              ${sec.fields.map((f) => `<div class="sg-preview-field span-${f.span || 2}">${renderFieldInput(f, {})}</div>`).join("") || `<p class="sg-subtle">No fields in this section.</p>`}
            </div>
          </fieldset>
        `).join("")}
      </div>
    `;
  }

  function wireEditorEvents() {
    document.getElementById("btnAddSection").addEventListener("click", () => {
      state.sections.push({ id: uid("sec"), title: `Section ${state.sections.length + 1}`, fields: [] });
      draw();
    });

    document.querySelectorAll(".sg-section-title-input").forEach((input) => {
      input.addEventListener("input", () => {
        const sec = state.sections.find((s) => s.id === input.dataset.section);
        if (sec) sec.title = input.value;
      });
    });

    document.querySelectorAll('[data-act="delete-section"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        syncMeta();
        state.sections = state.sections.filter((s) => s.id !== btn.dataset.section);
        draw();
      });
    });

    document.querySelectorAll('[data-act="delete-field"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        syncMeta();
        state.sections.forEach((s) => { s.fields = s.fields.filter((f) => f.id !== btn.dataset.field); });
        if (state.selectedFieldId === btn.dataset.field) state.selectedFieldId = null;
        draw();
      });
    });

    document.querySelectorAll(".sg-builder-field").forEach((el) => {
      el.addEventListener("click", () => { syncMeta(); state.selectedFieldId = el.dataset.field; draw(); });
    });

    document.querySelectorAll(".sg-palette-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", item.dataset.type); });
    });

    document.querySelectorAll(".sg-builder-dropzone").forEach((zone) => {
      zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("drag-over");
        const type = e.dataTransfer.getData("text/plain");
        if (!FIELD_TYPES.includes(type)) return;
        syncMeta();
        const sec = state.sections.find((s) => s.id === zone.dataset.section);
        const field = {
          id: uid("fld"), type, label: FIELD_TYPE_LABELS[type], placeholder: "", required: false,
          options: ["select", "radio"].includes(type) ? ["Option 1", "Option 2"] : undefined, span: 2, hint: "",
        };
        sec.fields.push(field);
        state.selectedFieldId = field.id;
        draw();
      });
    });

    const insLabel = document.getElementById("insLabel");
    if (insLabel && state.selectedFieldId) {
      const { field } = findField(state.selectedFieldId);
      const bind = (id, key, transform = (v) => v) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", () => { field[key] = transform(el.type === "checkbox" ? el.checked : el.value); });
      };
      bind("insLabel", "label");
      bind("insPlaceholder", "placeholder");
      bind("insHint", "hint");
      bind("insSpan", "span", (v) => Math.min(4, Math.max(1, Number(v) || 2)));
      const reqEl = document.getElementById("insRequired");
      if (reqEl) reqEl.addEventListener("change", () => { field.required = reqEl.checked; });
      const optEl = document.getElementById("insOptions");
      if (optEl) optEl.addEventListener("input", () => { field.options = optEl.value.split(",").map((s) => s.trim()).filter(Boolean); });
    }
  }

  draw();
}

// ============================== FIELD RENDERING (shared by preview + fill) ==============================
function renderFieldInput(field, values) {
  const val = values[field.id] ?? "";
  const req = field.required ? "required" : "";
  const common = `id="field_${field.id}" name="${field.id}" ${req}`;
  let control = "";
  switch (field.type) {
    case "textarea":
      control = `<textarea ${common} placeholder="${escapeHtml(field.placeholder || "")}" rows="3">${escapeHtml(val)}</textarea>`;
      break;
    case "select":
      control = `<select ${common}><option value="">Select…</option>${(field.options || []).map((o) => `<option value="${escapeHtml(o)}" ${val === o ? "selected" : ""}>${escapeHtml(o)}</option>`).join("")}</select>`;
      break;
    case "radio":
      control = (field.options || []).map((o) => `
        <label class="sg-radio-opt"><input type="radio" name="${field.id}" value="${escapeHtml(o)}" ${val === o ? "checked" : ""} /> ${escapeHtml(o)}</label>
      `).join("");
      break;
    case "checkbox":
      control = `<label class="sg-check-inline"><input type="checkbox" ${common} ${val ? "checked" : ""} /> ${escapeHtml(field.hint || "Yes")}</label>`;
      break;
    default:
      control = `<input type="${field.type}" ${common} placeholder="${escapeHtml(field.placeholder || "")}" value="${escapeHtml(val)}" />`;
  }
  return `
    <label class="sg-field-label">${escapeHtml(field.label)}${field.required ? " *" : ""}
      ${control}
      ${field.hint && field.type !== "checkbox" ? `<span class="sg-field-hint">${escapeHtml(field.hint)}</span>` : ""}
    </label>
  `;
}

function readFieldValue(field, root) {
  if (field.type === "checkbox") return !!root.querySelector(`#field_${field.id}`)?.checked;
  if (field.type === "radio") return root.querySelector(`input[name="${field.id}"]:checked`)?.value || "";
  return root.querySelector(`#field_${field.id}`)?.value || "";
}

// ============================== FILL ==============================
export async function renderFormFill(params, query) {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setActiveMenu("forms");

  const form = getForm(params.code);
  if (!form) {
    contentEl().innerHTML = `<div class="sg-empty-state">Form not found. <a href="#/forms">Back to Forms Library</a></div>`;
    return;
  }
  setBreadcrumb(`Forms Library / ${form.code} / Fill`);

  let draft = query.id ? getSubmission(query.id) : null;
  if (draft && draft.status !== "Draft") draft = null;

  const projects = distinctProjectCodes();
  const deliverables = listDeliverables();

  contentEl().innerHTML = `
    <div class="sg-page-header">
      <h1>${escapeHtml(form.name)}</h1>
      <p class="sg-subtle">${escapeHtml(form.code)} · ${escapeHtml(form.type)} · Stage ${escapeHtml(form.stage)}</p>
    </div>
    <form id="fillForm" class="sg-form-preview">
      <fieldset class="sg-preview-section">
        <legend>Context</legend>
        <div class="sg-preview-grid">
          <div class="sg-preview-field span-2">
            <label class="sg-field-label">Project Code
              <select id="ctxProject"><option value="">None</option>${projects.map((p) => `<option value="${escapeHtml(p)}" ${draft?.projectCode === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}</select>
            </label>
          </div>
          <div class="sg-preview-field span-2">
            <label class="sg-field-label">Linked Deliverable
              <select id="ctxDeliverable"><option value="">None</option>${deliverables.map((d) => `<option value="${escapeHtml(d.no)}" ${draft?.deliverableNo === d.no ? "selected" : ""}>${escapeHtml(d.no)} — ${escapeHtml(d.name)}</option>`).join("")}</select>
            </label>
          </div>
        </div>
      </fieldset>
      ${(form.sections || [{ id: "s1", title: form.name, fields: form.fieldsSchema }]).map((sec) => `
        <fieldset class="sg-preview-section">
          <legend>${escapeHtml(sec.title)}</legend>
          <div class="sg-preview-grid">
            ${sec.fields.map((f) => `<div class="sg-preview-field span-${f.span || 2}">${renderFieldInput(f, draft?.values || {})}</div>`).join("")}
          </div>
        </fieldset>
      `).join("")}
      <div class="sg-form-actions">
        <button type="button" class="btn btn-ghost" id="btnSaveDraft">Save Draft</button>
        <button type="submit" class="btn btn-primary" id="btnSubmitForm">Submit</button>
      </div>
    </form>
  `;

  const formEl = document.getElementById("fillForm");
  const allFields = (form.sections || [{ fields: form.fieldsSchema }]).flatMap((s) => s.fields);

  function collectValues() {
    const values = {};
    allFields.forEach((f) => { values[f.id] = readFieldValue(f, formEl); });
    return values;
  }

  function validateRequired(values) {
    const missing = allFields.filter((f) => f.required && !String(values[f.id] ?? "").trim());
    return missing;
  }

  document.getElementById("btnSaveDraft").addEventListener("click", () => {
    const saved = saveDraft({
      id: draft?.id, formCode: form.code,
      projectCode: document.getElementById("ctxProject").value,
      deliverableNo: document.getElementById("ctxDeliverable").value,
      values: collectValues(),
    }, user.name, user.businessRole);
    draft = saved;
    toast("Draft saved", "success");
    navigate(`/forms/fill/${encodeURIComponent(form.code)}?id=${saved.id}`);
  });

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const values = collectValues();
    const missing = validateRequired(values);
    if (missing.length) { toast(`Please complete required field: ${missing[0].label}`, "error"); return; }
    const saved = saveDraft({
      id: draft?.id, formCode: form.code,
      projectCode: document.getElementById("ctxProject").value,
      deliverableNo: document.getElementById("ctxDeliverable").value,
      values,
    }, user.name, user.businessRole);
    submitSubmission(saved.id, user.name, user.businessRole);
    toast("Form submitted for review", "success");
    navigate(`/forms/submission/${saved.id}`);
  });
}

// ============================== SUBMISSION DETAIL ==============================
export async function renderSubmissionDetail(params) {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setActiveMenu("forms");

  function draw() {
    const submission = getSubmission(params.id);
    if (!submission) {
      contentEl().innerHTML = `<div class="sg-empty-state">Submission not found. <a href="#/forms">Back to Forms Library</a></div>`;
      return;
    }
    const form = getForm(submission.formCode);
    setBreadcrumb(`Forms Library / ${submission.formCode} / Submission`);
    const allFields = form ? (form.sections || [{ fields: form.fieldsSchema }]).flatMap((s) => s.fields) : [];
    const canApprove = can(user.businessRole, "form.submission.approve");
    const isOwner = submission.filledBy === user.name;

    const actions = [];
    if (submission.status === "Draft" && isOwner) actions.push(`<a class="btn btn-primary" href="#/forms/fill/${encodeURIComponent(submission.formCode)}?id=${submission.id}">Continue Editing</a>`);
    if (submission.status === "Submitted" && canApprove) actions.push(`<button class="btn btn-secondary" data-act="review">Start Review</button>`);
    if (["Submitted", "UnderReview"].includes(submission.status) && canApprove) {
      actions.push(`<button class="btn btn-primary" data-act="approve">Approve</button>`);
      actions.push(`<button class="btn btn-danger" data-act="reject">Reject</button>`);
    }
    if (submission.status === "Rejected" && isOwner) actions.push(`<a class="btn btn-primary" href="#/forms/fill/${encodeURIComponent(submission.formCode)}?id=${submission.id}">Revise &amp; Resubmit</a>`);

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <div>
          <h1>${escapeHtml(submission.formCode)} Submission</h1>
          <p class="sg-subtle">Filled by ${escapeHtml(submission.filledBy)} · <span class="pill ${statusPillClass(submission.status)}">${submission.status}</span></p>
        </div>
        <div class="sg-header-actions" id="subActions">${actions.join("")}</div>
      </div>
      <div class="adm-scroll">
      <div class="sg-detail-grid">
        <div class="sg-detail-card"><div class="sg-kpi-label">Project</div>${escapeHtml(submission.projectCode || "—")}</div>
        <div class="sg-detail-card"><div class="sg-kpi-label">Deliverable</div>${escapeHtml(submission.deliverableNo || "—")}</div>
        <div class="sg-detail-card"><div class="sg-kpi-label">Submitted</div>${submission.submittedAt ? fmtDateTime(submission.submittedAt) : "—"}</div>
      </div>
      <h2 class="sg-section-title">Submitted Values</h2>
      <div class="sg-detail-grid">
        ${allFields.map((f) => `<div class="sg-detail-card"><div class="sg-kpi-label">${escapeHtml(f.label)}</div>${escapeHtml(formatValue(submission.values[f.id]))}</div>`).join("") || `<p class="sg-subtle">No field schema available.</p>`}
      </div>
      <h2 class="sg-section-title">Approval Timeline</h2>
      <div class="sg-timeline no-grow">
        ${submission.approvals.length ? submission.approvals.slice().reverse().map((a) => `
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
      </div>
    `;

    document.querySelectorAll("#subActions button[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          if (btn.dataset.act === "review") { startReview(submission.id, user.name, user.businessRole); toast("Submission updated", "success"); draw(); return; }
          if (btn.dataset.act === "approve") {
            const c = await promptComment("Approve");
            if (c === null) return;
            approveSubmission(submission.id, user.name, user.businessRole, c);
          }
          if (btn.dataset.act === "reject") {
            const c = await promptComment("Reject");
            if (c === null) return;
            rejectSubmission(submission.id, user.name, user.businessRole, c);
          }
          toast("Submission updated", "success");
          draw();
        } catch (err) { toast(err.message, "error"); }
      });
    });
  }

  function promptComment(label) {
    return new Promise((resolve) => {
      openModal({
        title: `${label} — comments`,
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

  draw();
}

function formatValue(v) {
  if (v === true) return "Yes";
  if (v === false) return "No";
  if (v === undefined || v === null || v === "") return "—";
  return v;
}
