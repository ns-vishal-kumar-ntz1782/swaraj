// Gate Checklist — now project-centric: pick one of the 15 real projects, then work through its
// full gate sequence (however many gates its template defines) as an accordion. Deliverables,
// documents, the checklist, and the approval workflow all live inline on this one page — no
// modal/popup and no page navigation for any of it, per the explicit "everything happens inside
// the existing Gate page" requirement. Documents belong to Deliverable Assignments (never
// duplicated here); the checklist only references them.
import { getActiveUser } from "../store/users.js";
import { can } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import {
  listProjects, getProject, listGateInstances, listAssignments,
  checklistItemsForGate, computeChecklistStatus, canSubmitGate, submitGateForApproval,
  respondToGateApproval, closeGateInstance, updateAssignmentStatus,
  uploadDocument, replaceDocument, removeDocument, gateInfo,
  READ_ONLY_STATUSES, EDITABLE_STATUSES,
} from "../store/projectExecution.js";
import { getProjectTeam, displayFor } from "../store/orgDirectory.js";
import { escapeHtml, fmtDateTime, statusPillClass, toast } from "../utils.js";
import { navigate } from "../router.js";

const ASSIGNMENT_STATUSES = ["Backlog", "Not Started", "In Progress", "Blocked", "Ready for Review", "Completed", "Rejected", "Overdue"];
const CHEVRON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

// The document/deliverable "who did this" fields must be a member of the record's own project
// team (data/projectMembers.json) — the admin console's own logged-in identity (getActiveUser(),
// a 4-role login model) has no counterpart in that 241-person roster, so it can never literally
// be the uploader. Deliverable ownership already names a responsible team member, so uploads are
// attributed to that deliverable's first responsible member — the same deterministic substitute
// used for "who's recording an approval response" below, just without an extra picker since a
// single natural owner already exists.
function defaultUploaderFor(a, projectCode) {
  if (a.responsibleMemberUserIds && a.responsibleMemberUserIds.length) return a.responsibleMemberUserIds[0];
  const team = getProjectTeam(projectCode);
  return team.length ? team[0].userId : null;
}

function healthPillClass(h) {
  return h === "Green" ? "pill-green" : h === "Amber" ? "pill-amber" : "pill-red";
}
function bucketOf(status) {
  if (READ_ONLY_STATUSES.includes(status)) return "readonly";
  if (EDITABLE_STATUSES.includes(status)) return "editable";
  if (status === "UnderReview") return "review";
  return "locked"; // NotStarted
}

// ============================== LIST — the 15 real projects ==============================
export async function renderGateList() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Gate Checklist");
  setActiveMenu("gates");

  const projects = listProjects();
  contentEl().innerHTML = `
    <div class="sg-page-header">
      <h1>Gate Checklist</h1>
      <p class="sg-subtle">${projects.length} project${projects.length === 1 ? "" : "s"} — select one to review its gate checklist and approvals.</p>
    </div>
    <div class="sg-table-wrap">
      <table class="sg-table">
        <thead><tr><th>Code</th><th>Project</th><th>Type</th><th>Current Gate</th><th>Progress</th><th>Health</th><th>Status</th></tr></thead>
        <tbody>
          ${projects.map((p) => `
            <tr class="sg-row-clickable" data-code="${escapeHtml(p.code)}">
              <td>${escapeHtml(p.code)}</td>
              <td><strong>${escapeHtml(p.name)}</strong><div class="sg-subtle">${escapeHtml(p.productFamily)}</div></td>
              <td><span class="chip">${escapeHtml(p.projectTypeCode)}</span></td>
              <td>${p.currentGate ? escapeHtml(p.currentGate) : "—"}</td>
              <td><div class="sg-mini-bar"><div class="sg-mini-bar-fill" style="width:${p.overallProgress}%"></div></div><span class="sg-mini-bar-label">${p.overallProgress}%</span></td>
              <td><span class="pill ${healthPillClass(p.projectHealth)}">${p.projectHealth}</span></td>
              <td><span class="pill ${statusPillClass(p.status)}">${p.status}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  document.querySelectorAll(".sg-row-clickable[data-code]").forEach((row) => {
    row.addEventListener("click", () => navigate(`/gates/${row.dataset.code}`));
  });
}

