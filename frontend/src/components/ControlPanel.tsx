import VariableSelect from "./controls/VariableSelect";
import DepthSlider from "./controls/DepthSlider";
import TimeSlider from "./controls/TimeSlider";
import ColorscaleSelect from "./controls/ColorscaleSelect";
import OpacitySlider from "./controls/OpacitySlider";
import Toggle from "./controls/Toggle";
import FloatInfoCard from "./FloatInfoCard";

export default function ControlPanel() {
  return (
    <aside
      className="flex flex-col gap-3 p-3 overflow-y-auto border-r"
      style={{
        width: 260,
        minWidth: 260,
        background: "var(--panel-bg)",
        borderColor: "var(--panel-border)",
      }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-1"
        style={{ color: "var(--text-muted)" }}>
        Controls
      </h2>

      <VariableSelect />
      <DepthSlider />
      <TimeSlider />
      <ColorscaleSelect />
      <OpacitySlider />

      <hr style={{ borderColor: "var(--panel-border)" }} />

      <Toggle
        label="Show Argo Floats"
        storeKey="showFloats"
        tip="Toggle the floating Argo observation markers on the ocean surface"
      />
      <Toggle
        label="Compare Model vs Observation"
        storeKey="compareModel"
        tip="Overlay simulated model profiles (dashed) against real float observations (solid)"
      />

      <FloatInfoCard />
    </aside>
  );
}
