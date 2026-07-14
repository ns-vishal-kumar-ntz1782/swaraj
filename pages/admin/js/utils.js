// Shared helpers: ids, dates, csv parsing, dom helpers.

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function pad(n, width = 3) {
  return String(n).padStart(width, "0");
}

export function nextSequenceCode(existingCodes, prefix, width = 3) {
  let max = 0;
  for (const code of existingCodes) {
    const m = String(code).match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${pad(max + 1, width)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function relTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return iso;
  const diffMs = Date.now() - d;
  const abs = Math.abs(diffMs);
  const units = [
    ["year", 365 * 24 * 3600 * 1000],
    ["month", 30 * 24 * 3600 * 1000],
    ["day", 24 * 3600 * 1000],
    ["hour", 3600 * 1000],
    ["minute", 60 * 1000],
  ];
  for (const [name, ms] of units) {
    if (abs >= ms) {
      const val = Math.floor(abs / ms);
      return diffMs >= 0 ? `${val} ${name}${val > 1 ? "s" : ""} ago` : `in ${val} ${name}${val > 1 ? "s" : ""}`;
    }
  }
  return "just now";
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function h(strings, ...values) {
  return strings.reduce((out, str, i) => out + str + (values[i] !== undefined ? values[i] : ""), "");
}

export function el(selector, root = document) {
  return root.querySelector(selector);
}
export function els(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function qs(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") usp.set(k, v);
  });
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export function parseQuery(str) {
  const usp = new URLSearchParams(str || "");
  const out = {};
  for (const [k, v] of usp.entries()) out[k] = v;
  return out;
}

// ---- CSV parsing (RFC4180-ish, handles quoted fields with commas/newlines) ----
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c === "\r") {
      // skip, \n follows
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((r) => {
    const obj = {};
    headers.forEach((hh, idx) => { obj[hh] = (r[idx] ?? "").trim(); });
    return obj;
  });
}

export function toast(message, kind = "info") {
  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const t = document.createElement("div");
  t.className = `toast toast-${kind}`;
  t.textContent = message;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 250);
  }, 3200);
}

