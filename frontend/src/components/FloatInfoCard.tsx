import { useOceanStore } from "../state/useOceanStore";
import { formatNum } from "../lib/format";

export default function FloatInfoCard() {
  const selectedFloatId = useOceanStore((s) => s.selectedFloatId);
  const floatDetail = useOceanStore((s) => s.floatDetail);
  const compareModel = useOceanStore((s) => s.compareModel);

  if (!selectedFloatId || !floatDetail) return null;

  // Compute mean differences if comparing
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
    meanDT = sumT / n;
    meanDS = sumS / n;
  }

  return (
    <div
      className="rounded p-2 text-xs"
      style={{ background: "#1e293b" }}
    >
      <div className="font-semibold mb-1" style={{ color: "var(--accent-orange)" }}>
        {floatDetail.id}
      </div>
      <div style={{ color: "var(--text-muted)" }}>
        Lat: {formatNum(floatDetail.lat, 2)}° | Lon: {formatNum(floatDetail.lon, 2)}°
      </div>
      {compareModel && (
        <div className="mt-1 pt-1" style={{ borderTop: "1px solid #334155" }}>
          <div style={{ color: "var(--text-muted)" }}>Model vs Obs Δ</div>
          <div style={{ color: "var(--text-primary)" }}>
            Mean |ΔT|: {formatNum(meanDT, 3)} °C
          </div>
          <div style={{ color: "var(--text-primary)" }}>
            Mean |ΔS|: {formatNum(meanDS, 3)} PSU
          </div>
        </div>
      )}
    </div>
  );
}
