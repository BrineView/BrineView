import VariableSelect from "./controls/VariableSelect";
import DepthSlider from "./controls/DepthSlider";
import TimeSlider from "./controls/TimeSlider";
import ColorscaleSelect from "./controls/ColorscaleSelect";
import OpacitySlider from "./controls/OpacitySlider";
import Toggle from "./controls/Toggle";
import FloatInfoCard from "./FloatInfoCard";
import { useOceanStore } from "../state/useOceanStore";

export default function ControlPanel() {
  const openUserData = useOceanStore((s) => s.openUserData);

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
      <h2 className="eyebrow mb-1">Controls</h2>

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

      <button
        onClick={openUserData}
        className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-transform hover:-translate-y-0.5"
        style={{
          background: "rgba(6, 182, 212, 0.1)",
          border: "1px dashed rgba(6, 182, 212, 0.4)",
          color: "var(--accent-cyan)",
          cursor: "pointer",
        }}
        title="Upload your own NetCDF or CSV and preview it on the 3D ocean surface"
      >
        + Import Your Data
      </button>

      <FloatInfoCard />
    </aside>
  );
}
