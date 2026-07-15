import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import {
  listAllForms, getForm, getFormSchema, saveFormSchema, restoreFormSchemaVersion, createCatalogEntry, updateCatalogEntry,
  setFormActive, duplicateForm, importForms, linkedDeliverablesFor,
  FIELD_TYPES, CONTROL_FIELD_TYPES, VALIDATABLE_TYPES, FORM_STATUS_OPTIONS, stages, CATEGORIES,
} from "../store/forms.js";
import {
  listSubmissions, getSubmission, saveDraft, submitSubmission, startReview, approveSubmission, rejectSubmission,
} from "../store/formSubmissions.js";
import { listProjects } from "../store/projectExecution.js";
import { listDeliverables } from "../store/deliverables.js";
import {
  escapeHtml, fmtDateTime, relTime, statusPillClass, openModal, openDrawer, confirmDialog, toast, uid,
  wireResizableSplit, paginate, paginationHtml, wirePagination, sortList, sortableTh, wireSortableTh, iconBtn, ICONS,
} from "../utils.js";
import { navigate, registerUnsavedGuard } from "../router.js";

const PAGE_SIZE = 15;

// Form Builder panel widths — a UI preference, not a data-model entity, so it's kept as its own
// isolated localStorage key rather than routed through store/db.js's ENTITY_KEYS registry.
const PANEL_WIDTHS_KEY = "spd.form_builder_panel_widths.v1";
function loadPanelWidths() {
  try { return JSON.parse(localStorage.getItem(PANEL_WIDTHS_KEY)) || {}; } catch { return {}; }
}
function savePanelWidths(widths) {
  localStorage.setItem(PANEL_WIDTHS_KEY, JSON.stringify(widths));
}

