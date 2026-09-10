import { useOceanStore } from "../../state/useOceanStore";
import { VARIABLES } from "../../types/ocean";
import ControlTooltip from "../ControlTooltip";

const VARIABLE_TIPS: Record<string, string> = {
  temperature: "Sea surface temperature in °C — key indicator of ocean heat content",
  salinity: "Salt concentration in PSU — affects water density and circulation",
  u_current: "East-west current speed in m/s — positive flows eastward",
  v_current: "North-south current speed in m/s — positive flows northward",
  chlorophyll: "Phytoplankton concentration in mg/m³ — proxy for marine productivity",
};

export default function VariableSelect() {
  const variable = useOceanStore((s) => s.variable);
  const setVariable = useOceanStore((s) => s.setVariable);

  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        Variable
      </label>
      <div className="grid grid-cols-2 gap-1">
        {VARIABLES.map((v) => (
          <ControlTooltip key={v.name} tip={VARIABLE_TIPS[v.name] ?? v.label}>
            <button
              onClick={() => setVariable(v.name)}
              className="px-2 py-1.5 text-xs rounded transition-colors w-full"
              style={{
                background: variable === v.name ? "var(--accent-cyan)" : "#1e293b",
                color: variable === v.name ? "#000" : "var(--text-primary)",
                fontWeight: variable === v.name ? 600 : 400,
                border: "none",
                cursor: "pointer",
              }}
            >
              {v.label}
            </button>
          </ControlTooltip>
        ))}
      </div>
    </div>
  );
}
