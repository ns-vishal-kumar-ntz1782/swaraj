import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import {
  listDeliverables, updateDeliverable, createDeliverable,
  bulkImport, stages, CATEGORIES, DEPARTMENTS, listFormOptions,
  topLevelOptionsFor, hierarchyLabels,
} from "../store/deliverables.js";
import { listTemplates } from "../store/projectTemplateAdmin.js";
import { listAuditEntries } from "../store/audit.js";
import {
  escapeHtml, openModal, openDrawer, toast, paginate, paginationHtml, wirePagination,
  sortList, sortableTh, wireSortableTh, iconBtn, ICONS, fmtDateTime, relTime,
} from "../utils.js";
import { navigate } from "../router.js";

const PAGE_SIZE = 15;

// ============================== LIBRARY — the only Deliverable Library view; everything
// (create, edit, link a form) happens inline here via modals/inline controls, never a
// separate detail page. ==============================
export async function renderDeliverableLibrary() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Deliverable Library");
  setActiveMenu("deliverables");

  const canManage = can(user.businessRole, "deliverable.library.manage");
  const canCreate = can(user.businessRole, "deliverable.create") || canManage;
  // Default sort is the hierarchy sequence itself (1, 1.1, 1.2, 2…) so children land directly
  // under their parent out of the box, without having to click the column header first.
  const state = { gateCode: "", active: "", q: "", page: 1, sortKey: "_hier", sortDir: "asc" };
  // Linked-form changes are staged here (deliverableNo -> new formCode) and only written to the
  // store when "Save Changes" is clicked, same pattern as Gate Master's order.
  const pendingLinks = {};

  function draw() {
    let list = listDeliverables({
      gateCode: state.gateCode || undefined,
      active: state.active === "" ? undefined : state.active === "true",
      q: state.q || undefined,
    });
    const hierLabels = hierarchyLabels();
    const gateOrder = stages();
    // "_hier" isn't a real stored field — it's a composite of (gate pipeline order, hierarchy
    // label), so gates stay grouped in Pre-KO→…→PPO order and children land right after their
    // parent within each gate, rather than every gate's "1" tying together across the whole list.
    list = sortList(list, state.sortKey, state.sortDir, (item, key) => {
      if (key !== "_hier") return item[key];
      const gi = gateOrder.indexOf(item.gateCode);
      const label = (hierLabels.get(item.deliverableNo) || {}).label || "9999";
      return `${String(gi < 0 ? 99 : gi).padStart(2, "0")}::${label}`;
    });
    const allList = listDeliverables();
    const forms = listFormOptions();
    const formByCode = Object.fromEntries(forms.map((f) => [f.formCode, f]));
    const kpis = { total: allList.length, active: allList.filter((d) => d.active).length, mandatory: allList.filter((d) => d.mandatory).length };
    const dirtyCount = Object.keys(pendingLinks).length;
    const { pageItems, totalPages, page, total } = paginate(list, state.page, PAGE_SIZE);

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <div>
          <h1>Deliverable Library</h1>
          <p class="sg-subtle">Master catalog of every deliverable. Project-level status/progress lives on each Project's own Gate Checklist, not here.</p>
        </div>
        <div class="sg-header-actions">
          ${canManage && dirtyCount ? `<button class="btn btn-ghost" id="btnDiscardLinks">Discard Changes</button>` : ""}
          ${canManage && dirtyCount ? `<button class="btn btn-secondary" id="btnSaveLinks">Save Changes (${dirtyCount})</button>` : ""}
          ${canManage ? `<button class="btn btn-ghost" id="btnImport">Bulk Import</button>` : ""}
          ${canCreate ? `<button class="btn btn-primary" id="btnCreate">+ New Deliverable</button>` : ""}
        </div>
      </div>
      ${dirtyCount ? `<div class="sg-form-error" style="margin-bottom:var(--space-12)">${dirtyCount} linked-form change${dirtyCount === 1 ? "" : "s"} not saved yet — click "Save Changes" to apply, or "Discard Changes" to revert.</div>` : ""}
      <div class="sg-kpi-filter-row">
        <div class="sg-kpi-strip compact">
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-blue">${ICONS.list}</span><div><div class="sg-kpi-label">Total</div><div class="sg-kpi-value">${kpis.total}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-green">${ICONS.check}</span><div><div class="sg-kpi-label">Active</div><div class="sg-kpi-value">${kpis.active}</div></div></div>
          <div class="sg-kpi-card"><span class="sg-kpi-icon sg-kpi-icon-red">${ICONS.flag}</span><div><div class="sg-kpi-label">Mandatory</div><div class="sg-kpi-value">${kpis.mandatory}</div></div></div>
        </div>
        <div class="sg-toolbar sg-toolbar-flex">
          <select id="fltStage"><option value="">All Stages</option>${stages().map((s) => `<option value="${s}" ${state.gateCode === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <select id="fltActive"><option value="">Active + Inactive</option><option value="true" ${state.active === "true" ? "selected" : ""}>Active only</option><option value="false" ${state.active === "false" ? "selected" : ""}>Inactive only</option></select>
          <input type="search" id="fltSearch" placeholder="Search deliverables…" value="${escapeHtml(state.q)}" />
        </div>
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table">
          <thead><tr>
            ${sortableTh("Seq.", "_hier", state)}${sortableTh("No", "deliverableNo", state)}${sortableTh("Code", "deliverableCode", state)}${sortableTh("Name", "deliverableName", state)}${sortableTh("Stage", "gateCode", state)}
            <th>Parent</th><th>Mandatory</th><th>Linked Form</th>${sortableTh("Version", "version", state)}<th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${pageItems.length ? pageItems.map((d) => {
              const hier = hierLabels.get(d.deliverableNo) || { label: "—", parentNo: null, parentName: null };
              const isChild = !!hier.parentNo;
              return `
              <tr class="${d.active ? "" : "sg-row-muted"}${isChild ? " sg-row-child" : ""}" data-no="${escapeHtml(d.deliverableNo)}">
                <td class="sg-hier-seq">${escapeHtml(hier.label)}</td>
                <td>${escapeHtml(d.deliverableNo)}</td>
                <td class="sg-link-text" data-act="edit" data-no="${escapeHtml(d.deliverableNo)}">${escapeHtml(d.deliverableCode)}</td>
                <td class="${isChild ? "sg-hier-child-name" : ""}">${isChild ? "↳ " : ""}${escapeHtml(d.deliverableName)}</td>
                <td>${escapeHtml(d.gateCode)}</td>
                <td>${isChild ? `<span class="sg-subtle">${escapeHtml(hier.parentName)}</span>` : "—"}</td>
                <td>${d.mandatory ? `<span class="pill pill-red">Mandatory</span>` : `<span class="pill pill-slate">Optional</span>`}</td>
                <td>${renderLinkedFormCell(d, forms, pendingLinks[d.deliverableNo])}</td>
                <td>v${escapeHtml(d.version)}</td>
                <td><span class="pill ${d.active ? "pill-green" : "pill-slate"}">${d.active ? "Active" : "Inactive"}</span></td>
                <td class="sg-row-actions">${canManage || canCreate ? iconBtn("edit", { act: "edit", id: d.deliverableNo, title: "Edit deliverable" }) : ""}</td>
              </tr>
            `; }).join("") : `<tr><td colspan="11" class="sg-empty-cell">No deliverables match your filters.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${paginationHtml(page, totalPages, total, PAGE_SIZE)}
    `;

    document.getElementById("fltStage").addEventListener("change", (e) => { state.gateCode = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltActive").addEventListener("change", (e) => { state.active = e.target.value; state.page = 1; draw(); });
    document.getElementById("fltSearch").addEventListener("input", (e) => { state.q = e.target.value; state.page = 1; draw(); });
    wirePagination(contentEl(), (p) => { state.page = p; draw(); });
    wireSortableTh(contentEl(), state, draw);
    document.getElementById("btnCreate")?.addEventListener("click", () => openDeliverableModal(null, draw));
    document.getElementById("btnImport")?.addEventListener("click", () => openImportModal(draw));

    document.querySelectorAll('[data-act="edit"]').forEach((btn) => {
      btn.addEventListener("click", () => openDeliverableModal(list.find((d) => d.deliverableNo === btn.dataset.no) || allList.find((d) => d.deliverableNo === btn.dataset.no), draw));
    });
    document.querySelectorAll('[data-act="open-linked-form"]').forEach((el) => {
      el.addEventListener("click", () => { if (el.dataset.code) navigate(`/form-builder?code=${encodeURIComponent(el.dataset.code)}`); });
    });
    document.querySelectorAll('[data-act="link-form"]').forEach((sel) => {
      sel.addEventListener("change", () => {
        const no = sel.dataset.no;
        const original = allList.find((d) => d.deliverableNo === no)?.linkedFormCode || "";
        if (sel.value === original) delete pendingLinks[no];
        else pendingLinks[no] = sel.value;
        draw();
      });
    });
    document.getElementById("btnSaveLinks")?.addEventListener("click", () => {
      Object.entries(pendingLinks).forEach(([no, formCode]) => {
        updateDeliverable(no, { linkedFormCode: formCode || null }, user.name, user.businessRole);
      });
      toast(`${Object.keys(pendingLinks).length} linked-form change(s) saved`, "success");
      Object.keys(pendingLinks).forEach((k) => delete pendingLinks[k]);
      draw();
    });
    document.getElementById("btnDiscardLinks")?.addEventListener("click", () => {
      Object.keys(pendingLinks).forEach((k) => delete pendingLinks[k]);
      toast("Linked-form changes discarded", "info");
      draw();
    });
  }

  draw();
}

// Always an editable picker (so the linked form can be changed, not just set once), plus a small
// "open" affordance to jump straight to that form in the Form Builder when one is selected.
function renderLinkedFormCell(d, forms, pendingValue) {
  const current = pendingValue !== undefined ? pendingValue : (d.linkedFormCode || "");
  return `
    <div class="sg-linked-form-cell">
      <select class="sg-inline-select" data-act="link-form" data-no="${escapeHtml(d.deliverableNo)}">
        <option value="">— none —</option>
        ${forms.map((f) => `<option value="${escapeHtml(f.formCode)}" ${current === f.formCode ? "selected" : ""}>${escapeHtml(f.formCode)} — ${escapeHtml(f.formName)}</option>`).join("")}
      </select>
      <button type="button" class="sg-linked-form-open" data-act="open-linked-form" data-code="${escapeHtml(current)}" title="Open in Form Builder" ${current ? "" : "disabled"}>↗</button>
    </div>
  `;
}

// Deliverables this one is used by — a real, derived relationship (which Project Template gates
// reference it), not an invented "dependency" field; deliverableLibrary.json has no such field.
function usedByTemplates(deliverableNo) {
  const rows = [];
  listTemplates().forEach((t) => {
    t.gates.forEach((gc) => {
      if (gc.defaultDeliverables.includes(deliverableNo)) rows.push({ templateCode: t.templateCode, templateName: t.templateName, gateCode: gc.gateCode });
    });
  });
  return rows;
}

function openDeliverableModal(deliverable, onDone) {
  const editing = !!deliverable;
  const user = getActiveUser();
  const forms = listFormOptions();
  const history = editing ? listAuditEntries({ entityType: "Deliverable" }).filter((e) => e.entityId === deliverable.deliverableNo) : [];
  const usedBy = editing ? usedByTemplates(deliverable.deliverableNo) : [];
  // A deliverable that already has children of its own can't also become someone else's child —
  // only one level of nesting is supported (see updateDeliverable's own guard for the same rule).
  const hasChildren = editing && listDeliverables().some((d) => d.parentDeliverableCode === deliverable.deliverableNo);

  function readForm(backdrop) {
    return {
      deliverableCode: backdrop.querySelector("#dCode").value.trim(),
      deliverableName: backdrop.querySelector("#dName").value.trim(),
      description: backdrop.querySelector("#dDesc").value.trim(),
      gateCode: backdrop.querySelector("#dStage").value,
      category: backdrop.querySelector("#dCategory").value.trim(),
      department: backdrop.querySelector("#dDept").value.trim(),
      estimatedDuration: backdrop.querySelector("#dDuration").value.trim(),
      linkedFormCode: backdrop.querySelector("#dForm").value || null,
      mandatory: backdrop.querySelector("#dMandatory").checked,
      active: backdrop.querySelector("#dActive").checked,
      version: backdrop.querySelector("#dVersion").value.trim(),
      parentDeliverableCode: hasChildren ? null : (backdrop.querySelector("#dParent")?.value || null),
    };
  }
  const original = {
    deliverableCode: deliverable?.deliverableCode || "", deliverableName: deliverable?.deliverableName || "",
    description: deliverable?.description || "", gateCode: deliverable?.gateCode || stages()[0],
    category: deliverable?.category || "", department: deliverable?.department || "",
    estimatedDuration: deliverable?.estimatedDuration || "5 days", linkedFormCode: deliverable?.linkedFormCode || null,
    mandatory: !!deliverable?.mandatory, active: deliverable?.active !== false, version: deliverable?.version || "1.0",
    parentDeliverableCode: hasChildren ? null : (deliverable?.parentDeliverableCode || null),
  };

  function parentOptionsHtml(gateCode) {
    return topLevelOptionsFor(gateCode, deliverable?.deliverableNo || null)
      .map((d) => `<option value="${escapeHtml(d.deliverableNo)}" ${original.parentDeliverableCode === d.deliverableNo ? "selected" : ""}>${escapeHtml(d.deliverableNo)} — ${escapeHtml(d.deliverableName)}</option>`)
      .join("");
  }

  let backdropRef = null;
  openDrawer({
    title: editing ? `Edit ${deliverable.deliverableNo}` : "New Deliverable",
    isDirty: () => backdropRef && JSON.stringify(readForm(backdropRef)) !== JSON.stringify(original),
    bodyHtml: `
      <div class="drawer-section">
        <h4 class="drawer-section-title">General Information</h4>
        <div class="sg-form-grid">
          <label>Deliverable Code<input type="text" id="dCode" value="${escapeHtml(original.deliverableCode)}" placeholder="e.g. PK-15" required /></label>
          <label>Version<input type="text" id="dVersion" value="${escapeHtml(original.version)}" /></label>
          <label class="span-2">Name<input type="text" id="dName" value="${escapeHtml(original.deliverableName)}" required /></label>
          <label class="span-2">Description<textarea id="dDesc" rows="2">${escapeHtml(original.description)}</textarea></label>
          <label>Category<input type="text" id="dCategory" value="${escapeHtml(original.category)}" list="dCategoryList" /></label>
          <label>Estimated Duration<input type="text" id="dDuration" value="${escapeHtml(original.estimatedDuration)}" /></label>
          <label class="sg-check-inline"><input type="checkbox" id="dMandatory" ${original.mandatory ? "checked" : ""} /> Mandatory</label>
          <label class="sg-check-inline"><input type="checkbox" id="dActive" ${original.active ? "checked" : ""} /> Active</label>
        </div>
        <datalist id="dCategoryList">${CATEGORIES.map((c) => `<option value="${escapeHtml(c)}"></option>`).join("")}</datalist>
        <datalist id="dDeptList">${DEPARTMENTS.map((d) => `<option value="${escapeHtml(d)}"></option>`).join("")}</datalist>
      </div>
      <div class="drawer-section">
        <h4 class="drawer-section-title">Linked Form</h4>
        <div class="sg-form-grid one-col">
          <label>Form<select id="dForm"><option value="">— none —</option>${forms.map((f) => `<option value="${escapeHtml(f.formCode)}" ${original.linkedFormCode === f.formCode ? "selected" : ""}>${escapeHtml(f.formCode)} — ${escapeHtml(f.formName)}</option>`).join("")}</select></label>
        </div>
      </div>
      <div class="drawer-section">
        <h4 class="drawer-section-title">Department</h4>
        <div class="sg-form-grid one-col">
          <label>Department<input type="text" id="dDept" value="${escapeHtml(original.department)}" list="dDeptList" /></label>
        </div>
      </div>
      <div class="drawer-section">
        <h4 class="drawer-section-title">Stage</h4>
        <div class="sg-form-grid one-col">
          <label>Gate / Stage<select id="dStage">${stages().map((s) => `<option value="${s}" ${original.gateCode === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        </div>
      </div>
      <div class="drawer-section">
        <h4 class="drawer-section-title">Parent Deliverable</h4>
        ${hasChildren
          ? `<p class="sg-subtle" style="margin:0">This deliverable already has children of its own, so it can't also become a child — only one level of nesting is supported.</p>`
          : `<div class="sg-form-grid one-col">
              <label>Parent<select id="dParent"><option value="">— none (top-level) —</option>${parentOptionsHtml(original.gateCode)}</select></label>
            </div>
            <p class="sg-subtle" style="margin:var(--space-6) 0 0">Only top-level deliverables in the same Gate / Stage can be a parent. Children are numbered 1.1, 1.2… under their parent's own sequence number.</p>`}
      </div>
      <div class="drawer-section">
        <h4 class="drawer-section-title">Version</h4>
        <p class="sg-subtle" style="margin:0">Current version: v${escapeHtml(original.version)} (editable in General Information above).</p>
      </div>
      <div class="drawer-section">
        <h4 class="drawer-section-title">History</h4>
        <div class="sg-timeline no-grow">
          ${history.length ? history.map((e) => `
            <div class="sg-timeline-item">
              <div class="sg-timeline-dot pill-blue"></div>
              <div class="sg-timeline-body">
                <div class="sg-timeline-title">${escapeHtml(e.summary)}</div>
                <div class="sg-timeline-time">${escapeHtml(e.actor)} · ${relTime(e.timestamp)} · ${fmtDateTime(e.timestamp)}</div>
              </div>
            </div>
          `).join("") : `<p class="sg-subtle" style="margin:0">${editing ? "No changes recorded yet." : "History appears once this deliverable is created."}</p>`}
        </div>
      </div>
      <div class="drawer-section">
        <h4 class="drawer-section-title">Dependencies</h4>
        ${usedBy.length ? `
          <p class="sg-subtle" style="margin:0 0 var(--space-8)">Used by ${usedBy.length} Project Template gate${usedBy.length === 1 ? "" : "s"}:</p>
          <div class="sg-chip-row">${usedBy.map((u) => `<span class="chip">${escapeHtml(u.templateCode)} / ${escapeHtml(u.gateCode)}</span>`).join("")}</div>
        ` : `<p class="sg-subtle" style="margin:0">${editing ? "Not referenced by any Project Template yet." : "Dependencies appear once this deliverable is created and linked from a Project Template."}</p>`}
      </div>
    `,
    footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">${editing ? "Save" : "Create"}</button>`,
    onMount: (backdrop, close, requestClose) => {
      backdropRef = backdrop;
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", requestClose);
      // Parent options are scoped to the currently-selected Gate/Stage — repopulate them live if
      // the user changes the stage, so the dropdown never offers a cross-gate parent.
      backdrop.querySelector("#dStage")?.addEventListener("change", (e) => {
        const dParent = backdrop.querySelector("#dParent");
        if (dParent) dParent.innerHTML = `<option value="">— none (top-level) —</option>${parentOptionsHtml(e.target.value)}`;
      });
      backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
        const payload = readForm(backdrop);
        if (!payload.deliverableCode || !payload.deliverableName) { toast("Deliverable code and name are required.", "error"); return; }
        try {
          if (editing) updateDeliverable(deliverable.deliverableNo, payload, user.name, user.businessRole);
          else createDeliverable(payload, user.name, user.businessRole);
          close();
          toast(editing ? "Deliverable updated" : "Deliverable created", "success");
          onDone();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    },
  });
}

function openImportModal(onDone) {
  const user = getActiveUser();
  openModal({
    title: "Bulk Import Deliverables",
    bodyHtml: `
      <p class="sg-subtle">Upload a CSV or JSON file. Columns/keys: deliverableCode, deliverableName, description, gateCode, category, department, estimatedDuration, mandatory, linkedFormCode, version, active. Existing codes are updated in place; duplicate codes within the file are rejected.</p>
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
          const { created, updated, errors } = bulkImport(text, file.name, user.name, user.businessRole);
          close();
          toast(`Import complete: ${created} created, ${updated} updated${errors.length ? `, ${errors.length} row(s) skipped` : ""}`, errors.length ? "info" : "success");
          onDone();
        } catch (err) {
          errEl.textContent = "Import failed: " + err.message;
          errEl.hidden = false;
        }
      });
    },
  });
}