const FIELD_TYPE_LABELS = {
  text: "Text", textarea: "Text Area", number: "Number", date: "Date", select: "Dropdown",
  checkbox: "Checkbox", radio: "Radio", attachment: "Attachment", table: "Table",
  signature: "Signature", section: "Section", instruction: "Instruction",
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
  // Admin (System Administrator) never fills forms — Forms Library is a template-management
  // surface for Admin; filling/submitting is real day-to-day work for PMO/R&D/Finance/Engineer,
  // who keep their normal form.submission.fill permission untouched.
  const canFill = can(user.businessRole, "form.submission.fill") && user.businessRole !== "System Administrator";
  const state = { gateCode: "", formCategory: "", active: "", q: "", page: 1, sortKey: "", sortDir: "asc" };

  function draw() {
    let forms = listAllForms({
      gateCode: state.gateCode || undefined, formCategory: state.formCategory || undefined,
      active: state.active === "" ? undefined : state.active === "true", q: state.q || undefined,
    });
    forms = sortList(forms, state.sortKey, state.sortDir);
    const all = listAllForms();
    const mySubmissions = listSubmissions({ filledBy: user.name }).slice(0, 8);
    const { pageItems, totalPages, page, total } = paginate(forms, state.page, PAGE_SIZE);

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <h1>Forms Library</h1>
        <div class="sg-header-actions">
          ${canManageLib ? `<button class="btn btn-ghost" id="btnImportForms">Import</button>` : ""}
          ${canBuild ? `<button class="btn btn-primary" id="btnNewForm">+ Build Form</button>` : ""}
        </div>
      </div>
      <div class="sg-kpi-filter-row">
        <div class="sg-kpi-strip compact">
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-blue">${ICONS.list}</span><div><div class="sg-kpi-label">Total</div><div class="sg-kpi-value">${all.length}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-green">${ICONS.check}</span><div><div class="sg-kpi-label">Active</div><div class="sg-kpi-value">${all.filter((f) => f.active).length}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-amber">${ICONS.edit}</span><div><div class="sg-kpi-label">Built</div><div class="sg-kpi-value">${all.filter((f) => f.built).length}</div></div></div>
        </div>
        <div class="sg-toolbar sg-toolbar-flex">
          <select id="fltStage"><option value="">All Stages</option>${stages().map((s) => `<option value="${s}" ${state.gateCode === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <select id="fltCategory"><option value="">All Categories</option>${CATEGORIES.map((c) => `<option value="${escapeHtml(c)}" ${state.formCategory === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select>
          <select id="fltActive"><option value="">Active + Archived</option><option value="true" ${state.active === "true" ? "selected" : ""}>Active only</option><option value="false" ${state.active === "false" ? "selected" : ""}>Archived only</option></select>
          <input type="search" id="fltSearch" placeholder="Search forms…" value="${escapeHtml(state.q)}" />
        </div>
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table">
          <thead><tr>
            ${sortableTh("Code", "formCode", state)}${sortableTh("Name", "formName", state)}${sortableTh("Category", "formCategory", state)}${sortableTh("Stage", "gateCode", state)}<th>Version</th><th>Fields</th><th>Linked Deliverables</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${pageItems.length ? pageItems.map((f) => `
              <tr class="${f.active ? "" : "sg-row-muted"}">
                <td class="sg-link-text" data-act="build" data-code="${escapeHtml(f.formCode)}">${escapeHtml(f.formCode)}</td>
                <td>${escapeHtml(f.formName)}</td>
                <td>${escapeHtml(f.formCategory)}</td>
                <td>${escapeHtml(f.gateCode)}</td>
                <td>${f.built ? `v${escapeHtml(f.version)}` : "—"}</td>
                <td>${f.built ? f.fieldCount : `<span class="pill pill-slate">Not built</span>`}</td>
                <td>${linkedDeliverablesFor(f.formCode).length}</td>
                <td><span class="pill ${f.active ? "pill-green" : "pill-slate"}">${f.active ? "Active" : "Archived"}</span></td>
                <td class="sg-row-actions">
                  ${f.built ? iconBtn("view", { act: "preview", id: f.formCode, title: "View form" }) : ""}
                  ${canFill && f.built ? `<a class="sg-icon-btn" href="#/forms/fill/${encodeURIComponent(f.formCode)}" title="Fill form">${ICONS.external}</a>` : ""}
                  ${canBuild ? `<a class="sg-icon-btn" href="#/form-builder?code=${encodeURIComponent(f.formCode)}" title="${f.built ? "Edit" : "Build"} form">${ICONS.edit}</a>` : ""}
                  ${canBuild && f.built ? iconBtn("clone", { act: "duplicate", id: f.formCode, title: "Duplicate form" }) : ""}
                  ${canManageLib ? iconBtn("archive", { act: "archive", id: f.formCode, title: f.active ? "Archive form" : "Unarchive form" }) : ""}
                </td>
              </tr>
            `).join("") : `<tr><td colspan="9" class="sg-empty-cell">No forms match your filters.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${paginationHtml(page, totalPages, total, PAGE_SIZE)}

      ${canFill ? `
        <h2 class="sg-section-title">My Submissions</h2>
        <div class="sg-table-wrap" style="flex:none;max-height:220px">
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
      ` : ""}
    `;

    document.getElementById("fltStage").addEventListener("change", (e) => { state.gateCode = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltCategory").addEventListener("change", (e) => { state.formCategory = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltActive").addEventListener("change", (e) => { state.active = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltSearch").addEventListener("input", (e) => { state.q = e.target.value; state.page = 1; draw(); });
    wirePagination(contentEl(), (p) => { state.page = p; draw(); });
    wireSortableTh(contentEl(), state, draw);
    document.querySelectorAll('[data-act="build"]').forEach((el) => {
      el.addEventListener("click", () => navigate(`/form-builder?code=${encodeURIComponent(el.dataset.code)}`));
    });
    document.querySelectorAll('button[data-act="archive"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const f = getForm(btn.dataset.id);
        setFormActive(f.formCode, !f.active, user.name, user.businessRole);
        toast(f.active ? "Form archived" : "Form unarchived", "success");
        draw();
      });
    });
    document.querySelectorAll('button[data-act="duplicate"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const copy = duplicateForm(btn.dataset.id, user.name, user.businessRole);
        toast(`Duplicated as ${copy.formCode}`, "success");
        draw();
      });
    });
    document.querySelectorAll('button[data-act="preview"]').forEach((btn) => {
      btn.addEventListener("click", () => openViewFormDrawer(getForm(btn.dataset.id)));
    });
    document.querySelectorAll(".sg-row-clickable[data-id]").forEach((row) => {
      row.addEventListener("click", (e) => { if (e.target.tagName !== "A") navigate(`/forms/submission/${row.dataset.id}`); });
    });
    document.getElementById("btnImportForms")?.addEventListener("click", () => openImportModal(draw));
    document.getElementById("btnNewForm")?.addEventListener("click", () => openNewFormModal());
  }

  draw();
}

// "View Form" — Admin never fills a form, only ever looks at its structure. Read-only drawer,
// no isDirty guard needed.
function openViewFormDrawer(form) {
  openDrawer({
    title: `View Form — ${form.formCode}`,
    width: "70%",
    bodyHtml: `
      <div class="sg-form-preview">
        ${form.sections.length ? form.sections.map((sec) => `
          <fieldset class="sg-preview-section">
            <legend>${escapeHtml(sec.title)}</legend>
            <div class="sg-preview-grid">${sec.fields.map((f) => `<div class="sg-preview-field span-${f.span || 2}">${renderFieldInput(f, {}, [])}</div>`).join("") || `<p class="sg-subtle">No fields.</p>`}</div>
          </fieldset>
        `).join("") : `<p class="sg-subtle">This form hasn't been built yet.</p>`}
      </div>
    `,
    footerHtml: `<button class="btn btn-primary" data-act="close">Close</button>`,
    onMount: (backdrop, close) => backdrop.querySelector('[data-act="close"]').addEventListener("click", close),
  });
}

function openNewFormModal() {
  const user = getActiveUser();
  openDrawer({
    title: "New Form",
    width: "50%",
    bodyHtml: `
      <div class="sg-form-grid">
        <label class="span-2">Form Name<input type="text" id="nfName" required /></label>
        <label class="span-2">Description<textarea id="nfDesc" rows="2"></textarea></label>
        <label>Stage<select id="nfStage">${stages().map((s) => `<option value="${s}">${s}</option>`).join("")}</select></label>
        <label>Category<input type="text" id="nfCategory" value="General" /></label>
      </div>
    `,
    footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Create &amp; Build</button>`,
    onMount: (backdrop, close, requestClose) => {
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", requestClose);
      backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
        const formName = document.getElementById("nfName").value.trim();
        if (!formName) { toast("Form name is required.", "error"); return; }
        const entry = createCatalogEntry({
          formName, description: document.getElementById("nfDesc").value.trim(),
          gateCode: document.getElementById("nfStage").value, formCategory: document.getElementById("nfCategory").value.trim(),
        }, user.name, user.businessRole);
        close();
        navigate(`/form-builder?code=${encodeURIComponent(entry.formCode)}`);
      });
    },
  });
}

