// ==========================================================
//  CHARTS — gauges (Health & Compliance) + Process Compliance Rate line chart.
//  Pure render helpers driven entirely by the project-detail record. Chart.js only.
// ==========================================================
(function (global) {
  "use strict";

  const NAVY = "#1e3a5f", TEAL = "#14b8a6", TRACK = "#e5e7eb";

  // Half-circle gauge matching the Figma:
  // - light-gray track, value arc split navy (lead) + teal (trailing ~25 pts)
  // - large % centred inside the arc
  // - "0" and "100" end labels drawn below the arc endpoints
  const centerTextPlugin = {
    id: "gaugeCenterText",
    afterDraw(chart) {
      const t = chart.config.options.plugins.gaugeText;
      if (!t) return;
      const { ctx, chartArea, width } = chart;
      // Centre of the arc = horizontal centre, bottom of chartArea
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = chartArea.bottom;

      // Percentage text — large, bold, navy
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = NAVY;
      ctx.font = "700 20px Inter, sans-serif";
      ctx.fillText(t.value, cx, cy - 8);

      // "0" label — bottom-left of arc
      ctx.font = "500 11px Inter, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "left";
      ctx.fillText("0", chartArea.left + 2, cy + 14);

      // "100" label — bottom-right of arc
      ctx.textAlign = "right";
      ctx.fillText("100", chartArea.right - 2, cy + 14);
      ctx.restore();
    }
  };

  function buildGauge(canvasId, pct) {
    const el = document.getElementById(canvasId);
    if (!el || !global.Chart) return null;
    const value = Math.max(0, Math.min(100, pct));
    const tealLen = Math.min(25, value);
    const navyLen = Math.max(0, value - tealLen);
    const rest    = Math.max(0, 100 - value);
    const ctx = el.getContext("2d");
    return new global.Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["", "", ""],
        datasets: [{
          data: [navyLen, tealLen, rest],
          backgroundColor: [NAVY, TEAL, TRACK],
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

  // Process Compliance Rate — FY26 (dashed teal, dotted markers), FY27 (solid navy),
  // FY27 AI Predicted (dashed amber). Monthly %, interactive tooltip, responsive.
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
          {
            label: "FY27 (AI Predicted)", data: detail.predicted.map(r => r.pct),
            borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,.05)",
            borderWidth: 1.5, borderDash: [6, 3], tension: .35,
            pointStyle: "circle", pointRadius: 3, pointBackgroundColor: "#fff", pointBorderColor: "#f59e0b", pointBorderWidth: 1.5,
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
          y: { min: 10, max: 100, ticks: { stepSize: 10, callback: v => v + "%", color: "#6b7280", font: { size: 10 } }, grid: { color: "#eef2f6" } }
        }
      }
    });
  }

  global.PDCharts = { buildGauge, buildComplianceRate };
})(window);