export function openModal({ title, bodyHtml, footerHtml, onMount, size = "" }) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="modal-close" type="button" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ""}
    </div>
  `;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector(".modal-close").addEventListener("click", close);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });
  if (onMount) onMount(backdrop, close);
  return { backdrop, close };
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    openModal({
      title: "Please confirm",
      bodyHtml: `<p>${escapeHtml(message)}</p>`,
      footerHtml: `
        <button class="btn btn-ghost" data-act="cancel">Cancel</button>
        <button class="btn btn-danger" data-act="ok">Confirm</button>
      `,
      onMount: (backdrop, close) => {
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", () => { close(); resolve(false); });
        backdrop.querySelector('[data-act="ok"]').addEventListener("click", () => { close(); resolve(true); });
      },
    });
  });
}

// Three-way variant of confirmDialog, used whenever a close attempt (drawer or page nav) hits
// unsaved changes. Resolves "save" | "discard" | "cancel" — never silently discards.
export function confirmUnsavedChanges(message = "You have unsaved changes. Save them before leaving?") {
  return new Promise((resolve) => {
    openModal({
      title: "Unsaved Changes",
      bodyHtml: `<p>${escapeHtml(message)}</p>`,
      footerHtml: `
        <button class="btn btn-ghost" data-act="cancel">Cancel</button>
        <button class="btn btn-ghost danger" data-act="discard">Discard</button>
        <button class="btn btn-primary" data-act="save">Save</button>
      `,
      onMount: (backdrop, close) => {
        backdrop.querySelector('[data-act="cancel"]').addEventListener("click", () => { close(); resolve("cancel"); });
        backdrop.querySelector('[data-act="discard"]').addEventListener("click", () => { close(); resolve("discard"); });
        backdrop.querySelector('[data-act="save"]').addEventListener("click", () => { close(); resolve("save"); });
      },
    });
  });
}

// Right-side drawer — replaces openModal for Create/Edit/View entity panels (openModal itself
// stays, for confirmDialog/confirmUnsavedChanges and small one-field utility popups like Bulk
// Import). API mirrors openModal's shape to keep call-site churn low.
//
// isDirty()  — optional; omit for pure "View" drawers with no editable state (no guard needed).
// onSaveFromWarning() — called only when the user picks "Save" from the unsaved-changes prompt
//   triggered by an in-progress close (✕ / ESC / overlay click); must return a truthy value (or
//   a Promise resolving truthy) for the drawer to actually close afterward. A normal in-form Save
//   button should call `close()` directly instead — it already knows the save succeeded.
export function openDrawer({ title, bodyHtml, footerHtml, onMount, isDirty, onSaveFromWarning, width = "80%" }) {
  const backdrop = document.createElement("div");
  backdrop.className = "drawer-backdrop";
  backdrop.innerHTML = `
    <div class="drawer" style="width:${width}" role="dialog" aria-modal="true">
      <div class="drawer-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="drawer-close" type="button" aria-label="Close">✕</button>
      </div>
      <div class="drawer-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="drawer-footer">${footerHtml}</div>` : ""}
    </div>
  `;
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("open"));

  let promptOpen = false;
  const close = () => {
    backdrop.classList.remove("open");
    backdrop.addEventListener("transitionend", () => backdrop.remove(), { once: true });
  };
  const requestClose = async () => {
    if (promptOpen) return;
    if (isDirty && isDirty()) {
      promptOpen = true;
      const choice = await confirmUnsavedChanges();
      promptOpen = false;
      if (choice === "cancel") return;
      if (choice === "save") {
        const ok = await onSaveFromWarning?.();
        if (!ok) return;
      }
    }
    close();
  };
  backdrop.querySelector(".drawer-close").addEventListener("click", requestClose);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) requestClose(); });
  document.addEventListener("keydown", function esc(e) {
    if (!document.body.contains(backdrop)) { document.removeEventListener("keydown", esc); return; }
    if (e.key === "Escape" && !promptOpen) requestClose();
  });
  if (onMount) onMount(backdrop, close, requestClose);
  return { backdrop, close, requestClose };
}

// Wires a draggable divider between two flex siblings so the user can resize the split at
// runtime. `container` holds [paneA, divider, paneB] as direct children laid out with flex;
// dragging sets paneA's flex-basis in px, clamped to [minA, totalWidth - minB]. Optional
// onResizeEnd(widthPx) fires once per drag gesture (on mouseup, not every mousemove) so callers
// can persist the final width without hammering localStorage during the drag itself.
export function wireResizableSplit(container, paneA, divider, minA = 220, minB = 260, onResizeEnd) {
  let dragging = false;
  let lastWidth = null;
  divider.addEventListener("mousedown", (e) => {
    dragging = true;
    e.preventDefault();
    document.body.style.cursor = "col-resize";
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const containerRect = container.getBoundingClientRect();
    const paneARect = paneA.getBoundingClientRect();
    const maxWidth = containerRect.right - paneARect.left - minB;
    const width = Math.min(Math.max(e.clientX - paneARect.left, minA), maxWidth);
    paneA.style.flex = `0 0 ${width}px`;
    lastWidth = width;
  });
  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
    if (lastWidth != null) onResizeEnd?.(lastWidth);
  });
}

// ---- sortable table columns: one reusable component for every table in the admin module.
// Sort BEFORE paginate — same order the existing filter-then-paginate flow already uses. ----
export function sortList(list, sortKey, sortDir, accessor = (item, key) => item[key]) {
  if (!sortKey) return list;
  const dir = sortDir === "desc" ? -1 : 1;
  return list.slice().sort((a, b) => {
    const av = accessor(a, sortKey);
    const bv = accessor(b, sortKey);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
  });
}
export function sortableTh(label, key, state) {
  const active = state.sortKey === key;
  const arrow = active ? (state.sortDir === "desc" ? " ▼" : " ▲") : "";
  return `<th class="sg-th-sortable" data-sort-key="${escapeHtml(key)}">${escapeHtml(label)}${arrow}</th>`;
}
export function wireSortableTh(container, state, onChange) {
  container.querySelectorAll(".sg-th-sortable[data-sort-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      state.sortDir = state.sortKey === key && state.sortDir === "asc" ? "desc" : "asc";
      state.sortKey = key;
      onChange();
    });
  });
}

// ---- pagination: one reusable component for every table in the admin module ----
export function paginate(list, page, pageSize) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * pageSize;
  return { pageItems: list.slice(start, start + pageSize), totalPages, page: clampedPage, total };
}

// Empty string when everything fits on one page — a page of 4 template cards doesn't need page
// controls, but the same call works unmodified once a table grows past pageSize.
export function paginationHtml(page, totalPages, total, pageSize) {
  if (totalPages <= 1) return "";
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = [];
  for (let p = start; p <= end; p++) pages.push(p);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return `
    <div class="sg-pagination">
      <span>${from}–${to} of ${total}</span>
      <div class="sg-pagination-controls">
        <button type="button" class="sg-pagination-btn" data-page="1" ${page === 1 ? "disabled" : ""} aria-label="First page">«</button>
        <button type="button" class="sg-pagination-btn" data-page="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="Previous page">‹</button>
        ${pages.map((p) => `<button type="button" class="sg-pagination-btn ${p === page ? "active" : ""}" data-page="${p}">${p}</button>`).join("")}
        <button type="button" class="sg-pagination-btn" data-page="${page + 1}" ${page === totalPages ? "disabled" : ""} aria-label="Next page">›</button>
        <button type="button" class="sg-pagination-btn" data-page="${totalPages}" ${page === totalPages ? "disabled" : ""} aria-label="Last page">»</button>
      </div>
    </div>
  `;
}
export function wirePagination(container, onChange) {
  container.querySelectorAll(".sg-pagination-btn[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => onChange(Number(btn.dataset.page)));
  });
}

// ---- drag-and-drop row/card reordering — no library, plain HTML5 DnD ----
// Every element matching `selector` inside `container` must have draggable="true" and a
// data-dnd-id. Dropping calls onReorder(orderedIds) once; the caller decides whether that
// auto-persists or just stages a local order.
export function wireDragReorder(container, selector, onReorder) {
  let dragEl = null;
  container.querySelectorAll(selector).forEach((el) => {
    el.addEventListener("dragstart", () => { dragEl = el; el.classList.add("sg-dragging"); });
    el.addEventListener("dragend", () => { el.classList.remove("sg-dragging"); dragEl = null; });
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragEl || dragEl === el) return;
      const rect = el.getBoundingClientRect();
      const after = (e.clientY - rect.top) / rect.height > 0.5;
      el.parentNode.insertBefore(dragEl, after ? el.nextSibling : el);
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      const order = Array.from(container.querySelectorAll(selector)).map((x) => x.dataset.dndId);
      onReorder(order);
    });
  });
}

// ---- one shared icon set, reused by every icon button across the admin module ----
export const ICONS = {
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>`,
  delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  view: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  power: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`,
  drag: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`,
  clone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
  // ---- generic KPI-card icon set, reused by every "Total/Active/Mandatory/Overdue/…" card ----
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  flag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
};
export function iconBtn(name, { act, id = "", cls = "", title = "", disabled = false } = {}) {
  const icon = ICONS[name] || "";
  return `<button type="button" class="sg-icon-btn ${cls}" data-act="${escapeHtml(act)}" ${id ? `data-id="${escapeHtml(id)}"` : ""} title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" ${disabled ? "disabled" : ""}>${icon}</button>`;
}

export function statusPillClass(status) {
  const map = {
    Draft: "pill-slate", Active: "pill-blue", UnderReview: "pill-amber", Approved: "pill-green",
    Rejected: "pill-red", Closed: "pill-slate", Pending: "pill-slate", InProgress: "pill-blue",
    Submitted: "pill-amber", Completed: "pill-green", Open: "pill-blue", OnHold: "pill-amber",
    Escalated: "pill-red", green: "pill-green", amber: "pill-amber", red: "pill-red",
    Backlog: "pill-slate", "Not Started": "pill-slate", "In Progress": "pill-blue",
    Blocked: "pill-red", "Ready for Review": "pill-amber", Overdue: "pill-red",
    Submit: "pill-amber", ClarificationRequested: "pill-amber",
    Published: "pill-green", Archived: "pill-slate", Activated: "pill-blue", Inactive: "pill-slate",
    Skipped: "pill-slate",
  };
  return map[status] || "pill-slate";
}
