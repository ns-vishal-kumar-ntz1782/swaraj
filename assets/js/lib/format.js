// ==========================================================
//  FORMAT — common date formatting helpers.
//
//  New/additive file, matching the exact "DD Mon YY" / "DD Mon YYYY" format
//  already established inside mock-data.js's private fmtDate()/fmtDateFull()
//  (that file's own copies are untouched — they're internal to its closure and
//  this refactor doesn't rewrite it) so new code has one public place to reach
//  for the same format instead of re-deriving it again.
// ==========================================================

var MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDateShort(d) { // "07 Jul 26"
  if (!(d instanceof Date)) d = new Date(d);
  return String(d.getDate()).padStart(2, "0") + " " + MONTH_ABBR[d.getMonth()] + " " + String(d.getFullYear()).slice(2);
}

function fmtDateFull(d) { // "07 Jul 2026"
  if (!(d instanceof Date)) d = new Date(d);
  return String(d.getDate()).padStart(2, "0") + " " + MONTH_ABBR[d.getMonth()] + " " + d.getFullYear();
}
