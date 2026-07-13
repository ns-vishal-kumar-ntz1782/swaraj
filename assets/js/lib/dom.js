// ==========================================================
//  DOM — common, small DOM/string helpers.
//
//  New/additive file. The root app currently has FIVE separate hand-written copies
//  of an HTML-escaping helper (shared.js, script.js, project-detail.js, timeline.js,
//  portfolio.js) — see the architecture analysis. None of those were touched here,
//  since each one is embedded in a page this refactor must leave unchanged; this is
//  the canonical version for anything written from here on, so a sixth copy never
//  needs to happen again.
// ==========================================================

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function qs(selector, root) { return (root || document).querySelector(selector); }
function qsa(selector, root) { return Array.from((root || document).querySelectorAll(selector)); }
