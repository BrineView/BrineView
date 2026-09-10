import { useOceanStore } from "../state/useOceanStore";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, ChartLegend);

export default function DepthProfilePanel() {
  const profilePanelOpen = useOceanStore((s) => s.profilePanelOpen);
  const floatDetail = useOceanStore((s) => s.floatDetail);
  const floatDetailLoading = useOceanStore((s) => s.floatDetailLoading);
  const compareModel = useOceanStore((s) => s.compareModel);
  const closeProfilePanel = useOceanStore((s) => s.closeProfilePanel);

  if (!profilePanelOpen) return null;

  const depths = floatDetail?.profile?.map((p) => p.depth) ?? [];

  const datasets = [];
  if (floatDetail?.profile) {
    datasets.push({
      label: "Obs Temperature",
      data: floatDetail.profile.map((p) => p.temperature),
      borderColor: "#ef4444",
      backgroundColor: "#ef4444",
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.3,
      yAxisID: "y",
    });
    datasets.push({
      label: "Obs Salinity",
      data: floatDetail.profile.map((p) => p.salinity),
      borderColor: "#3b82f6",
      backgroundColor: "#3b82f6",
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.3,
      yAxisID: "y1",
    });
  }

  if (compareModel && floatDetail?.model_profile) {
    datasets.push({
      label: "Model Temperature",
      data: floatDetail.model_profile.map((p) => p.temperature),
      borderColor: "#ef4444",
      backgroundColor: "#ef4444",
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 2,
      tension: 0.3,
      yAxisID: "y",
    });
    datasets.push({
      label: "Model Salinity",
      data: floatDetail.model_profile.map((p) => p.salinity),
      borderColor: "#3b82f6",
      backgroundColor: "#3b82f6",
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 2,
      tension: 0.3,
      yAxisID: "y1",
    });
  }

  const chartData = {
    labels: depths.map((d) => `${d} m`),
    datasets,
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y" as const,
    scales: {
      y: {
        reverse: true,
        title: { display: true, text: "Depth (m)", color: "#94a3b8" },
        ticks: { color: "#94a3b8" },
        grid: { color: "#1e293b" },
      },
      x: {
        position: "bottom" as const,
        title: { display: true, text: "Temperature (°C)", color: "#ef4444" },
        ticks: { color: "#ef4444" },
        grid: { color: "#1e293b" },
      },
      y1: {
        position: "right" as const,
        title: { display: true, text: "Salinity (PSU)", color: "#3b82f6" },
        ticks: { color: "#3b82f6" },
        grid: { drawOnChartArea: false },
      },
    },
    plugins: {
      legend: {
        labels: { color: "#94a3b8", font: { size: 10 } },
      },
    },
  };

  return (
    <div
      className="absolute right-0 top-0 bottom-0 flex flex-col border-l overflow-hidden"
      style={{
        width: 340,
        background: "var(--panel-bg)",
        borderColor: "var(--panel-border)",
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: "var(--panel-border)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--accent-orange)" }}>
          {floatDetail?.id ?? "Profile"}
        </span>
        <button
          onClick={closeProfilePanel}
          className="text-lg leading-none"
          style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          ×
        </button>
      </div>

      <div className="flex-1 p-2 overflow-y-auto">
        {floatDetailLoading && (
          <div className="flex items-center justify-center h-full" style={{ color: "var(--text-muted)" }}>
            Loading profile...
          </div>
        )}

        {!floatDetailLoading && floatDetail && (
          <>
            <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Lat: {floatDetail.lat.toFixed(2)}° | Lon: {floatDetail.lon.toFixed(2)}°
            </div>

            {compareModel && (
              <div className="text-[10px] mb-2 p-1.5 rounded" style={{ background: "#1e293b" }}>
                <span style={{ color: "var(--text-muted)" }}>Solid = Observed | Dashed = Model</span>
              </div>
            )}

            <div style={{ height: 400 }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </>
        )}

        {!floatDetailLoading && !floatDetail && (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--text-muted)" }}>
            Click a float marker to view its profile
          </div>
        )}
      </div>
    </div>
  );
}
