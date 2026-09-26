import VariableSelect from "./controls/VariableSelect";
import DepthSlider from "./controls/DepthSlider";
import TimeSlider from "./controls/TimeSlider";
import ColorscaleSelect from "./controls/ColorscaleSelect";
import OpacitySlider from "./controls/OpacitySlider";
import Toggle from "./controls/Toggle";
import FloatInfoCard from "./FloatInfoCard";
import { useUploadStore } from "../state/useUploadStore";
import { useOceanStore } from "../state/useOceanStore";
import { useDataStore } from "../state/useDataStore";
import { formatNum } from "../lib/format";

export default function ControlPanel() {
  const openUserData = useUploadStore((s) => s.openUserData);

  const variable = useOceanStore((s) => s.variable);
  const depth = useOceanStore((s) => s.depth);
  const timeIndex = useOceanStore((s) => s.timeIndex);
  const setShowAssimilated = useOceanStore((s) => s.setShowAssimilated);

  const floatMetrics = useDataStore((s) => s.floatMetrics);
  const runAssimilate = useDataStore((s) => s.runAssimilate);
  const assimilated = useDataStore((s) => s.assimilated);
  const assimilating = useDataStore((s) => s.assimilating);
  const assimError = useDataStore((s) => s.assimError);

  const anomalyCount = floatMetrics.filter((m) => m.anomaly).length;

  const handleAssimilate = async () => {
    const ok = await runAssimilate({ variable, depth, time_index: timeIndex });
    if (ok) setShowAssimilated(true);
  };

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

      <hr style={{ borderColor: "var(--panel-border)" }} />

      <div className="eyebrow">Analysis & AI</div>

      <Toggle
        label="Glider Layer"
        storeKey="showGliders"
        tip="Show autonomous glider missions (Seagliders/Slocum) as animated tracks on the surface"
      />
      <Toggle
        label="AI Anomaly Highlight"
        storeKey="showAnomalies"
        tip={
          anomalyCount > 0
            ? `Highlights ${anomalyCount} float(s) flagged by the unsupervised AI anomaly detector`
            : "Trained Isolation Forest flags floats whose model-residual profile is an outlier"
        }
      />
      {anomalyCount > 0 && (
        <div className="font-data text-[11px] px-1" style={{ color: "#f87171" }}>
          {anomalyCount} anomalous float{anomalyCount === 1 ? "" : "s"} detected
        </div>
      )}

      <div
        className="font-data text-[11px] px-1 pt-1 rounded"
        style={{ borderTop: "1px solid var(--panel-border)", color: "var(--text-muted)" }}
      >
        Localized data assimilation (optimal interpolation) corrects the {variable}{" "}
        field toward float observations at {formatNum(depth)} m / t+{timeIndex}.
      </div>
      <button
        onClick={handleAssimilate}
        disabled={assimilating}
        className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        style={{
          background: "rgba(45, 224, 200, 0.12)",
          border: "1px dashed rgba(45, 224, 200, 0.45)",
          color: "var(--biolum)",
          cursor: assimilating ? "wait" : "pointer",
        }}
        title="Run localized optimal-interpolation assimilation and report the RMSE/bias reduction on held-out floats"
      >
        {assimilating ? "Assimilating…" : "Run Assimilation"}
      </button>

      {assimilated && (
        <div className="font-data text-[11px] rounded px-2 py-1.5" style={{ background: "#12283a" }}>
          <div style={{ color: "var(--text-muted)" }}>Assimilation result (t+{timeIndex})</div>
          <div style={{ color: "var(--text-primary)" }}>
            RMSE {formatNum(assimilated.before.rmse, 3)} → {formatNum(assimilated.after.rmse, 3)}°C
          </div>
          {assimilated.reduction_rmse_pct !== null && (
            <div style={{ color: "var(--biolum)" }}>
              Δ RMSE {assimilated.reduction_rmse_pct > 0 ? "−" : "+"}
              {formatNum(Math.abs(assimilated.reduction_rmse_pct), 1)}% · bias{" "}
              {formatNum(assimilated.reduction_bias_pct ?? 0, 1)}%
            </div>
          )}
          <div style={{ color: "var(--text-muted)" }}>
            {assimilated.n_analysis}+{assimilated.n_validation} floats (train+held-out)
          </div>
        </div>
      )}

      <Toggle
        label="Show Assimilated Field"
        storeKey="showAssimilated"
        tip="Swap the surface to the assimilation-corrected field when available"
      />

      {assimError && (
        <div className="font-data text-[11px] px-1" style={{ color: "#f87171" }}>
          {assimError}
        </div>
      )}

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
