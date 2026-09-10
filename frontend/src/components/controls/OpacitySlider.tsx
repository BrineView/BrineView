import { useOceanStore } from "../../state/useOceanStore";

export default function OpacitySlider() {
  const opacity = useOceanStore((s) => s.opacity);
  const setOpacity = useOceanStore((s) => s.setOpacity);

  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        Opacity
      </label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-xs" style={{ color: "var(--text-primary)", minWidth: 30 }}>
          {Math.round(opacity * 100)}%
        </span>
      </div>
    </div>
  );
}
