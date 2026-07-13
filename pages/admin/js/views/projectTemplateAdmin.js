// Project Templates — replaces the old, misleadingly-titled "Gate Templates" route. Each of the
// 4 Project Types (M2/M4/M6/EXP) owns one template; editing it here is what a new Project
// auto-loads (Gate Sequence, Deliverables, Forms, Duration, Approval Rules) before PMO
// customizes and saves. One page, no separate detail route: clicking a template row expands its
// full Gate → Deliverables → Forms → Checklist → Approval Rules detail directly below that row.
import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import {
  listTemplates, getTemplate, updateBasicInfo, setGateSequence, setDeliverableStatuses,
  setLinkedForms, setGateDuration, setApprovalRules, getApprovalRules, dependencyLabel,
  deliverablesForGate, formsForGate, PROJECT_ROLE_SLOTS, availableGatesToAdd,
  addGateToSequence, removeGateFromSequence, resetTemplateToDefaults,
  addChecklistDocument, updateChecklistDocument, removeChecklistDocument, reorderChecklistDocuments,
  FILE_TYPE_OPTIONS,
} from "../store/projectTemplateAdmin.js";
import { listGates } from "../store/gateMasterAdmin.js";
import { escapeHtml, openDrawer, confirmDialog, toast, wireDragReorder, ICONS } from "../utils.js";
import { registerUnsavedGuard } from "../router.js";

const CHEVRON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

