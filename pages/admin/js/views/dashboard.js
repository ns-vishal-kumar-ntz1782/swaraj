import { getActiveUser } from "../store/users.js";
import { widgetsFor, WIDGET_LABELS } from "../rbac.js";
import { ensureShell, contentEl, setBreadcrumb, setActiveMenu } from "./shell.js";
import { listGates, readinessScore } from "../store/gates.js";
import { listDeliverables } from "../store/deliverables.js";
import { listActions } from "../store/actions.js";
import { listSubmissions } from "../store/formSubmissions.js";
import { listAuditEntries } from "../store/audit.js";
import { escapeHtml, fmtDate, relTime, statusPillClass } from "../utils.js";
import { navigate } from "../router.js";

const GATE_STATUSES = ["Draft", "Active", "UnderReview", "Approved", "Rejected", "Closed"];
const RAGS = ["green", "amber", "red"];

function kpiCard(label, value, sub) {
  return `<div class="sg-kpi-card"><div class="sg-kpi-label">${escapeHtml(label)}</div><div class="sg-kpi-value">${value}</div>${sub ? `<div class="sg-kpi-sub">${sub}</div>` : ""}</div>`;
}

function widgetShell(id, title, bodyHtml) {
  return `<section class="sg-widget" id="w-${id}"><div class="sg-widget-title">${escapeHtml(title)}</div><div class="sg-widget-body">${bodyHtml}</div></section>`;
}

function barRow(label, count, max, cls) {
  const pct = max ? Math.round((count / max) * 100) : 0;
  return `
    <div class="sg-bar-row">
      <span class="sg-bar-label">${escapeHtml(label)}</span>
      <div class="sg-bar-track"><div class="sg-bar-fill ${cls}" style="width:${pct}%"></div></div>
      <span class="sg-bar-value">${count}</span>
    </div>`;
}

