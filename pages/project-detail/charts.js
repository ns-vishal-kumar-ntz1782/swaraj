// ==========================================================
//  CHARTS — gauges (Health & Compliance) + Process Compliance Rate line chart.
//  Pure render helpers driven entirely by the project-detail record. Chart.js only.
// ==========================================================
(function (global) {
  "use strict";

  const NAVY = "#1e3a5f", TEAL = "#14b8a6";

  // Half-circle gauge matching the Figma:
  // - navy from 0 up to the real value (completed), teal for the remainder up to 100 (pending)
  //   — teal always trails at the end of the arc, never sandwiched between two navy segments
  // - large % centred inside the arc, auto-shrunk to fit the small (130x74) canvas
  // - "0" and "100" end labels drawn below the arc endpoints
  const centerTextPlugin = {
    id: "gaugeCenterText",
    afterDraw(chart) {
      const t = chart.config.options.plugins.gaugeText;
      if (!t) return;
      const { ctx, chartArea } = chart;
      // Centre of the arc = horizontal centre, bottom of chartArea
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = chartArea.bottom;

      // Percentage text — bold, navy, sized to fit the donut's inner cutout width (not the full
      // chart width) so a longer value like "94.29%" never crowds/overlaps the arc the way a
      // fixed font size could.
      const innerWidth = (chartArea.right - chartArea.left) * 0.62;
      let fontSize = 15;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = NAVY;
      ctx.font = `700 ${fontSize}px Inter, sans-serif`;
      while (ctx.measureText(t.value).width > innerWidth && fontSize > 10) {
        fontSize -= 1;
        ctx.font = `700 ${fontSize}px Inter, sans-serif`;
      }
      ctx.fillText(t.value, cx, cy - 6);

      // "0" label — bottom-left of arc
      ctx.font = "500 10px Inter, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "left";
      ctx.fillText("0", chartArea.left + 2, cy + 13);

      // "100" label — bottom-right of arc
      ctx.textAlign = "right";
      ctx.fillText("100", chartArea.right - 2, cy + 13);
      ctx.restore();
    }
  };

  function buildGauge(canvasId, pct) {
    const el = document.getElementById(canvasId);
    if (!el || !global.Chart) return null;
    const value = Math.max(0, Math.min(100, pct));
    const rest  = Math.max(0, 100 - value);
    const ctx = el.getContext("2d");
    return new global.Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["", ""],
        datasets: [{
          // Two segments only, always in this order — navy for the completed value (0..pct),
          // teal for what's left (pct..100) — so pending/remaining always renders as the
          // trailing end of the arc, never a band sandwiched inside the navy portion.
          data: [value, rest],
          backgroundColor: [NAVY, TEAL],
          borderWidth: 0, cutout: "72%",
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        rotation: -90, circumference: 180,
        layout: { padding: { top: 4, left: 4, right: 4, bottom: 20 } },
        events: [],
        plugins: {
          legend: { display: false }, tooltip: { enabled: false },
          gaugeText: { value: (Number.isInteger(pct) ? pct : pct.toFixed(2)) + "%" },
        }
      },
      plugins: [centerTextPlugin]
    });
  }

  // Process Compliance Rate — FY26 (dashed teal, dotted markers), FY27 (solid navy).
  // Monthly %, interactive tooltip, responsive.
  function buildComplianceRate(canvasId, detail) {
    const el = document.getElementById(canvasId);
    if (!el || !global.Chart) return null;
    const labels = detail.monthlyRate.map(r => r.month);
    const ctx = el.getContext("2d");
    return new global.Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "FY26", data: detail.fy26.map(r => r.pct),
            borderColor: "#16a34a", backgroundColor: "rgba(22,163,74,.06)",
            borderWidth: 1.5, borderDash: [5, 4], tension: .35,
            pointStyle: "circle", pointRadius: 3, pointBackgroundColor: "#fff", pointBorderColor: "#16a34a", pointBorderWidth: 1.5,
            spanGaps: true,
          },
          {
            label: "FY27", data: detail.monthlyRate.map(r => r.pct),
            borderColor: NAVY, backgroundColor: "rgba(30,58,95,.10)",
            borderWidth: 2.5, tension: .35, fill: true,
            pointStyle: "circle", pointRadius: 3, pointBackgroundColor: NAVY,
            spanGaps: true,
          },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 18, right: 8 } },
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 18, boxHeight: 2, usePointStyle: false, color: "#374151", font: { family: "Inter", size: 11 }, padding: 12 } },
          tooltip: {
            enabled: true, backgroundColor: "rgba(15,23,42,.9)", titleColor: "#fff", bodyColor: "#e2e8f0",
            padding: 10, cornerRadius: 8, callbacks: { label: i => " " + i.dataset.label + ": " + i.raw + "%" }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#6b7280", font: { size: 11 } } },
          y: { min: 0, max: 100, ticks: { stepSize: 10, callback: v => v + "%", color: "#6b7280", font: { size: 10 } }, grid: { color: "#eef2f6" } }
        }
      }
    });
  }

  global.PDCharts = { buildGauge, buildComplianceRate };
})(window);
