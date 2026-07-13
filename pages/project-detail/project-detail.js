// ==========================================================
//  PROJECT DETAIL — accordion layout, viewport-locked.
//  Matches Figma: current gate expanded by default, one top-level section open at a time.
// ==========================================================
(function () {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function $(id) { return document.getElementById(id); }

  // Minimal toast — used by the Gate Checklist approval workflow (approve/reject notifications).
  // This outer-app page has no shared toast component of its own (unlike the Admin Console).
  function showToast(msg, kind) {
    let host = $("pdToastHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "pdToastHost";
      host.className = "pd-toast-host";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = "pd-toast pd-toast-" + (kind || "info");
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add("visible"));
    setTimeout(() => { el.classList.remove("visible"); setTimeout(() => el.remove(), 250); }, 5000);
  }

  function sevCls(s) {
    return ({ Critical:"pd-b-critical",High:"pd-b-high",Medium:"pd-b-medium",Low:"pd-b-low" })[s] || "pd-b-low";
  }

  // Header is rendered by shared.js's renderTopNav("dashboard") — see the init call below —
  // so there's no page-local topnav wiring here anymore.

  // ── Overview ──
  function renderOverview(d) {
    $("ovTitle").textContent = d.projectName + " — Project Overview";
    const items = [
      ["Project Code", d.projectCode],
      ["Platform", d.platform],
      ["Project Category", d.category],
      ["SOP Date", d.sopDate],
      ["Project Leader", d.leaders.PEL || d.projectLeader],
    ];
    $("ovGrid").innerHTML = items.map(([k,v]) =>
      `<div class="pd-ov-item"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("");

    const L = d.leaders;
    const rows = [["PMgr",L.PMgr,d.teamMembers&&d.teamMembers[0]||"-"],["PEL",L.PEL,"-"],["PML",L.PML,d.teamMembers&&d.teamMembers[1]||d.teamMembers&&d.teamMembers[0]||"-"],["PVL",L.PVL,"-"]];
    $("roleTable").innerHTML =
      "<thead><tr><th>Role</th><th>Leader</th><th>Members</th></tr></thead><tbody>" +
      rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("") + "</tbody>";
  }

  // ── Health + Compliance Rate ──
  const _charts = {};
  function renderHealth(d) {
    $("delivFrac").textContent = d.deliverables.done + "/" + d.deliverables.total;
    $("goalsFrac").textContent  = d.goals.done + "/" + d.goals.total;
    _charts.deliv = window.PDCharts.buildGauge("deliverablesGauge", d.deliverables.pct);
    _charts.goals = window.PDCharts.buildGauge("goalsGauge", d.goals.pct);
    _charts.rate  = window.PDCharts.buildComplianceRate("complianceRateChart", d);
  }

  // ── Timeline ──
  function renderTimeline(d) {
    window.PDTimeline.renderStageGate($("stageGate"), d);
    window.PDTimeline.renderTimelineTable($("timelineTable"), d);
    window.PDTimeline.renderTimelineLegend($("timelineLegend"));
  }

  // ── Deliverables — gate-wise workspace ──
  function renderDeliverables(d) {
    const gateBar  = document.getElementById("dlvGateBar");
    const tbody    = document.getElementById("dlvTableBody");
    const banner   = document.getElementById("dlvFutureBanner");
    if (!gateBar || !tbody) return;

    // ── Permission tiers — Super Admin (full control, incl. Completed-gate override), PMO
    // Manager (assign/upload/update on the Active gate), R&D Head (the closest reachable analog
    // to an "assigned Engineer" — can update/upload only on rows that already have a responsible
    // member), everyone else read-only. See rowPermissions() below for the per-row breakdown. ──
    const currentRole = (typeof getCurrentRole === "function") ? getCurrentRole() : (sessionStorage.getItem("snpdRole") || "");
    const isSuperAdmin = currentRole === "SA";
    const isPMO = currentRole === "PMO";
    const isRD = currentRole === "RD";
    const actorName = (typeof roleDirectory !== "undefined" && roleDirectory[currentRole]) ? roleDirectory[currentRole].name : (currentRole || "User");
    const actorRoleBiz = (typeof currentBusinessRole === "function") ? (currentBusinessRole() || currentRole) : currentRole;
    const bridge = window.PDWorkspace || null;

    // Build gate list from gateDetails; use project gates array for status
    const gateDetails = d.gateDetails || [];
    if (!gateDetails.length) {
      tbody.innerHTML = '<tr class="dlv-empty-row"><td colspan="12">No gate data available for this project.</td></tr>';
      return;
    }

    // Determine status of each gate from the gates array (same data timeline uses)
    function gateStatus(gi) {
      const g = d.gates && d.gates[gi];
      if (!g) return gi < (d.gateReached || 0) ? "Completed" : "Future";
      const s = g.status;
      if (s === "In Progress") return "Active";
      if (s === "Completed" || s === "On Time" || s === "Delayed 15-60" || s === "Delayed >60") return "Completed";
      return "Future";
    }

    // State: which gate index is currently selected
    let selectedGateIdx = -1;
    for (let i = 0; i < gateDetails.length; i++) {
      if (gateStatus(i) === "Active") { selectedGateIdx = i; break; }
    }
    if (selectedGateIdx === -1) {
      for (let i = gateDetails.length - 1; i >= 0; i--) {
        if (gateStatus(i) === "Completed") { selectedGateIdx = i; break; }
      }
    }
    if (selectedGateIdx === -1) selectedGateIdx = 0;

    // ── Shared floating popover — one at a time, closed on outside click / Escape. Used by the
    // Responsible "+ Assign" control, the Documents cell, and the Actions "history" button. ──
    let openPopoverEl = null;
    function closePopover() {
      if (openPopoverEl) { openPopoverEl.remove(); openPopoverEl = null; }
      document.removeEventListener("mousedown", onPopoverOutsideClick, true);
      document.removeEventListener("keydown", onPopoverEscape, true);
    }
    function onPopoverOutsideClick(e) { if (openPopoverEl && !openPopoverEl.contains(e.target)) closePopover(); }
    function onPopoverEscape(e) { if (e.key === "Escape") closePopover(); }
    function openPopover(anchorEl, innerHtml, extraClass) {
      closePopover();
      const pop = document.createElement("div");
      pop.className = "dlv-popover" + (extraClass ? " " + extraClass : "");
      pop.innerHTML = innerHtml;
      document.body.appendChild(pop);
      const r = anchorEl.getBoundingClientRect();
      pop.style.top = r.bottom + 6 + "px";
      pop.style.left = r.left + "px";
      openPopoverEl = pop;
      requestAnimationFrame(() => {
        const pr = pop.getBoundingClientRect();
        if (pr.right > window.innerWidth - 8) pop.style.left = Math.max(8, window.innerWidth - pr.width - 8) + "px";
        if (pr.bottom > window.innerHeight - 8) pop.style.top = Math.max(8, r.top - pr.height - 6) + "px";
      });
      setTimeout(() => {
        document.addEventListener("mousedown", onPopoverOutsideClick, true);
        document.addEventListener("keydown", onPopoverEscape, true);
      }, 0);
      return pop;
    }

    // ── Build gate progress bar ──
    function buildGateBar() {
      const steps = gateDetails.map((g, gi) => {
        const st = gateStatus(gi);
        const isSelected = gi === selectedGateIdx;

        const btnClass = [
          "dlv-gate-btn",
          st === "Completed" ? "dlv-gate-completed" : "",
          st === "Active"    ? "dlv-gate-active"    : "",
          st === "Future"    ? "dlv-gate-future"    : "",
          isSelected         ? "dlv-gate-selected"  : "",
        ].filter(Boolean).join(" ");

        let circleInner = String(gi + 1);
        if (st === "Completed") {
          circleInner = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        }

        const connector = gi < gateDetails.length - 1 ? `<div class="dlv-gate-connector"></div>` : "";
        const stepClass = st === "Completed" ? "dlv-gate-step dlv-gate-step-done" : "dlv-gate-step";

        return `<div class="${stepClass}">
          <button class="${btnClass}" data-gate-idx="${gi}" type="button">
            <div class="dlv-gate-circle">${circleInner}</div>
            <span class="dlv-gate-label">${esc(g.stage)}</span>
          </button>${connector}
        </div>`;
      }).join("");

      gateBar.innerHTML = steps;
      gateBar.querySelectorAll(".dlv-gate-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          selectedGateIdx = parseInt(btn.dataset.gateIdx, 10);
          buildGateBar();
          buildTable();
        });
      });
    }

    // ── RAG calculation ──
    function calcRag(delayDays, isNotStarted) {
      if (isNotStarted) return "grey";
      if (delayDays === null || delayDays === undefined || delayDays < 0) return "green";
      if (delayDays <= 15)  return "green";
      if (delayDays <= 60)  return "amber";
      return "red";
    }

    // ── Status helpers — keyed by the REAL status value stored on the assignment record (Not
    // Started/Assigned/In Progress/Ready for Review/Completed/Rejected/Rework/Blocked), since
    // x.status now round-trips straight to/from that record via the workspace bridge. "Not
    // Started" displays as "Pending" (the spec's vocabulary for the same state) without needing
    // a second stored value. ──
    function statusClass(s) {
      const map = {
        "Not Started":"dlv-s-pending", "Blocked":"dlv-s-pending",
        "Assigned":"dlv-s-assigned",
        "In Progress":"dlv-s-inprogress",
        "Ready for Review":"dlv-s-review",
        "Completed":"dlv-s-completed",
        "Rejected":"dlv-s-rejected",
        "Rework":"dlv-s-rework",
      };
      return map[s] || "dlv-s-pending";
    }
    function statusLabel(s) {
      if (s === "Not Started") return "Pending";
      return s || "Pending";
    }
    // Enforces Pending→Assigned→In Progress→Ready for Review→Completed, or →Rejected→Rework→
    // Completed — the dropdown only ever offers the current value plus its valid next step(s).
    const FORWARD_PATH = ["Not Started","Assigned","In Progress","Ready for Review","Completed"];
    function nextAllowedStatuses(current) {
      if (current === "Rejected") return ["Rejected","Rework"];
      if (current === "Rework") return ["Rework","In Progress","Completed"];
      const i = FORWARD_PATH.indexOf(current);
      const base = i >= 0 ? FORWARD_PATH.slice(i, i + 2) : [current];
      return [...new Set([...base, "Rejected"])];
    }
    // Deterministic pseudo file size (no real "size" field on uploaded documents) — same
    // hash-based seeding principle used throughout this app's other synthesized-but-stable content.
    function pseudoFileSize(fileName) {
      let h = 2166136261;
      for (let i = 0; i < fileName.length; i++) { h ^= fileName.charCodeAt(i); h = Math.imul(h, 16777619); }
      const kb = 80 + (Math.abs(h) % 4200);
      return kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB";
    }
    // Per-row permission tiers — see the header comment above for the reasoning behind mapping
    // R&D Head to "can only touch rows that already have a responsible member assigned."
    function rowPermissions(x, isFuture, isCompleted) {
      const none = { canEditStatus:false, canEditDates:false, canEditRemarks:false, canAssign:false, canUpload:false };
      if (isFuture) return none;
      if (isSuperAdmin) return { canEditStatus:true, canEditDates:true, canEditRemarks:true, canAssign:true, canUpload:true };
      if (isCompleted) return none;
      if (isPMO) return { canEditStatus:true, canEditDates:true, canEditRemarks:true, canAssign:true, canUpload:true };
      if (isRD) {
        const hasResp = Array.isArray(x.responsible) && x.responsible.length > 0;
        return { canEditStatus:hasResp, canEditDates:false, canEditRemarks:hasResp, canAssign:false, canUpload:hasResp };
      }
      return none;
    }

    // ── Popover content builders ──
    function buildResponsiblePopoverHtml(team, selectedIds) {
      const rows = team.map(m => {
        const name = m.user ? m.user.fullName : m.userName;
        return `<label class="dlv-pop-row">
          <input type="checkbox" value="${esc(m.userId)}" ${selectedIds.has(m.userId) ? "checked" : ""}>
          <span class="dlv-pop-row-name">${esc(name)}</span>
          <span class="dlv-pop-row-sub">${esc(m.projectRole || "")}</span>
        </label>`;
      }).join("");
      return `
        <div class="dlv-pop-head">Assign Responsible Member(s)</div>
        <input type="text" class="dlv-pop-search" placeholder="Search project members…">
        <div class="dlv-pop-list">${rows || '<div class="dlv-pop-empty">No project members found.</div>'}</div>
        <div class="dlv-pop-actions">
          <button type="button" class="dlv-pop-btn dlv-pop-cancel">Cancel</button>
          <button type="button" class="dlv-pop-btn dlv-pop-save">Save</button>
        </div>`;
    }
    function buildDocsPopoverHtml(x, canUpload) {
      const rows = (x.uploadedDocuments || []).map(doc => {
        const uploader = bridge ? bridge.displayFor(doc.uploadedByUserId).name : doc.uploadedByUserId;
        return `<tr><td>${esc(doc.fileName)}</td><td>v${doc.version || 1}</td><td>${esc(uploader)}</td><td>${esc(doc.uploadedAt || "-")}</td><td>${pseudoFileSize(doc.fileName)}</td></tr>`;
      }).join("");
      return `
        <div class="dlv-pop-head">Documents — ${esc(x.name)}</div>
        <table class="dlv-pop-doctable">
          <thead><tr><th>Name</th><th>Ver</th><th>Uploaded By</th><th>Date</th><th>Size</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="dlv-pop-empty">No documents uploaded yet.</td></tr>'}</tbody>
        </table>
        ${canUpload ? `<div class="dlv-pop-upload">
          <input type="text" class="dlv-pop-filename" placeholder="File name (e.g. Report_v2.pdf)">
          <button type="button" class="dlv-pop-btn dlv-pop-save dlv-pop-upload-btn">Upload</button>
        </div>` : ""}`;
    }
    function buildHistoryPopoverHtml(entries) {
      const rows = entries.slice(0, 25).map(e => `
        <div class="dlv-pop-hist-row">
          <div class="dlv-pop-hist-top"><strong>${esc(e.action || "Update")}</strong><span>${esc((e.timestamp || "").slice(0, 10))}</span></div>
          <div class="dlv-pop-hist-sub">${esc(e.summary || "")}${e.actorName ? " — " + esc(e.actorName) : ""}</div>
        </div>`).join("");
      return `<div class="dlv-pop-head">Audit History</div><div class="dlv-pop-hist-list">${rows || '<div class="dlv-pop-empty">No history recorded yet.</div>'}</div>`;
    }

    // ── Format ISO date to DD Mon YY for display ──
    const MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function isoToDisplay(iso) {
      if (!iso || iso === "-") return "—";
      // Already formatted (e.g. "07 Jul 26") — pass through
      if (!/^\d{4}-/.test(iso)) return iso;
      const d2 = new Date(iso + "T00:00:00");
      if (isNaN(d2)) return "—";
      return String(d2.getDate()).padStart(2,"0") + " " + MON3[d2.getMonth()] + " " + String(d2.getFullYear()).slice(2);
    }
    // Convert display date to YYYY-MM-DD for date inputs
    function displayToISO(display) {
      if (!display || display === "—") return "";
      if (/^\d{4}-/.test(display)) return display;
      const parts = display.trim().split(" ");
      if (parts.length < 3) return "";
      const day = parts[0].padStart(2,"0");
      const mo = MON3.indexOf(parts[1]);
      if (mo < 0) return "";
      const yr = parseInt(parts[2]) < 100 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
      return `${yr}-${String(mo+1).padStart(2,"0")}-${day}`;
    }

    // ── Build table ──
    function buildTable() {
      const gd = gateDetails[selectedGateIdx];
      const st = gateStatus(selectedGateIdx);
      const isFuture    = st === "Future";
      const isCompleted = st === "Completed";

      if (banner) banner.hidden = !isFuture;

      if (!gd || !gd.deliverables || !gd.deliverables.length) {
        tbody.innerHTML = `<tr class="dlv-empty-row"><td colspan="12">No deliverables defined for this gate.</td></tr>`;
        return;
      }

      // Re-fetches one deliverable's fresh record after a bridge mutation, re-derives its display
      // fields via the same transform the seed used (window.mapAssignmentToDisplay), splices it
      // back into this gate's list, and re-renders — so a persisted edit is reflected immediately
      // without losing the rest of the table's state.
      function refreshRow(idx, freshAssignment) {
        if (freshAssignment && typeof window.mapAssignmentToDisplay === "function") {
          gd.deliverables[idx] = window.mapAssignmentToDisplay(freshAssignment);
        }
        buildTable();
      }

      const rows = gd.deliverables.map((x, i) => {
        // ── Planned Start/End — the seed now provides these as two distinct real fields
        // (x.plannedDate / x.plannedEndDate, from the assignment's own plannedStart/targetDate,
        // clamped to a 5–60 day gap) — no longer duplicated from a single value. ──
        const plannedStartISO = isFuture ? "" : (x.plannedDate && x.plannedDate !== "-" ? displayToISO(x.plannedDate) || x.plannedDate : "");
        const plannedEndISO   = isFuture ? "" : (x.plannedEndDate && x.plannedEndDate !== "-" ? displayToISO(x.plannedEndDate) || x.plannedEndDate : "");
        const actualISO       = isFuture ? "" : (x.actualDate && x.actualDate !== "-" ? displayToISO(x.actualDate) || x.actualDate : "");

        const plannedStartDisplay = isoToDisplay(plannedStartISO) || "—";
        const plannedEndDisplay   = isoToDisplay(plannedEndISO)   || "—";
        const actualDisplay       = isoToDisplay(actualISO)       || "—";

        // RAG
        const delayDays = (!isFuture && x.delayDays !== undefined) ? x.delayDays : null;
        const rag = calcRag(delayDays, isFuture);
        const ragHtml = `<span class="dlv-rag-dot dlv-rag-${rag}" title="${delayDays !== null ? delayDays + ' day' + (delayDays === 1 ? '' : 's') + ' delay' : ''}"></span>`;

        // Status — real value (see statusClass/statusLabel above); Future-gate rows are always
        // "Not Started" ("Pending" once displayed) regardless of anything on the underlying record.
        const rawStatus = isFuture ? "Not Started" : (x.status || "Not Started");

        // Code
        const code = x.dependency && x.dependency !== "-"
          ? esc(x.dependency).substring(0, 12)
          : `${gd.stage.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(2, "0")}`;

        const remarks = isFuture ? "" : (x.remarks === "-" ? "" : x.remarks || "");
        // A deliverable can have several responsible members (real data: responsibleMemberUserIds
        // is an array) — x.responsible carries the full list; x.owner (first name only) stays as
        // a fallback for any record seeded before this field existed.
        const responsibleList = isFuture ? [] : (Array.isArray(x.responsible) && x.responsible.length ? x.responsible : (x.owner && x.owner !== "Unassigned" ? [x.owner] : []));
        const docs = isFuture ? [] : (x.uploadedDocuments || []);

        const perms = rowPermissions(x, isFuture, isCompleted);

        // ── Responsible cell ──
        let respCell;
        if (isFuture) {
          respCell = `<span class="dlv-unassigned">Not Assigned</span>`;
        } else {
          const chipsHtml = responsibleList.length
            ? `<div class="${perms.canAssign ? "dlv-resp-chips" : "dlv-responsible dlv-resp-chips-ro"}">${responsibleList.map((m, mi) =>
                perms.canAssign
                  ? `<span class="dlv-resp-chip">${esc(m)}<button type="button" class="dlv-resp-chip-x" data-remove-idx="${mi}" aria-label="Remove ${esc(m)}">✕</button></span>`
                  : `<span class="dlv-resp-chip-ro">${esc(m)}</span>`
              ).join("")}</div>`
            : `<span class="dlv-unassigned">Unassigned</span>`;
          const addBtn = perms.canAssign ? `<button type="button" class="dlv-resp-assign-btn">+ Assign</button>` : "";
          respCell = `<div class="dlv-resp-multi" data-idx="${i}">${chipsHtml}${addBtn}</div>`;
        }

        // ── Date / status / remarks cells ──
        let startCell, endCell, actualCell, statusCell, remarksCell;
        if (perms.canEditDates) {
          startCell = `<input class="dlv-edit-date" type="date" data-field="plannedStart" value="${plannedStartISO}">`;
          endCell   = `<input class="dlv-edit-date" type="date" data-field="plannedEnd" value="${plannedEndISO}">`;
          actualCell= `<input class="dlv-edit-date" type="date" data-field="actualClosure" value="${actualISO}">`;
        } else {
          startCell  = `<span style="color:var(--color-slate-680);font-size:var(--fs-11)">${isFuture ? "" : plannedStartDisplay}</span>`;
          endCell    = `<span style="color:var(--color-slate-680);font-size:var(--fs-11)">${isFuture ? "" : plannedEndDisplay}</span>`;
          actualCell = `<span style="color:var(--color-slate-680);font-size:var(--fs-11)">${isFuture ? "" : actualDisplay}</span>`;
        }
        if (perms.canEditStatus) {
          statusCell = `<select class="dlv-edit-select dlv-edit-status" data-field="status">
            ${nextAllowedStatuses(rawStatus).map(s => `<option value="${s}"${rawStatus === s ? " selected" : ""}>${esc(statusLabel(s))}</option>`).join("")}
          </select>`;
        } else {
          statusCell = `<span class="dlv-status ${statusClass(rawStatus)}">${esc(statusLabel(rawStatus))}</span>`;
        }
        if (perms.canEditRemarks) {
          remarksCell = `<input class="dlv-edit-text" type="text" data-field="remarks" value="${esc(remarks)}" placeholder="Add remarks…">`;
        } else {
          remarksCell = `<span style="font-size:var(--fs-11);color:var(--color-slate-780)">${esc(remarks) || "—"}</span>`;
        }

        // ── Documents cell ──
        const docCount = docs.length;
        const docLabel = docCount ? `${docCount} Document${docCount === 1 ? "" : "s"}` : "No Documents";
        const docCell = `<button type="button" class="dlv-doc-btn" data-doc-idx="${i}" ${isFuture ? "disabled" : ""}>${esc(docLabel)}</button>`;

        // ── Actions cell (History) ──
        const actionsCell = `<button type="button" class="dlv-action-btn" data-hist-idx="${i}" title="View history" ${isFuture ? "disabled" : ""}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </button>`;

        const rowEditable = perms.canEditStatus || perms.canEditDates || perms.canEditRemarks || perms.canAssign || perms.canUpload;
        const rowClass = isCompleted ? "dlv-row-readonly" : (rowEditable ? "dlv-row-editable" : "");

        return `<tr class="${rowClass}" data-idx="${i}">
          <td style="text-align:center;color:var(--color-slate-530)">${i + 1}</td>
          <td style="font-weight:var(--fw-600);color:var(--color-slate-780);font-size:var(--fs-10)">${code}</td>
          <td><span class="dlv-name-link">${esc(x.name)}</span></td>
          <td class="dlv-td-resp">${respCell}</td>
          <td class="dlv-td-date">${startCell}</td>
          <td class="dlv-td-date">${endCell}</td>
          <td class="dlv-td-date">${actualCell}</td>
          <td style="text-align:center">${ragHtml}</td>
          <td class="dlv-td-status">${statusCell}</td>
          <td class="dlv-td-remarks">${remarksCell}</td>
          <td style="text-align:center">${docCell}</td>
          <td style="text-align:center">${actionsCell}</td>
        </tr>`;
      }).join("");

      tbody.innerHTML = rows;

      // ── Wire every interactive control, row by row ──
      tbody.querySelectorAll("tr[data-idx]").forEach(row => {
        const idx = parseInt(row.dataset.idx, 10);
        const x = gd.deliverables[idx];
        const perms = rowPermissions(x, isFuture, isCompleted);

        // Status / date / remarks edits — each persists through the bridge immediately on change.
        row.querySelectorAll("[data-field]").forEach(input => {
          input.addEventListener("change", () => {
            if (!bridge) { showToast("Cannot save — workspace not ready.", "error"); return; }
            const field = input.dataset.field;
            const val = input.value;
            try {
              let fresh;
              if (field === "status") {
                fresh = bridge.updateAssignmentStatus(x.assignmentId, val, actorName, actorRoleBiz);
                showToast(`${x.name} status set to ${statusLabel(val)}.`, "success");
              } else {
                const fieldMap = { plannedStart: "plannedStart", plannedEnd: "targetDate", actualClosure: "actualEnd", remarks: "remarks" };
                fresh = bridge.updateAssignmentFields(x.assignmentId, { [fieldMap[field]]: val || null }, actorName, actorRoleBiz);
              }
              refreshRow(idx, fresh);
            } catch (e) { showToast("Could not save: " + e.message, "error"); }
          });
        });

        // Responsible: remove one chip, or open the searchable "+ Assign" popover.
        row.querySelectorAll(".dlv-resp-chip-x").forEach(btn => {
          btn.addEventListener("click", () => {
            if (!bridge) return;
            const removeIdx = parseInt(btn.dataset.removeIdx, 10);
            const remainingIds = (x.responsibleIds || []).filter((_, mi) => mi !== removeIdx);
            try {
              const fresh = bridge.assignResponsibleMembers(x.assignmentId, remainingIds, actorName, actorRoleBiz);
              refreshRow(idx, fresh);
            } catch (e) { showToast("Could not remove member: " + e.message, "error"); }
          });
        });
        const assignBtn = row.querySelector(".dlv-resp-assign-btn");
        if (assignBtn) {
          assignBtn.addEventListener("click", () => {
            if (!bridge) return;
            const team = bridge.getProjectTeam(d.projectCode);
            const selectedIds = new Set(x.responsibleIds || []);
            const pop = openPopover(assignBtn, buildResponsiblePopoverHtml(team, selectedIds), "dlv-resp-popover");
            pop.querySelector(".dlv-pop-search").addEventListener("input", (e) => {
              const q = e.target.value.toLowerCase();
              pop.querySelectorAll(".dlv-pop-row").forEach(r => { r.hidden = !r.textContent.toLowerCase().includes(q); });
            });
            pop.querySelector(".dlv-pop-cancel").addEventListener("click", closePopover);
            pop.querySelector(".dlv-pop-save").addEventListener("click", () => {
              const ids = [...pop.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
              closePopover();
              try {
                const fresh = bridge.assignResponsibleMembers(x.assignmentId, ids, actorName, actorRoleBiz);
                showToast(`Assigned ${x.name} to ${ids.length} member(s).`, "success");
                refreshRow(idx, fresh);
              } catch (e) { showToast("Could not assign: " + e.message, "error"); }
            });
          });
        }

        // Documents popover — view always available (when not Future); upload only if permitted.
        const docBtn = row.querySelector(".dlv-doc-btn");
        if (docBtn && !docBtn.disabled) {
          docBtn.addEventListener("click", () => {
            const pop = openPopover(docBtn, buildDocsPopoverHtml(x, perms.canUpload), "dlv-docs-popover");
            const uploadBtn = pop.querySelector(".dlv-pop-upload-btn");
            if (uploadBtn) {
              uploadBtn.addEventListener("click", () => {
                if (!bridge) return;
                const fileName = (pop.querySelector(".dlv-pop-filename").value || "").trim();
                if (!fileName) return;
                const team = bridge.getProjectTeam(d.projectCode);
                const uploaderId = (x.responsibleIds || [])[0] || (team[0] || {}).userId;
                try {
                  const fresh = bridge.uploadDocument(x.assignmentId, fileName, uploaderId, actorName, actorRoleBiz);
                  closePopover();
                  showToast(`Uploaded "${fileName}".`, "success");
                  refreshRow(idx, fresh);
                } catch (e) { showToast("Could not upload: " + e.message, "error"); }
              });
            }
          });
        }

        // History popover — available on Active and Completed gates for everyone (read-only view).
        const histBtn = row.querySelector(".dlv-action-btn");
        if (histBtn && !histBtn.disabled) {
          histBtn.addEventListener("click", () => {
            const entries = bridge ? bridge.assignmentHistory(x.assignmentId, d.projectCode) : [];
            openPopover(histBtn, buildHistoryPopoverHtml(entries), "dlv-history-popover");
          });
        }
      });
    }

    buildGateBar();
    buildTable();
  }

  // ── Gate Checklist — same gate-stepper/table pattern as Deliverables above, but the item list
  // is the Admin Console's real Gate Checklist Template for that gate (d.gateChecklist, built in
  // project-detail-seed.js — never a hardcoded/random list here). Adds a gate-level multi-approver
  // sign-off workflow below the table once every item is Completed. Approval progress is
  // session-only (in-memory), matching every other edit on this page — there's no persistence
  // layer for outer-app pages, same as Deliverables' own "optimistic in-memory update" edits.
  function renderGateChecklist(d) {
    const gateBar = $("gcGateBar");
    const tbody = $("gcTableBody");
    const banner = $("gcFutureBanner");
    const approvalEl = $("gcApprovalSection");
    if (!gateBar || !tbody) return;

    const currentRole = (typeof getCurrentRole === "function") ? getCurrentRole() : (sessionStorage.getItem("snpdRole") || "");
    const canEdit = currentRole === "SA" || currentRole === "PMO";

    const projectMembers = (d.teamMembers || []).filter(Boolean);
    ["PMgr","PEL","PML","PVL"].forEach(k => { if (d.leaders[k] && d.leaders[k] !== "-") projectMembers.push(d.leaders[k]); });
    const uniqueMembers = [...new Set(projectMembers)].sort();

    const gateChecklist = d.gateChecklist || [];
    if (!gateChecklist.length) {
      tbody.innerHTML = '<tr class="dlv-empty-row"><td colspan="7">No checklist data available for this project.</td></tr>';
      return;
    }

    // Per-gate approval state, kept only for the lifetime of this render (session-only) — keyed
    // by stage code so switching between gates never loses each gate's own in-progress approval.
    const approvalState = {};
    const gateApproved = {};
    // The approval card always starts collapsed for every gate — the user clicks its header to
    // open it, rather than it auto-expanding and pushing the checklist table down.
    const approvalExpanded = {};

    let selectedGateIdx = -1;

    function gateStatus(gi) {
      const stageCode = gateChecklist[gi].stage;
      if (gateApproved[stageCode]) return "Completed";
      const g = d.gates && d.gates[gi];
      let seedStatus;
      if (!g) seedStatus = gi < (d.gateReached || 0) ? "Completed" : "Future";
      else if (g.status === "In Progress") seedStatus = "Active";
      else if (["Completed","On Time","Delayed 15-60","Delayed >60"].includes(g.status)) seedStatus = "Completed";
      else seedStatus = "Future";
      if (seedStatus !== "Future") return seedStatus;
      // Seed data hasn't caught up yet, but if the immediately previous gate was just approved
      // THIS session, unlock this one so the user can move straight into it.
      const prevStage = gi > 0 ? gateChecklist[gi - 1].stage : null;
      if (prevStage && gateApproved[prevStage]) return "Active";
      return seedStatus;
    }
    function editableGate(gi) { return canEdit && gateStatus(gi) !== "Future" && gateStatus(gi) !== "Completed"; }

    for (let i = 0; i < gateChecklist.length; i++) {
      if (gateStatus(i) === "Active") { selectedGateIdx = i; break; }
    }
    if (selectedGateIdx === -1) {
      for (let i = gateChecklist.length - 1; i >= 0; i--) {
        if (gateStatus(i) === "Completed") { selectedGateIdx = i; break; }
      }
    }
    if (selectedGateIdx === -1) selectedGateIdx = 0;

    function buildGateBar() {
      const steps = gateChecklist.map((g, gi) => {
        const st = gateStatus(gi);
        const isSelected = gi === selectedGateIdx;
        const btnClass = [
          "dlv-gate-btn",
          st === "Completed" ? "dlv-gate-completed" : "",
          st === "Active"    ? "dlv-gate-active"    : "",
          st === "Future"    ? "dlv-gate-future"    : "",
          isSelected         ? "dlv-gate-selected"  : "",
        ].filter(Boolean).join(" ");
        let circleInner = String(gi + 1);
        if (st === "Completed") circleInner = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        const connector = gi < gateChecklist.length - 1 ? `<div class="dlv-gate-connector"></div>` : "";
        const stepClass = st === "Completed" ? "dlv-gate-step dlv-gate-step-done" : "dlv-gate-step";
        return `<div class="${stepClass}">
          <button class="${btnClass}" data-gate-idx="${gi}" type="button">
            <div class="dlv-gate-circle">${circleInner}</div>
            <span class="dlv-gate-label">${esc(g.stage)}</span>
          </button>${connector}
        </div>`;
      }).join("");
      gateBar.innerHTML = steps;
      gateBar.querySelectorAll(".dlv-gate-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          selectedGateIdx = parseInt(btn.dataset.gateIdx, 10);
          buildGateBar();
          buildTable();
        });
      });
    }

    function calcRag(delayDays, isNotStarted) {
      if (isNotStarted) return "grey";
      if (delayDays === null || delayDays === undefined || delayDays < 0) return "green";
      if (delayDays <= 15) return "green";
      if (delayDays <= 60) return "amber";
      return "red";
    }

    const CHK_STATUS_OPTIONS = ["Not Started","In Progress","Completed","Rework"];
    function chkStatusClass(s) {
      return ({ "Not Started":"dlv-s-pending","In Progress":"dlv-s-inprogress","Completed":"dlv-s-completed","Rework":"dlv-s-rework" })[s] || "dlv-s-pending";
    }

    const MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function isoToDisplay(iso) {
      if (!iso || iso === "-") return "—";
      if (!/^\d{4}-/.test(iso)) return iso;
      const dd = new Date(iso + "T00:00:00");
      if (isNaN(dd)) return "—";
      return String(dd.getDate()).padStart(2,"0") + " " + MON3[dd.getMonth()] + " " + String(dd.getFullYear()).slice(2);
    }
    function displayToISO(display) {
      if (!display || display === "—") return "";
      if (/^\d{4}-/.test(display)) return display;
      const parts = display.trim().split(" ");
      if (parts.length < 3) return "";
      const day = parts[0].padStart(2,"0");
      const mo = MON3.indexOf(parts[1]);
      if (mo < 0) return "";
      const yr = parseInt(parts[2]) < 100 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
      return `${yr}-${String(mo+1).padStart(2,"0")}-${day}`;
    }

    function buildTable() {
      const gc = gateChecklist[selectedGateIdx];
      const st = gateStatus(selectedGateIdx);
      const isFuture = st === "Future";
      const isCompleted = st === "Completed";
      const editable = canEdit && !isFuture && !isCompleted;

      if (banner) banner.hidden = !isFuture;

      if (!gc || !gc.items || !gc.items.length) {
        tbody.innerHTML = `<tr class="dlv-empty-row"><td colspan="7">No checklist items configured for this gate yet — add them in Admin Console → Gate Checklist Templates.</td></tr>`;
        if (approvalEl) approvalEl.innerHTML = "";
        return;
      }

      const rows = gc.items.map((x, i) => {
        const delayDays = (!isFuture && x.delayDays !== undefined) ? x.delayDays : null;
        const rag = calcRag(delayDays, isFuture);
        const ragHtml = `<span class="dlv-rag-dot dlv-rag-${rag}" title="${delayDays !== null ? delayDays + ' day' + (delayDays === 1 ? '' : 's') + ' delay' : ''}"></span>`;

        const rawStatus = isFuture ? "Not Started" : (x.status || "Not Started");
        const remarks = isFuture ? "" : (x.remarks || "");
        const responsibleList = isFuture ? [] : (Array.isArray(x.responsible) ? x.responsible : []);
        const hasDocs = !isFuture && x.evidence;

        let respCell, statusCell, remarksCell;

        if (editable) {
          const addOptions = uniqueMembers.filter(m => !responsibleList.includes(m));
          respCell = `<div class="dlv-resp-multi" data-idx="${i}">
            <div class="dlv-resp-chips">
              ${responsibleList.length
                ? responsibleList.map(m => `<span class="dlv-resp-chip">${esc(m)}<button type="button" class="dlv-resp-chip-x" data-member="${esc(m)}" aria-label="Remove ${esc(m)}">✕</button></span>`).join("")
                : `<span class="dlv-resp-chip-empty">— Assign —</span>`}
            </div>
            ${addOptions.length ? `<select class="dlv-resp-add-select">
              <option value="">+ Add member…</option>
              ${addOptions.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join("")}
            </select>` : ""}
          </div>`;
          statusCell = `<select class="dlv-edit-select dlv-edit-status" data-field="status">
            ${CHK_STATUS_OPTIONS.map(s => `<option value="${s}"${rawStatus === s ? " selected" : ""}>${s}</option>`).join("")}
          </select>`;
          remarksCell = `<input class="dlv-edit-text" type="text" data-field="remarks" value="${esc(remarks)}" placeholder="Add remarks…">`;
        } else {
          respCell = responsibleList.length
            ? `<div class="dlv-responsible dlv-resp-chips-ro">${responsibleList.map(m => `<span class="dlv-resp-chip-ro">${esc(m)}</span>`).join("")}</div>`
            : `<span class="dlv-unassigned">${isFuture ? "Not Assigned" : "Unassigned"}</span>`;
          statusCell = `<span class="dlv-status ${chkStatusClass(rawStatus)}">${esc(rawStatus)}</span>`;
          remarksCell = `<span style="font-size:var(--fs-11);color:var(--color-slate-780)">${esc(remarks) || "—"}</span>`;
        }

        const dlBtn = `<button class="dlv-dl-btn" title="${hasDocs ? "Download: " + esc(x.evidence) : "No documents"}" ${!hasDocs ? "disabled" : ""} type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>`;

        const rowClass = isCompleted ? "dlv-row-readonly" : (editable ? "dlv-row-editable" : "");
        const mandTag = x.mandatory ? `<span class="gc-mand-tag" title="Mandatory">*</span>` : "";

        return `<tr class="${rowClass}" data-idx="${i}">
          <td style="text-align:center;color:var(--color-slate-530)">${i + 1}</td>
          <td><span class="dlv-name-link" title="${esc(x.description || "")}">${esc(x.title)}${mandTag}</span></td>
          <td class="dlv-td-resp">${respCell}</td>
          <td style="text-align:center">${ragHtml}</td>
          <td class="dlv-td-status">${statusCell}</td>
          <td class="dlv-td-remarks">${remarksCell}</td>
          <td style="text-align:center">${dlBtn}</td>
        </tr>`;
      }).join("");

      tbody.innerHTML = rows;

      if (editable) {
        tbody.querySelectorAll("tr[data-idx]").forEach(row => {
          row.querySelectorAll("[data-field]").forEach(input => {
            input.addEventListener("change", () => {
              const idx = parseInt(row.dataset.idx, 10);
              const field = input.dataset.field;
              const val = input.value;
              const x = gc.items[idx];
              if (field === "status") {
                x.status = val;
                x.completion = val === "Completed" ? 100 : (val === "In Progress" ? Math.max(x.completion || 0, 10) : 0);
                // No Actual Closure column/input anymore — closing an item via the Status
                // dropdown stamps today's (app-fixed) date so delay/RAG still has a real
                // actual-vs-planned-end comparison to work from.
                if (val === "Completed" && (!x.actualDate || x.actualDate === "-")) x.actualDate = isoToDisplay("2026-07-07");
                if (val !== "Completed") x.actualDate = "-";

                const ragDot = row.querySelector(".dlv-rag-dot");
                if (ragDot) {
                  const today = new Date(2026, 6, 7);
                  const actualISO = displayToISO(x.actualDate);
                  const actualDate = actualISO ? new Date(actualISO) : null;
                  const targetISO  = displayToISO(x.plannedEndDate);
                  const targetDate = targetISO ? new Date(targetISO) : null;
                  let delay = 0;
                  if (actualDate && targetDate) delay = Math.max(0, Math.round((actualDate - targetDate) / 86400000));
                  else if (targetDate && targetDate < today) delay = Math.round((today - targetDate) / 86400000);
                  x.delayDays = delay;
                  ragDot.className = `dlv-rag-dot dlv-rag-${calcRag(delay, false)}`;
                }
              }
              if (field === "remarks") x.remarks = val;
              renderApprovalSection(); // item completion may just have changed gate eligibility
            });
          });

          const respMulti = row.querySelector(".dlv-resp-multi");
          if (respMulti) {
            const idx = parseInt(row.dataset.idx, 10);
            const x = gc.items[idx];
            respMulti.querySelectorAll(".dlv-resp-chip-x").forEach(btn => {
              btn.addEventListener("click", () => {
                x.responsible = (x.responsible || []).filter(m => m !== btn.dataset.member);
                buildTable();
              });
            });
            const addSelect = respMulti.querySelector(".dlv-resp-add-select");
            addSelect?.addEventListener("change", () => {
              if (!addSelect.value) return;
              x.responsible = [...(x.responsible || []), addSelect.value];
              buildTable();
            });
          }
        });
      }

      renderApprovalSection();
    }

    // Wraps any approval-section state in a collapsible card that starts CLOSED — the user
    // clicks the header to open it, rather than it auto-expanding and pushing the checklist
    // table down every time a gate becomes eligible for approval.
    function approvalCardShell(stageCode, headerHtml, bodyHtml, extraClass) {
      const isOpen = !!approvalExpanded[stageCode];
      return `<div class="gc-approval-card ${extraClass || ""}">
        <button type="button" class="gc-approval-toggle" data-stage="${esc(stageCode)}">
          <svg class="gc-approval-chevron ${isOpen ? "open" : ""}" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          ${headerHtml}
        </button>
        <div class="gc-approval-body" ${isOpen ? "" : "hidden"}>${bodyHtml}</div>
      </div>`;
    }
    function wireApprovalToggle() {
      approvalEl.querySelector(".gc-approval-toggle")?.addEventListener("click", (e) => {
        const stageCode = e.currentTarget.dataset.stage;
        approvalExpanded[stageCode] = !approvalExpanded[stageCode];
        renderApprovalSection();
      });
    }

    // ── Gate approval workflow (below the table) — visible once every item in the selected
    // gate is Completed. PMO/SA pick how many approvers are needed, then who they are; every
    // approver must Approve for the gate to close. A Reject resets ALL approvers back to
    // Pending and flags the specific defective item for rework by its responsible member.
    // A gate that's already Completed (from real history, not just this session) still shows
    // its real approvers — sourced from d.approvals (gateApprovalHistory.json) rather than
    // showing nothing just because no live approval ever ran for it in this session. ──
    function renderApprovalSection() {
      if (!approvalEl) return;
      const gc = gateChecklist[selectedGateIdx];
      const st = gateStatus(selectedGateIdx);
      if (!gc) { approvalEl.innerHTML = ""; return; }
      const stageCode = gc.stage;

      // Not-started (Future) gate — no approval section at all.
      if (st === "Future") { approvalEl.innerHTML = ""; return; }

      const state = approvalState[stageCode] || (approvalState[stageCode] = { approvers: [], started: false });

      // Completed gate — real history if this session didn't just approve it, else the
      // in-session approver list. Either way: just the checklist + who approved, no setup UI.
      if (st === "Completed" || gateApproved[stageCode]) {
        const approvers = gateApproved[stageCode] && state.approvers.length
          ? state.approvers.map(a => ({ name: a.name, status: a.status }))
          : (d.approvals || []).filter(a => a.gate === stageCode).map(a => ({ name: a.approver, status: a.status }));
        const approvedCount = approvers.filter(a => a.status === "Approved").length;
        approvalEl.innerHTML = approvalCardShell(stageCode,
          `<h4>Gate ${esc(stageCode)} — Approved</h4><span class="gc-approval-count">${approvedCount} member${approvedCount === 1 ? "" : "s"} approved</span>`,
          `<div class="gc-approver-list">
            ${approvers.length
              ? approvers.map(a => `<div class="gc-approver-row"><span class="gc-approver-name">${esc(a.name)}</span><span class="pd-badge ${a.status === "Approved" ? "pd-b-completed" : "pd-b-pending"}">${esc(a.status)}</span></div>`).join("")
              : `<p class="gc-approval-hint">No approval record found for this gate.</p>`}
          </div>`,
          "gc-approval-done");
        wireApprovalToggle();
        return;
      }

      if (!editableGate(selectedGateIdx)) { approvalEl.innerHTML = ""; return; }

      const allComplete = gc.items.length > 0 && gc.items.every(x => x.status === "Completed");

      // Once approval has STARTED, keep the approver list visible even if a rejection just
      // knocked an item back out of "Completed" — the panel must show the rejection state, not
      // vanish the moment allComplete goes false again.
      if (!state.started) {
        if (!allComplete) { approvalEl.innerHTML = ""; return; }
        if (!canEdit) {
          approvalEl.innerHTML = approvalCardShell(stageCode, `<h4>Gate Approval — ${esc(stageCode)}</h4>`,
            `<p class="gc-approval-hint">All checklist items are complete. Waiting for PMO/Admin to start the gate approval.</p>`);
          wireApprovalToggle();
          return;
        }
        approvalEl.innerHTML = approvalCardShell(stageCode,
          `<h4>Start Gate Approval — ${esc(stageCode)}</h4>`,
          `<p class="gc-approval-hint">All checklist items are complete. Choose how many approvers are required for this gate to close.</p>
          <div class="gc-approval-setup">
            <label>Number of Approvers
              <select id="gcApproverCount">
                <option value="">Select…</option>
                ${[1,2,3,4,5,6].map(n => `<option value="${n}">${n}</option>`).join("")}
              </select>
            </label>
            <button type="button" class="gc-btn gc-btn-primary" id="gcSetupNext" disabled>Next: Choose Approvers</button>
          </div>
          <div id="gcApproverPickWrap"></div>`);
        wireApprovalToggle();
        const countSel = $("gcApproverCount");
        const nextBtn = $("gcSetupNext");
        const pickWrap = $("gcApproverPickWrap");
        countSel.addEventListener("change", () => { nextBtn.disabled = !countSel.value; pickWrap.innerHTML = ""; });
        nextBtn.addEventListener("click", () => {
          const n = parseInt(countSel.value, 10);
          pickWrap.innerHTML = `
            <div class="gc-approval-picklist">
              ${Array.from({ length: n }).map((_, i) => `
                <label>Approver ${i + 1}
                  <select class="gc-approver-pick" data-slot="${i}">
                    <option value="">Select member…</option>
                    ${uniqueMembers.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join("")}
                  </select>
                </label>`).join("")}
              <button type="button" class="gc-btn gc-btn-primary" id="gcConfirmApprovers" disabled>Confirm &amp; Start Approval</button>
            </div>`;
          const picks = Array.from(pickWrap.querySelectorAll(".gc-approver-pick"));
          const confirmBtn = $("gcConfirmApprovers");
          function checkReady() {
            const vals = picks.map(p => p.value);
            confirmBtn.disabled = vals.some(v => !v) || new Set(vals).size !== vals.length;
          }
          picks.forEach(p => p.addEventListener("change", checkReady));
          confirmBtn.addEventListener("click", () => {
            state.approvers = picks.map(p => ({ name: p.value, status: "Pending", remarks: "" }));
            state.started = true;
            renderApprovalSection();
          });
        });
        return;
      }

      approvalEl.innerHTML = approvalCardShell(stageCode,
        `<h4>Gate Approval — ${esc(stageCode)}</h4><span class="gc-approval-count">${state.approvers.filter(a => a.status === "Approved").length}/${state.approvers.length} approved</span>`,
        `<div class="gc-approver-list">
          ${state.approvers.map((a, ai) => `
            <div class="gc-approver-row" data-ai="${ai}">
              <span class="gc-approver-name">${esc(a.name)}</span>
              <span class="pd-badge ${a.status === "Approved" ? "pd-b-completed" : a.status === "Rejected" ? "pd-b-delay-high" : "pd-b-pending"}">${esc(a.status)}</span>
              ${a.status === "Pending" ? `
                <button type="button" class="gc-approve-btn" data-ai="${ai}">Approve</button>
                <button type="button" class="gc-reject-btn" data-ai="${ai}">Reject</button>
              ` : `<span class="gc-approver-remarks">${esc(a.remarks || "")}</span>`}
            </div>
            <div class="gc-reject-form" id="gcRejectForm-${ai}" hidden></div>
          `).join("")}
        </div>`);
      wireApprovalToggle();

      approvalEl.querySelectorAll(".gc-approve-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const ai = parseInt(btn.dataset.ai, 10);
          state.approvers[ai].status = "Approved";
          state.approvers[ai].remarks = "Approved.";
          if (state.approvers.every(a => a.status === "Approved")) {
            gateApproved[stageCode] = true;
            buildGateBar();
            showToast(`Gate ${stageCode} approved by all members — status updated to Completed.`, "success");
          }
          renderApprovalSection();
        });
      });
      approvalEl.querySelectorAll(".gc-reject-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const ai = parseInt(btn.dataset.ai, 10);
          const formEl = $("gcRejectForm-" + ai);
          formEl.hidden = false;
          formEl.innerHTML = `
            <div class="gc-reject-inner">
              <label>Which checklist item is defective?
                <select class="gc-reject-item">
                  ${gc.items.map(it => `<option value="${esc(it.id)}">${esc(it.title)}</option>`).join("")}
                </select>
              </label>
              <label>Reason for rejection
                <textarea class="gc-reject-reason" rows="2" placeholder="Explain what needs to be fixed…"></textarea>
              </label>
              <div class="gc-reject-actions">
                <button type="button" class="gc-btn gc-reject-cancel">Cancel</button>
                <button type="button" class="gc-btn gc-btn-danger gc-reject-submit">Submit Rejection</button>
              </div>
            </div>`;
          formEl.querySelector(".gc-reject-cancel").addEventListener("click", () => { formEl.hidden = true; formEl.innerHTML = ""; });
          formEl.querySelector(".gc-reject-submit").addEventListener("click", () => {
            const itemId = formEl.querySelector(".gc-reject-item").value;
            const reason = formEl.querySelector(".gc-reject-reason").value.trim();
            if (!reason) { formEl.querySelector(".gc-reject-reason").focus(); return; }
            const item = gc.items.find(it => it.id === itemId);

            // Reject resets the WHOLE approval cycle — every approver goes back to Pending —
            // and sends the flagged item back to its responsible member for rework.
            state.approvers.forEach(a => { a.status = "Pending"; a.remarks = ""; });
            state.approvers[ai].status = "Rejected";
            state.approvers[ai].remarks = reason;
            if (item) { item.status = "Rework"; item.remarks = `Rejected: ${reason}`; }
            const responsibleNames = item && item.responsible && item.responsible.length ? item.responsible.join(", ") : "the responsible member";
            showToast(`Notification sent to ${responsibleNames}: "${item ? item.title : "item"}" was rejected — ${reason}`, "error");
            buildTable();
          });
        });
      });
    }

    buildGateBar();
    buildTable();
  }

  // ── Approvals ──
  function renderApprovals(d) {
    const tblHtml = "<thead><tr><th>Gate</th><th>Approver</th><th>Status</th><th>Date</th></tr></thead><tbody>" +
      (d.approvals||[]).map(a=>`<tr><td>${esc(a.gate)}</td><td>${esc(a.approver)}</td>
        <td><span class="pd-badge ${a.status==="Approved"?"pd-b-completed":"pd-b-pending"}">${esc(a.status)}</span></td>
        <td>${esc(a.date)}</td></tr>`).join("") + "</tbody>";

    const t1 = $("approvalsTable");
    if (t1) t1.innerHTML = tblHtml;
  }

  // ── Action Register — reads/writes the EXACT SAME localStorage key the Admin Console's own
  // Action Register store uses (pages/admin/js/store/actions.js → ENTITY_KEYS.ACTION_REGISTER =
  // "action_register"), so an action logged from this project page shows up in Admin's master
  // list immediately, and any admin edit shows up here on next visit. This page is a plain
  // script (not an ES module) so it can't import that store directly — reading/writing the same
  // key is the same bridging approach already used for Gate Checklist Templates. ──
  const AR_KEY = "spd.action_register.v1";
  const AR_MEETING_TYPES = ["Design Review","Management Meeting","Gate Review","Supplier Review","Testing Review","Internal Audit","Prototype Inspection","Customer Feedback","Risk Mitigation","DFMEA Review","Audit","Issue Resolution","Management Review","Lessons from Previous Gates"];
  const AR_PRIORITIES = ["Low","Medium","High","Critical"];
  const AR_STATUSES = ["Open","Assigned","In Progress","Blocked","Waiting for Input","Completed","Closed","Cancelled"];
  function arStatusCls(s) {
    if (s === "Completed" || s === "Closed") return "pd-b-completed";
    if (s === "In Progress" || s === "Assigned") return "pd-b-inprog";
    if (s === "Blocked" || s === "Cancelled") return "pd-b-delay-high";
    return "pd-b-pending"; // Open, Waiting for Input
  }
  function loadActionRegisterAll() {
    try {
      const raw = localStorage.getItem(AR_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to seed */ }
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", APP_ROOT + "data/actionRegister.json", false);
      xhr.send(null);
      const seeded = JSON.parse(xhr.responseText);
      localStorage.setItem(AR_KEY, JSON.stringify(seeded));
      return seeded;
    } catch (e) { return []; }
  }
  function persistActionRegisterAll(list) { localStorage.setItem(AR_KEY, JSON.stringify(list)); }
  function nextActionIds(list) {
    let max = 0;
    list.forEach(a => { const m = String(a.id).match(/^ACT-(\d+)$/); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    return { id: `ACT-${String(max + 1).padStart(4, "0")}`, actionNumber: `AR-${String(max + 1).padStart(4, "0")}` };
  }

  function renderActionRegister(d) {
    const tbody = $("arTableBody");
    const newBtn = $("arNewBtn");
    const formWrap = $("arFormWrap");
    if (!tbody) return;

    const currentRole = (typeof getCurrentRole === "function") ? getCurrentRole() : (sessionStorage.getItem("snpdRole") || "");
    const canEdit = currentRole === "SA" || currentRole === "PMO";
    if (newBtn) newBtn.hidden = !canEdit;

    const team = d.teamMembersDetailed || [];

    function draw() {
      const all = loadActionRegisterAll();
      const rows = all.filter(a => a.projectCode === d.projectCode).sort((a, b) => (a.targetDate || "").localeCompare(b.targetDate || ""));
      tbody.innerHTML = rows.length ? rows.map((a, i) => {
        const respName = (team.find(m => m.userId === a.assignedToUserId) || {}).name || "Unassigned";
        let statusCell, remarksCell;
        if (canEdit) {
          statusCell = `<select class="dlv-edit-select" data-field="status" data-id="${esc(a.id)}">${AR_STATUSES.map(s => `<option value="${s}" ${a.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>`;
          remarksCell = `<input class="dlv-edit-text" type="text" data-field="remarks" data-id="${esc(a.id)}" value="${esc(a.remarks || "")}" placeholder="Add remarks…">`;
        } else {
          statusCell = `<span class="pd-badge ${arStatusCls(a.status)}">${esc(a.status)}</span>`;
          remarksCell = `<span style="font-size:var(--fs-11)">${esc(a.remarks || "—")}</span>`;
        }
        return `<tr>
          <td style="text-align:center;color:var(--color-slate-530)">${i + 1}</td>
          <td>${esc(a.source || "—")}</td>
          <td><strong>${esc(a.title)}</strong>${a.description ? `<div class="sg-subtle" style="font-size:11px;margin-top:2px">${esc(a.description)}</div>` : ""}</td>
          <td>${esc(respName)}</td>
          <td><span class="pd-badge ${sevCls(a.priority)}">${esc(a.priority)}</span></td>
          <td>${esc(a.targetDate || "—")}</td>
          <td>${statusCell}</td>
          <td>${remarksCell}</td>
        </tr>`;
      }).join("") : `<tr><td colspan="8" style="text-align:center;padding:var(--space-24);color:var(--color-slate-530);font-style:italic">No action items logged for this project yet.</td></tr>`;

      if (canEdit) {
        tbody.querySelectorAll("[data-field]").forEach(input => {
          input.addEventListener("change", () => {
            const list = loadActionRegisterAll();
            const idx = list.findIndex(a => a.id === input.dataset.id);
            if (idx === -1) return;
            list[idx][input.dataset.field] = input.value;
            if (input.dataset.field === "status" && ["Completed", "Closed"].includes(input.value) && !list[idx].actualCompletionDate) {
              list[idx].actualCompletionDate = new Date(2026, 6, 7).toISOString().slice(0, 10);
            }
            persistActionRegisterAll(list);
          });
        });
      }
    }

    newBtn?.addEventListener("click", () => {
      const opening = formWrap.hidden;
      formWrap.hidden = !opening;
      formWrap.innerHTML = "";
      if (!opening) return;
      formWrap.innerHTML = `
        <div class="ar-form">
          <div class="sg-form-grid">
            <label class="span-2">Action to be Taken<input type="text" id="arTitle" required></label>
            <label>Meeting Type<select id="arMeetingType">${AR_MEETING_TYPES.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join("")}</select></label>
            <label>Priority<select id="arPriority">${AR_PRIORITIES.map(p => `<option value="${p}" ${p === "Medium" ? "selected" : ""}>${p}</option>`).join("")}</select></label>
            <label>Responsibility<select id="arAssignee">${team.length ? team.map(m => `<option value="${esc(m.userId)}">${esc(m.name)} — ${esc(m.role)}</option>`).join("") : `<option value="">No team members found</option>`}</select></label>
            <label>Meeting / Target Date<input type="date" id="arTarget"></label>
            <label class="span-2">Remarks<textarea id="arRemarks" rows="2" placeholder="Add remarks…"></textarea></label>
          </div>
          <div class="ar-form-actions">
            <button type="button" class="gc-btn" id="arCancel">Cancel</button>
            <button type="button" class="gc-btn gc-btn-primary" id="arSave">Save Action</button>
          </div>
        </div>`;
      $("arCancel").addEventListener("click", () => { formWrap.hidden = true; formWrap.innerHTML = ""; });
      $("arSave").addEventListener("click", () => {
        const title = $("arTitle").value.trim();
        const assignedToUserId = $("arAssignee").value;
        if (!title) { $("arTitle").focus(); return; }
        const list = loadActionRegisterAll();
        const { id, actionNumber } = nextActionIds(list);
        const nowStr = new Date(2026, 6, 7).toISOString().slice(0, 10);
        const action = {
          id, actionNumber, projectCode: d.projectCode, gateCode: "",
          deliverableAssignmentId: null, checklistItemId: null, relatedRisk: null, relatedIssue: null,
          title, description: "", category: "", priority: $("arPriority").value, severity: "Minor",
          source: $("arMeetingType").value,
          status: "Open", createdDate: nowStr, assignedDate: nowStr,
          targetDate: $("arTarget").value, actualCompletionDate: null, reminderDate: null, escalationDate: null,
          comments: [], attachments: [], reminderEnabled: false, reminderFrequency: null,
          escalationLevel: null, escalatedTo: null, escalationReason: null, dependsOnActionIds: [],
          assignedByUserId: assignedToUserId, assignedToUserId,
          watcherUserIds: [], escalationOwnerUserId: null, remarks: $("arRemarks").value.trim(),
        };
        list.push(action);
        persistActionRegisterAll(list);
        formWrap.hidden = true; formWrap.innerHTML = "";
        showToast("Action item created — also visible in Admin Console's Action Register.", "success");
        draw();
      });
    });

    draw();
  }

  // ── Pre-KO (Product Requirement Form) ──
  function renderPreKo(d) {
    const pk = (typeof getPreKoDetail === "function") ? getPreKoDetail(d.projectCode) : null;
    if (!pk) return;

    const listHtml = items => `<ul class="pd-preko-list">${items.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
    const cardHtml = (title, inner) => `<div class="pd-generic-card"><div class="pd-generic-head"><h3>${esc(title)}</h3></div>${inner}</div>`;

    $("prekoBackground").innerHTML = `
      <div class="pd-preko-grid-2">
        ${cardHtml("Background", listHtml(pk.background))}
        ${cardHtml("Objective", listHtml(pk.objective))}
      </div>`;

    $("prekoSpecs").innerHTML = cardHtml("Key Specifications", `
      <div class="pd-spec-grid">
        ${pk.specs.map(s => `<div class="pd-spec-row"><span class="pd-spec-label">${esc(s.label)}</span><span class="pd-spec-value">${esc(s.value)}</span></div>`).join("")}
      </div>
      <div class="pd-spec-chip-row">
        ${pk.specChips.map(s => `<span class="pd-spec-chip">${esc(s.label)}: ${esc(s.value)}</span>`).join("")}
      </div>`);

    $("prekoFeatures").innerHTML = `
      <div class="pd-preko-grid-4">
        ${cardHtml("Unmatched Comfort", listHtml(pk.features.comfort))}
        ${cardHtml("Unmatched Performance", listHtml(pk.features.performance))}
        ${cardHtml("Unmatched Reliability", listHtml(pk.features.reliability))}
        ${cardHtml("Unmatched Versatility / Suitability", listHtml(pk.features.versatility))}
      </div>`;

    $("prekoApplications").innerHTML = `
      <div class="pd-preko-grid-2">
        ${cardHtml("Target Applications", listHtml(pk.targetApplications))}
        ${cardHtml("FI Targets", `<div class="pd-spec-grid" style="grid-template-columns:1fr">${pk.fiTargets.map(f => `<div class="pd-spec-row"><span class="pd-spec-label">${esc(f.label)}</span><span class="pd-spec-value">${esc(f.value)}</span></div>`).join("")}</div>`)}
      </div>`;

    $("prekoVariants").innerHTML = `
      <div class="pd-preko-grid-2">
        ${cardHtml("Variants", `<div class="pd-inner-scroll"><table class="pd-data-table" style="min-width:0">
          <thead><tr><th>Attribute</th><th>Base Variant</th></tr></thead>
          <tbody>${pk.variants.map(v => `<tr><td>${esc(v.attribute)}</td><td style="white-space:normal">${esc(v.value)}</td></tr>`).join("")}</tbody>
        </table></div>`)}
        ${cardHtml("Variant Wise Volume", `<div class="pd-inner-scroll"><table class="pd-data-table" style="min-width:0">
          <thead><tr><th>Variant</th>${pk.variantVolume.years.map(y => `<th>${esc(y)}</th>`).join("")}</tr></thead>
          <tbody>${pk.variantVolume.rows.map(r => `<tr><td>${esc(r.variant)}</td>${r.values.map(v => `<td>${v.toLocaleString("en-IN")}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>`)}
      </div>`;

    $("prekoCost").innerHTML = `
      <div class="pd-preko-grid-2">
        ${cardHtml("Budget Summary", `<div class="pd-spec-grid" style="grid-template-columns:1fr">
          <div class="pd-spec-row"><span class="pd-spec-label">Planned</span><span class="pd-spec-value">₹${pk.costBudget.planned.toLocaleString("en-IN")} L</span></div>
          <div class="pd-spec-row"><span class="pd-spec-label">Approved</span><span class="pd-spec-value">₹${pk.costBudget.approved.toLocaleString("en-IN")} L</span></div>
          <div class="pd-spec-row"><span class="pd-spec-label">Consumed to Date</span><span class="pd-spec-value">₹${pk.costBudget.consumed.toLocaleString("en-IN")} L</span></div>
          <div class="pd-spec-row"><span class="pd-spec-label">Forecast at Completion</span><span class="pd-spec-value">₹${pk.costBudget.forecast.toLocaleString("en-IN")} L</span></div>
        </div>`)}
        ${cardHtml("Cost Breakdown by Category", `<div class="pd-inner-scroll"><table class="pd-data-table" style="min-width:0">
          <thead><tr><th>Category</th><th>Amount (₹ L)</th><th>% of Planned</th></tr></thead>
          <tbody>${pk.costBudget.breakdown.map(b => `<tr><td>${esc(b.category)}</td><td>${b.amountLakh.toLocaleString("en-IN")}</td><td>${b.pct}%</td></tr>`).join("")}</tbody>
        </table></div>`)}
      </div>`;

    $("prekoCompetitors").innerHTML = cardHtml("Competitor Analysis & Benchmark", `<div class="pd-inner-scroll"><table class="pd-data-table" style="min-width:0">
      <thead><tr><th>Competitor</th><th>HP Class</th><th>Indicative Price Band</th><th>Key Strength</th></tr></thead>
      <tbody>${pk.competitors.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.hpClass)}</td><td>${esc(c.priceBandLakh)}</td><td>${esc(c.strength)}</td></tr>`).join("")}</tbody>
    </table></div>`);
  }

  // ── Pre-KO sub-tabs ──
  function initPreKoSubtabs() {
    document.querySelectorAll(".pd-preko-subtab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".pd-preko-subtab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const sub = btn.dataset.subtab;
        document.querySelectorAll(".pd-preko-subpanel").forEach(p => { p.hidden = p.dataset.subpanel !== sub; });
      });
    });
  }

  // ── Gantt ──
  function renderGantt(d) {
    // ── helpers ──
    const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const parseDate = s => {
      const p = String(s||"").trim().split(" ");
      if (p.length < 3) return null;
      const mi = MON.indexOf(p[1]);
      if (mi < 0) return null;
      const yr = +p[2] < 100 ? 2000 + +p[2] : +p[2];
      return new Date(yr, mi, +p[0]);
    };
    const fmtDate = d2 => {
      if (!d2) return "-";
      return String(d2.getDate()).padStart(2,"0") + " " + MON[d2.getMonth()] + " " + String(d2.getFullYear()).slice(2);
    };
    const addDays = (d2, n) => new Date(d2.getTime() + n*86400000);
    const diffDays = (a, b) => Math.round((b - a) / 86400000);

    // ── build activity rows from mock data ──
    const activities = (d.activities||[]).filter(a => a.planned && a.planned !== "-");

    // Compute project span
    const allDates = [];
    activities.forEach(a => {
      const s = parseDate(a.planned);
      const e = parseDate(a.outlook !== "-" ? a.outlook : a.planned) || s;
      if (s) allDates.push(s.getTime(), (e||s).getTime());
    });
    if (!allDates.length) {
      document.getElementById("gcLeftRows").innerHTML = "<div style='padding:20px;color:#64748b'>No activities found.</div>";
      return;
    }
    const spanStart = new Date(Math.min(...allDates));
    const spanEnd   = new Date(Math.max(...allDates));

    // Snap to month start/end
    const chartStart = new Date(spanStart.getFullYear(), spanStart.getMonth(), 1);
    const chartEnd   = new Date(spanEnd.getFullYear(), spanEnd.getMonth()+1, 0);
    const totalDays  = diffDays(chartStart, chartEnd) + 1;

    // Week width: distribute weeks across chart
    const WEEK_W = 44; // px per week
    const totalWeeks = Math.ceil(totalDays / 7);
    const chartW = totalWeeks * WEEK_W;

    // Helper: days from chartStart → px
    const daysPx = days => (days / totalDays) * chartW;
    const datePx = d2 => daysPx(diffDays(chartStart, d2));

    // ── RAG from status ──
    const ragClass = s => {
      if (s === "On Time" || s === "Completed") return "gc-rag-green";
      if (s === "In Progress" || s === "Delayed 15-60") return "gc-rag-amber";
      if (s === "Delayed >60") return "gc-rag-red";
      return "gc-rag-grey";
    };

    // ── Intelligence banner stats ──
    const critPath = activities.filter(a => a.priority === "High").length;

    const bannerEl = document.getElementById("gcBannerStats");
    if (bannerEl) {
      const planDays = diffDays(chartStart, chartEnd);
      const cards = [
        { val: activities.length, lbl: "TOTAL DELIVERABLES (PROJ.)", color: "gc-stat-green" },
        { val: planDays,           lbl: "PLANNING DURATION (DAYS)",   color: "gc-stat-blue"  },
        { val: critPath,           lbl: "CRITICAL PATH TASKS (PROJ.)", color: "gc-stat-amber", id: "gcCritStatCard" },
      ];
      bannerEl.innerHTML = cards.map(c =>
        `<div class="gc-stat${c.id ? " gc-stat-clickable" : ""}" ${c.id ? `id="${c.id}"` : ""}>
           <div class="gc-stat-val ${c.color}">${c.val}</div>
           <div class="gc-stat-lbl">${c.lbl}</div>
         </div>`
      ).join("");
    }

    // ── Left rows ──
    const leftRowsEl = document.getElementById("gcLeftRows");
    if (leftRowsEl) {
      leftRowsEl.innerHTML = activities.map((a, i) => {
        const startD = parseDate(a.planned);
        const endD   = parseDate(a.outlook !== "-" ? a.outlook : a.planned) || startD;
        const days   = startD && endD ? diffDays(startD, endD) : "-";
        return `<div class="gc-left-row">
          <div class="gc-cell gc-cell-sno">${i+1}</div>
          <div class="gc-cell gc-cell-deliv" title="${esc(a.activity)}">${esc(a.activity)}</div>
          <div class="gc-cell gc-cell-id">${esc(a.gate||"-")}</div>
          <div class="gc-cell gc-cell-resp" title="${esc(a.department)}">${esc((a.department||"").split(" ")[0])}</div>
          <div class="gc-cell gc-cell-start">${fmtDate(startD)}</div>
          <div class="gc-cell gc-cell-end">${fmtDate(endD)}</div>
          <div class="gc-cell gc-cell-days">${days}</div>
          <div class="gc-cell gc-cell-rag"><span class="gc-rag-dot ${ragClass(a.status)}"></span></div>
        </div>`;
      }).join("");
    }

    // ── Month / week headers ──
    const monthRowEl = document.getElementById("gcMonthRow");
    const weekRowEl  = document.getElementById("gcWeekRow");

    if (monthRowEl) {
      const months = [];
      let cur = new Date(chartStart);
      while (cur <= chartEnd) {
        const mStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
        const mEnd   = new Date(cur.getFullYear(), cur.getMonth()+1, 0);
        const clamp  = t => Math.max(chartStart.getTime(), Math.min(chartEnd.getTime(), t));
        const mW     = daysPx(diffDays(new Date(clamp(mStart.getTime())), new Date(clamp(mEnd.getTime()))) + 1);
        months.push(`<div class="gc-month-cell" style="width:${mW}px">${MON[cur.getMonth()]} ${cur.getFullYear()}</div>`);
        cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
      }
      monthRowEl.style.width = chartW + "px";
      monthRowEl.innerHTML = months.join("");
    }

    if (weekRowEl) {
      let html = "", cur = new Date(chartStart);
      let weekNum = 1, lastMonth = cur.getMonth();
      while (cur <= chartEnd) {
        if (cur.getMonth() !== lastMonth) { weekNum = 1; lastMonth = cur.getMonth(); }
        const isMonthStart = cur.getDate() <= 7 && weekNum === 1;
        html += `<div class="gc-week-cell${isMonthStart?" month-start":""}" style="width:${WEEK_W}px">W${weekNum}</div>`;
        cur = addDays(cur, 7);
        weekNum++;
      }
      weekRowEl.style.width = chartW + "px";
      weekRowEl.innerHTML = html;
    }

    // ── Bars ──
    const barsEl = document.getElementById("gcBarsArea");
    if (barsEl) {
      // vertical grid every 4 weeks (month)
      let vgrid = "", gc = new Date(chartStart);
      while (gc <= chartEnd) {
        gc = new Date(gc.getFullYear(), gc.getMonth()+1, 1);
        const x = datePx(gc);
        if (x > 0 && x < chartW) vgrid += `<div class="gc-vgrid" style="left:${x}px"></div>`;
      }

      const rows = activities.map(a => {
        const startD = parseDate(a.planned);
        const endD   = parseDate(a.outlook !== "-" ? a.outlook : a.planned) || startD;
        const actStartD = parseDate(a.approved !== "-" ? a.approved : a.planned) || startD;
        const actEndD   = endD;

        let bars = "";
        if (startD && endD) {
          const pl = datePx(startD);
          const pw = Math.max(WEEK_W * 0.5, datePx(endD) - datePx(startD));
          bars += `<div class="gc-bar gc-bar-planned" style="left:${pl}px;width:${pw}px" title="Planned: ${fmtDate(startD)} – ${fmtDate(endD)}"></div>`;
        }
        if (actStartD && actEndD) {
          const al = datePx(actStartD);
          const aw = Math.max(WEEK_W * 0.4, datePx(actEndD) - datePx(actStartD));
          bars += `<div class="gc-bar gc-bar-actual" style="left:${al}px;width:${aw}px" title="Actual: ${fmtDate(actStartD)} – ${fmtDate(actEndD)}"></div>`;
        }
        return `<div class="gc-bar-row" style="width:${chartW}px">${vgrid}${bars}</div>`;
      }).join("");
      barsEl.innerHTML = rows;
    }

    // Set chart inner width
    const chartInner = document.getElementById("gcChartInner");
    if (chartInner) chartInner.style.minWidth = chartW + "px";

    // ── Critical Path filter toggle ──
    let criticalPathActive = false;

    function applyFilter() {
      const leftRows  = document.querySelectorAll("#gcLeftRows .gc-left-row");
      const barRows   = document.querySelectorAll("#gcBarsArea .gc-bar-row");
      leftRows.forEach((row, i) => {
        const act = activities[i];
        const hide = criticalPathActive && act.priority !== "High";
        row.style.display = hide ? "none" : "";
        if (barRows[i]) barRows[i].style.display = hide ? "none" : "";
      });

      const critBtn = document.getElementById("gcCritPathBtn");
      const allBtn = document.getElementById("gcAllBtn");
      if (critBtn) {
        critBtn.classList.toggle("gc-hl-crit-active", criticalPathActive);
        critBtn.innerHTML = criticalPathActive
          ? "✕ Clear Filter"
          : '<i class="gc-dot gc-dot-amber"></i> Critical Path';
      }
      if (allBtn) {
        allBtn.classList.toggle("gc-hl-active", !criticalPathActive);
      }
    }

    // Wire the buttons (after DOM is painted)
    requestAnimationFrame(() => {
      const critBtn = document.getElementById("gcCritPathBtn");
      const allBtn = document.getElementById("gcAllBtn");
      const critCard = document.getElementById("gcCritStatCard");
      
      if (critBtn) {
        critBtn.addEventListener("click", () => {
          criticalPathActive = !criticalPathActive;
          applyFilter();
        });
      }
      
      if (allBtn) {
        allBtn.addEventListener("click", () => {
          criticalPathActive = false;
          applyFilter();
        });
      }
      
      if (critCard) {
        critCard.addEventListener("click", () => {
          criticalPathActive = true;
          applyFilter();
        });
        critCard.style.cursor = "pointer";
      }
    });
    const leftRows = document.getElementById("gcLeftRows");
    const barsArea = document.getElementById("gcBarsArea");
    if (leftRows && barsArea) {
      let syncing = false;
      leftRows.addEventListener("scroll", () => {
        if (syncing) return; syncing = true;
        barsArea.scrollTop = leftRows.scrollTop;
        syncing = false;
      }, {passive:true});
      barsArea.addEventListener("scroll", () => {
        if (syncing) return; syncing = true;
        leftRows.scrollTop = barsArea.scrollTop;
        syncing = false;
      }, {passive:true});
    }
  }

  // ── Gate Checklist init ──
  function initGateChecklist(d) {
    renderGateChecklist(d);
  }

  // ── Tab switching ──
  function initTabs() {
    document.querySelectorAll(".pd-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".pd-tab").forEach(b => b.classList.remove("pd-tab-active"));
        btn.classList.add("pd-tab-active");
        const tab = btn.dataset.tab;
        document.querySelectorAll(".pd-tabpanel").forEach(p => { p.hidden = p.id !== "tab-" + tab; });
        if (tab === "snapshot") Object.values(_charts).forEach(c => c && c.resize && c.resize());
      });
    });
  }

  // ── PDF ──
  function initPdf() {
    const btn = $("downloadPdfBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const panels = [...document.querySelectorAll(".pd-tabpanel")];
      const prev = panels.map(p => p.hidden);
      panels.forEach(p => { p.hidden = false; });
      window.print();
      panels.forEach((p, i) => { p.hidden = prev[i]; });
    });
    $("aiBtn") && $("aiBtn").addEventListener("click", () => {
      const d = window.__pd;
      if (!d) return;
      const late = (d.gates||[]).filter(g=>g.delayDays>15).length;
      alert(`AI Summary: ${d.projectName} (${d.projectCode})\nHealth: ${d.healthScore}% | Gate: ${d.currentGate}\nCompliance: ${d.compliancePct.toFixed(1)}% | ${late} gate(s) delayed >15 days\nDeliverables: ${d.deliverables.done}/${d.deliverables.total}`);
    });
    $("notesBtn") && $("notesBtn").addEventListener("click", () => {
      document.querySelector('.pd-tab[data-tab="approvals"]') && document.querySelector('.pd-tab[data-tab="approvals"]').click();
    });
  }

  // ── Boot ──
  function init() {
    renderTopNav("dashboard");
    const params = new URLSearchParams(location.search);
    const id = params.get("id") || "Tractor 2";
    const d = (typeof getProjectDetail === "function") ? getProjectDetail(id) : null;
    if (!d) {
      document.querySelectorAll(".pd-tabpanel").forEach(p => { p.hidden = true; });
      $("pdNotFound").hidden = false;
      $("pdNotFoundMsg").textContent = 'No project found for id "' + id + '".';
      return;
    }
    window.__pd = d;
    document.title = d.projectName + " — Project Detail";

    renderOverview(d);
    renderHealth(d);
    renderTimeline(d);
    renderPreKo(d);
    renderDeliverables(d);
    renderApprovals(d);
    renderActionRegister(d);
    renderGantt(d);

    initGateChecklist(d);
    initTabs();
    initPreKoSubtabs();
    applyPdTabVisibility();
    initPdf();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
