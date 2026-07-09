// ==========================================================
//  PROJECT DETAIL — accordion layout, viewport-locked.
//  Matches Figma: current gate expanded by default, one top-level section open at a time.
// ==========================================================
(function () {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function $(id) { return document.getElementById(id); }

  function badgeCls(status) {
    return ({ "On Time":"pd-b-ontime","Completed":"pd-b-completed",
      "In Progress":"pd-b-inprog","Delayed 15-60":"pd-b-delay-mid",
      "Delayed >60":"pd-b-delay-high","Pending":"pd-b-pending" })[status] || "pd-b-pending";
  }
  function sevCls(s) {
    return ({ Critical:"pd-b-critical",High:"pd-b-high",Medium:"pd-b-medium",Low:"pd-b-low" })[s] || "pd-b-low";
  }

  // ── Shared topnav ──
  function initTopnav() {
    const roleKey = (typeof getCurrentRole === "function" && getCurrentRole()) || "CEO";
    const role = (typeof roleDirectory !== "undefined" && roleDirectory[roleKey]) || { avatar:"CEO", name:"CEO", email:"ceo@swaraj.mahindra.com" };
    const av = $("roleAvatar"), nm = $("avatarDropdownName"), em = $("avatarDropdownEmail");
    if (av) av.textContent = role.avatar;
    if (nm) nm.textContent = role.name;
    if (em) em.textContent = role.email;
    const adminTab = $("adminTab");
    if (adminTab && typeof accessiblePages === "function") {
      adminTab.hidden = !accessiblePages(roleKey).some(p => p.key === "admin-users");
    }
    const btn = $("roleAvatar"), dd = $("avatarDropdown");
    if (btn && dd) {
      btn.addEventListener("click", e => { e.stopPropagation(); dd.hidden = !dd.hidden; btn.setAttribute("aria-expanded", String(!dd.hidden)); });
      document.addEventListener("click", () => { dd.hidden = true; });
    }
    const logoutBtn = $("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", () => (typeof logoutAndRedirect === "function" ? logoutAndRedirect() : (sessionStorage.removeItem("snpdRole"), location.href = "login.html")));
  }

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
    // badge count = total activities
    const badge = $("timelineBadge");
    if (badge) badge.textContent = (d.activities||[]).length + " Activities";
  }

  // ── Gate Details (nested accordion) ──
  function buildGateAccordion(container, d, currentGateId) {
    if (!d.gateDetails || !d.gateDetails.length) { container.innerHTML = "<p>No gate data.</p>"; return; }

    container.innerHTML = d.gateDetails.map((g, gi) => {
      const gateObj = d.gates && d.gates[gi];
      const status = gateObj ? gateObj.status : (gi < (d.gateReached || 0) ? "Completed" : "Pending");
      const isCurrentGate = currentGateId === g.gate;
      const isCompleted = status === "Completed" || status === "On Time" || status === "Delayed 15-60" || status === "Delayed >60";
      const isFuture = status === "Pending";
      const openClass = isCurrentGate ? " open" : "";
      const disabledClass = isFuture ? " pd-gate-item-disabled" : "";
      const doneCount = g.deliverables.filter(x => x.status !== "Pending").length;

      let statusBadgeHtml = "";
      if (isCompleted) statusBadgeHtml = `<span class="pd-gate-item-status pd-b-completed">Completed</span>`;
      else if (isCurrentGate) statusBadgeHtml = `<span class="pd-gate-item-status pd-b-inprog">In Progress</span>`;
      else if (isFuture) statusBadgeHtml = `<span class="pd-gate-item-status pd-b-pending">Future</span>`;

      const rows = g.deliverables.map(x => `
        <tr>
          <td>${esc(x.name)}</td><td>${esc(x.owner)}</td><td>${esc(x.department)}</td>
          <td>${esc(x.plannedDate)}</td><td>${esc(x.actualDate)}</td>
          <td><span class="pd-badge ${badgeCls(x.status)}">${esc(x.status)}</span></td>
          <td>${x.completion}%</td><td>${x.delayDays > 0 ? x.delayDays+"d" : "-"}</td>
          <td>${esc(x.remarks)}</td>
        </tr>`).join("");

      const bodyReadonly = isCompleted ? ' aria-readonly="true"' : "";
      const bodyStyle = isFuture ? ' style="opacity:.6;pointer-events:none"' : "";

      return `<div class="pd-gate-item${openClass}${disabledClass}" data-gate="${g.gate}">
        <div class="pd-gate-item-head"${isFuture ? ' aria-disabled="true"' : ""}>
          <span class="pd-gate-item-chevron">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
          <span class="pd-gate-item-label">${esc(g.gate)} · ${esc(g.stage)}</span>
          <div class="pd-gate-item-meta">
            ${statusBadgeHtml}
            <span>${doneCount}/${g.deliverables.length} deliverables</span>
          </div>
        </div>
        <div class="pd-gate-item-body"${bodyReadonly}${bodyStyle}>
          <div class="pd-inner-scroll">
            <table class="pd-data-table">
              <thead><tr><th>Deliverable</th><th>Owner</th><th>Department</th><th>Planned</th>
                <th>Actual</th><th>Status</th><th>Completion</th><th>Delay</th><th>Remarks</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
    }).join("");

    // Wire clicks (disabled gates don't expand)
    container.querySelectorAll(".pd-gate-item:not(.pd-gate-item-disabled) .pd-gate-item-head").forEach(h => {
      h.addEventListener("click", () => {
        const item = h.closest(".pd-gate-item");
        item.classList.toggle("open");
      });
    });
  }

  // ── Deliverables flat list ──
  function renderDeliverables(d) {
    const all = [];
    (d.gateDetails||[]).forEach(g => g.deliverables.forEach(x => all.push(Object.assign({gate:g.gate},x))));

    const tblHtml = "<thead><tr><th>Deliverable</th><th>Gate</th><th>Owner</th><th>Department</th>" +
      "<th>Planned</th><th>Actual</th><th>Status</th><th>Completion</th><th>Evidence</th><th>Remarks</th></tr></thead><tbody>" +
      all.map(x=>`<tr>
        <td>${esc(x.name)}</td><td>${esc(x.gate)}</td><td>${esc(x.owner)}</td><td>${esc(x.department)}</td>
        <td>${esc(x.plannedDate)}</td><td>${esc(x.actualDate)}</td>
        <td><span class="pd-badge ${badgeCls(x.status)}">${esc(x.status)}</span></td>
        <td>${x.completion}%</td><td>${esc(x.evidence||"-")}</td><td>${esc(x.remarks)}</td></tr>`).join("") + "</tbody>";

    const t1 = $("deliverableTable");
    if (t1) t1.innerHTML = tblHtml;
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
    const currentGateId = (d.gates && d.gates.find(g => g.status === "In Progress") || (d.gates && d.gates[0]) || {}).id || "G1";

    const gateDetailsEl = $("gateDetails");
    if (gateDetailsEl) buildGateAccordion(gateDetailsEl, d, currentGateId);
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
    initTopnav();
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
    renderDeliverables(d);
    renderApprovals(d);
    renderGantt(d);

    initGateChecklist(d);
    initTabs();
    initPdf();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
