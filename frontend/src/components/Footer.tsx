import { useOceanStore } from "../state/useOceanStore";
import { formatTime } from "../lib/format";

export default function Footer() {
  const meta = useOceanStore((s) => s.meta);
  const field = useOceanStore((s) => s.field);
  const timeIndex = useOceanStore((s) => s.timeIndex);

  const times = meta?.times ?? [];
  const totalSteps = times.length;

  return (
    <footer
      className="flex items-center justify-between px-4 py-1.5 text-[11px] border-t"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--panel-border)",
        color: "var(--text-muted)",
      }}
    >
      <div>
        Dataset: {times.length > 0 ? formatTime(times[0]) : "—"} → {times.length > 0 ? formatTime(times[times.length - 1]) : "—"}
      </div>
      <div>
        {field && (
          <>
            Current: {formatTime(field.time)} (step {timeIndex + 1}/{totalSteps})
            {" | "}
            Depth: {field.depth} m
          </>
        )}
      </div>
      <div>
        Synthetic data via SyntheticAdapter
      </div>
    </footer>
  );
}