function openImportModal(onDone) {
  const user = getActiveUser();
  openModal({
    title: "Import Form Library Entries",
    bodyHtml: `
      <p class="sg-subtle">Upload CSV or JSON. Keys: formCode, formName, description, gateCode, formCategory, estimatedCompletionTime, active. This imports catalog metadata only — build each form's fields via the Form Builder.</p>
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
  // "form-builder" is reachable only via Forms Library's "Build"/"Edit" links — no persistent tab
  // of its own, so keep Forms Library highlighted while here.
  setActiveMenu("forms");

  const catalogEntry = getForm(query.code);
  if (!catalogEntry) {
    contentEl().innerHTML = `<div class="sg-empty-state">Form not found in the library. <button type="button" class="sg-link-text" id="btnFormBuilderBack">Go back</button></div>`;
    document.getElementById("btnFormBuilderBack")?.addEventListener("click", () => goBack("#/forms"));
    return;
  }
  const existingSchema = getFormSchema(catalogEntry.formCode);
  const originalSectionsJson = existingSchema ? JSON.stringify(existingSchema.sections) : JSON.stringify([]);
  const state = {
    code: catalogEntry.formCode,
    sections: existingSchema ? JSON.parse(JSON.stringify(existingSchema.sections)) : [{ id: uid("sec"), title: "Section 1", fields: [] }],
    status: existingSchema?.status || "Draft",
    changeSummary: "",
    selectedFieldId: null,
    preview: false,
    showHistory: false,
  };

  function isDirty() {
    return JSON.stringify(state.sections) !== originalSectionsJson;
  }
  function persistForm() {
    if (!state.sections.some((s) => s.fields.length)) { toast("Add at least one field before saving.", "error"); return false; }
    const saved = saveFormSchema(state.code, state.sections, user.name, user.businessRole, {
      status: state.status, changeSummary: state.changeSummary.trim(),
    });
    toast(`Form ${state.code} saved as v${saved.version}`, "success");
    return true;
  }
  registerUnsavedGuard({ isDirty, onSave: async () => persistForm() });

  function findField(fieldId) {
    for (const sec of state.sections) {
      const f = sec.fields.find((x) => x.id === fieldId);
      if (f) return { section: sec, field: f };
    }
    return null;
  }
  function allFieldsFlat() {
    return state.sections.flatMap((s) => s.fields);
  }

  function draw() {
    contentEl().innerHTML = `
      <p class="sg-subtle" style="margin:0 0 var(--space-6)"><a href="#/forms" class="sg-link-text">Forms Library</a> / ${escapeHtml(state.code)}</p>
      <div class="sg-page-header">
        <div>
          <button class="btn btn-ghost btn-sm" id="btnBackToForms" style="margin-bottom:var(--space-8)">← Back to Forms Library</button>
          <h1>${escapeHtml(catalogEntry.formName)} <span class="sg-subtle">(${escapeHtml(state.code)})</span></h1>
          <p class="sg-subtle">${escapeHtml(catalogEntry.gateCode)} · ${escapeHtml(catalogEntry.formCategory)} ${existingSchema ? `· v${escapeHtml(existingSchema.version)}` : "· not yet built"}</p>
        </div>
        <div class="sg-header-actions">
          <select id="fbStatus" title="Status this save will carry">${FORM_STATUS_OPTIONS.map((s) => `<option value="${s}" ${state.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <input type="text" id="fbChangeSummary" placeholder="Change summary (optional)" value="${escapeHtml(state.changeSummary)}" style="width:220px" />
          <button class="btn btn-ghost" id="btnHistory">Version History</button>
          <button class="btn btn-ghost" id="btnTogglePreview">${state.preview ? "Back to Editor" : "Live Preview"}</button>
          <button class="btn btn-primary" id="btnSaveForm">Save Form</button>
        </div>
      </div>
      ${state.preview ? renderPreview() : renderEditor()}
    `;

    document.getElementById("btnBackToForms").addEventListener("click", () => goBack("#/forms"));
    document.getElementById("fbStatus").addEventListener("change", (e) => { state.status = e.target.value; });
    document.getElementById("fbChangeSummary").addEventListener("input", (e) => { state.changeSummary = e.target.value; });
    document.getElementById("btnTogglePreview").addEventListener("click", () => { state.preview = !state.preview; draw(); });
    // A restore writes a brand-new version to the store — re-entering renderFormBuilder (not
    // just draw()) so state.sections/existingSchema are re-read fresh instead of staying pinned
    // to whatever was loaded when this route first rendered.
    document.getElementById("btnHistory").addEventListener("click", () => openHistoryDrawer(catalogEntry.formCode, () => renderFormBuilder(params, query)));
    document.getElementById("btnSaveForm").addEventListener("click", () => {
      if (persistForm()) navigate("/forms");
    });

    if (!state.preview) wireEditorEvents();
  }

  function renderEditor() {
    const selected = state.selectedFieldId ? findField(state.selectedFieldId) : null;
    const widths = loadPanelWidths();
    return `
      <div class="sg-builder-layout" id="builderLayout">
        <div class="sg-builder-palette" id="builderPalette" ${widths.palette ? `style="flex:0 0 ${widths.palette}px"` : ""}>
          <h3>Field Palette</h3>
          <p class="sg-subtle">Drag a field type into a section.</p>
          ${CONTROL_FIELD_TYPES.map((t) => `<div class="sg-palette-item" draggable="true" data-type="${t}">${FIELD_TYPE_LABELS[t]}</div>`).join("")}
          <button class="btn btn-ghost btn-sm sg-add-section" id="btnAddSection">+ Add Section</button>
        </div>
        <div class="sg-builder-split" id="builderSplitLeft"></div>
        <div class="sg-builder-canvas" id="builderCanvas" ${widths.canvas ? `style="flex:0 0 ${widths.canvas}px"` : ""}>
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
                    <span class="sg-builder-field-label">${escapeHtml(f.label)}${f.required ? " *" : ""}${f.readOnly ? " 🔒" : ""}${f.visibleIf ? " 👁" : ""}</span>
                    <button class="sg-builder-field-remove" data-act="delete-field" data-field="${f.id}" title="Remove">✕</button>
                  </div>
                `).join("") : `<div class="sg-builder-dropzone-empty">Drop fields here</div>`}
              </div>
            </div>
          `).join("")}
        </div>
        <div class="sg-builder-split" id="builderSplit"></div>
        <div class="sg-builder-inspector" id="builderInspector">
          <h3>Field Inspector</h3>
          ${selected ? renderInspector(selected.field) : `<p class="sg-subtle">Select a field to edit its properties.</p>`}
        </div>
      </div>
    `;
  }

  function renderInspector(field) {
    const otherFields = allFieldsFlat().filter((f) => f.id !== field.id && f.type !== "instruction" && f.type !== "section");
    const isInstruction = field.type === "instruction";
    return `
      <div class="sg-form-grid one-col">
        <label>${isInstruction ? "Instruction Text" : "Label"}<input type="text" id="insLabel" value="${escapeHtml(field.label)}" /></label>
        ${!isInstruction ? `<label>Placeholder<input type="text" id="insPlaceholder" value="${escapeHtml(field.placeholder || "")}" /></label>` : ""}
        <label>Hint<input type="text" id="insHint" value="${escapeHtml(field.hint || "")}" /></label>
        <label>Span (1-4)<input type="number" id="insSpan" min="1" max="4" value="${field.span || 2}" /></label>
        ${!isInstruction ? `
          <label class="sg-check-inline"><input type="checkbox" id="insRequired" ${field.required ? "checked" : ""} /> Required</label>
          <label class="sg-check-inline"><input type="checkbox" id="insReadOnly" ${field.readOnly ? "checked" : ""} /> Read Only</label>
        ` : ""}
        ${["select", "radio"].includes(field.type) ? `<label>Options (comma-separated)<input type="text" id="insOptions" value="${escapeHtml((field.options || []).join(", "))}" /></label>` : ""}
        ${field.type === "table" ? `<label>Columns (comma-separated)<input type="text" id="insColumns" value="${escapeHtml((field.columns || []).join(", "))}" /></label>` : ""}
        ${VALIDATABLE_TYPES.includes(field.type) ? `
          <label>Validation Regex<input type="text" id="insRegex" value="${escapeHtml(field.validationRegex || "")}" placeholder="e.g. ^[0-9]{6}$" /></label>
          <label>Validation Message<input type="text" id="insRegexMsg" value="${escapeHtml(field.validationMessage || "")}" placeholder="Shown when the pattern doesn't match" /></label>
        ` : ""}
        ${!isInstruction ? `
          <h4 style="margin:8px 0 2px">Conditional Visibility</h4>
          <label>Show only if field<select id="insVisField"><option value="">— always visible —</option>${otherFields.map((f) => `<option value="${escapeHtml(f.id)}" ${field.visibleIf?.fieldId === f.id ? "selected" : ""}>${escapeHtml(f.label)}</option>`).join("")}</select></label>
          <label>Equals value<input type="text" id="insVisValue" value="${escapeHtml(field.visibleIf?.value || "")}" /></label>
        ` : ""}
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
              ${sec.fields.map((f) => `<div class="sg-preview-field span-${f.span || 2}">${renderFieldInput(f, {}, allFieldsFlat())}</div>`).join("") || `<p class="sg-subtle">No fields in this section.</p>`}
            </div>
          </fieldset>
        `).join("")}
      </div>
    `;
  }

  function wireEditorEvents() {
    const layout = document.getElementById("builderLayout");
    const palette = document.getElementById("builderPalette");
    const canvas = document.getElementById("builderCanvas");
    const inspector = document.getElementById("builderInspector");
    const splitLeft = document.getElementById("builderSplitLeft");
    const splitRight = document.getElementById("builderSplit");
    // Two independent dividers — palette↔canvas and canvas↔inspector — both persisted so the
    // layout survives a reload instead of resetting to the CSS defaults every time.
    if (layout && palette && splitLeft) {
      wireResizableSplit(layout, palette, splitLeft, 150, 300, (width) => {
        savePanelWidths({ ...loadPanelWidths(), palette: Math.round(width) });
      });
    }
    if (layout && inspector && splitRight) {
      wireResizableSplit(layout, canvas, splitRight, 320, 220, (width) => {
        savePanelWidths({ ...loadPanelWidths(), canvas: Math.round(width) });
      });
    }

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
      btn.addEventListener("click", () => { state.sections = state.sections.filter((s) => s.id !== btn.dataset.section); draw(); });
    });

    document.querySelectorAll('[data-act="delete-field"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.sections.forEach((s) => { s.fields = s.fields.filter((f) => f.id !== btn.dataset.field); });
        if (state.selectedFieldId === btn.dataset.field) state.selectedFieldId = null;
        draw();
      });
    });

    document.querySelectorAll(".sg-builder-field").forEach((el) => {
      el.addEventListener("click", () => { state.selectedFieldId = el.dataset.field; draw(); });
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
        if (!CONTROL_FIELD_TYPES.includes(type)) return;
        const sec = state.sections.find((s) => s.id === zone.dataset.section);
        const field = {
          id: uid("fld"), type, label: FIELD_TYPE_LABELS[type], placeholder: "", required: false, readOnly: false,
          options: ["select", "radio"].includes(type) ? ["Option 1", "Option 2"] : undefined,
          columns: type === "table" ? ["Column 1", "Column 2"] : undefined,
          span: 2, hint: "", visibleIf: null, validationRegex: "", validationMessage: "",
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
      bind("insRegex", "validationRegex");
      bind("insRegexMsg", "validationMessage");
      const reqEl = document.getElementById("insRequired");
      if (reqEl) reqEl.addEventListener("change", () => { field.required = reqEl.checked; });
      const roEl = document.getElementById("insReadOnly");
      if (roEl) roEl.addEventListener("change", () => { field.readOnly = roEl.checked; });
      const optEl = document.getElementById("insOptions");
      if (optEl) optEl.addEventListener("input", () => { field.options = optEl.value.split(",").map((s) => s.trim()).filter(Boolean); });
      const colEl = document.getElementById("insColumns");
      if (colEl) colEl.addEventListener("input", () => { field.columns = colEl.value.split(",").map((s) => s.trim()).filter(Boolean); });
      const visFieldEl = document.getElementById("insVisField");
      const visValueEl = document.getElementById("insVisValue");
      const syncVisibility = () => {
        const fieldId = visFieldEl?.value || "";
        field.visibleIf = fieldId ? { fieldId, value: visValueEl.value } : null;
      };
      if (visFieldEl) visFieldEl.addEventListener("change", syncVisibility);
      if (visValueEl) visValueEl.addEventListener("input", syncVisibility);
    }
  }

  draw();
}

// Version History — read-only view (no isDirty guard) except for the Restore action, which
// writes a brand-new version and re-draws the caller (the builder) so it picks up the restored
// sections immediately.
function openHistoryDrawer(formCode, onRestored) {
  const user = getActiveUser();
  const schema = getFormSchema(formCode);
  const history = schema?.versionHistory || [];
  const { close } = openDrawer({
    title: `Version History — ${formCode}`,
    width: "55%",
    bodyHtml: history.length ? `
      <div class="sg-timeline no-grow">
        ${history.slice().reverse().map((h) => `
          <div class="sg-timeline-item">
            <div class="sg-timeline-dot ${statusPillClass(h.status || "Draft")}"></div>
            <div class="sg-timeline-body">
              <div class="sg-timeline-title">v${escapeHtml(h.version)} <span class="pill ${statusPillClass(h.status || "Draft")}">${escapeHtml(h.status || "Draft")}</span></div>
              <div class="sg-timeline-time">${escapeHtml(h.savedBy)} · ${fmtDateTime(h.savedAt)}</div>
              ${h.changeSummary ? `<div class="sg-timeline-comments">${escapeHtml(h.changeSummary)}</div>` : ""}
              ${h.sections ? `<button type="button" class="btn btn-ghost btn-sm" data-act="restore" data-version="${escapeHtml(h.version)}" style="margin-top:var(--space-8)">${ICONS.reset} Restore this version</button>` : `<p class="sg-subtle" style="margin:var(--space-4) 0 0">No snapshot to restore (saved before Restore Version existed).</p>`}
            </div>
          </div>
        `).join("")}
      </div>
    ` : `<p class="sg-subtle">No versions saved yet.</p>`,
    footerHtml: `<button class="btn btn-primary" data-act="close">Close</button>`,
    onMount: (backdrop, closeDrawer) => {
      backdrop.querySelector('[data-act="close"]').addEventListener("click", closeDrawer);
      backdrop.querySelectorAll('[data-act="restore"]').forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!(await confirmDialog(`Restore v${btn.dataset.version}? This creates a new version copying that snapshot — history is never overwritten.`))) return;
          const restored = restoreFormSchemaVersion(formCode, btn.dataset.version, user.name, user.businessRole);
          toast(`Restored v${btn.dataset.version} as new v${restored.version}`, "success");
          closeDrawer();
          onRestored?.();
        });
      });
    },
  });
}

// ============================== FIELD RENDERING (shared by preview + fill) ==============================
function renderFieldInput(field, values, allFields) {
  if (field.type === "instruction") {
    return `<div class="sg-instruction-block">${escapeHtml(field.label)}${field.hint ? `<div class="sg-field-hint">${escapeHtml(field.hint)}</div>` : ""}</div>`;
  }
  const val = values[field.id] ?? "";
  const req = field.required ? "required" : "";
  const ro = field.readOnly ? "disabled" : "";
  const pattern = field.validationRegex ? `pattern="${escapeHtml(field.validationRegex)}" title="${escapeHtml(field.validationMessage || "Invalid format")}"` : "";
  const visAttr = field.visibleIf ? `data-visible-if-field="${escapeHtml(field.visibleIf.fieldId)}" data-visible-if-value="${escapeHtml(field.visibleIf.value)}"` : "";
  const common = `id="field_${field.id}" name="${field.id}" ${req} ${ro} ${pattern}`;
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
        <label class="sg-radio-opt"><input type="radio" name="${field.id}" value="${escapeHtml(o)}" ${val === o ? "checked" : ""} ${ro} /> ${escapeHtml(o)}</label>
      `).join("");
      break;
    case "checkbox":
      control = `<label class="sg-check-inline"><input type="checkbox" ${common} ${val ? "checked" : ""} /> ${escapeHtml(field.hint || "Yes")}</label>`;
      break;
    case "attachment":
      control = `<input type="file" ${common} /><div class="sg-field-hint">Simulated — no file storage in this demo.</div>`;
      break;
    case "signature":
      control = `<input type="text" ${common} class="sg-signature-pad" placeholder="Type your full name to sign" value="${escapeHtml(val)}" />`;
      break;
    case "table":
      control = renderTableField(field, values[field.id] || [{}]);
      break;
    default:
      control = `<input type="${field.type}" ${common} placeholder="${escapeHtml(field.placeholder || "")}" value="${escapeHtml(val)}" />`;
  }
  return `
    <div class="sg-preview-field-wrap" ${visAttr}>
      <label class="sg-field-label">${escapeHtml(field.label)}${field.required ? " *" : ""}${field.readOnly ? " 🔒" : ""}
        ${field.type !== "checkbox" && field.type !== "table" ? control : ""}
      </label>
      ${field.type === "table" ? control : ""}
      ${field.hint && !["checkbox", "table"].includes(field.type) ? `<span class="sg-field-hint">${escapeHtml(field.hint)}</span>` : ""}
    </div>
  `;
}

