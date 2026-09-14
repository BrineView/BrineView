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
      className="font-data absolute bottom-3 left-3 px-3 py-2 rounded text-xs pointer-events-none"
      style={{
        background: "rgba(6, 12, 24, 0.92)",
        border: "1px solid #1b2b44",
        color: "var(--text-primary)",
        zIndex: 10,
        backdropFilter: "blur(4px)",
      }}
    >
      <div>{formatNum(lat, 2)}° N, {formatNum(lon, 2)}° E</div>
      <div>Depth: {depth} m</div>
      <div style={{ color: "var(--accent-cyan)" }}>
        {info?.label ?? variable}: {formatNum(value)} {info?.unit}
      </div>
    </div>
  );
}
