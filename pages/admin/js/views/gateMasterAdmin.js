import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import { listGates, createGate, updateGate, setGateActive, saveGateOrder } from "../store/gateMasterAdmin.js";
import { escapeHtml, openDrawer, confirmDialog, toast, paginate, paginationHtml, wirePagination, wireDragReorder, iconBtn, ICONS } from "../utils.js";

const PAGE_SIZE = 10;

export async function renderGateMaster() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Gate Master");
  setActiveMenu("gate-master");

  const canManage = can(user.businessRole, "gatemaster.manage");
  const state = { page: 1 };

  function draw() {
    const gates = listGates(); // already sorted by displayOrder
    const { pageItems, totalPages, page, total } = paginate(gates, state.page, PAGE_SIZE);

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <div>
          <h1>Gate Master</h1>
          <p class="sg-subtle">The canonical set of gates every Project Template sequences from. Drag a row to reorder — future gates can be added here with no code changes.</p>
        </div>
        <div class="sg-header-actions">
          ${canManage ? `<button class="btn btn-primary" id="btnCreate">+ New Gate</button>` : ""}
        </div>
      </div>
      <div class="sg-table-wrap">
        <table class="sg-table sg-table-fixed">
          <colgroup>
            <col style="width:70px" /><col style="width:110px" /><col style="width:190px" /><col />
            <col style="width:140px" /><col style="width:110px" /><col style="width:96px" />
          </colgroup>
          <thead><tr><th></th><th>Code</th><th>Name</th><th>Description</th><th>Default Duration</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="gmTbody">
            ${pageItems.map((g) => `
              <tr class="${g.active ? "" : "sg-row-muted"}" draggable="${canManage}" data-dnd-id="${escapeHtml(g.gateCode)}">
                <td>${canManage ? `<span class="sg-drag-handle" title="Drag to reorder">${ICONS.drag}</span>` : ""}</td>
                <td><strong>${escapeHtml(g.gateCode)}</strong></td>
                <td>${escapeHtml(g.gateName)}</td>
                <td class="sg-subtle sg-cell-truncate" title="${escapeHtml(g.description)}">${escapeHtml(g.description)}</td>
                <td>${escapeHtml(g.defaultDuration)}</td>
                <td><span class="pill ${g.active ? "pill-green" : "pill-slate"}">${g.active ? "Active" : "Deactivated"}</span></td>
                <td class="sg-row-actions">
                  ${canManage ? iconBtn("edit", { act: "edit", id: g.gateCode, title: "Edit gate" }) : ""}
                  ${canManage ? iconBtn("power", { act: "toggle", id: g.gateCode, title: g.active ? "Deactivate gate" : "Activate gate" }) : ""}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${paginationHtml(page, totalPages, total, PAGE_SIZE)}
    `;

    document.getElementById("btnCreate")?.addEventListener("click", () => openGateModal(null, draw));
    document.querySelectorAll('[data-act="edit"]').forEach((btn) => btn.addEventListener("click", () => openGateModal(gates.find((g) => g.gateCode === btn.dataset.id), draw)));
    document.querySelectorAll('[data-act="toggle"]').forEach((btn) => btn.addEventListener("click", async () => {
      const g = gates.find((x) => x.gateCode === btn.dataset.id);
      if (g.active && !(await confirmDialog(`Deactivate gate "${g.gateCode}"? It will no longer be selectable in new Project Templates.`))) return;
      setGateActive(g.gateCode, !g.active, user.name, user.businessRole);
      toast(g.active ? "Gate deactivated" : "Gate activated", "success");
      draw();
    }));
    wirePagination(contentEl(), (p) => { state.page = p; draw(); });

    if (canManage) {
      wireDragReorder(document.getElementById("gmTbody"), "tr[data-dnd-id]", (orderedCodesOnPage) => {
        // Splice the reordered page back into the full sequence, keeping other pages' gates in place.
        const fullOrder = gates.map((g) => g.gateCode);
        const pageIds = new Set(pageItems.map((g) => g.gateCode));
        let cursor = 0;
        const merged = fullOrder.map((code) => (pageIds.has(code) ? orderedCodesOnPage[cursor++] : code));
        saveGateOrder(merged, user.name, user.businessRole);
        toast("Gate order updated", "success");
        draw();
      });
    }
  }

  draw();
}

function openGateModal(gate, onDone) {
  const editing = !!gate;
  const user = getActiveUser();
  openDrawer({
    width: "40%",
    title: editing ? `Edit Gate — ${gate.gateCode}` : "New Gate",
    bodyHtml: `
      <div class="sg-form-grid">
        <label>Gate Code<input type="text" id="gCode" value="${escapeHtml(gate?.gateCode || "")}" ${editing ? "disabled" : ""} placeholder="e.g. PPAP" required /></label>
        <label>Gate Name<input type="text" id="gName" value="${escapeHtml(gate?.gateName || "")}" required /></label>
        <label class="span-2">Description<textarea id="gDesc" rows="3">${escapeHtml(gate?.description || "")}</textarea></label>
        <label>Default Duration<input type="text" id="gDuration" value="${escapeHtml(gate?.defaultDuration || "4 weeks")}" /></label>
      </div>
    `,
    footerHtml: `<button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">${editing ? "Save" : "Create"}</button>`,
    onMount: (backdrop, close, requestClose) => {
      backdrop.querySelector('[data-act="cancel"]').addEventListener("click", requestClose);
      backdrop.querySelector('[data-act="save"]').addEventListener("click", () => {
        const payload = {
          gateCode: document.getElementById("gCode").value.trim().toUpperCase(),
          gateName: document.getElementById("gName").value.trim(),
          description: document.getElementById("gDesc").value.trim(),
          defaultDuration: document.getElementById("gDuration").value.trim(),
        };
        if (!payload.gateCode || !payload.gateName) { toast("Gate code and name are required.", "error"); return; }
        try {
          if (editing) updateGate(gate.gateCode, payload, user.name, user.businessRole);
          else createGate(payload, user.name, user.businessRole);
          close();
          toast(editing ? "Gate updated" : "Gate created", "success");
          onDone();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    },
  });
}
