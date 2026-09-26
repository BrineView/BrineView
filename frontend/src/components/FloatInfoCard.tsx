import { useDataStore } from "../state/useDataStore";
import { useOceanStore } from "../state/useOceanStore";
import { formatNum } from "../lib/format";

export default function FloatInfoCard() {
  const selectedFloatId = useDataStore((s) => s.selectedFloatId);
  const floatDetail = useDataStore((s) => s.floatDetail);
  const compareModel = useOceanStore((s) => s.compareModel);
  const floatMetrics = useDataStore((s) => s.floatMetrics);

  if (!selectedFloatId || !floatDetail) return null;

  const metrics = floatMetrics.find((m) => m.id === floatDetail.id);

  // Fallback while server metrics are still loading
  let meanDT = 0;
  let meanDS = 0;
  if (compareModel && floatDetail.profile && floatDetail.model_profile) {
    const n = floatDetail.profile.length;
    let sumT = 0;
    let sumS = 0;
    for (let i = 0; i < n; i++) {
      sumT += Math.abs(floatDetail.profile[i].temperature - floatDetail.model_profile[i].temperature);
      sumS += Math.abs(floatDetail.profile[i].salinity - floatDetail.model_profile[i].salinity);
    }
    meanDT = n > 0 ? sumT / n : 0;
    meanDS = n > 0 ? sumS / n : 0;
  }

  return (
    <div
      className="font-data rounded p-2 text-xs"
      style={{ background: "#16233a" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold" style={{ color: "var(--accent-orange)" }}>
          {floatDetail.id}
        </div>
        {metrics?.anomaly && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: "rgba(248, 113, 113, 0.2)", color: "#f87171" }}
          >
            ANOMALY
          </span>
        )}
      </div>
      <div style={{ color: "var(--text-muted)" }}>
        Lat: {formatNum(floatDetail.lat, 2)}° · Lon: {formatNum(floatDetail.lon, 2)}°
      </div>
      {compareModel && (
        <div className="mt-1 pt-1" style={{ borderTop: "1px solid #1b2b44" }}>
          <div style={{ color: "var(--text-muted)" }}>Model vs Obs</div>
          <div style={{ color: "var(--text-primary)" }}>
            T: RMSE {formatNum(metrics?.rmse_t ?? meanDT, 3)} °C · bias{" "}
            {formatNum(metrics?.bias_t ?? 0, 3)} °C
          </div>
          <div style={{ color: "var(--text-primary)" }}>
            S: RMSE {formatNum(metrics?.rmse_s ?? meanDS, 3)} PSU · bias{" "}
            {formatNum(metrics?.bias_s ?? 0, 3)} PSU
          </div>
          {metrics && (
            <div style={{ color: "var(--text-muted)" }}>
              Isolation Forest score: {formatNum(metrics.anomaly_score, 2)} across {metrics.n_t}{" "} depth levels
              depth levels
            </div>
          )}
        </div>
      )}
    </div>
  );
}