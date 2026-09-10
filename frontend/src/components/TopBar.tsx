import { useOceanStore } from "../state/useOceanStore";
import Legend from "./Legend";
import { formatTime } from "../lib/format";

export default function TopBar() {
  const field = useOceanStore((s) => s.field);
  const meta = useOceanStore((s) => s.meta);
  const timeIndex = useOceanStore((s) => s.timeIndex);

  const currentTime = meta?.times?.[timeIndex] ?? field?.time ?? "";

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b"
      style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-wide" style={{ color: "var(--accent-cyan)" }}>
          BrineView
        </h1>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          OceanLens 3D
        </span>
      </div>

      <div className="flex items-center gap-4">
        {field && (
          <div className="text-xs px-2 py-1 rounded" style={{ background: "#1e293b" }}>
            <span style={{ color: "var(--text-muted)" }}>Time: </span>
            <span style={{ color: "var(--text-primary)" }}>{formatTime(currentTime)}</span>
          </div>
        )}
        <Legend />
      </div>
    </header>
  );
}