// ============================== PAGE — list + inline expand, one route ==============================
export async function renderProjectTemplates() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Project Templates");
  setActiveMenu("project-templates");
  const canManage = can(user.businessRole, "projecttemplate.manage");
  const allGateMaster = listGates({ includeInactive: false });

  const state = {
    expandedCode: null,
    gateOpen: {},   // gateCode -> bool, scoped to the currently expanded template
    gateSubTab: {}, // gateCode -> "deliverables" | "forms" | "checklist" | "approval"
    order: null,    // staged gate sequence for the currently expanded template
  };

  function isOrderDirty(t) {
    return state.order && state.order.join(",") !== t.defaultGateSequence.join(",");
  }

  registerUnsavedGuard({
    isDirty: () => {
      if (!state.expandedCode) return false;
      const t = getTemplate(state.expandedCode);
      return t ? isOrderDirty(t) : false;
    },
    onSave: async () => {
      setGateSequence(state.expandedCode, state.order, user.name, user.businessRole);
      toast("Gate order saved", "success");
      return true;
    },
  });

  function draw() {
    const templates = listTemplates();

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <div>
          <h1>Project Templates</h1>
          <p class="sg-subtle">Each Project Type owns one template. Selecting a Project Type when creating a Project auto-loads everything below. Click a template to expand its detail.</p>
        </div>
      </div>
      <div class="adm-scroll" id="tplList">
        ${templates.map((t) => renderTemplateRow(t)).join("")}
      </div>
    `;

    document.querySelectorAll(".sg-tpl-row[data-code]").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest("[data-act]")) return;
        const code = row.dataset.code;
        if (state.expandedCode === code) {
          state.expandedCode = null;
        } else {
          state.expandedCode = code;
          state.gateOpen = {};
          state.gateSubTab = {};
          state.order = null;
        }
        draw();
      });
    });

    if (state.expandedCode) wireDetail(getTemplate(state.expandedCode));
  }

  function renderTemplateRow(t) {
    const expanded = state.expandedCode === t.templateCode;
    const gateCount = t.defaultGateSequence.length;
    const deliverableCount = t.gates.reduce((s, g) => s + g.defaultDeliverables.length, 0);
    const formCount = t.gates.reduce((s, g) => s + (g.linkedForms || []).length, 0);
    return `
      <div class="sg-tpl-row-wrap">
        <div class="sg-tpl-row sg-row-clickable ${expanded ? "active" : ""}" data-code="${escapeHtml(t.templateCode)}">
          <span class="pd-gate-item-chevron ${expanded ? "open" : ""}">${CHEVRON_SVG}</span>
          <span class="chip">${escapeHtml(t.projectType)}</span>
          <span class="sg-tpl-row-name">${escapeHtml(t.templateName)} <span class="sg-subtle">(${escapeHtml(t.templateCode)})</span></span>
          <span class="sg-subtle">v${escapeHtml(t.version)}</span>
          <span class="sg-tpl-row-stats">
            <span class="chip">${gateCount} gates</span>
            <span class="chip">${deliverableCount} deliverables</span>
            <span class="chip">${formCount} forms</span>
          </span>
        </div>
        ${expanded ? renderTemplateDetail(t) : ""}
      </div>
    `;
  }

  function renderTemplateDetail(t) {
    if (state.order === null) state.order = t.defaultGateSequence.slice();
    const dirty = isOrderDirty(t);
    const sequence = state.order.filter((gc) => t.defaultGateSequence.includes(gc));
    return `
      <div class="sg-tpl-detail">
        <div class="sg-tpl-detail-toolbar">
          <p class="sg-subtle" style="margin:0">${canManage ? "Drag a gate by its handle to reorder, then Save Order." : "Gate sequence for this template."}</p>
          <div class="sg-header-actions">
            ${canManage && dirty ? `<button class="btn btn-ghost btn-sm" data-act="reset-gate-order">Reset Order</button>` : ""}
            ${canManage && dirty ? `<button class="btn btn-secondary btn-sm" data-act="save-gate-order">Save Order</button>` : ""}
            ${canManage ? `<button class="btn btn-ghost btn-sm" data-act="edit-basic">Edit Basic Info</button>` : ""}
            ${canManage ? `<button class="btn btn-ghost btn-sm" data-act="reset-template-defaults">↺ Reset to Defaults</button>` : ""}
            ${canManage ? `<button class="btn btn-primary btn-sm" data-act="add-gate">+ Add Gate</button>` : ""}
          </div>
        </div>
        ${dirty ? `<div class="sg-form-error" style="margin-bottom:var(--space-10)">Gate order changed but not saved yet — click "Save Order" to apply. Leaving this page will prompt you to save or discard.</div>` : ""}
        <div id="gateSeqList">
          ${sequence.map((gateCode, i) => renderGateItem(t, gateCode, i, sequence.length)).join("")}
        </div>
      </div>
    `;
  }

  function renderGateItem(t, gateCode, i, total) {
    const gc = t.gates.find((g) => g.gateCode === gateCode);
    const gateMeta = allGateMaster.find((g) => g.gateCode === gateCode);
    const openClass = state.gateOpen[gateCode] ? " open" : "";
    const rules = getApprovalRules(gc);
    const checklistDocs = (gc.checklistDocuments || []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
    const activeTab = state.gateSubTab[gateCode] || "deliverables";
    return `
      <div class="pd-gate-item${openClass}" data-gate="${escapeHtml(gateCode)}" draggable="${canManage}" data-dnd-id="${escapeHtml(gateCode)}">
        <div class="pd-gate-item-head">
          ${canManage ? `<span class="sg-drag-handle" title="Drag to reorder">${ICONS.drag}</span>` : ""}
          <span class="pd-gate-item-chevron">${CHEVRON_SVG}</span>
          <span class="pd-gate-item-label">${escapeHtml(gateCode)} — ${escapeHtml(gateMeta ? gateMeta.gateName : "")}</span>
          <span class="pd-gate-item-meta">
            <button type="button" class="chip chip-clickable" data-act="goto-subtab" data-goto="deliverables" title="Open Deliverables">${gc.defaultDeliverables.length} deliverables</button>
            <button type="button" class="chip chip-clickable" data-act="goto-subtab" data-goto="forms" title="Open Forms">${(gc.linkedForms || []).length} forms</button>
            <button type="button" class="chip chip-clickable" data-act="goto-subtab" data-goto="checklist" title="Open Checklist Documents">${checklistDocs.length} checklist docs</button>
            ${canManage ? `<button type="button" class="btn btn-ghost btn-sm danger" data-act="remove-gate">Remove Gate</button>` : ""}
          </span>
        </div>
        <div class="pd-gate-item-body">
          <p class="sg-subtle" style="margin:0 0 10px">Dependency: ${escapeHtml(dependencyLabel(t.templateCode, gateCode))}</p>
          <div class="sg-tabs sg-tabs-compact" data-gatetabs="${escapeHtml(gateCode)}">
            <button class="sg-tab ${activeTab === "deliverables" ? "active" : ""}" data-subtab="deliverables">Deliverables</button>
            <button class="sg-tab ${activeTab === "forms" ? "active" : ""}" data-subtab="forms">Forms</button>
            <button class="sg-tab ${activeTab === "checklist" ? "active" : ""}" data-subtab="checklist">Checklist Documents</button>
            <button class="sg-tab ${activeTab === "approval" ? "active" : ""}" data-subtab="approval">Approval &amp; Duration</button>
          </div>

          <div class="sg-gate-subpanel" data-subpanel="deliverables" ${activeTab === "deliverables" ? "" : "hidden"}>
            <div class="sg-scroll-panel" style="flex:1">
              <table class="sg-table sg-table-compact">
                <thead><tr><th>Code</th><th>Name</th><th>None</th><th>Optional</th><th>Mandatory</th></tr></thead>
                <tbody>
                  ${deliverablesForGate(gateCode).map((d) => {
                    const status = gc.mandatoryDeliverables.includes(d.deliverableNo) ? "mandatory" : gc.optionalDeliverables.includes(d.deliverableNo) ? "optional" : "none";
                    return `
                      <tr>
                        <td>${escapeHtml(d.deliverableCode)}</td>
                        <td>${escapeHtml(d.deliverableName)}</td>
                        ${["none", "optional", "mandatory"].map((s) => `<td style="text-align:left"><input type="radio" name="dstat-${escapeHtml(d.deliverableNo)}" data-act="dstat" data-no="${escapeHtml(d.deliverableNo)}" value="${s}" ${status === s ? "checked" : ""} ${canManage ? "" : "disabled"} /></td>`).join("")}
                      </tr>
                    `;
                  }).join("") || `<tr><td colspan="5" class="sg-empty-cell">No deliverables defined for ${escapeHtml(gateCode)} in the library.</td></tr>`}
                </tbody>
              </table>
            </div>
            ${canManage ? `<button class="btn btn-primary btn-sm" style="margin-top:12px;align-self:flex-start" data-act="save-deliverables">Save Deliverables</button>` : ""}
          </div>

          <div class="sg-gate-subpanel" data-subpanel="forms" ${activeTab === "forms" ? "" : "hidden"}>
            <p class="sg-subtle" style="margin-top:0">Default Forms — from Forms Library</p>
            <div class="sg-scroll-panel" style="flex:1">
              ${formsForGate(gateCode).length ? formsForGate(gateCode).map((f) => `
                <label class="sg-check-chip">
                  <input type="checkbox" data-act="form" value="${escapeHtml(f.formCode)}" ${(gc.linkedForms || []).includes(f.formCode) ? "checked" : ""} ${canManage ? "" : "disabled"} />
                  ${escapeHtml(f.formCode)} — ${escapeHtml(f.formName)}
                </label>
              `).join("") : `<div class="sg-empty-state">No forms in the library for ${escapeHtml(gateCode)}.</div>`}
            </div>
            ${canManage ? `<button class="btn btn-primary btn-sm" style="margin-top:12px;align-self:flex-start" data-act="save-gate">Save Forms</button>` : ""}
          </div>

          <div class="sg-gate-subpanel" data-subpanel="checklist" ${activeTab === "checklist" ? "" : "hidden"}>
            <div class="sg-panel-toolbar" style="justify-content:space-between;align-items:center">
              <p class="sg-subtle" style="margin:0">Checklist Documents — owned by this gate</p>
              ${canManage ? `<button type="button" class="btn btn-ghost btn-sm" data-act="add-checklist-doc">+ Add Document</button>` : ""}
            </div>
            <div class="sg-scroll-panel" style="flex:1">
              <table class="sg-table sg-table-compact">
                <thead><tr><th></th><th>Code</th><th>Name</th><th>Mandatory</th><th>Version</th><th>Max Size</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody id="checklistDocBody-${escapeHtml(gateCode)}">
                  ${checklistDocs.length ? checklistDocs.map((c) => `
                    <tr data-checklist-id="${escapeHtml(c.checklistId)}" draggable="${canManage}" data-dnd-id="${escapeHtml(c.checklistId)}">
                      <td>${canManage ? `<span class="sg-drag-handle" title="Drag to reorder">${ICONS.drag}</span>` : ""}</td>
                      <td>${escapeHtml(c.documentCode)}</td>
                      <td>${escapeHtml(c.documentName)}</td>
                      <td>${c.mandatory ? `<span class="pill pill-red">Mandatory</span>` : `<span class="pill pill-slate">Optional</span>`}</td>
                      <td>v${escapeHtml(c.version)}</td>
                      <td>${c.maxFileSizeMB} MB</td>
                      <td><span class="pill ${c.status === "Active" ? "pill-green" : "pill-slate"}">${escapeHtml(c.status)}</span></td>
                      <td class="sg-row-actions">
                        ${canManage ? `<button type="button" class="btn btn-ghost btn-sm" data-act="edit-checklist-doc">Edit</button>` : ""}
                        ${canManage ? `<button type="button" class="btn btn-ghost btn-sm danger" data-act="remove-checklist-doc">Remove</button>` : ""}
                      </td>
                    </tr>
                  `).join("") : `<tr><td colspan="8" class="sg-empty-cell">No checklist documents configured for ${escapeHtml(gateCode)} yet.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <div class="sg-gate-subpanel" data-subpanel="approval" ${activeTab === "approval" ? "" : "hidden"}>
            <div class="sg-scroll-panel" style="flex:1">
              <h4 style="margin-top:0">Approval Rules</h4>
              <label class="sg-subtle" style="display:block;margin-bottom:10px">Minimum Approvers<input type="number" min="1" max="6" class="sg-inline-input" style="width:70px;margin-left:8px" data-act="minappr" value="${rules.minApprovers}" ${canManage ? "" : "disabled"} /></label>
              <div class="sg-chip-row">
                ${PROJECT_ROLE_SLOTS.map((role) => `
                  <label class="sg-check-chip">
                    <input type="checkbox" data-act="reqrole" value="${escapeHtml(role)}" ${rules.requiredRoles.includes(role) ? "checked" : ""} ${canManage ? "" : "disabled"} />
                    ${escapeHtml(role)}
                  </label>
                `).join("")}
              </div>
              <h4 style="margin-top:18px">Gate Duration</h4>
              <input type="text" class="sg-inline-input" style="max-width:220px" data-act="duration" value="${escapeHtml(gc.gateDuration)}" ${canManage ? "" : "disabled"} />
            </div>
            ${canManage ? `<button class="btn btn-primary btn-sm" style="margin-top:12px;align-self:flex-start" data-act="save-gate">Save Approval &amp; Duration</button>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  function wireDetail(t) {
    document.getElementById("tplList").querySelectorAll('[data-act="edit-basic"]').forEach((btn) => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); openBasicInfoModal(t, draw); });
    });
    document.querySelectorAll('[data-act="add-gate"]').forEach((btn) => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); openAddGateModal(t, () => { state.order = null; draw(); }); });
    });
    document.querySelectorAll('[data-act="save-gate-order"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setGateSequence(t.templateCode, state.order, user.name, user.businessRole);
        toast("Gate order saved", "success");
        draw();
      });
    });
    document.querySelectorAll('[data-act="reset-gate-order"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.order = t.defaultGateSequence.slice();
        toast("Gate order reset", "info");
        draw();
      });
    });
    document.querySelectorAll('[data-act="reset-template-defaults"]').forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!(await confirmDialog(`Reset "${t.templateCode}" to its shipped defaults? Every customization made to this template (gate sequence, deliverables, forms, checklist documents, approval rules) will be discarded.`))) return;
        resetTemplateToDefaults(t.templateCode, user.name, user.businessRole);
        state.order = null;
        state.gateOpen = {};
        toast(`${t.templateCode} reset to defaults`, "success");
        draw();
      });
    });

    document.querySelectorAll(".pd-gate-item > .pd-gate-item-head").forEach((head) => {
      head.addEventListener("click", (e) => {
        if (e.target.closest("[data-act]")) return;
        e.stopPropagation();
        const item = head.closest(".pd-gate-item");
        const gateCode = item.dataset.gate;
        const nowOpen = !item.classList.contains("open");
        item.classList.toggle("open", nowOpen);
        state.gateOpen[gateCode] = nowOpen;
      });
    });
    // Deliverables/Forms/Checklist Documents chips — jump straight to that sub-tab, opening the
    // gate's detail if it wasn't already expanded.
    document.querySelectorAll('[data-act="goto-subtab"]').forEach((chip) => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const gateCode = chip.closest(".pd-gate-item").dataset.gate;
        state.gateOpen[gateCode] = true;
        state.gateSubTab[gateCode] = chip.dataset.goto;
        draw();
      });
    });
    if (canManage) {
      const gateSeqList = document.getElementById("gateSeqList");
      if (gateSeqList) {
        wireDragReorder(gateSeqList, ".pd-gate-item", (orderedGateCodes) => {
          state.order = orderedGateCodes;
          draw();
        });
      }
    }
    document.querySelectorAll('[data-subtab]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const gateCode = btn.closest("[data-gatetabs]").dataset.gatetabs;
        state.gateSubTab[gateCode] = btn.dataset.subtab;
        state.gateOpen[gateCode] = true;
        draw();
      });
    });
    document.querySelectorAll('[data-act="save-gate"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = btn.closest(".pd-gate-item");
        const gateCode = item.dataset.gate;
        state.gateOpen[gateCode] = true;
        const duration = item.querySelector('[data-act="duration"]').value.trim();
        const minApprovers = Number(item.querySelector('[data-act="minappr"]').value) || 1;
        const requiredRoles = Array.from(item.querySelectorAll('[data-act="reqrole"]:checked')).map((el) => el.value);
        const linkedForms = Array.from(item.querySelectorAll('[data-act="form"]:checked')).map((el) => el.value);
        try {
          setGateDuration(t.templateCode, gateCode, duration, user.name, user.businessRole);
          setApprovalRules(t.templateCode, gateCode, { minApprovers, requiredRoles }, user.name, user.businessRole);
          setLinkedForms(t.templateCode, gateCode, linkedForms, user.name, user.businessRole);
          toast(`Gate ${gateCode} settings saved`, "success");
          draw();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
    // Radio changes are NOT auto-committed — same explicit-save pattern as the Forms and
    // Approval & Duration sub-tabs: every changed radio is read fresh at "Save Deliverables"
    // time, in one batch write, instead of persisting on each individual click.
    document.querySelectorAll('[data-act="dstat"]').forEach((radio) => {
      radio.addEventListener("change", (e) => e.stopPropagation());
    });
    document.querySelectorAll('[data-act="save-deliverables"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = btn.closest(".pd-gate-item");
        const gateCode = item.dataset.gate;
        state.gateOpen[gateCode] = true;
        const statusByNo = {};
        item.querySelectorAll('[data-act="dstat"]:checked').forEach((radio) => { statusByNo[radio.dataset.no] = radio.value; });
        try {
          setDeliverableStatuses(t.templateCode, gateCode, statusByNo, user.name, user.businessRole);
          toast(`Gate ${gateCode} deliverables saved`, "success");
          draw();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
    document.querySelectorAll('[data-act="remove-gate"]').forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const gateCode = btn.closest(".pd-gate-item").dataset.gate;
        if (!(await confirmDialog(`Remove gate "${gateCode}" from this template? Its deliverables, forms, checklist documents and approval rules configured here will be lost.`))) return;
        removeGateFromSequence(t.templateCode, gateCode, user.name, user.businessRole);
        state.order = null; // any staged (unsaved) reorder is moot once the sequence itself changed server-side
        toast(`Gate ${gateCode} removed from template`, "success");
        draw();
      });
    });
    document.querySelectorAll('[data-act="add-checklist-doc"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const gateCode = btn.closest(".pd-gate-item").dataset.gate;
        state.gateOpen[gateCode] = true;
        openChecklistDocModal(t.templateCode, gateCode, null, draw);
      });
    });
    document.querySelectorAll('[data-act="edit-checklist-doc"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = btn.closest(".pd-gate-item");
        const gateCode = item.dataset.gate;
        const checklistId = btn.closest("tr").dataset.checklistId;
        const gc = t.gates.find((g) => g.gateCode === gateCode);
        const doc = gc.checklistDocuments.find((c) => c.checklistId === checklistId);
        state.gateOpen[gateCode] = true;
        openChecklistDocModal(t.templateCode, gateCode, doc, draw);
      });
    });
    document.querySelectorAll('[data-act="remove-checklist-doc"]').forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const item = btn.closest(".pd-gate-item");
        const gateCode = item.dataset.gate;
        const checklistId = btn.closest("tr").dataset.checklistId;
        if (!(await confirmDialog("Remove this checklist document from the template?"))) return;
        state.gateOpen[gateCode] = true;
        removeChecklistDocument(t.templateCode, gateCode, checklistId, user.name, user.businessRole);
        toast("Checklist document removed", "success");
        draw();
      });
    });
    if (canManage) {
      document.querySelectorAll('[id^="checklistDocBody-"]').forEach((tbody) => {
        const gateCode = tbody.id.replace("checklistDocBody-", "");
        wireDragReorder(tbody, "tr[data-checklist-id]", (orderedIds) => {
          state.gateOpen[gateCode] = true;
          reorderChecklistDocuments(t.templateCode, gateCode, orderedIds, user.name, user.businessRole);
          draw();
        });
      });
    }
  }

  function openChecklistDocModal(templateCode, gateCode, doc, onDone) {
    const editing = !!doc;
    openDrawer({
      width: "50%",
      title: editing ? `Edit Checklist Document — ${doc.documentCode}` : `New Checklist Document — ${gateCode}`,
      bodyHtml: `
        <div class="sg-form-grid">
          <label>Document Code<input type="text" id="cCode" value="${escapeHtml(doc?.documentCode || "")}" placeholder="e.g. VV-CK06" required /></label>
          <label>Version<input type="text" id="cVersion" value="${escapeHtml(doc?.version || "1.0")}" /></label>
          <label class="span-2">Document Name<input type="text" id="cName" value="${escapeHtml(doc?.documentName || "")}" required /></label>
          <label class="span-2">Description<textarea id="cDesc" rows="2">${escapeHtml(doc?.description || "")}</textarea></label>
          <label>Maximum File Size (MB)<input type="number" id="cMaxSize" min="1" max="200" value="${doc?.maxFileSizeMB ?? 10}" /></label>
          <label>Status<select id="cStatus"><option value="Active" ${doc?.status !== "Inactive" ? "selected" : ""}>Active</option><option value="Inactive" ${doc?.status === "Inactive" ? "selected" : ""}>Inactive</option></select></label>
          <label class="span-2">Allowed File Types
            <div class="sg-chip-row">
              ${FILE_TYPE_OPTIONS.map((ft) => `<label class="sg-check-chip"><input type="checkbox" data-filetype value="${ft}" ${(doc?.allowedFileTypes || ["pdf"]).includes(ft) ? "checked" : ""} /> .${ft}</label>`).join("")}
            </div>
          </label>
          <label class="sg-check-inline span-2"><input type="checkbox" id="cMandatory" ${doc?.mandatory ? "checked" : ""} /> Mandatory</label>
        </div>
      `,
      footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">${editing ? "Save" : "Add"}</button>`,
      onMount: (backdrop, close, requestClose) => {
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", requestClose);
        backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
          const user = getActiveUser();
          const payload = {
            documentCode: document.getElementById("cCode").value.trim(),
            documentName: document.getElementById("cName").value.trim(),
            description: document.getElementById("cDesc").value.trim(),
            version: document.getElementById("cVersion").value.trim(),
            maxFileSizeMB: Number(document.getElementById("cMaxSize").value) || 10,
            status: document.getElementById("cStatus").value,
            mandatory: document.getElementById("cMandatory").checked,
            allowedFileTypes: Array.from(backdrop.querySelectorAll("[data-filetype]:checked")).map((el) => el.value),
          };
          if (!payload.documentCode || !payload.documentName) { toast("Document code and name are required.", "error"); return; }
          try {
            if (editing) updateChecklistDocument(templateCode, gateCode, doc.checklistId, payload, user.name, user.businessRole);
            else addChecklistDocument(templateCode, gateCode, payload, user.name, user.businessRole);
            close();
            toast(editing ? "Checklist document updated" : "Checklist document added", "success");
            onDone();
          } catch (err) {
            toast(err.message, "error");
          }
        });
      },
    });
  }

  function openAddGateModal(t, onDone) {
    const user = getActiveUser();
    const available = availableGatesToAdd(t.templateCode);
    openDrawer({
      width: "40%",
      title: `Add Gate — ${t.templateCode}`,
      bodyHtml: available.length ? `
        <div class="sg-form-grid one-col">
          <label>Gate <span class="sg-subtle">— from Gate Master</span>
            <select id="newGateCode">${available.map((g) => `<option value="${escapeHtml(g.gateCode)}">${escapeHtml(g.gateCode)} — ${escapeHtml(g.gateName)}</option>`).join("")}</select>
          </label>
        </div>
      ` : `<p class="sg-subtle">Every active gate in Gate Master is already part of this template's sequence. Create a new gate in Gate Master first.</p>`,
      footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button>${available.length ? `<button class="btn btn-primary" data-act="save">Add Gate</button>` : ""}`,
      onMount: (backdrop, close, requestClose) => {
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", requestClose);
        backdrop.querySelector('[data-act="save"]')?.addEventListener("click", () => {
          const gateCode = document.getElementById("newGateCode").value;
          addGateToSequence(t.templateCode, gateCode, user.name, user.businessRole);
          close();
          toast(`Gate ${gateCode} added to template`, "success");
          onDone();
        });
      },
    });
  }

  draw();
}

function openBasicInfoModal(t, onDone) {
  const user = getActiveUser();
  openDrawer({
    width: "35%",
    title: `Edit Basic Info — ${t.templateCode}`,
    bodyHtml: `
      <div class="sg-form-grid">
        <label class="span-2">Template Name<input type="text" id="tName" value="${escapeHtml(t.templateName)}" /></label>
        <label>Version<input type="text" id="tVersion" value="${escapeHtml(t.version)}" /></label>
        <label>Project Type<input type="text" value="${escapeHtml(t.projectType)}" disabled /></label>
      </div>
    `,
    footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Save</button>`,
    onMount: (backdrop, close, requestClose) => {
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", requestClose);
      backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
        updateBasicInfo(t.templateCode, { templateName: document.getElementById("tName").value.trim(), version: document.getElementById("tVersion").value.trim() }, user.name, user.businessRole);
        close();
        toast("Basic info updated", "success");
        onDone();
      });
    },
  });
}
