import { useOceanStore } from "../../state/useOceanStore";
import ControlTooltip from "../ControlTooltip";

interface ToggleProps {
  label: string;
  storeKey: "showFloats" | "compareModel";
  tip?: string;
}

export default function Toggle({ label, storeKey, tip }: ToggleProps) {
  const value = useOceanStore((s) => s[storeKey]);
  const setter = useOceanStore((s) => s[storeKey === "showFloats" ? "setShowFloats" : "setCompareModel"]);

  return (
    <ControlTooltip tip={tip ?? label}>
      <div
        className="flex items-center justify-between gap-2 text-xs"
        style={{ color: "var(--text-primary)" }}
      >
        <span>{label}</span>
        <button
          role="switch"
          aria-checked={value}
          aria-label={label}
          onClick={() => setter(!value)}
          className="relative w-9 h-5 rounded-full transition-colors shrink-0"
          style={{
            background: value ? "var(--accent-cyan)" : "#334155",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
            style={{
              transform: value ? "translateX(16px)" : "translateX(0)",
            }}
          />
        </button>
      </div>
    </ControlTooltip>
  );
}