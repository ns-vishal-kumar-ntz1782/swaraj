import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import { GATE_CODES, GATE_NAMES, listTemplateItems, createTemplateItem, updateTemplateItem, deleteTemplateItem } from "../store/gateTemplates.js";
import { escapeHtml, openModal, confirmDialog, toast, fmtDate } from "../utils.js";

export async function renderGateTemplates() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Gate Checklist Templates");
  setActiveMenu("gate-templates");

  const canManage = can(user.businessRole, "gatetemplate.manage");
  const state = { gateCode: GATE_CODES[0] };

  function draw() {
    const items = listTemplateItems(state.gateCode);
    contentEl().innerHTML = `
      <div class="sg-page-header">
        <h1>Gate Checklist Templates</h1>
        ${canManage ? `<button class="btn btn-primary" id="btnAddItem">+ Add Checklist Item</button>` : ""}
      </div>
      <div class="sg-tabs" id="gateCodeTabs">
        ${GATE_CODES.map((c) => `<button class="sg-tab ${c === state.gateCode ? "active" : ""}" data-code="${c}">${c}</button>`).join("")}
      </div>
      <p class="sg-subtle">${escapeHtml(GATE_NAMES[state.gateCode])}</p>
      <div class="sg-table-wrap">
      <table class="sg-table">
        <thead><tr><th>Name</th><th>Description</th><th>Mandatory</th><th>Target Date</th><th>Responsibility</th>${canManage ? "<th></th>" : ""}</tr></thead>
        <tbody>
          ${items.length ? items.map((i) => `
            <tr>
              <td>${escapeHtml(i.name)}</td>
              <td>${escapeHtml(i.description)}</td>
              <td>${i.mandatory ? "Yes" : "No"}</td>
              <td>${fmtDate(i.targetDate)}</td>
              <td>${escapeHtml(i.responsibility)}</td>
              ${canManage ? `<td class="sg-row-actions">
                <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${i.id}">Edit</button>
                <button class="btn btn-ghost btn-sm danger" data-act="delete" data-id="${i.id}">Delete</button>
              </td>` : ""}
            </tr>
          `).join("") : `<tr><td colspan="6" class="sg-empty-cell">No checklist items defined for ${state.gateCode} yet.</td></tr>`}
        </tbody>
      </table>
      </div>
    `;

    document.querySelectorAll("#gateCodeTabs .sg-tab").forEach((tab) => {
      tab.addEventListener("click", () => { state.gateCode = tab.dataset.code; draw(); });
    });
    const addBtn = document.getElementById("btnAddItem");
    if (addBtn) addBtn.addEventListener("click", () => openItemModal(null));
    document.querySelectorAll('button[data-act="edit"]').forEach((btn) => {
      btn.addEventListener("click", () => openItemModal(items.find((i) => i.id === btn.dataset.id)));
    });
    document.querySelectorAll('button[data-act="delete"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const item = items.find((i) => i.id === btn.dataset.id);
        if (await confirmDialog(`Delete checklist item "${item.name}"?`)) {
          deleteTemplateItem(item.id, user.name, user.businessRole);
          toast("Checklist item deleted", "success");
          draw();
        }
      });
    });
  }

  function openItemModal(item) {
    const editing = !!item;
    openModal({
      title: editing ? "Edit Checklist Item" : "Add Checklist Item",
      bodyHtml: `
        <div class="sg-form-grid">
          <label class="span-2">Name<input type="text" id="tiName" value="${escapeHtml(item?.name || "")}" required /></label>
          <label class="span-2">Description<textarea id="tiDescription" rows="2">${escapeHtml(item?.description || "")}</textarea></label>
          <label>Mandatory<select id="tiMandatory"><option value="true" ${item?.mandatory ? "selected" : ""}>Yes</option><option value="false" ${item && !item.mandatory ? "selected" : ""}>No</option></select></label>
          <label>Target Date<input type="date" id="tiTargetDate" value="${item?.targetDate || ""}" /></label>
          <label class="span-2">Responsibility<input type="text" id="tiResponsibility" value="${escapeHtml(item?.responsibility || "")}" placeholder="e.g. PMO Manager" /></label>
        </div>
      `,
      footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">${editing ? "Save" : "Add"}</button>`,
      onMount: (backdrop, close) => {
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", close);
        backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
          const payload = {
            name: document.getElementById("tiName").value.trim(),
            description: document.getElementById("tiDescription").value.trim(),
            mandatory: document.getElementById("tiMandatory").value === "true",
            targetDate: document.getElementById("tiTargetDate").value,
            responsibility: document.getElementById("tiResponsibility").value.trim(),
          };
          if (!payload.name) { toast("Name is required.", "error"); return; }
          if (editing) updateTemplateItem(item.id, payload, user.name, user.businessRole);
          else createTemplateItem({ gateCode: state.gateCode, ...payload }, user.name, user.businessRole);
          close();
          toast(editing ? "Checklist item updated" : "Checklist item added", "success");
          draw();
        });
      },
    });
  }

  draw();
}
