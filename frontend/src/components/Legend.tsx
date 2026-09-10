import { useOceanStore } from "../state/useOceanStore";
import { buildGradientCss } from "../lib/colormaps";
import { VARIABLE_MAP } from "../types/ocean";

export default function Legend() {
  const field = useOceanStore((s) => s.field);
  const colorscale = useOceanStore((s) => s.colorscale);
  const variable = useOceanStore((s) => s.variable);

  const info = VARIABLE_MAP[variable];
  const gradient = buildGradientCss(colorscale);

  return (
    <div className="flex items-center gap-2 text-xs" style={{ minWidth: 200 }}>
      <span style={{ color: "var(--text-muted)" }}>
        {field?.min?.toFixed(1)} {info?.unit}
      </span>
      <div
        className="legend-gradient flex-1"
        style={{ background: gradient }}
      />
      <span style={{ color: "var(--text-muted)" }}>
        {field?.max?.toFixed(1)} {info?.unit}
      </span>
    </div>
  );
}
