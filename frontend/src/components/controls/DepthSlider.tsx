import { useOceanStore } from "../../state/useOceanStore";
import { getDepthBand } from "../../lib/depthBands";

export default function DepthSlider() {
  const meta = useOceanStore((s) => s.meta);
  const depth = useOceanStore((s) => s.depth);
  const setDepth = useOceanStore((s) => s.setDepth);

  const depths = meta?.depths ?? [];
  const currentIdx = depths.indexOf(depth);
  const band = getDepthBand(depth);

  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        Depth
      </label>
      <input
        type="range"
        min={0}
        max={Math.max(0, depths.length - 1)}
        step={1}
        value={currentIdx >= 0 ? currentIdx : 0}
        onChange={(e) => {
          const idx = Number(e.target.value);
          if (depths[idx] !== undefined) setDepth(depths[idx]);
        }}
        disabled={!meta}
        className="w-full"
      />
      <div className="flex justify-between text-xs mt-1">
        <span style={{ color: "var(--text-primary)" }}>
          {depth} m
        </span>
        <span style={{ color: "var(--accent-cyan)" }}>
          {band.name}
        </span>
      </div>
      {band.blurb && (
        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {band.blurb}
        </p>
      )}
    </div>
  );
}
