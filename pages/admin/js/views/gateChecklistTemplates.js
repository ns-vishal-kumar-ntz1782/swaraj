// Gate Checklist Templates — the "Gate Checklist" tab's content. One shared checklist per gate
// (from Gate Master, live — a gate created there shows up here immediately with no code change),
// staged locally and only persisted on "Save Changes"/"Publish". This replaced the earlier
// per-project live approval workflow view at this route, per explicit instruction.
//
// Target Date / Responsible are deliberately NOT editable here — those belong to Deliverables,
// not to a checklist item definition (the underlying keys stay on the stored item shape for
// backward compatibility; they're just never rendered or written to from this page).
import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import { registerUnsavedGuard } from "../router.js";
import { listGates } from "../store/gateMasterAdmin.js";
import {
  itemsForGate, saveGateChecklist, publishGateChecklist, resetGateToDefaults, newBlankItem,
  FILE_TYPE_OPTIONS, STATUS_OPTIONS,
} from "../store/gateChecklistTemplates.js";
import { escapeHtml, confirmDialog, toast, wireDragReorder, openDrawer, iconBtn, ICONS, statusPillClass } from "../utils.js";

export async function renderGateChecklistTemplates() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Gate Checklist");
  setActiveMenu("gates");

  const canManage = can(user.businessRole, "gatechecklisttpl.manage");
  const gates = listGates({ includeInactive: false });
  const state = {
    activeGate: gates[0]?.gateCode || null,
    items: {}, // gateCode -> staged item array (only populated once a tab is opened)
  };

  function ensureStaged(gateCode) {
    if (!state.items[gateCode]) state.items[gateCode] = itemsForGate(gateCode).map((i) => ({ ...i }));
    return state.items[gateCode];
  }

  function isDirty(gateCode) {
    const staged = state.items[gateCode];
    if (!staged) return false;
    const saved = itemsForGate(gateCode);
    return JSON.stringify(staged) !== JSON.stringify(saved);
  }

  registerUnsavedGuard({
    isDirty: () => gates.some((g) => isDirty(g.gateCode)),
    onSave: async () => {
      gates.forEach((g) => {
        if (isDirty(g.gateCode)) {
          saveGateChecklist(g.gateCode, state.items[g.gateCode], user.name, user.businessRole);
          state.items[g.gateCode] = itemsForGate(g.gateCode).map((i) => ({ ...i }));
        }
      });
      toast("Checklist changes saved", "success");
      return true;
    },
  });

  function draw() {
    if (!gates.length) {
      contentEl().innerHTML = `<div class="sg-empty-state">No active gates in Gate Master yet. Create one there first.</div>`;
      return;
    }
    if (!state.activeGate || !gates.some((g) => g.gateCode === state.activeGate)) state.activeGate = gates[0].gateCode;
    const items = ensureStaged(state.activeGate).slice().sort((a, b) => a.displayOrder - b.displayOrder);
    const dirty = isDirty(state.activeGate);

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <div>
          <h1>Gate Checklist Templates</h1>
          <p class="sg-subtle">Define mandatory documents required to approve each gate.</p>
        </div>
        <div class="sg-header-actions">
          ${canManage ? `<button class="btn btn-ghost" id="btnResetDefaults">↺ Reset ${escapeHtml(state.activeGate)} Checklist</button>` : ""}
        </div>
      </div>
      <div class="sg-tabs" id="gctTabs">
        ${gates.map((g) => `<button class="sg-tab ${state.activeGate === g.gateCode ? "active" : ""}" data-gate="${escapeHtml(g.gateCode)}">${escapeHtml(g.gateCode)} <span class="sg-subtle">(${itemsForGate(g.gateCode).length})</span></button>`).join("")}
      </div>
      ${dirty ? `<div class="sg-form-error" style="margin-bottom:var(--space-10)">Unsaved changes for ${escapeHtml(state.activeGate)} — click "Save Changes" below to apply. Leaving this page will prompt you to save or discard.</div>` : ""}
      ${items.length ? `
        <div class="sg-gct-header">
          <span></span><span></span><span>Document Name</span><span>Description</span><span>Category</span><span>Mandatory</span><span>Status</span><span>Actions</span>
        </div>
      ` : ""}
      <div class="adm-scroll" id="gctList">
        ${items.length ? items.map((item, i) => renderItemCard(item, i, items.length)).join("") : `<div class="sg-empty-state">No checklist items for ${escapeHtml(state.activeGate)} yet.</div>`}
        ${canManage ? `<button type="button" class="btn btn-ghost" id="btnAddItem" style="margin-top:var(--space-4)">+ Add checklist item</button>` : ""}
      </div>
      <div class="sg-gct-footer">
        <p class="sg-subtle" style="margin:0">Changes apply to every project that opens a ${escapeHtml(state.activeGate)} gate. Stored and persisted across refresh.</p>
        <div class="sg-header-actions">
          ${canManage && dirty ? `<button class="btn btn-secondary" id="btnSaveChecklist">Save Changes</button>` : ""}
          ${canManage ? `<button class="btn btn-primary" id="btnPublishChecklist">Publish ${escapeHtml(state.activeGate)} Checklist</button>` : ""}
        </div>
      </div>
    `;

    document.querySelectorAll("#gctTabs .sg-tab").forEach((tab) => {
      tab.addEventListener("click", () => { state.activeGate = tab.dataset.gate; draw(); });
    });
    document.getElementById("btnResetDefaults")?.addEventListener("click", async () => {
      if (!(await confirmDialog(`Reset the ${state.activeGate} checklist to its default items? Any unsaved or saved customizations for this gate will be discarded.`))) return;
      const restored = resetGateToDefaults(state.activeGate, user.name, user.businessRole);
      state.items[state.activeGate] = restored.map((i) => ({ ...i }));
      toast("Checklist reset to defaults", "success");
      draw();
    });
    document.getElementById("btnAddItem")?.addEventListener("click", () => {
      openItemDrawer(null, (payload) => {
        const staged = state.items[state.activeGate];
        staged.push({ ...newBlankItem(state.activeGate, staged.length + 1), ...payload });
        draw();
      });
    });
    document.getElementById("btnSaveChecklist")?.addEventListener("click", () => {
      saveGateChecklist(state.activeGate, state.items[state.activeGate], user.name, user.businessRole);
      state.items[state.activeGate] = itemsForGate(state.activeGate).map((i) => ({ ...i }));
      toast(`${state.activeGate} checklist saved`, "success");
      draw();
    });
    document.getElementById("btnPublishChecklist")?.addEventListener("click", async () => {
      if (!(await confirmDialog(`Publish the ${state.activeGate} checklist? All items in this gate only will be marked Published.`))) return;
      const published = publishGateChecklist(state.activeGate, state.items[state.activeGate], user.name, user.businessRole);
      state.items[state.activeGate] = published.map((i) => ({ ...i }));
      toast(`${state.activeGate} checklist published`, "success");
      draw();
    });
    wireItemCards();
  }

  function renderItemCard(item, i, total) {
    return `
      <div class="sg-gct-row" draggable="${canManage}" data-dnd-id="${escapeHtml(item.id)}" data-item-id="${escapeHtml(item.id)}">
        ${canManage ? `<span class="sg-drag-handle" title="Drag to reorder">${ICONS.drag}</span>` : `<span></span>`}
        <span class="sg-gct-index">${String(i + 1).padStart(2, "0")}</span>
        <span class="sg-gct-title-text sg-cell-truncate" title="${escapeHtml(item.title)}">${escapeHtml(item.title) || "<em>Untitled</em>"}</span>
        <span class="sg-gct-desc-text sg-cell-truncate" title="${escapeHtml(item.description)}">${escapeHtml(item.description) || "—"}</span>
        <span class="chip">${escapeHtml(item.documentCategory) || "—"}</span>
        <span>${item.mandatory ? `<span class="pill pill-red">Mandatory</span>` : `<span class="pill pill-slate">Optional</span>`}</span>
        <span><span class="pill ${statusPillClass(item.status || "Published")}">${escapeHtml(item.status || "Published")}</span></span>
        <span class="sg-row-actions">
          ${canManage ? iconBtn("edit", { act: "edit-item", id: item.id, title: "Edit item" }) : ""}
          ${canManage ? iconBtn("delete", { act: "remove-item", id: item.id, title: "Remove item", cls: "danger" }) : ""}
        </span>
      </div>
    `;
  }

  function wireItemCards() {
    document.querySelectorAll(".sg-gct-row").forEach((card) => {
      const itemId = card.dataset.itemId;
      const staged = state.items[state.activeGate];
      const item = staged.find((x) => x.id === itemId);
      card.querySelector('[data-act="edit-item"]')?.addEventListener("click", () => {
        openItemDrawer(item, (payload) => {
          Object.assign(item, payload);
          draw();
        });
      });
      card.querySelector('[data-act="remove-item"]')?.addEventListener("click", async () => {
        if (!(await confirmDialog(`Remove "${item.title || "this item"}" from the ${state.activeGate} checklist? This isn't final until you click "Save Changes" or "Publish".`))) return;
        state.items[state.activeGate] = staged.filter((x) => x.id !== itemId);
        draw();
      });
    });
    if (canManage) {
      wireDragReorder(document.getElementById("gctList"), ".sg-gct-row", (orderedIds) => {
        const staged = state.items[state.activeGate];
        const byId = Object.fromEntries(staged.map((it) => [it.id, it]));
        state.items[state.activeGate] = orderedIds.map((id, idx) => ({ ...byId[id], displayOrder: idx + 1 }));
        draw();
      });
    }
  }

  // Create/Edit drawer — collects every field the task requires for a new checklist item.
  // Purely local: onSaved receives the payload and the caller decides whether to push a new
  // staged item or merge into an existing one; nothing is persisted until page-level Save/Publish.
  function openItemDrawer(item, onSaved) {
    const editing = !!item;
    const original = {
      title: item?.title || "", description: item?.description || "", documentCategory: item?.documentCategory || "",
      mandatory: !!item?.mandatory, allowedFileTypes: item?.allowedFileTypes || ["pdf"],
      maxFileSizeMB: item?.maxFileSizeMB ?? 10, versionRequired: item?.versionRequired ?? true,
      remarks: item?.remarks || "", status: item?.status || "Draft",
    };

    function readForm(backdrop) {
      return {
        title: backdrop.querySelector("#ciName").value.trim(),
        description: backdrop.querySelector("#ciDesc").value.trim(),
        documentCategory: backdrop.querySelector("#ciCategory").value.trim(),
        mandatory: backdrop.querySelector("#ciMandatory").checked,
        allowedFileTypes: Array.from(backdrop.querySelectorAll("[data-filetype]:checked")).map((el) => el.value),
        maxFileSizeMB: Number(backdrop.querySelector("#ciMaxSize").value) || 10,
        versionRequired: backdrop.querySelector("#ciVersionRequired").checked,
        remarks: backdrop.querySelector("#ciRemarks").value.trim(),
        status: backdrop.querySelector("#ciStatus").value,
      };
    }

    let backdropRef = null;
    openDrawer({
      title: editing ? `Edit Checklist Item — ${item.title || "Untitled"}` : "New Checklist Item",
      width: "50%",
      isDirty: () => backdropRef && JSON.stringify(readForm(backdropRef)) !== JSON.stringify(original),
      bodyHtml: `
        <div class="sg-form-grid one-col">
          <label>Document Name<input type="text" id="ciName" value="${escapeHtml(original.title)}" required /></label>
          <label>Description<textarea id="ciDesc" rows="2" required>${escapeHtml(original.description)}</textarea></label>
          <label>Document Category<input type="text" id="ciCategory" value="${escapeHtml(original.documentCategory)}" placeholder="e.g. Design, Quality, Compliance" required /></label>
          <label class="sg-check-inline"><input type="checkbox" id="ciMandatory" ${original.mandatory ? "checked" : ""} /> Mandatory</label>
          <label>Allowed File Types
            <div class="sg-chip-row">
              ${FILE_TYPE_OPTIONS.map((ft) => `<label class="sg-check-chip"><input type="checkbox" data-filetype value="${ft}" ${original.allowedFileTypes.includes(ft) ? "checked" : ""} /> .${ft}</label>`).join("")}
            </div>
          </label>
          <label>Maximum File Size (MB)<input type="number" id="ciMaxSize" min="1" max="200" value="${original.maxFileSizeMB}" required /></label>
          <label class="sg-check-inline"><input type="checkbox" id="ciVersionRequired" ${original.versionRequired ? "checked" : ""} /> Version Required</label>
          <label>Remarks<textarea id="ciRemarks" rows="2">${escapeHtml(original.remarks)}</textarea></label>
          <label>Status<select id="ciStatus">${STATUS_OPTIONS.map((s) => `<option value="${s}" ${original.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        </div>
      `,
      footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">${editing ? "Save" : "Add"}</button>`,
      onMount: (backdrop, close, requestClose) => {
        backdropRef = backdrop;
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", requestClose);
        backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
          const payload = readForm(backdrop);
          if (!payload.title || !payload.description || !payload.documentCategory) {
            toast("Document Name, Description and Document Category are required.", "error");
            return;
          }
          if (!payload.allowedFileTypes.length) { toast("Select at least one allowed file type.", "error"); return; }
          onSaved(payload);
          close();
        });
      },
    });
  }

  draw();
}