function renderTableField(field, rows) {
  const cols = field.columns || [];
  return `
    <div class="sg-table-field" data-table="${field.id}">
      <table class="sg-table sg-table-compact">
        <thead><tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}<th></th></tr></thead>
        <tbody>
          ${rows.map((row, ri) => `<tr>${cols.map((c) => `<td><input type="text" data-table-cell="${field.id}" data-row="${ri}" data-col="${escapeHtml(c)}" value="${escapeHtml(row[c] || "")}" ${field.readOnly ? "disabled" : ""} /></td>`).join("")}<td>${ri === rows.length - 1 && !field.readOnly ? `<button type="button" class="btn btn-ghost btn-sm" data-table-addrow="${field.id}">+ Row</button>` : ""}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function wireConditionalVisibility(root) {
  const evaluate = () => {
    root.querySelectorAll("[data-visible-if-field]").forEach((wrap) => {
      const fieldId = wrap.dataset.visibleIfField;
      const expected = wrap.dataset.visibleIfValue;
      const source = root.querySelector(`#field_${fieldId}`) || root.querySelector(`input[name="${fieldId}"]:checked`);
      const actual = source ? (source.type === "checkbox" ? String(source.checked) : source.value) : "";
      wrap.hidden = actual !== expected;
    });
  };
  root.addEventListener("input", evaluate);
  root.addEventListener("change", evaluate);
  evaluate();
}

function wireTableFields(root) {
  root.querySelectorAll("[data-table-addrow]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const table = btn.closest(".sg-table-field");
      const cols = Array.from(table.querySelectorAll("thead th")).slice(0, -1).map((th) => th.textContent);
      const tbody = table.querySelector("tbody");
      const rowIdx = tbody.querySelectorAll("tr").length;
      const tr = document.createElement("tr");
      tr.innerHTML = cols.map((c) => `<td><input type="text" data-table-cell="${btn.dataset.tableAddrow}" data-row="${rowIdx}" data-col="${escapeHtml(c)}" /></td>`).join("") + `<td></td>`;
      const lastRow = tbody.querySelector("tr:last-child");
      lastRow.querySelector("td:last-child").innerHTML = "";
      tbody.appendChild(tr);
      tr.querySelector("td:last-child").innerHTML = `<button type="button" class="btn btn-ghost btn-sm" data-table-addrow="${btn.dataset.tableAddrow}">+ Row</button>`;
      wireTableFields(root);
    });
  });
}

