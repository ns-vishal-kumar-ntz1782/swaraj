// ==========================================================
//  STATUS — common, parameterized status/RAG color helper.
//
//  New/additive file. script.js, portfolio.js, and charts.js each currently
//  re-derive "what color is this health score" independently, at DIFFERENT
//  thresholds and DIFFERENT hex values (see the architecture analysis) — those
//  weren't touched here, since unifying their thresholds would change what color
//  renders on pages this refactor must leave looking exactly the same. This helper
//  takes the thresholds/colors as parameters instead of hardcoding one "correct"
//  set, so future code can express "green above 85, amber above 70" (script.js's
//  rule) or "green above 75, amber above 60" (portfolio.js's rule) with the same
//  function, rather than a fourth hand-rolled if/else chain.
//
//  Usage:
//    ragColor(92, { good: 85, warn: 70 })                          -> "good"
//    ragColor(92, { good: 85, warn: 70 }, { good:"#15803d", warn:"#d97706", bad:"#dc2626" })
// ==========================================================

function ragClass(value, thresholds) {
  const t = thresholds || { good: 85, warn: 70 };
  if (value >= t.good) return "good";
  if (value >= t.warn) return "warn";
  return "bad";
}

function ragColor(value, thresholds, palette) {
  const p = palette || { good: "#15803d", warn: "#d97706", bad: "#dc2626" };
  return p[ragClass(value, thresholds)];
}

// Maps the ragClass() result to the common pill classes in styles/components.css.
function ragPillClass(value, thresholds) {
  const cls = ragClass(value, thresholds);
  return cls === "good" ? "pill-green" : cls === "warn" ? "pill-amber" : "pill-red";
}