const WIDGET_RENDERERS = {
  "kpi-total-gates": () => {
    const gates = listGates();
    return kpiCard("Total Gates", gates.length, `${gates.filter((g) => g.status === "Active").length} active`);
  },
  "kpi-pending-approvals": (ctx) => {
    const pendingGates = listGates({ status: "UnderReview" }).length;
    const pendingForms = listSubmissions({ status: "Submitted" }).length + listSubmissions({ status: "UnderReview" }).length;
    return kpiCard("Pending Approvals", pendingGates + pendingForms, `${pendingGates} gates · ${pendingForms} forms`);
  },
  "kpi-open-actions": () => {
    const open = listActions().filter((a) => !["Completed", "Closed"].includes(a.status));
    return kpiCard("Open Actions", open.length, `${open.filter((a) => a.priority === "Critical").length} critical`);
  },
  "kpi-overdue-deliverables": () => {
    const today = new Date().toISOString().slice(0, 10);
    const overdue = listDeliverables().filter((d) => d.due && d.due < today && d.status !== "Completed");
    return kpiCard("Overdue Deliverables", overdue.length, overdue.length ? "needs attention" : "all on track");
  },
  "gates-by-status": () => {
    const gates = listGates();
    const counts = GATE_STATUSES.map((s) => ({ s, n: gates.filter((g) => g.status === s).length }));
    const max = Math.max(1, ...counts.map((c) => c.n));
    return widgetShell("gates-by-status", "Gates by Status", counts.map((c) => barRow(c.s, c.n, max, `pill-fill-${statusPillClass(c.s).replace("pill-", "")}`)).join(""));
  },
  "deliverables-rag": () => {
    const list = listDeliverables();
    const counts = RAGS.map((r) => ({ r, n: list.filter((d) => d.rag === r).length }));
    const max = Math.max(1, ...counts.map((c) => c.n));
    return widgetShell("deliverables-rag", "Deliverables RAG Breakdown", counts.map((c) => barRow(c.r.toUpperCase(), c.n, max, `pill-fill-${c.r}`)).join(""));
  },
  "upcoming-approvals": (ctx) => {
    const gates = listGates({ status: "UnderReview" }).slice(0, 6);
    const rows = gates.map((g) => `
      <a class="sg-list-row" href="#/gates/${g.id}">
        <span class="pill ${statusPillClass(g.status)}">${g.status}</span>
        <span class="sg-list-main">${escapeHtml(g.projectCode)} · ${escapeHtml(g.code)} — ${escapeHtml(g.name)}</span>
        <span class="sg-list-sub">${escapeHtml(g.owner)}</span>
      </a>`).join("");
    return widgetShell("upcoming-approvals", "Upcoming Approvals", rows || `<div class="sg-widget-empty">Nothing awaiting approval.</div>`);
  },
  "recent-activity": () => {
    const entries = listAuditEntries().slice(0, 8);
    const rows = entries.map((e) => `
      <div class="sg-list-row static">
        <span class="sg-list-main">${escapeHtml(e.summary)}</span>
        <span class="sg-list-sub">${escapeHtml(e.actor)} · ${relTime(e.timestamp)}</span>
      </div>`).join("");
    return widgetShell("recent-activity", "Recent Activity", rows || `<div class="sg-widget-empty">No activity recorded yet.</div>`);
  },
  "my-actions": (ctx) => {
    const mine = listActions({ assignedTo: ctx.user.name }).filter((a) => !["Completed", "Closed"].includes(a.status)).slice(0, 6);
    const rows = mine.map((a) => `
      <a class="sg-list-row" href="#/actions">
        <span class="pill ${statusPillClass(a.status)}">${a.status}</span>
        <span class="sg-list-main">${escapeHtml(a.number)} — ${escapeHtml(a.title)}</span>
        <span class="sg-list-sub">Due ${fmtDate(a.targetDate)}</span>
      </a>`).join("");
    return widgetShell("my-actions", "My Action Items", rows || `<div class="sg-widget-empty">No open action items assigned to you.</div>`);
  },
  "finance-summary": () => {
    const subs = listSubmissions({ formCode: "FT-004" });
    const total = subs.reduce((sum, s) => sum + (Number(s.values?.requestedAmount) || 0), 0);
    const approved = subs.filter((s) => s.status === "Approved").reduce((sum, s) => sum + (Number(s.values?.requestedAmount) || 0), 0);
    return widgetShell("finance-summary", "Finance Summary (Budget Requests)", `
      <div class="sg-finance-grid">
        <div><span class="sg-kpi-label">Requested</span><div class="sg-kpi-value">₹${total.toLocaleString()}</div></div>
        <div><span class="sg-kpi-label">Approved</span><div class="sg-kpi-value">₹${approved.toLocaleString()}</div></div>
        <div><span class="sg-kpi-label">Requests</span><div class="sg-kpi-value">${subs.length}</div></div>
      </div>
    `);
  },
  "compliance-rate": () => {
    const gates = listGates().filter((g) => !["Draft", "Closed"].includes(g.status));
    const avg = gates.length ? Math.round(gates.reduce((sum, g) => sum + readinessScore(g), 0) / gates.length) : 0;
    return widgetShell("compliance-rate", "Compliance Rate (avg gate readiness)", `
      <div class="sg-donut-wrap">
        <div class="sg-donut" style="--pct:${avg}"><span>${avg}%</span></div>
      </div>
    `);
  },
};

export async function renderDashboard() {
  const user = getActiveUser();
  if (!user) return;
  ensureShell();
  setBreadcrumb("Dashboard");
  setActiveMenu("dashboard");

  const widgets = widgetsFor(user.businessRole);
  const kpiIds = widgets.filter((w) => w.startsWith("kpi-"));
  const panelIds = widgets.filter((w) => !w.startsWith("kpi-"));
  const ctx = { user };

  contentEl().innerHTML = `
    <div class="sg-dash-header">
      <h1>Welcome back, ${escapeHtml(user.name.split(" ")[0])}</h1>
      <p>${escapeHtml(user.businessRole)} overview</p>
    </div>
    ${kpiIds.length ? `<div class="sg-kpi-strip">${kpiIds.map((id) => WIDGET_RENDERERS[id](ctx)).join("")}</div>` : ""}
    <div class="sg-widget-grid">${panelIds.map((id) => WIDGET_RENDERERS[id](ctx)).join("")}</div>
    ${!widgets.length ? `<div class="sg-empty-state">No dashboard widgets are enabled for your role yet.</div>` : ""}
  `;
}