function readFieldValue(field, root) {
  if (field.type === "instruction") return undefined;
  if (field.type === "checkbox") return !!root.querySelector(`#field_${field.id}`)?.checked;
  if (field.type === "radio") return root.querySelector(`input[name="${field.id}"]:checked`)?.value || "";
  if (field.type === "table") {
    const cells = Array.from(root.querySelectorAll(`[data-table-cell="${field.id}"]`));
    const rows = {};
    cells.forEach((cell) => {
      const r = cell.dataset.row;
      rows[r] = rows[r] || {};
      rows[r][cell.dataset.col] = cell.value;
    });
    return Object.values(rows);
  }
  return root.querySelector(`#field_${field.id}`)?.value || "";
}

// ============================== FILL ==============================
export async function renderFormFill(params, query) {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setActiveMenu("forms");

  const form = getForm(params.code);
  if (!form || !form.sections.length) {
    contentEl().innerHTML = `<div class="sg-empty-state">Form not found or not yet built. <button type="button" class="sg-link-text" id="btnFormFillNotFoundBack">Go back</button></div>`;
    document.getElementById("btnFormFillNotFoundBack")?.addEventListener("click", () => goBack("#/forms"));
    return;
  }
  setBreadcrumb(`Forms Library / ${form.formCode} / Fill`);

  let draft = query.id ? getSubmission(query.id) : null;
  if (draft && draft.status !== "Draft") draft = null;

  const projects = listProjects().map((p) => p.code);
  const deliverables = listDeliverables();
  const allFields = form.sections.flatMap((s) => s.fields);

  contentEl().innerHTML = `
    <p class="sg-subtle" style="margin:0 0 var(--space-6)"><a href="#/forms" class="sg-link-text">Forms Library</a> / ${escapeHtml(form.formCode)} / Fill</p>
    <div class="sg-page-header">
      <div>
        <button class="btn btn-ghost btn-sm" id="btnBackFill" style="margin-bottom:var(--space-8)">← Back to Forms Library</button>
        <h1>${escapeHtml(form.formName)}</h1>
        <p class="sg-subtle">${escapeHtml(form.formCode)} · ${escapeHtml(form.formCategory)} · Stage ${escapeHtml(form.gateCode)}</p>
      </div>
    </div>
    <form id="fillForm" class="sg-form-preview adm-scroll">
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
              <select id="ctxDeliverable"><option value="">None</option>${deliverables.map((d) => `<option value="${escapeHtml(d.deliverableNo)}" ${draft?.deliverableNo === d.deliverableNo ? "selected" : ""}>${escapeHtml(d.deliverableNo)} — ${escapeHtml(d.deliverableName)}</option>`).join("")}</select>
            </label>
          </div>
        </div>
      </fieldset>
      ${form.sections.map((sec) => `
        <fieldset class="sg-preview-section">
          <legend>${escapeHtml(sec.title)}</legend>
          <div class="sg-preview-grid">
            ${sec.fields.map((f) => renderFieldInput(f, draft?.values || {}, allFields)).join("")}
          </div>
        </fieldset>
      `).join("")}
      <div class="sg-form-actions">
        <button type="button" class="btn btn-ghost" id="btnSaveDraft">Save Draft</button>
        <button type="submit" class="btn btn-primary" id="btnSubmitForm">Submit</button>
      </div>
    </form>
  `;

  document.getElementById("btnBackFill").addEventListener("click", () => goBack("#/forms"));

  const formEl = document.getElementById("fillForm");
  wireConditionalVisibility(formEl);
  wireTableFields(formEl);

  function collectValues() {
    const values = {};
    allFields.forEach((f) => { const v = readFieldValue(f, formEl); if (v !== undefined) values[f.id] = v; });
    return values;
  }

  function validateForm(values) {
    const missing = allFields.filter((f) => f.required && f.type !== "instruction" && !String(values[f.id] ?? "").trim());
    if (missing.length) return `Please complete required field: ${missing[0].label}`;
    for (const f of allFields) {
      if (f.validationRegex && values[f.id]) {
        try {
          if (!new RegExp(f.validationRegex).test(String(values[f.id]))) return f.validationMessage || `"${f.label}" doesn't match the required format.`;
        } catch { /* invalid regex authored — skip, don't block filling */ }
      }
    }
    return null;
  }

  document.getElementById("btnSaveDraft").addEventListener("click", () => {
    const saved = saveDraft({
      id: draft?.id, formCode: form.formCode,
      projectCode: document.getElementById("ctxProject").value,
      deliverableNo: document.getElementById("ctxDeliverable").value,
      values: collectValues(),
    }, user.name, user.businessRole);
    draft = saved;
    toast("Draft saved", "success");
    navigate(`/forms/fill/${encodeURIComponent(form.formCode)}?id=${saved.id}`);
  });

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const values = collectValues();
    const error = validateForm(values);
    if (error) { toast(error, "error"); return; }
    const saved = saveDraft({
      id: draft?.id, formCode: form.formCode,
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
      contentEl().innerHTML = `<div class="sg-empty-state">Submission not found. <button type="button" class="sg-link-text" id="btnSubmissionNotFoundBack">Go back</button></div>`;
      document.getElementById("btnSubmissionNotFoundBack")?.addEventListener("click", () => goBack("#/forms"));
      return;
    }
    const form = getForm(submission.formCode);
    setBreadcrumb(`Forms Library / ${submission.formCode} / Submission`);
    const allFields = form ? form.sections.flatMap((s) => s.fields) : [];
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
      <p class="sg-subtle" style="margin:0 0 var(--space-6)"><a href="#/forms" class="sg-link-text">Forms Library</a> / ${escapeHtml(submission.formCode)} / Submission</p>
      <div class="sg-page-header">
        <div>
          <button class="btn btn-ghost btn-sm" id="btnBackSubmission" style="margin-bottom:var(--space-8)">← Back to Forms Library</button>
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
        ${allFields.filter((f) => f.type !== "instruction").map((f) => `<div class="sg-detail-card"><div class="sg-kpi-label">${escapeHtml(f.label)}</div>${escapeHtml(formatValue(submission.values[f.id]))}</div>`).join("") || `<p class="sg-subtle">No field schema available.</p>`}
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

    document.getElementById("btnBackSubmission").addEventListener("click", () => goBack("#/forms"));
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
  if (Array.isArray(v)) return v.length ? `${v.length} row(s)` : "—";
  if (v === undefined || v === null || v === "") return "—";
  return v;
}
