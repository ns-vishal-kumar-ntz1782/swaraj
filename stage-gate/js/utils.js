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

export function statusPillClass(status) {
  const map = {
    Draft: "pill-slate", Active: "pill-blue", UnderReview: "pill-amber", Approved: "pill-green",
    Rejected: "pill-red", Closed: "pill-slate", Pending: "pill-slate", InProgress: "pill-blue",
    Submitted: "pill-amber", Completed: "pill-green", Open: "pill-blue", OnHold: "pill-amber",
    Escalated: "pill-red", green: "pill-green", amber: "pill-amber", red: "pill-red",
  };
  return map[status] || "pill-slate";
}