// ============================== WORKSPACE — one project's full gate accordion ==============================
export async function renderGateWorkspace(params) {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setActiveMenu("gates");

  const project = getProject(params.projectCode);
  if (!project) {
    contentEl().innerHTML = `<div class="sg-empty-state">Project not found. <a href="#/gates">Back to Gate Checklist</a></div>`;
    return;
  }
  setBreadcrumb(`Gate Checklist / ${project.code}`);

  const canChecklist = can(user.businessRole, "gate.checklist.manage");
  const canClose = can(user.businessRole, "gate.approve");
  const openState = {}; // gateCode -> user has manually toggled a read-only gate open this visit

  function draw() {
    const proj = getProject(project.code); // re-fetch fresh after any mutation
    const instances = listGateInstances(proj.code);

    contentEl().innerHTML = `
      <div class="sg-page-header">
        <div>
          <h1>${escapeHtml(proj.name)} <span class="sg-subtle">(${escapeHtml(proj.code)})</span></h1>
          <p class="sg-subtle">${escapeHtml(proj.businessUnit)} · ${escapeHtml(proj.platform)} · ${escapeHtml(proj.productFamily)}</p>
        </div>
      </div>
      <div class="sg-detail-grid">
        <div class="sg-detail-card"><div class="sg-kpi-label">Project Manager</div>${escapeHtml(displayFor(proj.projectManagerUserId).name)}</div>
        <div class="sg-detail-card"><div class="sg-kpi-label">Program Manager</div>${escapeHtml(displayFor(proj.programManagerUserId).name)}</div>
        <div class="sg-detail-card"><div class="sg-kpi-label">Budget Consumed / Planned</div>₹${proj.budgetConsumed}L / ₹${proj.budgetPlanned}L</div>
        <div class="sg-detail-card"><div class="sg-kpi-label">Overall Progress</div>${proj.overallProgress}%</div>
        <div class="sg-detail-card"><div class="sg-kpi-label">Project Health</div><span class="pill ${healthPillClass(proj.projectHealth)}">${proj.projectHealth}</span></div>
        <div class="sg-detail-card"><div class="sg-kpi-label">Schedule Health</div><span class="pill ${healthPillClass(proj.scheduleHealth)}">${proj.scheduleHealth}</span></div>
      </div>
      <div class="adm-scroll" id="gateAccordion"></div>
    `;

    document.getElementById("gateAccordion").innerHTML = instances.map((gi) => renderGateItem(proj, gi)).join("");
    wireGateItems(proj, instances);
  }

  function renderGateItem(proj, gi) {
    const info = gateInfo(gi.gateCode);
    const bucket = bucketOf(gi.currentStatus);
    const disabled = bucket === "locked";
    const openByDefault = bucket === "editable" || bucket === "review";
    const openClass = (openByDefault || openState[gi.gateCode]) ? " open" : "";
    const disabledClass = disabled ? " pd-gate-item-disabled" : "";

    return `
      <div class="pd-gate-item${openClass}${disabledClass}" data-gate="${escapeHtml(gi.gateCode)}">
        <div class="pd-gate-item-head">
          <span class="pd-gate-item-chevron">${CHEVRON_SVG}</span>
          <span class="pd-gate-item-label">${escapeHtml(gi.gateCode)} — ${escapeHtml(info ? info.gateName : "")}</span>
          <span class="pd-gate-item-meta">
            <span class="pd-gate-item-status pill ${statusPillClass(gi.currentStatus)}">${escapeHtml(gi.currentStatus)}</span>
            ${gi.gateProgress}%
          </span>
        </div>
        <div class="pd-gate-item-body">
          ${disabled ? `<p class="sg-subtle">Locked until the previous gate is approved.</p>` : renderGateBody(proj, gi, bucket)}
        </div>
      </div>
    `;
  }

  function renderGateBody(proj, gi, bucket) {
    const assignments = listAssignments(proj.code, gi.gateCode);
    const checklist = checklistItemsForGate(gi.gateCode);
    const readOnly = bucket === "readonly";
    const isReview = bucket === "review";
    const pendingApprovers = isReview ? (gi.approvalPanel || []).filter((ap) => !(gi.approvalResponses || {})[ap.userId]) : [];
    const isPendingApprover = pendingApprovers.length > 0;

    let html = "";
    if (readOnly) html += `<div class="gc-readonly-banner">✓ ${escapeHtml(gi.currentStatus)} — read only. Documents and approval history remain visible below.</div>`;
    if (isPendingApprover) html += renderApprovalBanner(gi, pendingApprovers);

    html += renderSummaryGrid(proj, gi, assignments, checklist);
    html += `<h3 class="sg-section-title">Deliverables</h3>`;
    html += renderDeliverableTable(assignments, !readOnly && !isReview && canChecklist);
    html += `<h3 class="sg-section-title">Checklist</h3>`;
    html += renderChecklistList(proj, gi, checklist);

    if (isReview) {
      html += `<h3 class="sg-section-title">Approval Progress</h3>`;
      html += renderApprovalProgress(gi);
    }
    html += `<h3 class="sg-section-title">Approval History</h3>`;
    html += renderApprovalHistory(gi);

    if (!readOnly && !isReview && canChecklist) {
      const { canSubmit, reasons } = canSubmitGate(proj.code, gi.gateCode);
      html += `
        <div class="gc-submit-bar">
          <div>${!canSubmit ? `<div class="gc-submit-reasons">${escapeHtml(reasons.join(" "))}</div>` : `<span class="sg-subtle">All conditions met — ready to submit.</span>`}</div>
          <button class="btn btn-primary" data-act="open-submit" data-gate="${escapeHtml(gi.gateCode)}" ${canSubmit ? "" : "disabled"}>Submit for Approval</button>
        </div>
        <div class="gc-inline-panel" id="submitPanel-${escapeHtml(gi.gateCode)}" hidden>
          ${renderApproverAssignmentPanel(proj, gi)}
        </div>
      `;
    }
    if (gi.currentStatus === "Approved" && canClose) {
      html += `<div class="gc-submit-bar"><span class="sg-subtle">Gate approved — ready to formally close.</span><button class="btn btn-secondary" data-act="close-gate" data-gate="${escapeHtml(gi.gateCode)}">Close Gate</button></div>`;
    }
    return html;
  }

  function renderSummaryGrid(proj, gi, assignments, checklist) {
    const mandatoryAssignments = assignments.filter((a) => a.mandatory);
    const completedMandatory = mandatoryAssignments.filter((a) => a.status === "Completed").length;
    const totalDocsRequired = assignments.reduce((s, a) => s + a.requiredDocuments.length, 0);
    const totalDocsUploaded = assignments.reduce((s, a) => s + a.uploadedDocuments.length, 0);
    const checklistDone = checklist.filter((c) => computeChecklistStatus(proj.code, gi.gateCode, c).completionStatus === "Completed").length;
    return `
      <div class="gc-summary-grid">
        <div class="gc-summary-card"><div class="gc-summary-label">Deliverable Completion</div><div class="gc-summary-value">${completedMandatory}/${mandatoryAssignments.length}</div></div>
        <div class="gc-summary-card"><div class="gc-summary-label">Checklist Completion</div><div class="gc-summary-value">${checklistDone}/${checklist.length}</div></div>
        <div class="gc-summary-card"><div class="gc-summary-label">Document Completion</div><div class="gc-summary-value">${totalDocsUploaded}/${totalDocsRequired}</div></div>
        <div class="gc-summary-card"><div class="gc-summary-label">Approval Status</div><div class="gc-summary-value"><span class="pill ${statusPillClass(gi.currentStatus)}">${escapeHtml(gi.currentStatus)}</span></div></div>
      </div>
    `;
  }

  function renderDeliverableTable(assignments, editable) {
    return `
      <div class="sg-table-wrap" style="flex:none; max-height:260px;">
      <table class="sg-table">
        <thead><tr><th>No</th><th>Deliverable</th><th>Mandatory</th><th>Responsible</th><th>Status</th><th>Progress</th><th>Documents</th></tr></thead>
        <tbody>
          ${assignments.length ? assignments.map((a) => `
            <tr>
              <td>${escapeHtml(a.deliverableNo)}</td>
              <td>${escapeHtml(a.deliverableName)}</td>
              <td>${a.mandatory ? "Yes" : "No"}</td>
              <td>${escapeHtml((a.responsibleMemberUserIds || []).map((uid) => displayFor(uid).name).join(", ") || "—")}</td>
              <td>${editable
                ? `<select class="sg-inline-select" data-act="assignment-status" data-id="${escapeHtml(a.assignmentId)}">${ASSIGNMENT_STATUSES.map((s) => `<option value="${s}" ${a.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>`
                : `<span class="pill ${statusPillClass(a.status)}">${escapeHtml(a.status)}</span>`}
              </td>
              <td>${a.progress}%</td>
              <td>${renderDocCell(a, editable)}</td>
            </tr>
          `).join("") : `<tr><td colspan="7" class="sg-empty-cell">No deliverables assigned.</td></tr>`}
        </tbody>
      </table>
      </div>
    `;
  }

  function renderDocCell(a, editable) {
    const pendingCount = Math.max(0, a.requiredDocuments.length - a.uploadedDocuments.length);
    return `
      <div>
        ${a.uploadedDocuments.map((d) => `
          <div class="gc-doc-row">
            <span class="gc-doc-name">📄 ${escapeHtml(d.fileName)} <span class="sg-subtle">v${d.version}</span></span>
            <div class="gc-doc-actions">
              <button type="button" data-act="doc-view" data-id="${escapeHtml(a.assignmentId)}" data-file="${escapeHtml(d.fileName)}">View</button>
              <button type="button" data-act="doc-download" data-id="${escapeHtml(a.assignmentId)}" data-file="${escapeHtml(d.fileName)}">Download</button>
              ${editable ? `<button type="button" data-act="doc-replace" data-id="${escapeHtml(a.assignmentId)}" data-file="${escapeHtml(d.fileName)}">Replace</button>` : ""}
              ${editable ? `<button type="button" class="danger" data-act="doc-remove" data-id="${escapeHtml(a.assignmentId)}" data-file="${escapeHtml(d.fileName)}">Remove</button>` : ""}
            </div>
          </div>
        `).join("")}
        ${pendingCount > 0 ? `<div class="gc-doc-pending">${pendingCount} pending</div>` : ""}
        ${editable && pendingCount > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-act="doc-upload" data-id="${escapeHtml(a.assignmentId)}">+ Upload</button>` : ""}
      </div>
    `;
  }

  function renderChecklistList(proj, gi, checklist) {
    if (!checklist.length) return `<div class="sg-empty-state">No checklist items defined for this gate.</div>`;
    return checklist.map((c) => {
      const s = computeChecklistStatus(proj.code, gi.gateCode, c);
      return `
        <div class="gc-checklist-row">
          <div>
            <div class="gc-checklist-title">${escapeHtml(c.title)} <span class="pill ${c.mandatory ? "pill-red" : "pill-slate"}" style="margin-left:6px">${c.mandatory ? "Mandatory" : "Optional"}</span></div>
            <div class="gc-checklist-desc">${escapeHtml(c.description)}</div>
          </div>
          <div class="gc-checklist-meta">
            <span class="gc-checklist-docs">${s.uploadedDocumentsCount} uploaded · ${s.pendingDocumentsCount} pending</span>
            <span class="pill ${statusPillClass(s.completionStatus)}">${s.completionStatus}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderApprovalHistory(gi) {
    const hist = gi.approvalHistory || [];
    if (!hist.length) return `<div class="sg-empty-state">No approval activity yet.</div>`;
    return `
      <div class="sg-timeline no-grow">
        ${hist.slice().reverse().map((h) => `
          <div class="sg-timeline-item">
            <div class="sg-timeline-dot ${statusPillClass(h.decision)}"></div>
            <div class="sg-timeline-body">
              <div class="sg-timeline-title">${escapeHtml(h.decision)} by ${escapeHtml(h.approverUserId ? displayFor(h.approverUserId).name : h.actorName)}</div>
              <div class="sg-timeline-time">${fmtDateTime(h.timestamp)}</div>
              ${h.comments ? `<div class="sg-timeline-comments">${escapeHtml(h.comments)}</div>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderApprovalProgress(gi) {
    return `<div class="sg-chip-row">${(gi.approvalPanel || []).map((ap) => {
      const resp = (gi.approvalResponses || {})[ap.userId];
      const info = displayFor(ap.userId);
      return `<span class="chip">${escapeHtml(info.name)} (${escapeHtml(info.role)}): ${resp ? escapeHtml(resp) : "Pending"}</span>`;
    }).join("")}</div>`;
  }

  function renderApprovalBanner(gi, pendingApprovers) {
    return `
      <div class="gc-approval-banner" style="flex-direction:column;align-items:stretch;">
        <span>This gate is awaiting approval. Record a response on behalf of the pending approver:</span>
        <select id="respAs-${escapeHtml(gi.gateCode)}" style="margin-top:8px;border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;font-size:12.5px;font-family:inherit">
          ${pendingApprovers.map((ap) => `<option value="${escapeHtml(ap.userId)}">${escapeHtml(displayFor(ap.userId).name)} — ${escapeHtml(displayFor(ap.userId).role)}</option>`).join("")}
        </select>
        <textarea id="respComments-${escapeHtml(gi.gateCode)}" rows="2" placeholder="Comments (required for reject / clarification)" style="width:100%;margin-top:8px;border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;font-size:12.5px;font-family:inherit"></textarea>
        <div class="gc-abtns" style="margin-left:0;margin-top:8px">
          <button class="btn btn-primary btn-sm" data-act="respond-approve" data-gate="${escapeHtml(gi.gateCode)}">Approve</button>
          <button class="btn btn-danger btn-sm" data-act="respond-reject" data-gate="${escapeHtml(gi.gateCode)}">Reject</button>
          <button class="btn btn-ghost btn-sm" data-act="respond-clarify" data-gate="${escapeHtml(gi.gateCode)}">Request Clarification</button>
        </div>
      </div>
    `;
  }

  function renderApproverAssignmentPanel(proj, gi) {
    const team = getProjectTeam(proj.code);
    const rows = [0, 1, 2, 3].map((i) => `
      <div class="gc-approver-row">
        <select class="gc-appr-userid" data-idx="${i}">
          <option value="">— none —</option>
          ${team.map((m) => `<option value="${escapeHtml(m.userId)}">${escapeHtml(m.user ? m.user.fullName : m.userName)} — ${escapeHtml(m.projectRole)}</option>`).join("")}
        </select>
        <input type="number" class="gc-appr-order" data-idx="${i}" value="${i + 1}" min="1" title="Approval order" />
        <input type="text" class="gc-appr-comments" data-idx="${i}" placeholder="Comments (optional)" style="flex:1;min-width:140px" />
      </div>
    `).join("");
    return `
      <h4>Assign Approvers — select 1 or more project members</h4>
      ${rows}
      <div class="sg-form-actions">
        <button class="btn btn-ghost" data-act="cancel-submit" data-gate="${escapeHtml(gi.gateCode)}">Cancel</button>
        <button class="btn btn-primary" data-act="confirm-submit" data-gate="${escapeHtml(gi.gateCode)}">Confirm Submit</button>
      </div>
    `;
  }

  function wireGateItems(proj, instances) {
    document.querySelectorAll(".pd-gate-item:not(.pd-gate-item-disabled) > .pd-gate-item-head").forEach((head) => {
      head.addEventListener("click", () => {
        const item = head.closest(".pd-gate-item");
        const gateCode = item.dataset.gate;
        const nowOpen = !item.classList.contains("open");
        item.classList.toggle("open", nowOpen);
        openState[gateCode] = nowOpen;
      });
    });

    document.querySelectorAll('select[data-act="assignment-status"]').forEach((sel) => {
      sel.addEventListener("click", (e) => e.stopPropagation());
      sel.addEventListener("change", () => {
        try {
          updateAssignmentStatus(sel.dataset.id, sel.value, user.name, user.businessRole);
          toast("Deliverable status updated", "success");
          draw();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });

    document.querySelectorAll('button[data-act^="doc-"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const { act, id, file } = btn.dataset;
        if (act === "doc-view" || act === "doc-download") {
          toast(`${act === "doc-view" ? "Viewing" : "Downloading"} ${file} (simulated — no file storage in this demo).`, "info");
          return;
        }
        const findAssignment = () => instances.flatMap((g) => listAssignments(proj.code, g.gateCode)).find((a) => a.assignmentId === id);
        if (act === "doc-upload") {
          const fileName = window.prompt("Enter a file name to simulate an upload:", "document.pdf");
          if (!fileName) return;
          uploadDocument(id, fileName, defaultUploaderFor(findAssignment(), proj.code), user.name, user.businessRole);
          toast("Document uploaded", "success");
          draw();
        } else if (act === "doc-replace") {
          const fileName = window.prompt("Enter the replacement file name:", file);
          if (!fileName) return;
          replaceDocument(id, file, fileName, defaultUploaderFor(findAssignment(), proj.code), user.name, user.businessRole);
          toast("Document replaced", "success");
          draw();
        } else if (act === "doc-remove") {
          if (!window.confirm(`Remove "${file}"?`)) return;
          removeDocument(id, file, user.name, user.businessRole);
          toast("Document removed", "success");
          draw();
        }
      });
    });

    document.querySelectorAll('button[data-act="open-submit"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const panel = document.getElementById(`submitPanel-${btn.dataset.gate}`);
        if (panel) panel.hidden = !panel.hidden;
      });
    });
    document.querySelectorAll('button[data-act="cancel-submit"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const panel = document.getElementById(`submitPanel-${btn.dataset.gate}`);
        if (panel) panel.hidden = true;
      });
    });
    document.querySelectorAll('button[data-act="confirm-submit"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const gateCode = btn.dataset.gate;
        const panel = document.getElementById(`submitPanel-${gateCode}`);
        const rows = Array.from(panel.querySelectorAll(".gc-approver-row"));
        const approvalPanel = rows.map((row) => {
          const userId = row.querySelector(".gc-appr-userid").value;
          if (!userId) return null;
          return {
            userId,
            approvalOrder: Number(row.querySelector(".gc-appr-order").value) || 1,
            comments: row.querySelector(".gc-appr-comments").value.trim(),
          };
        }).filter(Boolean);
        try {
          submitGateForApproval(proj.code, gateCode, approvalPanel, user.name, user.businessRole);
          toast("Gate submitted for approval", "success");
          draw();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });

    document.querySelectorAll('button[data-act^="respond-"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const gateCode = btn.dataset.gate;
        const decision = btn.dataset.act === "respond-approve" ? "Approved" : btn.dataset.act === "respond-reject" ? "Rejected" : "ClarificationRequested";
        const respondingUserId = document.getElementById(`respAs-${gateCode}`)?.value;
        const comments = document.getElementById(`respComments-${gateCode}`)?.value.trim() || "";
        if (!respondingUserId) {
          toast("Select which approver this response is for.", "error");
          return;
        }
        if (decision !== "Approved" && !comments) {
          toast("Comments are required to reject or request clarification.", "error");
          return;
        }
        try {
          respondToGateApproval(proj.code, gateCode, respondingUserId, user.name, user.businessRole, decision, comments);
          toast(`Recorded: ${decision}`, "success");
          draw();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });

    document.querySelectorAll('button[data-act="close-gate"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!window.confirm("Close this gate?")) return;
        try {
          closeGateInstance(proj.code, btn.dataset.gate, user.name, user.businessRole, "");
          toast("Gate closed", "success");
          draw();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
  }

  draw();
}
