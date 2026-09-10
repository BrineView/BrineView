import { useOceanStore } from "../../state/useOceanStore";
import { VARIABLES } from "../../types/ocean";

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
          <button
            key={v.name}
            onClick={() => setVariable(v.name)}
            className="px-2 py-1.5 text-xs rounded transition-colors"
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
        ))}
      </div>
    </div>
  );
}
