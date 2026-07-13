// ==========================================================
//  PRE-KO TAB — Product Requirement Form (PRF) content for the Project Detail page's new
//  "Pre-KO" tab. Not a pseudo-random generator: every project's content is DERIVED from its
//  real data/projects.json fields (platform, projectTypeCode, productFamily, budget*, targetSOP)
//  so two projects on the same platform/type read as genuinely related, and a Heavy/M6 program
//  reads as bigger and more ambitious than a Compact/M2 one — never independent of the real data
//  it's based on, same principle project-detail-seed.js already uses for the other tabs.
//  Cost & Budget figures are the REAL budgetPlanned/budgetApproved/budgetConsumed/forecastCost/
//  budgetBreakdown fields — not invented — everything else (specs, features, variants, volumes,
//  competitor bands) is a deterministic template keyed by platform + projectTypeCode + a
//  per-project numeric seed, so re-loading always shows the same content for the same project.
//  Exposes: getPreKoDetail(codeOrName).
// ==========================================================
(function (global) {
  "use strict";

  const DATA_ROOT = (function () {
    const self = document.currentScript
      || [...document.getElementsByTagName("script")].find(s => /(^|\/)assets\/js\/data\/preko-seed\.js(\?|#|$)/.test(s.getAttribute("src") || ""));
    return self && self.src ? self.src.replace(/assets\/js\/data\/preko-seed\.js(\?[^#]*)?(#.*)?$/, "") : "";
  })();
  function loadJsonSync(relPath) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", DATA_ROOT + "data/" + relPath, false);
    xhr.send(null);
    return JSON.parse(xhr.responseText);
  }

  const projects = loadJsonSync("projects.json");

  function rng(seedInt) { let a = seedInt >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seedFromString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function fmtCr(lakh) { return "₹" + (lakh / 100).toFixed(2) + " Cr"; }
  function fmtLakh(lakh) { return "₹" + Math.round(lakh).toLocaleString("en-IN") + " L"; }

  // ── Platform → base engineering envelope. Every number below is a realistic band for that
  //    tractor size class; per-project rand() jitter (seeded from the project code) picks a
  //    concrete value inside the band so same-platform projects differ, not repeat verbatim. ──
  const PLATFORM_SPEC = {
    Heavy:   { hpLo: 74, hpHi: 110, torque: 540, rpm: 1400, lift: 3500, liftMax: 4000, pump: 65, tank: 150, service: 600, speed: 40, gearboxBase: "16F+16R", gearboxPremium: "32F+32R", cabin: "Open station (ROPS) / Premium AC Cabin", brakes: "Oil-immersed disc brakes" },
    Utility: { hpLo: 45, hpHi: 65,  torque: 280, rpm: 2000, lift: 1800, liftMax: 2200, pump: 42, tank: 95,  service: 500, speed: 32, gearboxBase: "8F+8R",  gearboxPremium: "12F+12R", cabin: "Open station (ROPS)", brakes: "Oil-immersed disc / drum brakes" },
    Compact: { hpLo: 20, hpHi: 35,  torque: 130, rpm: 2400, lift: 900,  liftMax: 1200, pump: 28, tank: 45,  service: 400, speed: 26, gearboxBase: "6F+2R",  gearboxPremium: "8F+4R",   cabin: "Open station (canopy optional)", brakes: "Mechanical drum brakes" },
  };

  // ── Project type → narrative framing + ambition tier (drives copy tone + variant count). ──
  const TYPE_NARRATIVE = {
    M6: {
      label: "New Platform / Breakthrough", tier: 3,
      background: (p) => [
        "Indian agriculture is shifting toward larger, mechanised, and commercial farming models, driven by labour shortages, contract farming, biomass, and industrial use cases.",
        `The existing ${p.platform.toLowerCase()} portfolio is economical but architecturally limited, with constraints on scalability and advanced features.`,
        "Market demand is emerging for a premium platform capable of handling heavier implements, longer duty cycles, and higher productivity.",
        "Competitors already have ready premium platforms in this class, posing a future market share risk for Swaraj.",
      ],
      objective: (p) => [
        `Enable timely entry into the premium ${p.hpLo}–${p.hpHi} HP segment to address evolving customer and application needs.`,
        `Leverage a common base architecture to fast-track development while ensuring Swaraj-defined performance and brand differentiation.`,
        "Strengthen Swaraj's presence in high-value, high-margin and contractor segments, including exports.",
        "Build a future-ready scalable platform supporting advanced technologies, higher reliability, and premium positioning.",
      ],
    },
    M4: {
      label: "Major Change / Redesign", tier: 2,
      background: (p) => [
        `The current ${p.productFamily} generation has been in production for several cycles and is showing feature and cost gaps against newer entrants.`,
        "Customer clinics and dealer feedback consistently flag comfort, hydraulics, and connectivity as the top improvement asks for this segment.",
        "A major sub-system redesign is required to stay competitive without the cost and schedule of an all-new platform.",
      ],
      objective: (p) => [
        `Redesign the ${p.productFamily} line's key sub-systems (hydraulics, transmission, operator station) to close the competitive gap.`,
        "Improve reliability and service intervals versus the outgoing generation, based on field/warranty data.",
        "Protect the program's cost structure by carrying over validated components wherever the redesign allows.",
      ],
    },
    M2: {
      label: "Minor Change / Refresh", tier: 1,
      background: (p) => [
        `The ${p.productFamily} continues to sell well but needs a running refresh to stay current on comfort, styling, and regulatory requirements.`,
        "Field and warranty data show a small set of targeted improvements would materially improve customer satisfaction at low investment.",
      ],
      objective: (p) => [
        `Deliver a focused refresh of the ${p.productFamily} — targeted feature and styling updates within a tight budget and schedule envelope.`,
        "Maintain full carryover of the validated powertrain and structure to minimise re-validation scope.",
      ],
    },
    Exploration: {
      label: "Pre-Concept Feasibility", tier: 0,
      background: (p) => [
        `This is an early feasibility study into a possible ${p.platform.toLowerCase()}-class opportunity — no product commitment has been made yet.`,
        "The study exists to size the market opportunity and flag major technical risks before any funding decision.",
      ],
      objective: (p) => [
        "Establish whether a viable business case exists before committing engineering resources to a full program.",
        "Identify the 2–3 biggest technical or sourcing risks that would need to be resolved before chartering a real program.",
      ],
    },
  };

  const FEATURE_POOL = {
    comfort: [
      "Fully integrated HVAC cabin with low-noise, low-vibration performance",
      "Best-in-industry NVH with balancer shaft and refined noise signatures",
      "Air-suspension driver seat, tilt & telescopic steering, ergonomic controls",
      "Programmable TFT cluster, smart connectivity, camera and charging provisions",
      "Clean exhaust behaviour with no visible smoke during operation",
      "Tilt & telescopic steering with reduced operator fatigue over long shifts",
    ],
    performance: [
      (p) => `High-capacity engine delivering ~${p.hpLo} to ${p.hpHi} HP`,
      (p) => `Strong torque output up to ${p.torque} Nm at low engine speeds`,
      "Advanced transmission options including power shuttle and creeper speeds",
      (p) => `High hydraulic flow with lift capacity up to ${p.liftMax.toLocaleString("en-IN")} kg`,
      "Multiple PTO speeds with electro-hydraulic actuation and auto cut-off",
      "Responsive throttle mapping across 3 selectable engine modes",
    ],
    reliability: [
      (p) => `Extended ${p.service}-hour service and engine oil change intervals`,
      "Proven operation across extreme temperatures and high altitudes",
      "Robust cooling package with reversible fan and dust-evacuating air cleaner",
      "Wet clutch, oil-immersed brakes, and heavy-duty driveline components",
      "Swaraj-defined durability standards and controlled software calibrations",
    ],
    versatility: [
      "Modular platform supporting open-station and premium cabin variants",
      "Suitable for agriculture, biomass, haulage, rental, and industrial use",
      "Front and rear PTO and hitch provisions for diverse implement needs",
      "Designed for Indian and export markets across multiple regions",
      "Common architecture scalable for future higher/lower-HP derivatives",
    ],
  };

  const COMPETITOR_POOL = [
    { name: "Mahindra", note: "Broadest dealer network in this HP class" },
    { name: "John Deere", note: "Premium positioning, strong resale value" },
    { name: "New Holland", note: "Strong export/haulage reputation" },
    { name: "Massey Ferguson", note: "Value-for-money leader in this segment" },
    { name: "Sonalika", note: "Aggressive pricing, fast-growing share" },
    { name: "Kubota", note: "Compact-segment technology leader" },
  ];

  const APPLICATION_POOL = {
    Heavy: ["Heavy tillage & haulage on large land holdings", "Contract farming and custom hiring fleets", "Biomass and industrial haulage applications", "Export markets requiring higher HP/torque"],
    Utility: ["Multi-crop farming on medium land holdings", "Haulage and trolley operations", "Rotavator, seed-drill and general implement work", "Rental and custom-hiring fleets"],
    Compact: ["Orchard, vineyard and horticulture operations", "Small and marginal land holdings", "Municipal, landscaping and light haulage use", "Export markets favouring compact tractors"],
  };

  function build(project) {
    const rand = rng(seedFromString(project.code));
    const platform = PLATFORM_SPEC[project.platform] || PLATFORM_SPEC.Utility;
    const narrative = TYPE_NARRATIVE[project.projectTypeCode] || TYPE_NARRATIVE.M4;
    const between = (lo, hi) => Math.round(lo + rand() * (hi - lo));
    const pick = (arr, n) => arr.slice().sort(() => rand() - 0.5).slice(0, n);

    // ── Product Specifications — jittered inside the platform's real-world band ──
    const hpTop = between(platform.hpHi - 4, platform.hpHi + 6);
    const specCtx = { hpLo: platform.hpLo, hpHi: hpTop, torque: platform.torque + between(-20, 20), liftMax: platform.liftMax, service: platform.service };
    // Narrative templates need both the real project fields (name, platform, productFamily) AND
    // the derived spec numbers (hpLo/hpHi) — project.json itself has no HP fields, those only
    // exist on the platform spec profile, so this merges the two into one context object.
    const narrativeCtx = { ...project, hpLo: platform.hpLo, hpHi: hpTop };
    const specs = [
      { label: "Horsepower Range", value: `~${platform.hpLo} HP / ${Math.round((platform.hpLo + hpTop) / 2)} HP / ${hpTop} HP` },
      { label: "Engine Type", value: "4-cylinder, Diesel, Turbocharged & Intercooled" },
      { label: "Emission Norms", value: "As per applicable regulations (CEV / TREM)" },
      { label: "Maximum Torque", value: `Up to ~${specCtx.torque} Nm @ ~${platform.rpm} rpm` },
      { label: "Gearbox", value: `${platform.gearboxBase} (Base) / ${platform.gearboxPremium} (Premium)` },
      { label: "Clutch", value: "Wet clutch (Mechanical / Electro-hydraulic)" },
      { label: "Max Speed", value: `Up to ${platform.speed} kmph (Eco haulage – Premium)` },
      { label: "Drive Options", value: "2WD & 4WD" },
      { label: "Hydraulic Lift Capacity", value: `${platform.lift.toLocaleString("en-IN")} kg (up to ${platform.liftMax.toLocaleString("en-IN")} kg optional)` },
      { label: "Hydraulic Pump Output", value: `~${platform.pump} LPM (Hydraulics) + Steering pump` },
      { label: "Brakes", value: platform.brakes },
      { label: "Cabin / ROPS", value: platform.cabin },
      { label: "Fuel Tank Capacity", value: `~${platform.tank} litres (Main + Auxiliary)` },
      { label: "Service Interval", value: `~${platform.service} hours` },
      { label: "Target Markets", value: "India + Export markets (Africa, Nepal, Bangladesh)" },
    ];
    const specChips = specs.slice(0, 5);

    // ── Features & CVP — 5 pooled bullets per category, some resolved against this project's specs ──
    function resolveFeature(f) { return typeof f === "function" ? f(specCtx) : f; }
    const features = {
      comfort: pick(FEATURE_POOL.comfort, 5).map(resolveFeature),
      performance: pick(FEATURE_POOL.performance, 5).map(resolveFeature),
      reliability: pick(FEATURE_POOL.reliability, 5).map(resolveFeature),
      versatility: pick(FEATURE_POOL.versatility, 5).map(resolveFeature),
    };

    // ── Target Applications & FI Targets — applications from the platform pool, FI targets from
    //    the project's REAL budget fields (not invented). ──
    const targetApplications = APPLICATION_POOL[project.platform] || APPLICATION_POOL.Utility;
    const annualVolumeTarget = Math.round((project.budgetPlanned / (platform.hpHi / 10)) * (0.8 + rand() * 0.4));
    const priceBandLakh = Math.round((platform.hpHi * 0.9 + between(2, 8)) * 10) / 10;
    const paybackYears = Math.max(2, Math.round((project.budgetPlanned / (annualVolumeTarget * priceBandLakh * 0.12)) * 10) / 10);
    const fiTargets = [
      { label: "Program Investment (Planned)", value: fmtCr(project.budgetPlanned) },
      { label: "Program Investment (Approved)", value: fmtCr(project.budgetApproved) },
      { label: "Target Annual Volume (at maturity)", value: `~${annualVolumeTarget.toLocaleString("en-IN")} units/year` },
      { label: "Indicative Price Band (ex-showroom)", value: `${fmtLakh(priceBandLakh * 100000 / 1000)} – ${fmtLakh((priceBandLakh + 3) * 100000 / 1000)}` },
      { label: "Target Payback Period", value: `~${paybackYears} years` },
      { label: "Target SOP", value: project.targetSOP },
    ];

    // ── Variants & Volume — Base/Mid/Premium attribute table + a 5-year volume ramp per variant,
    //    scaled off the same annualVolumeTarget derived above (so the two tabs never disagree). ──
    const variantNames = narrative.tier >= 2 ? ["Base Variant", "Mid Variant", "Premium Variant"] : ["Base Variant", "Premium Variant"];
    const variantAttrRows = [
      { attribute: "Braking & Safety", value: `${platform.brakes}${narrative.tier >= 2 ? ", Mechanical diff-lock, Trailer brake provision" : ""}` },
      { attribute: "Comfort & Operator Interface", value: `${platform.cabin}, ${narrative.tier >= 2 ? "Mechanical suspension seat, Tilt & telescopic steering" : "Standard operator seat"}${narrative.tier >= 3 ? ", Programmable TFT cluster" : ""}` },
      { attribute: "Electrical & Connectivity", value: `12V system, ${narrative.tier >= 3 ? "180 Ah battery, 90A alternator, OBD diagnostics, USB & 12V charging" : "standard battery & alternator"}` },
      { attribute: "Engine & Performance", value: `4-cyl turbo-intercooled diesel ~${platform.hpLo} / ${hpTop} HP, Up to ${specCtx.torque} Nm torque${narrative.tier >= 3 ? ", 3 engine modes" : ""}` },
      { attribute: "PTO & Hydraulics", value: `${narrative.tier >= 2 ? "Independent PTO with wet clutch, 540 / 540E" : "Standard PTO, 540"} · ${platform.liftMax.toLocaleString("en-IN")} kg lift capacity` },
      { attribute: "Transmission & Driveline", value: `Mechanical shuttle ${platform.gearboxBase}${narrative.tier >= 2 ? `, Creeper speeds, Mechanical / wet clutch` : ""}` },
      { attribute: "Tyres", value: `${platform.hpLo}–${hpTop} HP: 12.4×24 (F), 18.4×30 (R)` },
      { attribute: "Versatility / Applications", value: `${targetApplications[0]}, Front PTO & hitch provision, 2WD / 4WD support` },
    ];
    const sopYear = new Date(project.targetSOP).getFullYear() - 2000;
    const volumeYears = [0, 1, 2, 3].map((i) => `FY-${sopYear + i}`);
    const rampFactors = [0.35, 0.65, 0.9, 1.1];
    const variantVolume = {
      years: volumeYears,
      rows: variantNames.map((vn, vi) => ({
        variant: vn,
        values: rampFactors.map((f, yi) => Math.round(annualVolumeTarget * f * (vi === 0 ? 0.55 : vi === 1 ? 0.3 : 0.15) * (1 + yi * 0.02))),
      })),
    };

    // ── Product Cost & Budget — 100% real fields, no invented numbers ──
    const breakdown = Object.entries(project.budgetBreakdown || {}).map(([k, v]) => ({
      category: k.charAt(0).toUpperCase() + k.slice(1),
      amountLakh: v,
      pct: Math.round((v / project.budgetPlanned) * 1000) / 10,
    })).sort((a, b) => b.amountLakh - a.amountLakh);
    const costBudget = {
      planned: project.budgetPlanned, approved: project.budgetApproved,
      consumed: project.budgetConsumed, forecast: project.forecastCost,
      breakdown,
    };

    // ── Competitor Analysis & Benchmark — generic class-level positioning, no fabricated exact
    //    specs attributed to real competitor products, just realistic market-segment framing. ──
    const competitors = pick(COMPETITOR_POOL, 4).map((c) => ({
      name: c.name,
      hpClass: `${platform.hpLo}–${hpTop} HP class`,
      priceBandLakh: `~₹${(priceBandLakh + between(-3, 4)).toFixed(1)} L`,
      strength: c.note,
    }));

    return {
      typeLabel: narrative.label,
      background: narrative.background(narrativeCtx),
      objective: narrative.objective(narrativeCtx),
      specs, specChips, features,
      targetApplications, fiTargets,
      variants: variantAttrRows, variantVolume,
      costBudget, competitors,
    };
  }

  const DETAILS = {};
  projects.forEach((p) => { const rec = build(p); DETAILS[p.code] = rec; DETAILS[p.name] = rec; });

  global.getPreKoDetail = (id) => DETAILS[id] || DETAILS[decodeURIComponent(id || "")] || null;
})(typeof window !== "undefined" ? window : this);
