import { useOceanStore } from "../../state/useOceanStore";
import { formatTime } from "../../lib/format";

export default function TimeSlider() {
  const meta = useOceanStore((s) => s.meta);
  const timeIndex = useOceanStore((s) => s.timeIndex);
  const setTimeIndex = useOceanStore((s) => s.setTimeIndex);

  const times = meta?.times ?? [];
  const currentTime = times[timeIndex] ?? "";

  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        Time
      </label>
      <input
        type="range"
        min={0}
        max={Math.max(0, times.length - 1)}
        step={1}
        value={timeIndex}
        onChange={(e) => setTimeIndex(Number(e.target.value))}
        disabled={!meta}
        className="w-full"
      />
      <div className="flex justify-between text-xs mt-1">
        <span style={{ color: "var(--text-primary)" }}>
          Step {timeIndex + 1}/{times.length}
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          {formatTime(currentTime)}
        </span>
      </div>
    </div>
  );
}
