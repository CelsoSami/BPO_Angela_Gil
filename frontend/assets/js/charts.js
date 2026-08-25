/* ============================================================================
   Build Flow BPO — Gráficos (Chart.js) com cores do tema
   ============================================================================ */
const Charts = (() => {
  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function palette() {
    return {
      accent: css("--accent") || "#4C7DFF",
      accent2: css("--accent-2") || "#2DD4BF",
      success: css("--success") || "#22C55E",
      warning: css("--warning") || "#F59E0B",
      danger: css("--danger") || "#EF4444",
      text: css("--text-2") || "#B8BCC5",
      grid: css("--border") || "rgba(128,128,128,0.15)",
    };
  }
  function baseOptions(extra = {}) {
    const p = palette();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: p.text, boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } } },
        tooltip: { backgroundColor: css("--bg-4"), titleColor: css("--text"), bodyColor: css("--text-2"), borderColor: css("--border-strong"), borderWidth: 1 },
      },
      scales: {
        x: { ticks: { color: p.text, font: { size: 10.5 } }, grid: { color: p.grid } },
        y: { ticks: { color: p.text, font: { size: 10.5 } }, grid: { color: p.grid } },
      },
      ...extra,
    };
  }
  function destroy(id) {
    const existing = Chart.getChart(id);
    if (existing) existing.destroy();
  }
  function line(id, labels, datasets) {
    destroy(id);
    const el = document.getElementById(id);
    if (!el) return;
    new Chart(el, {
      type: "line",
      data: { labels, datasets },
      options: baseOptions({
        interaction: { mode: "index", intersect: false },
        elements: { line: { tension: 0.35 }, point: { radius: 2.5, hoverRadius: 4 } },
      }),
    });
  }
  function bar(id, labels, datasets) {
    destroy(id);
    const el = document.getElementById(id);
    if (!el) return;
    new Chart(el, {
      type: "bar",
      data: { labels, datasets },
      options: baseOptions({
        borderRadius: 6,
        datasets: { bar: { maxBarThickness: 34 } },
      }),
    });
  }
  function doughnut(id, labels, values, colors) {
    destroy(id);
    const el = document.getElementById(id);
    if (!el) return;
    new Chart(el, {
      type: "doughnut",
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
      options: baseOptions({ cutout: "62%" }),
    });
  }
  return { palette, line, bar, doughnut, destroy };
})();
