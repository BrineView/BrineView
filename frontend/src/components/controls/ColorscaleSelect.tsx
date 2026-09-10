import { useOceanStore } from "../../state/useOceanStore";
import { PALETTES, buildGradientCss } from "../../lib/colormaps";
import ControlTooltip from "../ControlTooltip";

const PALETTE_TIPS: Record<string, string> = {
  thermal: "Rainbow heat map — intuitive for temperature fields",
  viridis: "Perceptually uniform — great for salinity and general data",
  chlorophyll: "Green scale tuned for chlorophyll concentration",
  ocean: "Blue gradient from shallow to deep-water values",
  rdbu: "Red-blue divergent — highlights positive vs negative currents",
};

export default function ColorscaleSelect() {
  const colorscale = useOceanStore((s) => s.colorscale);
  const setColorscale = useOceanStore((s) => s.setColorscale);

  const paletteNames = Object.keys(PALETTES);

  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        Color Scale
      </label>
      <div className="flex flex-col gap-1">
        {paletteNames.map((name) => (
          <ControlTooltip key={name} tip={PALETTE_TIPS[name] ?? "Choose a color map"}>
            <button
              onClick={() => setColorscale(name)}
              className="flex items-center gap-2 px-2 py-1 text-xs rounded transition-colors w-full"
              style={{
                background: colorscale === name ? "#1e293b" : "transparent",
                border: colorscale === name ? "1px solid var(--accent-cyan)" : "1px solid transparent",
                cursor: "pointer",
                color: "var(--text-primary)",
              }}
            >
              <div
                className="flex-1 h-2 rounded"
                style={{ background: buildGradientCss(name) }}
              />
              <span style={{ minWidth: 50, textTransform: "capitalize" }}>{name}</span>
            </button>
          </ControlTooltip>
        ))}
      </div>
    </div>
  );
}