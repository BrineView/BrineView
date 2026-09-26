import { useDataStore } from "../state/useDataStore";
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
import type { ProfilePoint } from "../types/ocean";
import { formatNum } from "../lib/format";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, ChartLegend);

type Datum = { depth: number; temperature: number; salinity: number } | ProfilePoint;
interface Pair {
  label: string;
  depth: number;
  temperature: number | null;
  salinity: number | null;
}

function buildSeries(
  obs: Pair[],
  model: Pair[],
  compareModel: boolean,
  salinity: boolean,
  color: string,
) {
  const key = salinity ? "salinity" : "temperature";
  const datasets = [];
  datasets.push({
    label: salinity ? "Obs Salinity" : "Obs Temperature",
    data: obs.map((p) => p[key]),
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    xAxisID: "x",
    pointRadius: 3,
    tension: 0.3,
  });
  if (compareModel) {
    datasets.push({
      label: salinity ? "Model Salinity" : "Model Temperature",
      data: model.map((p) => p[key]),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      borderDash: [6, 4],
      xAxisID: "x",
      pointRadius: 2,
      tension: 0.3,
    });
  }
  return datasets;
}

function makeOptions(unitLabel: string, color: string) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y" as const,
    scales: {
      y: {
        reverse: true,
        title: { display: true, text: "Depth (m)", color: "#94a3b8" },
        ticks: { color: "#94a3b8", font: { size: 9 } },
        grid: { color: "#1e293b" },
        position: "left" as const,
      },
      x: {
        position: "bottom" as const,
        title: { display: true, text: unitLabel, color },
        ticks: { color, font: { size: 9 } },
        grid: { color: "#1e293b" },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };
}

function alignByDepth(profile: Datum[], model: Datum[]): Pair[] {
  const modelByDepth = new Map<number, Datum>(model.map((p) => [p.depth, p]));
  return profile.map((p) => ({
    label: "x",
    depth: p.depth,
    temperature: modelByDepth.get(p.depth)?.temperature ?? null,
    salinity: modelByDepth.get(p.depth)?.salinity ?? null,
  }));
}

export default function DepthProfilePanel() {
  const profilePanelOpen = useDataStore((s) => s.profilePanelOpen);
  const gliderPanelOpen = useDataStore((s) => s.gliderPanelOpen);
  const floatDetail = useDataStore((s) => s.floatDetail);
  const gliderDetail = useDataStore((s) => s.gliderDetail);
  const selectedGliderId = useDataStore((s) => s.selectedGliderId);
  const floatDetailLoading = useDataStore((s) => s.floatDetailLoading);
  const floatMetrics = useDataStore((s) => s.floatMetrics);
  const compareModel = useOceanStore((s) => s.compareModel);
  const timeIndex = useOceanStore((s) => s.timeIndex);
  const closeProfilePanel = useDataStore((s) => s.closeProfilePanel);

  if (!profilePanelOpen && !gliderPanelOpen) return null;
  const isGlider = gliderPanelOpen;

  let title = floatDetail?.id ?? "Float";
  let profile: Datum[] = floatDetail?.profile ?? [];
  let model: Datum[] = floatDetail?.model_profile ?? [];
  let obsColorT = "#ef4444";
  let obsColorS = "#3b82f6";
  let metrics = floatDetail ? floatMetrics.find((m) => m.id === floatDetail.id) : undefined;

  if (isGlider) {
    title = gliderDetail?.name ?? selectedGliderId ?? "Glider";
    const station =
      gliderDetail?.stations.reduce((a, b) =>
        Math.abs(a.t - timeIndex) <= Math.abs(b.t - timeIndex) ? a : b,
      gliderDetail.stations[0],
      ) ?? null;
    profile = station?.profile ?? [];
    model = station?.model_profile ?? [];
    obsColorT = "#22d3ee";
    obsColorS = "#a78bfa";
    metrics = undefined;
  }

  const modelAligned = alignByDepth(profile, model);
  const obsPairs: Pair[] = profile.map((p) => ({
    label: "x",
    depth: p.depth,
    temperature: p.temperature,
    salinity: p.salinity,
  }));
  const depths = profile.map((p) => p.depth);
  const labels = depths.map((d) => `${d} m`);
  const tempChart = {
    labels,
    datasets: buildSeries(obsPairs, modelAligned, compareModel, false, obsColorT),
  };
  const salChart = {
    labels,
    datasets: buildSeries(obsPairs, modelAligned, compareModel, true, obsColorS),
  };
  const tempOptions = makeOptions("Temperature (°C)", obsColorT);
  const salOptions = makeOptions("Salinity (PSU)", obsColorS);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Profile panel"
      className="absolute top-4 right-4 z-20 w-[300px] rounded-lg border p-3 shadow-xl backdrop-blur-sm"
      style={{ background: "rgba(10, 31, 61, 0.92)", borderColor: "var(--panel-border)" }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <div className="eyebrow">{isGlider ? "Glider Mission" : "Argo Float Profile"}</div>
          <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            {title}
          </div>
        </div>
        <button
          onClick={closeProfilePanel}
          aria-label="Close profile panel"
          className="rounded px-2 py-1 text-sm"
          style={{ color: "var(--text-muted)", cursor: "pointer", border: "none", background: "transparent" }}
        >
          ✕
        </button>
      </div>

      {metrics && (
        <div className="font-data text-[11px] rounded px-2 py-1 mb-2" style={{ background: "#12283a", color: "var(--text-primary)" }}>
          RMSE {formatNum(metrics.rmse_t ?? 0, 3)} °C · bias {formatNum(metrics.bias_t ?? 0, 3)} °C&nbsp;
          <span style={{ color: metrics.anomaly ? "#f87171" : "var(--text-muted)" }}>
            {metrics.anomaly ? `· ANOMALY (score ${formatNum(metrics.anomaly_score, 2)})` : `· ${metrics.n_t} levels`}
          </span>
        </div>
      )}

      {floatDetailLoading ? (
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>Loading profile…</div>
      ) : depths.length === 0 ? (
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          {isGlider ? "Glider mission has no sampled station nearby." : "No observed profile at this location."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span style={{ color: obsColorT }}>—</span> Obs ·{" "}
              <span style={{ color: obsColorT }}>- -</span> Model
            </div>
            <div className="h-24">
              <Line data={tempChart} options={tempOptions} />
            </div>
          </div>
          <div>
            <div className="h-24">
              <Line data={salChart} options={salOptions} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}