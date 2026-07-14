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

  // ── Shared floating popover — one at a time, closed on outside click / Escape. Used by the
  // Deliverables tab's Responsible "+ Assign"/Documents/Actions-history controls AND the
  // Timeline tab's "Skip this gate" confirm (moved to top level, out of renderDeliverables'
  // own closure, so both tabs' render functions can share the same instance). ──
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
  // Exposed so timeline.js (a separate classic-script closure, loaded before this file but only
  // *calling* this at click-time, well after both files have finished loading) can reuse the
  // same floating-popover implementation for the Timeline tab's "Skip this gate" confirm.
  window.PDPopover = { open: openPopover, close: closePopover };

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
      if (s === "Skipped") return "Skipped";
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
          st === "Skipped"   ? "dlv-gate-skipped"   : "",
          isSelected         ? "dlv-gate-selected"  : "",
        ].filter(Boolean).join(" ");

        let circleInner = String(gi + 1);
        if (st === "Completed") {
          circleInner = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        } else if (st === "Skipped") {
          circleInner = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.5" y1="18.5" x2="18.5" y2="5.5"/></svg>`;
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

    // ── RAG calculation — Red/Amber/Green driven purely by real actual-vs-planned delay days:
    // green = delivered on or before its planned end date; amber = late by up to 15 days;
    // red = late by more than 15 days. No usable date (not started, no delayDays yet) reads as
    // grey/empty rather than a falsely-reassuring green. ──
    function calcRag(delayDays, isNotStarted) {
      if (isNotStarted || delayDays === null || delayDays === undefined) return "grey";
      if (delayDays <= 0)  return "green";
      if (delayDays <= 15) return "amber";
      return "red";
    }

    // ── Status helpers — keyed by the REAL status value stored on the assignment record (Not
    // Started/Assigned/In Progress/Ready for Review/Completed/Rejected/Rework/Blocked), since
    // x.status now round-trips straight to/from that record via the workspace bridge. "Not
    // Started" displays as "Pending" (the spec's vocabulary for the same state) without needing
    // a second stored value. Color comes from RAG (see calcRag), not the workflow stage itself. ──
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

    // ── Add Deliverable — PMO/SA only (see dlvAddBtn wiring in buildTable below). Scoped to the
    // gate's own master library entries so the data stays realistic and reconcilable, same as
    // every other deliverable on this page — never a free-text/custom entry. ──
    function buildAddDeliverablePopoverHtml(options) {
      const rows = options.map(o => `
        <div class="dlv-pop-row" data-deliverable-no="${esc(o.deliverableNo)}">
          <span class="dlv-pop-row-name">${esc(o.deliverableName)}</span>
          <span class="dlv-pop-row-sub">${esc(o.deliverableCode)}${o.department ? " · " + esc(o.department) : ""}</span>
        </div>`).join("");
      return `
        <div class="dlv-pop-head">Add Deliverable</div>
        <div class="dlv-pop-list">${rows || '<div class="dlv-pop-empty">Every library deliverable for this gate is already assigned.</div>'}</div>
        <div class="dlv-pop-actions">
          <button type="button" class="dlv-pop-btn dlv-pop-cancel">Cancel</button>
        </div>`;
    }
    function openAddDeliverablePopover(anchorEl, gateCode, gd) {
      if (!bridge) return;
      const options = bridge.listAddableDeliverables(d.projectCode, gateCode);
      const pop = openPopover(anchorEl, buildAddDeliverablePopoverHtml(options), "dlv-add-popover");
      pop.querySelector(".dlv-pop-cancel").addEventListener("click", closePopover);
      pop.querySelectorAll("[data-deliverable-no]").forEach(row => {
        row.addEventListener("click", () => {
          try {
            const fresh = bridge.addDeliverableToGate(d.projectCode, gateCode, row.dataset.deliverableNo, actorName, actorRoleBiz);
            closePopover();
            showToast(`Added "${row.querySelector(".dlv-pop-row-name").textContent}".`, "success");
            if (fresh && typeof window.mapAssignmentToDisplay === "function") {
              gd.deliverables.push(window.mapAssignmentToDisplay(fresh));
            }
            buildTable();
          } catch (e) { showToast("Could not add: " + e.message, "error"); }
        });
      });
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

    // ── Parent/child hierarchy — one level only, mirrors the Deliverable Library catalog's own
    // rule. Returns [{idx, x, label, depth}] in display order: every top-level item numbered
    // 1, 2, 3… followed immediately by its own children as 1.1, 1.2…, so array position ("idx",
    // used everywhere else in this function for data-idx wiring) stays untouched — only the
    // RENDER order and the displayed label change. ──
    function buildHierarchyOrder(list) {
      const byId = new Map(list.map((x, i) => [x.assignmentId, i]));
      const childrenOf = new Map(); // parentAssignmentId -> [originalIdx,...]
      const topLevel = [];
      list.forEach((x, i) => {
        const pid = x.parentAssignmentId;
        if (pid && byId.has(pid) && pid !== x.assignmentId) {
          if (!childrenOf.has(pid)) childrenOf.set(pid, []);
          childrenOf.get(pid).push(i);
        } else {
          topLevel.push(i);
        }
      });
      const order = [];
      topLevel.forEach((idx, ti) => {
        const label = String(ti + 1);
        order.push({ idx, x: list[idx], label, depth: 0 });
        (childrenOf.get(list[idx].assignmentId) || []).forEach((cidx, ci) => {
          order.push({ idx: cidx, x: list[cidx], label: `${label}.${ci + 1}`, depth: 1 });
        });
      });
      return order;
    }
    function hasChildren(list, assignmentId) {
      return list.some(x => x.parentAssignmentId === assignmentId);
    }

    // ── Set Parent — SA/PMO only (same tier as Add Deliverable, a structural change rather than
    // a day-to-day status/date edit). Lists other TOP-LEVEL deliverables in this same gate. ──
    function buildSetParentPopoverHtml(x, candidates) {
      const rows = candidates.map(c => `
        <div class="dlv-pop-row" data-assignment-id="${esc(c.assignmentId)}">
          <span class="dlv-pop-row-name">${esc(c.name)}</span>
        </div>`).join("");
      return `
        <div class="dlv-pop-head">Set Parent — ${esc(x.name)}</div>
        <div class="dlv-pop-list">
          <div class="dlv-pop-row" data-assignment-id="">
            <span class="dlv-pop-row-name">— None (top-level) —</span>
          </div>
          ${rows || '<div class="dlv-pop-empty">No other top-level deliverables in this gate.</div>'}
        </div>
        <div class="dlv-pop-actions">
          <button type="button" class="dlv-pop-btn dlv-pop-cancel">Cancel</button>
        </div>`;
    }
    function openSetParentPopover(anchorEl, gd, x) {
      if (!bridge) return;
      const candidates = gd.deliverables.filter(c => c.assignmentId !== x.assignmentId && !c.parentAssignmentId);
      const pop = openPopover(anchorEl, buildSetParentPopoverHtml(x, candidates), "dlv-add-popover");
      pop.querySelector(".dlv-pop-cancel").addEventListener("click", closePopover);
      pop.querySelectorAll("[data-assignment-id]").forEach(row => {
        row.addEventListener("click", () => {
          try {
            const parentId = row.dataset.assignmentId || null;
            const fresh = bridge.setAssignmentParent(x.assignmentId, parentId, actorName, actorRoleBiz);
            closePopover();
            showToast(parentId ? `Set as a child deliverable.` : `Cleared parent — now top-level.`, "success");
            const idx = gd.deliverables.findIndex(d => d.assignmentId === x.assignmentId);
            if (idx !== -1 && typeof window.mapAssignmentToDisplay === "function") {
              gd.deliverables[idx] = window.mapAssignmentToDisplay(fresh);
            }
            buildTable();
          } catch (e) { showToast("Could not set parent: " + e.message, "error"); }
        });
      });
    }

    // ── Build table ──
    function buildTable() {
      const gd = gateDetails[selectedGateIdx];
      const st = gateStatus(selectedGateIdx);
      const isFuture    = st === "Future";
      const isCompleted = st === "Completed";
      const isSkipped   = st === "Skipped";

      if (banner) {
        banner.hidden = !isFuture && !isSkipped;
        if (isSkipped) {
          banner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="7" y1="17" x2="17" y2="7"/></svg>This gate has been marked Skipped for this project — no deliverables or approval are required, and it's excluded from progress and compliance calculations.`;
        } else if (isFuture) {
          banner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>This gate has not started yet. Deliverables will become available once the previous gate is completed and this gate becomes Active.`;
        }
      }

      const addBtn = document.getElementById("dlvAddBtn");
      if (addBtn) {
        addBtn.hidden = !(isSuperAdmin || isPMO);
        addBtn.disabled = isSkipped;
        addBtn.title = isSkipped ? "This gate is Skipped — deliverables can't be added." : "";
        addBtn.onclick = isSkipped || !gd ? null : () => openAddDeliverablePopover(addBtn, gd.stage, gd);
      }

      if (!gd || !gd.deliverables || !gd.deliverables.length) {
        tbody.innerHTML = `<tr class="dlv-empty-row"><td colspan="12">${isSkipped ? "This gate is Skipped — no deliverables required." : "No deliverables defined for this gate."}</td></tr>`;
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

      const hierOrder = buildHierarchyOrder(gd.deliverables);
      const rows = hierOrder.map(({ idx: i, x, label: seqLabel, depth }) => {
        // ── Planned Start/End — the seed now provides these as two distinct real fields
        // (x.plannedDate / x.plannedEndDate, from the assignment's own plannedStart/targetDate,
        // clamped to a 5–60 day gap) — no longer duplicated from a single value. ──
        const plannedStartISO = isFuture ? "" : (x.plannedDate && x.plannedDate !== "-" ? displayToISO(x.plannedDate) || x.plannedDate : "");
        const plannedEndISO   = isFuture ? "" : (x.plannedEndDate && x.plannedEndDate !== "-" ? displayToISO(x.plannedEndDate) || x.plannedEndDate : "");
        const actualISO       = isFuture ? "" : (x.actualDate && x.actualDate !== "-" ? displayToISO(x.actualDate) || x.actualDate : "");

        const plannedStartDisplay = isoToDisplay(plannedStartISO) || "—";
        const plannedEndDisplay   = isoToDisplay(plannedEndISO)   || "—";
        const actualDisplay       = isoToDisplay(actualISO)       || "—";
        const outlookISO          = isFuture ? "" : (x.outlookDate && x.outlookDate !== "-" ? displayToISO(x.outlookDate) || x.outlookDate : "");
        const outlookDisplay      = isoToDisplay(outlookISO) || "—";

        // RAG drives the Status pill's color (see statusCell below) — grey/no-color when there's
        // no real date basis to judge from, rather than a default that would falsely claim "on time".
        const delayDays = (!isFuture && x.delayDays !== undefined) ? x.delayDays : null;
        const rag = calcRag(delayDays, isFuture);
        const isDelayed = rag === "amber" || rag === "red";
        const delayTitle = delayDays !== null ? `${delayDays} day${delayDays === 1 ? "" : "s"} delay` : "";

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
        let startCell, endCell, actualCell, outlookCell, statusCell, remarksCell;
        if (perms.canEditDates) {
          startCell = `<input class="dlv-edit-date" type="date" data-field="plannedStart" value="${plannedStartISO}">`;
          endCell   = `<input class="dlv-edit-date" type="date" data-field="plannedEnd" value="${plannedEndISO}">`;
          actualCell= `<input class="dlv-edit-date" type="date" data-field="actualClosure" value="${actualISO}">`;
          // Outlook — a revised "expected to finish by" date, not a status/RAG indicator. Blank
          // until someone explicitly sets one; no auto-computed default.
          outlookCell = `<input class="dlv-edit-date" type="date" data-field="outlook" value="${outlookISO}">`;
        } else {
          startCell  = `<span style="color:var(--color-slate-680);font-size:var(--fs-11)">${isFuture ? "" : plannedStartDisplay}</span>`;
          endCell    = `<span style="color:var(--color-slate-680);font-size:var(--fs-11)">${isFuture ? "" : plannedEndDisplay}</span>`;
          actualCell = `<span style="color:var(--color-slate-680);font-size:var(--fs-11)">${isFuture ? "" : actualDisplay}</span>`;
          outlookCell= `<span style="color:var(--color-slate-680);font-size:var(--fs-11)">${isFuture || !outlookISO ? "" : outlookDisplay}</span>`;
        }
        // Status color reads as RAG (red/amber/green) — the same signal the delay-days hover
        // used to carry on the (now-removed) Outlook dot lives here now, as this pill's title.
        if (perms.canEditStatus) {
          statusCell = `<select class="dlv-edit-select dlv-edit-status dlv-status-rag-${rag}" data-field="status" title="${esc(delayTitle)}">
            ${nextAllowedStatuses(rawStatus).map(s => `<option value="${s}"${rawStatus === s ? " selected" : ""}>${esc(statusLabel(s))}</option>`).join("")}
          </select>`;
        } else {
          statusCell = `<span class="dlv-status dlv-status-rag-${rag}" title="${esc(delayTitle)}">${esc(statusLabel(rawStatus))}</span>`;
        }
        if (perms.canEditRemarks) {
          remarksCell = `<input class="dlv-edit-text${isDelayed ? " dlv-edit-text-required" : ""}" type="text" data-field="remarks" value="${esc(remarks)}" placeholder="${isDelayed ? "Remarks required — explain the delay…" : "Add remarks…"}">`;
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
        const rowClass = [
          isCompleted ? "dlv-row-readonly" : (rowEditable ? "dlv-row-editable" : ""),
          depth > 0 ? "dlv-row-child" : "",
        ].filter(Boolean).join(" ");

        // ── Parent/child control — SA/PMO only, same tier as Add Deliverable. A row that already
        // has children of its own can't also become a child (one level of nesting, mirrors the
        // Deliverable Library catalog's own rule). ──
        const canSetParent = (isSuperAdmin || isPMO) && !isFuture && !isSkipped;
        const isParentRow = hasChildren(gd.deliverables, x.assignmentId);
        let parentTag = "";
        if (depth > 0) {
          const parentX = gd.deliverables.find(d => d.assignmentId === x.parentAssignmentId);
          parentTag = canSetParent
            ? `<button type="button" class="dlv-parent-tag dlv-parent-tag-btn" data-set-parent-idx="${i}">↳ Child of ${esc(parentX ? parentX.name : "—")}</button>`
            : `<span class="dlv-parent-tag">↳ Child of ${esc(parentX ? parentX.name : "—")}</span>`;
        } else if (canSetParent && !isParentRow) {
          parentTag = `<button type="button" class="dlv-parent-tag dlv-parent-tag-btn dlv-parent-tag-empty" data-set-parent-idx="${i}">+ Set parent</button>`;
        }

        return `<tr class="${rowClass}" data-idx="${i}">
          <td style="text-align:center;color:var(--color-slate-530)">${esc(seqLabel)}</td>
          <td style="font-weight:var(--fw-600);color:var(--color-slate-780);font-size:var(--fs-10)">${code}</td>
          <td class="${depth > 0 ? "dlv-td-name-child" : ""}"><span class="dlv-name-link">${esc(x.name)}</span>${parentTag}</td>
          <td class="dlv-td-resp">${respCell}</td>
          <td class="dlv-td-date">${startCell}</td>
          <td class="dlv-td-date">${endCell}</td>
          <td class="dlv-td-date">${actualCell}</td>
          <td class="dlv-td-date">${outlookCell}</td>
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

        row.querySelector("[data-set-parent-idx]")?.addEventListener("click", (e) => {
          openSetParentPopover(e.currentTarget, gd, x);
        });

        // A delayed item (amber/red RAG) can't be updated — status, dates, whatever — without
        // remarks explaining the delay first; only editing remarks itself is exempt. Reverts the
        // control back to its saved value rather than leaving a phantom unsaved change on screen.
        function originalFieldValue(field) {
          if (field === "status") return x.status || "Not Started";
          if (field === "plannedStart")  return x.plannedDate    && x.plannedDate    !== "-" ? (displayToISO(x.plannedDate)    || "") : "";
          if (field === "plannedEnd")    return x.plannedEndDate && x.plannedEndDate !== "-" ? (displayToISO(x.plannedEndDate) || "") : "";
          if (field === "actualClosure") return x.actualDate     && x.actualDate     !== "-" ? (displayToISO(x.actualDate)     || "") : "";
          if (field === "outlook")       return x.outlookDate    && x.outlookDate    !== "-" ? (displayToISO(x.outlookDate)    || "") : "";
          return "";
        }

        // Status / date / remarks edits — each persists through the bridge immediately on change.
        row.querySelectorAll("[data-field]").forEach(input => {
          input.addEventListener("change", () => {
            if (!bridge) { showToast("Cannot save — workspace not ready.", "error"); return; }
            const field = input.dataset.field;
            const val = input.value;

            const rowRag = calcRag(x.delayDays !== undefined ? x.delayDays : null, isFuture);
            if (field !== "remarks" && (rowRag === "amber" || rowRag === "red")) {
              const remarksInput = row.querySelector('[data-field="remarks"]');
              const remarksVal = (remarksInput ? remarksInput.value : (x.remarks && x.remarks !== "-" ? x.remarks : "")).trim();
              if (!remarksVal) {
                showToast("This item is delayed — add remarks explaining the delay before updating it.", "error");
                input.value = originalFieldValue(field);
                if (remarksInput) remarksInput.focus();
                return;
              }
            }

            try {
              let fresh;
              if (field === "status") {
                fresh = bridge.updateAssignmentStatus(x.assignmentId, val, actorName, actorRoleBiz);
                showToast(`${x.name} status set to ${statusLabel(val)}.`, "success");
              } else {
                const fieldMap = { plannedStart: "plannedStart", plannedEnd: "targetDate", actualClosure: "actualEnd", outlook: "outlookDate", remarks: "remarks" };
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
      tbody.innerHTML = '<tr class="dlv-empty-row"><td colspan="6">No checklist data available for this project.</td></tr>';
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
      else if (g.status === "Skipped") seedStatus = "Skipped";
      else if (g.status === "In Progress") seedStatus = "Active";
      else if (["Completed","On Time","Delayed 15-60","Delayed >60"].includes(g.status)) seedStatus = "Completed";
      else seedStatus = "Future";
      if (seedStatus === "Skipped") return "Skipped";
      if (seedStatus !== "Future") return seedStatus;
      // Seed data hasn't caught up yet, but if the immediately previous gate was just approved
      // THIS session, unlock this one so the user can move straight into it.
      const prevStage = gi > 0 ? gateChecklist[gi - 1].stage : null;
      if (prevStage && gateApproved[prevStage]) return "Active";
      return seedStatus;
    }
    function editableGate(gi) { return canEdit && gateStatus(gi) !== "Future" && gateStatus(gi) !== "Completed" && gateStatus(gi) !== "Skipped"; }

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
          st === "Skipped"   ? "dlv-gate-skipped"   : "",
          isSelected         ? "dlv-gate-selected"  : "",
        ].filter(Boolean).join(" ");
        let circleInner = String(gi + 1);
        if (st === "Completed") circleInner = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        else if (st === "Skipped") circleInner = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.5" y1="18.5" x2="18.5" y2="5.5"/></svg>`;
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

    function buildTable() {
      const gc = gateChecklist[selectedGateIdx];
      const st = gateStatus(selectedGateIdx);
      const isFuture = st === "Future";
      const isCompleted = st === "Completed";
      const isSkipped = st === "Skipped";
      const editable = canEdit && !isFuture && !isCompleted && !isSkipped;

      if (banner) {
        banner.hidden = !isFuture && !isSkipped;
        if (isSkipped) {
          banner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="7" y1="17" x2="17" y2="7"/></svg>This gate has been marked Skipped for this project — no checklist or approval is required.`;
        } else if (isFuture) {
          banner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>This gate's checklist isn't open yet — it becomes available once the previous gate's approval is complete.`;
        }
      }

      if (!gc || !gc.items || !gc.items.length) {
        tbody.innerHTML = `<tr class="dlv-empty-row"><td colspan="6">${isSkipped ? "This gate is Skipped — no checklist required." : "No checklist items configured for this gate yet — add them in Admin Console → Gate Checklist Templates."}</td></tr>`;
        if (approvalEl) approvalEl.innerHTML = "";
        return;
      }

      const rows = gc.items.map((x, i) => {
        const rawStatus = isFuture ? "Not Started" : (x.status || "Not Started");
        const remarks = isFuture ? "" : (x.remarks || "");
        const responsibleList = isFuture ? [] : (Array.isArray(x.responsible) ? x.responsible : []);
        const hasDocs = !isFuture && !!x.evidence;

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

        // Document cell — a Completed item (or any item someone already uploaded evidence for)
        // shows a clear "uploaded" badge with its filename, not just a bare enabled icon;
        // an editable, not-yet-uploaded item gets an Upload button instead of a disabled one.
        let docCell;
        if (hasDocs) {
          docCell = `<div class="gc-doc-uploaded" data-doc-idx="${i}" title="${esc(x.evidence)}">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span class="gc-doc-name">${esc(x.evidence)}</span>
            ${editable ? `<button type="button" class="gc-doc-replace" data-upload-idx="${i}" title="Replace document">Replace</button>` : ""}
          </div>`;
        } else if (editable) {
          docCell = `<button type="button" class="gc-upload-btn" data-upload-idx="${i}">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload
          </button>`;
        } else {
          docCell = `<span class="dlv-unassigned">No document</span>`;
        }

        const rowClass = isCompleted ? "dlv-row-readonly" : (editable ? "dlv-row-editable" : "");
        const mandTag = x.mandatory ? `<span class="gc-mand-tag" title="Mandatory">*</span>` : "";

        return `<tr class="${rowClass}" data-idx="${i}">
          <td style="text-align:center;color:var(--color-slate-530)">${i + 1}</td>
          <td><span class="dlv-name-link" title="${esc(x.description || "")}">${esc(x.title)}${mandTag}</span></td>
          <td class="dlv-td-resp">${respCell}</td>
          <td class="dlv-td-status">${statusCell}</td>
          <td class="dlv-td-remarks">${remarksCell}</td>
          <td class="dlv-td-doc">${docCell}</td>
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
                // dropdown stamps today's (app-fixed) date so a real actual-vs-planned-end
                // comparison exists even without a dedicated date field.
                if (val === "Completed" && (!x.actualDate || x.actualDate === "-")) x.actualDate = isoToDisplay("2026-07-07");
                if (val !== "Completed") x.actualDate = "-";
                // A newly-Completed item reads as "document uploaded" the same way a pre-seeded
                // Completed one already does, rather than needing a separate manual upload —
                // matches project-detail-seed.js's own deterministic evidence-filename pattern.
                if (val === "Completed" && !x.evidence) x.evidence = x.title.replace(/\s+/g, "_") + ".pdf";
              }
              if (field === "remarks") x.remarks = val;
              buildTable(); // status/remarks may change the Document cell or gate eligibility below
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

          // Upload (no document yet) / Replace (already uploaded) — same small popover either
          // way. Session-only, like the rest of this tab's edits (no bridge/persistence layer
          // exists for checklist items), but it drives the exact same "uploaded" badge a
          // pre-seeded Completed item already shows.
          const uploadBtn = row.querySelector(".gc-upload-btn") || row.querySelector(".gc-doc-replace");
          if (uploadBtn) {
            uploadBtn.addEventListener("click", () => {
              const idx = parseInt(row.dataset.idx, 10);
              const x = gc.items[idx];
              const pop = openPopover(uploadBtn, `
                <div class="dlv-pop-head">${x.evidence ? "Replace" : "Upload"} Document — ${esc(x.title)}</div>
                <div class="dlv-pop-upload">
                  <input type="text" class="dlv-pop-filename" placeholder="File name (e.g. Evidence.pdf)">
                  <button type="button" class="dlv-pop-btn dlv-pop-save dlv-pop-upload-btn">Upload</button>
                </div>`, "dlv-docs-popover");
              pop.querySelector(".dlv-pop-upload-btn").addEventListener("click", () => {
                const fileName = (pop.querySelector(".dlv-pop-filename").value || "").trim();
                if (!fileName) return;
                x.evidence = fileName;
                closePopover();
                showToast(`Uploaded "${fileName}".`, "success");
                buildTable();
              });
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

      // Not-started (Future) or Skipped gate — no approval section at all.
      if (st === "Future" || st === "Skipped") { approvalEl.innerHTML = ""; return; }

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
          `<h4>Start Gate Sign - Off — ${esc(stageCode)}</h4>`,
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

  // ── Gantt Chart — gate-grouped deliverables (same records the Deliverables tab edits) with a
  // real date-scaled timeline. Figma node 532:1621. Left/right panes are both built from one
  // shared row model (rows[]) so their heights can never drift out of pixel alignment. ──
  function renderGantt(d) {
    const MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function parseDisp(s) {
      if (!s || s === "-" || s === "—") return null;
      const p = String(s).trim().split(" ");
      if (p.length < 3) return null;
      const mi = MON3.indexOf(p[1]);
      if (mi < 0) return null;
      let yr = parseInt(p[2], 10); if (yr < 100) yr += 2000;
      return new Date(yr, mi, parseInt(p[0], 10));
    }
    const diffDaysG = (a, b) => Math.round((b - a) / 86400000);
    const TODAY_G = new Date(2026, 6, 7); // fixed app "today" — matches every other tab

    const gateDetails = d.gateDetails || [];
    const gatesArr = d.gates || [];
    const kpiStrip       = $("gcKpiStrip");
    const leftScroll     = $("gcLeftScroll");
    const rightScroll    = $("gcRightScroll");
    const headInner      = $("gcRightHeadInner");
    const gateRowEl      = $("gcGateRow");
    const monthRowEl     = $("gcMonthRow2");
    const weekRowEl      = $("gcWeekRow2");
    const barsInnerEl    = $("gcBarsInner");
    const catFilterEl    = $("gcCategoryFilter");
    const statusFilterEl = $("gcStatusFilter");
    const filterSummaryEl = $("gcFilterSummary");
    if (!leftScroll || !rightScroll) return;

    if (!gateDetails.length) {
      leftScroll.innerHTML = '<div style="padding:24px;color:var(--color-slate-600);font-style:italic">No deliverables found for this project.</div>';
      if (kpiStrip) kpiStrip.innerHTML = "";
      return;
    }

    function gateStatusOf(gi) {
      const g = gatesArr[gi];
      if (!g) return gi < (d.gateReached || 0) ? "Completed" : "Future";
      const s = g.status;
      if (s === "In Progress") return "Active";
      if (s === "Completed" || s === "On Time" || s === "Delayed 15-60" || s === "Delayed >60") return "Completed";
      return "Future";
    }
    // Same 0–15 green / 15–60 amber / >60 red formula used by the Deliverables tab and Gate
    // Checklist tab's delay bands — one formula, reused everywhere a deliverable/gate is scored.
    function ragOf(x, isFutureGate) {
      if (isFutureGate) return "grey";
      const dd = x.delayDays;
      if (dd === null || dd === undefined || dd < 0) return "green";
      if (dd <= 15) return "green";
      if (dd <= 60) return "amber";
      return "red";
    }

    // Flat, unfiltered list of every deliverable across every gate — base for KPI totals,
    // category options and global row numbering (numbering stays stable across filtering).
    const allEntries = [];
    gateDetails.forEach((gd, gi) => {
      const isFutureGate = gateStatusOf(gi) === "Future";
      (gd.deliverables || []).forEach(x => allEntries.push({ x, gi, isFutureGate, rag: ragOf(x, isFutureGate) }));
    });
    allEntries.forEach((e, i) => { e.no = i + 1; });

    // State persists across re-renders of this tab (expand/collapse + filters survive a redraw).
    if (!renderGantt._state) {
      renderGantt._state = { gateExpanded: {}, category: "", status: "", scrolledOnce: false };
    }
    const state = renderGantt._state;

    // ── KPI values — always over the WHOLE project, independent of the active filter ──
    const plannedStarts = allEntries.map(e => parseDisp(e.x.plannedDate)).filter(Boolean);
    const plannedEnds   = allEntries.map(e => parseDisp(e.x.plannedEndDate)).filter(Boolean);
    const gateStarts = gatesArr.map(g => parseDisp(g.plannedStart)).filter(Boolean);
    const gateEnds   = gatesArr.map(g => parseDisp(g.target)).filter(Boolean);
    const spanStarts = plannedStarts.concat(gateStarts);
    const spanEnds   = plannedEnds.concat(gateEnds);
    const overallMin = spanStarts.length ? new Date(Math.min.apply(null, spanStarts.map(t => t.getTime()))) : TODAY_G;
    const overallMax = spanEnds.length ? new Date(Math.max.apply(null, spanEnds.map(t => t.getTime()))) : TODAY_G;

    const totalDeliverables = allEntries.length;
    const plannedDurationDays = Math.max(0, diffDaysG(overallMin, overallMax));
    const criticalEntries = allEntries.filter(e => e.rag === "red");
    const criticalCount = criticalEntries.length;
    const delayedEntries = allEntries.filter(e => !e.isFutureGate && (e.x.delayDays || 0) > 0);
    const avgDelay = delayedEntries.length ? Math.round(delayedEntries.reduce((s, e) => s + e.x.delayDays, 0) / delayedEntries.length) : 0;
    const completedCount = allEntries.filter(e => e.x.status === "Completed").length;

    if (kpiStrip) {
      const cards = [
        { val: totalDeliverables, lbl: "Total Deliverables" },
        { val: plannedDurationDays + " days", lbl: "Planned Duration" },
        { val: criticalCount, lbl: "Critical", id: "gcKpiCritical", cls: "gc2-kpi-red gc2-kpi-clickable" },
        { val: avgDelay + "d", lbl: "Avg. Delay", cls: "gc2-kpi-amber" },
        { val: completedCount, lbl: "Completed", cls: "gc2-kpi-teal" },
      ];
      kpiStrip.innerHTML = cards.map(c =>
        `<div class="gc2-kpi-card ${c.cls || ""}" ${c.id ? `id="${c.id}"` : ""}>
           <div class="gc2-kpi-val">${c.val}</div>
           <div class="gc2-kpi-lbl">${esc(c.lbl)}</div>
         </div>`
      ).join("");
    }

    // Category filter options — real department values present on this project's deliverables.
    if (catFilterEl && !catFilterEl.dataset.built) {
      const cats = [...new Set(allEntries.map(e => e.x.department).filter(Boolean))].sort();
      catFilterEl.innerHTML = '<option value="">Category: All</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
      catFilterEl.dataset.built = "1";
    }

    function passesFilter(e) {
      if (state.category && e.x.department !== state.category) return false;
      if (state.status && e.rag !== state.status) return false;
      return true;
    }

    // ── Row model — one flat, ordered list driving BOTH panes ──
    const GATE_H = 34, DELIV_H = 52, MS_H = 30;
    const rows = [];
    gateDetails.forEach((gd, gi) => {
      const status = gateStatusOf(gi);
      const gateEntries = allEntries.filter(e => e.gi === gi);
      const visibleEntries = gateEntries.filter(passesFilter);
      rows.push({ kind: "gate", gi, gd, status, height: GATE_H });
      if (state.gateExpanded[gi] !== false) {
        visibleEntries.forEach(e => rows.push({ kind: "deliv", gi, e, height: DELIV_H }));
        const total = gateEntries.length;
        const done = gateEntries.filter(e => e.x.status === "Completed").length;
        const pct = total ? Math.round(done / total * 100) : 0;
        rows.push({ kind: "ms", gi, status, pct, height: MS_H });
      }
    });
    let yCursor = 0;
    rows.forEach(r => { r.top = yCursor; yCursor += r.height; });
    const totalHeight = Math.max(yCursor, 1);

    // ── Left pane ──
    function chevronSvg(open) {
      return `<svg class="gc2-gate-chevron${open ? " gc2-open" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    }
    const USER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
    function respText(x) {
      const list = x.responsible || [];
      if (!list.length) return "Unassigned";
      if (list.length === 1) return list[0];
      return list[0] + " +" + (list.length - 1);
    }

    const leftHtml = rows.map(r => {
      if (r.kind === "gate") {
        const open = state.gateExpanded[r.gi] !== false;
        return `<div class="gc2-gate-header-row gc2-gate-${r.status.toLowerCase()}" data-gate-idx="${r.gi}" style="height:${r.height}px">
          ${chevronSvg(open)}
          <span>Gate ${r.gi + 1} — ${esc(r.gd.stage)}</span>
          ${r.status === "Active" ? '<span class="gc2-gate-current-tag">(CURRENT)</span>' : ""}
        </div>`;
      }
      if (r.kind === "ms") {
        const bucket = r.pct >= 100 ? "gc2-ms-done" : r.pct > 0 ? "gc2-ms-partial" : "gc2-ms-pending";
        return `<div class="gc2-milestone-row ${bucket}" style="height:${r.height}px">
          <span class="gc2-ms-diamond"></span>
          <span class="gc2-ms-label">Milestone: Gate ${r.gi + 1} Complete — ${r.pct}%</span>
          ${r.pct < 100 ? `<div class="gc2-ms-bar"><div style="width:${r.pct}%"></div></div>` : ""}
        </div>`;
      }
      const x = r.e.x;
      const sD = parseDisp(x.plannedDate), eD = parseDisp(x.plannedEndDate);
      const days = (sD && eD) ? diffDaysG(sD, eD) : "-";
      const varVal = r.e.isFutureGate ? 0 : (x.delayDays || 0);
      return `<div class="gc2-deliv-row" style="height:${r.height}px">
        <div class="gc2-dc gc2-dc-no">${r.e.no}</div>
        <div class="gc2-dc gc2-dc-deliv">
          <div class="gc2-dc-name" title="${esc(x.name)}">${esc(x.name)}</div>
          <div class="gc2-dc-resp">${USER_ICON}<span>${esc(respText(x))}</span></div>
        </div>
        <div class="gc2-dc gc2-dc-date"><span class="p">P: ${esc(x.plannedDate)}</span><span class="a">A: —</span></div>
        <div class="gc2-dc gc2-dc-date"><span class="p">P: ${esc(x.plannedEndDate)}</span><span class="a">A: ${esc(x.actualDate)}</span></div>
        <div class="gc2-dc gc2-dc-days">${days}</div>
        <div class="gc2-dc gc2-dc-var gc2-var-${r.e.rag}">${varVal > 0 ? "+" + varVal : "0"}</div>
        <div class="gc2-dc gc2-dc-status"><span class="gc2-rag-dot gc2-rag-${r.e.rag}" title="${x.delayDays || 0} day(s) delay"></span></div>
      </div>`;
    }).join("");
    leftScroll.innerHTML = leftHtml;

    // ── Right pane — date-scaled timeline ──
    const chartStart = new Date(overallMin.getFullYear(), overallMin.getMonth(), 1);
    const chartEnd   = new Date(overallMax.getFullYear(), overallMax.getMonth() + 1, 0);
    const totalDays  = Math.max(1, diffDaysG(chartStart, chartEnd) + 1);
    const WEEK_W = 26;
    const totalWeeks = Math.ceil(totalDays / 7);
    const chartW = totalWeeks * WEEK_W;
    const daysPx = days => (days / totalDays) * chartW;
    const datePx = dt => daysPx(diffDaysG(chartStart, dt));

    // Per-gate span (for the gate-band header + milestone diamond x-position)
    const gateSpans = gateDetails.map((gd, gi) => {
      const ents = allEntries.filter(e => e.gi === gi);
      const starts = ents.map(e => parseDisp(e.x.plannedDate)).filter(Boolean);
      const ends   = ents.map(e => parseDisp(e.x.plannedEndDate)).filter(Boolean);
      const gStart = parseDisp(gatesArr[gi] && gatesArr[gi].plannedStart);
      const gEnd   = parseDisp(gatesArr[gi] && gatesArr[gi].target);
      const allS = gStart ? starts.concat([gStart]) : starts;
      const allE = gEnd ? ends.concat([gEnd]) : ends;
      const s = allS.length ? new Date(Math.min.apply(null, allS.map(t => t.getTime()))) : chartStart;
      const e2 = allE.length ? new Date(Math.max.apply(null, allE.map(t => t.getTime()))) : s;
      return { start: s, end: e2 < s ? s : e2 };
    });

    if (gateRowEl) {
      gateRowEl.innerHTML = gateSpans.map((sp, gi) => {
        const status = gateStatusOf(gi);
        const left = Math.max(0, datePx(sp.start));
        const width = Math.max(34, datePx(sp.end) - left);
        const open = state.gateExpanded[gi] !== false;
        return `<div class="gc2-gate-band gc2-gate-${status.toLowerCase()}" data-gate-idx="${gi}" style="position:absolute;left:${left}px;width:${width}px;height:100%;top:0">
          <span>Gate ${gi + 1}${status === "Active" ? " (CURRENT)" : ""}</span><span style="font-weight:400">${open ? "−" : "+"}</span>
        </div>`;
      }).join("");
    }

    if (monthRowEl) {
      let html = "", cur = new Date(chartStart);
      while (cur <= chartEnd) {
        const mStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
        const mEnd   = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
        const clampT = t => Math.max(chartStart.getTime(), Math.min(chartEnd.getTime(), t));
        const w = daysPx(diffDaysG(new Date(clampT(mStart.getTime())), new Date(clampT(mEnd.getTime()))) + 1);
        html += `<div class="gc2-month-cell" style="width:${w}px">${MON3[cur.getMonth()]} ${cur.getFullYear()}</div>`;
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      }
      monthRowEl.innerHTML = html;
    }
    if (weekRowEl) {
      let html = "", cur = new Date(chartStart), weekNum = 1, lastMonth = cur.getMonth();
      while (cur <= chartEnd) {
        if (cur.getMonth() !== lastMonth) { weekNum = 1; lastMonth = cur.getMonth(); }
        html += `<div class="gc2-week-cell${weekNum === 1 ? " gc2-month-start" : ""}" style="width:${WEEK_W}px">W${weekNum}</div>`;
        cur = new Date(cur.getTime() + 7 * 86400000);
        weekNum++;
      }
      weekRowEl.innerHTML = html;
    }
    if (headInner) headInner.style.width = chartW + "px";

    // Vertical month grid lines
    let vgridHtml = "";
    { let cur = new Date(chartStart);
      while (cur <= chartEnd) {
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        const x = datePx(cur);
        if (x > 0 && x < chartW) vgridHtml += `<div class="gc2-vgrid-line" style="left:${x}px"></div>`;
      }
    }

    // Bar rows — same order/heights as the left pane
    const rowByName = {};
    rows.forEach(r => { if (r.kind === "deliv") rowByName[r.e.x.name] = r; });
    let depSvg = "";
    const barRowsHtml = rows.map(r => {
      if (r.kind === "gate") {
        return `<div class="gc2-bar-row gc2-bar-row-gate" style="top:${r.top}px;height:${r.height}px;width:${chartW}px"></div>`;
      }
      if (r.kind === "ms") {
        const sp = gateSpans[r.gi];
        const cx = datePx(sp.end);
        const cls = r.pct > 0 ? "done" : "pending";
        return `<div class="gc2-bar-row gc2-bar-row-ms" style="top:${r.top}px;height:${r.height}px;width:${chartW}px">
          <div class="gc2-ms-diamond-track ${cls}" style="left:${cx}px"></div>
        </div>`;
      }
      const x = r.e.x;
      const sD = parseDisp(x.plannedDate), eD = parseDisp(x.plannedEndDate);
      let bars = "";
      if (sD && eD) {
        const left = datePx(sD), width = Math.max(10, datePx(eD) - left);
        bars += `<div class="gc2-bar gc2-bar-planned" style="left:${left}px;width:${width}px" title="Planned: ${esc(x.plannedDate)} – ${esc(x.plannedEndDate)}">${width > 70 ? `<span class="gc2-bar-label">${esc(x.plannedDate)} – ${esc(x.plannedEndDate)}</span>` : ""}</div>`;
      }
      if (x.status === "Completed" && x.actualDate && x.actualDate !== "-" && sD) {
        const actualEndD = parseDisp(x.actualDate);
        if (actualEndD) {
          const left = datePx(sD), width = Math.max(8, datePx(actualEndD) - left);
          bars += `<div class="gc2-bar gc2-bar-actual" style="left:${left}px;width:${width}px" title="Actual: ${esc(x.plannedDate)} – ${esc(x.actualDate)}"></div>`;
        }
      }
      if (r.e.rag === "red") {
        const alertLeft = (eD ? datePx(eD) : (sD ? datePx(sD) : 0)) + 4;
        bars += `<div class="gc2-bar-alert" title="${x.delayDays} day(s) delay" style="left:${alertLeft}px">!</div>`;
      }
      // Dependency connector — only real dependencies (x.dependency names another real deliverable)
      if (x.dependency && x.dependency !== "-") {
        const depRow = rowByName[x.dependency];
        if (depRow) {
          const depX = parseDisp(depRow.e.x.plannedEndDate) || parseDisp(depRow.e.x.plannedDate);
          if (depX && sD) {
            const x1 = datePx(depX), y1 = depRow.top + depRow.height / 2;
            const x2 = datePx(sD), y2 = r.top + r.height / 2;
            const midX = x1 + Math.max(14, (x2 - x1) / 2);
            depSvg += `<path d="M${x1},${y1} L${midX},${y1} L${midX},${y2} L${Math.max(x1, x2 - 5)},${y2}" fill="none" stroke="#94a3b8" stroke-width="1.3" stroke-dasharray="4,3" marker-end="url(#gc2ArrowHead)"/>`;
          }
        }
      }
      return `<div class="gc2-bar-row" style="top:${r.top}px;height:${r.height}px;width:${chartW}px">${bars}</div>`;
    }).join("");

    if (barsInnerEl) {
      barsInnerEl.style.width = chartW + "px";
      barsInnerEl.style.height = totalHeight + "px";
      const todayX = datePx(TODAY_G);
      barsInnerEl.innerHTML = `
        <div class="gc2-vgrid-overlay">${vgridHtml}</div>
        <svg class="gc2-dep-svg" width="${chartW}" height="${totalHeight}">
          <defs><marker id="gc2ArrowHead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>
          ${depSvg}
        </svg>
        ${barRowsHtml}
        ${todayX >= 0 && todayX <= chartW ? `<div class="gc2-today-line" style="left:${todayX}px;height:${totalHeight}px"></div><div class="gc2-today-flag" style="left:${todayX}px">Today</div>` : ""}
      `;
    }

    // ── Scroll sync: vertical (left ↔ right), horizontal (right bars → sticky head via transform) ──
    let syncingV = false;
    leftScroll.onscroll = () => {
      if (syncingV) return; syncingV = true;
      rightScroll.scrollTop = leftScroll.scrollTop;
      syncingV = false;
    };
    rightScroll.onscroll = () => {
      if (!syncingV) { syncingV = true; leftScroll.scrollTop = rightScroll.scrollTop; syncingV = false; }
      if (headInner) headInner.style.transform = `translateX(-${rightScroll.scrollLeft}px)`;
    };

    // ── Gate accordion toggle — both left header and right band open/close the same gate ──
    function toggleGate(gi) {
      state.gateExpanded[gi] = state.gateExpanded[gi] === false ? true : false;
      renderGantt(d);
    }
    leftScroll.querySelectorAll(".gc2-gate-header-row").forEach(el => {
      el.addEventListener("click", () => toggleGate(parseInt(el.dataset.gateIdx, 10)));
    });
    if (gateRowEl) gateRowEl.querySelectorAll(".gc2-gate-band").forEach(el => {
      el.addEventListener("click", () => toggleGate(parseInt(el.dataset.gateIdx, 10)));
    });

    // ── Filters ──
    if (catFilterEl) {
      catFilterEl.value = state.category;
      catFilterEl.classList.toggle("gc2-filter-active", !!state.category);
      catFilterEl.onchange = () => { state.category = catFilterEl.value; renderGantt(d); };
    }
    if (statusFilterEl) {
      statusFilterEl.value = state.status;
      statusFilterEl.classList.toggle("gc2-filter-active", !!state.status);
      statusFilterEl.onchange = () => { state.status = statusFilterEl.value; renderGantt(d); };
    }
    const critCard = $("gcKpiCritical");
    if (critCard) {
      critCard.classList.toggle("gc2-kpi-active", state.status === "red");
      critCard.title = "Click to filter the table to Critical (>60 day delay) deliverables";
      critCard.addEventListener("click", () => {
        state.status = state.status === "red" ? "" : "red";
        renderGantt(d);
      });
    }

    if (filterSummaryEl) {
      const visibleCount = allEntries.filter(passesFilter).length;
      filterSummaryEl.textContent = (state.category || state.status)
        ? `Showing ${visibleCount} of ${totalDeliverables} deliverables`
        : `${totalDeliverables} deliverables · Scroll ↓ rows · Scroll → timeline`;
    }

    // Bring "today" into view the first time this tab's panel is actually visible — while the
    // panel is [hidden] (every tab renders once up-front in init(), not lazily on click) it has
    // no layout box, so a scrollLeft write here would silently no-op. initTabs() calls this again
    // once the Gantt panel's `hidden` attribute is removed, when clientWidth is real.
    renderGantt._scrollToToday = function () {
      if (state.scrolledOnce) return;
      const viewportW = rightScroll.clientWidth;
      if (!viewportW) return; // still hidden — initTabs() will retry on tab click
      state.scrolledOnce = true;
      const target = Math.max(0, datePx(TODAY_G) - viewportW * 0.3);
      rightScroll.scrollLeft = target;
      if (headInner) headInner.style.transform = `translateX(-${target}px)`;
    };
    requestAnimationFrame(renderGantt._scrollToToday);
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
        // The Gantt tab's initial "scroll to today" runs once when its panel first becomes
        // visible — while [hidden], the pane has no layout box so scrollLeft writes are no-ops.
        if (tab === "gantt" && typeof renderGantt._scrollToToday === "function") renderGantt._scrollToToday();
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
