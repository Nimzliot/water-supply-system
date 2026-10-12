import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";

// Registering a plugin or element resets its defaults, so everything is registered here
// first and the pages' own register calls become no-ops.
ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

// App-wide chart styling so every chart matches the light theme.
ChartJS.defaults.font.family = "Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif";
ChartJS.defaults.font.size = 12;
ChartJS.defaults.color = "#64748b";
ChartJS.defaults.borderColor = "#e2e8f0";
ChartJS.defaults.maintainAspectRatio = false;
ChartJS.defaults.set("plugins.legend", { display: false });
ChartJS.defaults.set("plugins.tooltip", { backgroundColor: "#0f172a", padding: 10, cornerRadius: 6 });
ChartJS.defaults.set("elements.line", { borderWidth: 2, tension: 0.3 });
ChartJS.defaults.set("elements.point", { radius: 2, hoverRadius: 4 });
ChartJS.defaults.set("elements.bar", { borderRadius: 4 });

// Shared options: no vertical grid lines, values start at zero, few enough ticks to fit a phone.
export const cartesianOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  scales: {
    x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
    y: { beginAtZero: true, border: { display: false }, ticks: { maxTicksLimit: 6 } }
  }
};
