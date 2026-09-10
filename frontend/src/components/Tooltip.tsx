import { VARIABLE_MAP } from "../types/ocean";
import { formatNum } from "../lib/format";

interface TooltipProps {
  lat: number;
  lon: number;
  depth: number;
  value: number | null;
  variable: string;
}

export default function Tooltip({ lat, lon, depth, value, variable }: TooltipProps) {
  const info = VARIABLE_MAP[variable];
  return (
    <div
      className="absolute bottom-3 left-3 px-3 py-2 rounded text-xs pointer-events-none"
      style={{
        background: "rgba(15, 23, 42, 0.9)",
        border: "1px solid #334155",
        color: "var(--text-primary)",
        zIndex: 10,
        backdropFilter: "blur(4px)",
      }}
    >
      <div>{formatNum(lat, 2)}° N, {formatNum(lon, 2)}° E</div>
      <div>Depth: {depth} m</div>
      <div style={{ color: "var(--accent-cyan)" }}>
        {info?.label}: {formatNum(value)} {info?.unit}
      </div>
    </div>
  );
}
