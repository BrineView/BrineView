import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useOceanStore } from "../state/useOceanStore";
import type { UserDatasetInfo, UserVariableInfo } from "../types/ocean";

const UPLOAD_NC_ACCEPT = ".nc,.nc4,.cdf,.netcdf";
const UPLOAD_CSV_ACCEPT = ".csv";

export default function UserDataModal() {
  const open = useOceanStore((s) => s.userDataOpen);
  const close = useOceanStore((s) => s.closeUserData);
  const datasets = useOceanStore((s) => s.userDatasets);
  const loading = useOceanStore((s) => s.userDataLoading);
  const error = useOceanStore((s) => s.userDataError);
  const upload = useOceanStore((s) => s.uploadUserData);
  const remove = useOceanStore((s) => s.deleteUserData);
  const loadUserField = useOceanStore((s) => s.loadUserField);

  const ncInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await upload(file);
    } catch {
      // error already surfaced in the modal
    }
  };

  const preview = async (d: UserDatasetInfo, v: UserVariableInfo) => {
    if (!v.has_lat_lon) return;
    await loadUserField(d.index, v.name);
    close();
  };

  const uploadButton = (label: string, hint: string, onPick: () => void) => (
    <button
      onClick={onPick}
      className="flex-1 px-4 py-3 rounded-lg text-sm font-medium text-left transition-transform hover:-translate-y-0.5"
      style={{
        background: "rgba(6, 182, 212, 0.08)",
        border: "1px dashed rgba(6, 182, 212, 0.4)",
        color: "var(--text-primary)",
        cursor: "pointer",
      }}
    >
      <span style={{ color: "var(--accent-cyan)" }}>{label}</span>
      <span className="block text-xs mt-1" style={{ color: "var(--text-muted)" }}>
        {hint}
      </span>
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import your own data"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5, 10, 20, 0.75)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="flex flex-col w-full max-w-xl rounded-2xl overflow-hidden"
        style={{
          background: "var(--panel-bg)",
          border: "1px solid var(--panel-border)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--panel-border)" }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Add your own data
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Upload NetCDF or CSV, then drop it onto the 3D ocean surface
            </p>
          </div>
          <button
            onClick={close}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
            style={{
              background: "rgba(148, 163, 184, 0.1)",
              color: "var(--text-muted)",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Close import dialog"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5 overflow-y-auto" style={{ maxHeight: "62vh", overscrollBehavior: "contain" }}>
          {/* Upload buttons */}
          <div className="flex gap-3">
            {uploadButton("NetCDF (.nc)", "Model output or gridded field", () => ncInputRef.current?.click())}
            {uploadButton("CSV (.csv)", "lat, lon + value columns", () => csvInputRef.current?.click())}
          </div>
          <input ref={ncInputRef} type="file" accept={UPLOAD_NC_ACCEPT} className="hidden" onChange={handleFile} />
          <input ref={csvInputRef} type="file" accept={UPLOAD_CSV_ACCEPT} className="hidden" onChange={handleFile} />

          {loading && (
            <div className="flex items-center gap-3 text-sm" style={{ color: "var(--text-muted)" }}>
              <div
                className="w-5 h-5 border-2 rounded-full animate-spin"
                style={{ borderColor: "var(--accent-cyan)", borderTopColor: "transparent" }}
              />
              Reading file…
            </div>
          )}

          {error && (
            <div
              className="text-xs px-3 py-2 rounded-md"
              style={{ color: "#fca5a5", background: "rgba(248, 113, 113, 0.08)" }}
            >
              {error}
            </div>
          )}

          {/* Dataset list */}
          {datasets.length === 0 && !loading && (
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              No datasets uploaded yet. Pick a file above — when it has a variable on a
              (lat, lon) grid you can preview it straight onto the 3D view.
            </p>
          )}

          <div className="flex flex-col gap-4">
            {datasets.map((d) => (
              <div key={d.index} className="rounded-xl p-4" style={{ background: "rgba(30, 41, 59, 0.4)", border: "1px solid var(--panel-border)" }}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold truncate" style={{ color: "var(--accent-cyan)" }}>
                      {d.name}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(148, 163, 184, 0.12)", color: "var(--text-muted)" }}
                    >
                      {d.source}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (confirmRemove === d.index) {
                        setConfirmRemove(null);
                        remove(d.index);
                      } else {
                        setConfirmRemove(d.index);
                      }
                    }}
                    className="text-[11px] px-2 py-0.5 rounded"
                    style={{
                      color: "#f87171",
                      background: confirmRemove === d.index ? "rgba(248, 113, 113, 0.28)" : "rgba(248, 113, 113, 0.1)",
                      border: "none",
                      cursor: "pointer",
                    }}
                    aria-label={confirmRemove === d.index ? `Confirm removing ${d.name}` : `Remove ${d.name}`}
                  >
                    {confirmRemove === d.index ? "Confirm remove?" : "Remove"}
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  {d.variables.map((v) => (
                    <div key={v.name} className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span style={{ color: "var(--text-primary)" }}>{v.name}</span>
                        {v.units && (
                          <span style={{ color: "var(--text-muted)" }}>
                            {" "}· {v.long_name}{" "}· {v.units}
                          </span>
                        )}
                        <span className="block" style={{ color: "var(--text-muted)" }}>
                          shape {v.shape.join("×")} · {v.dims.join(", ")}
                          {!v.has_lat_lon && " · needs lat/lon"}
                        </span>
                      </div>
                      <button
                        onClick={() => preview(d, v)}
                        disabled={!v.has_lat_lon}
                        className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-transform hover:-translate-y-0.5 shrink-0"
                        style={{
                          background: v.has_lat_lon ? "var(--accent-cyan)" : "rgba(148, 163, 184, 0.15)",
                          color: v.has_lat_lon ? "#000" : "var(--text-muted)",
                          border: "none",
                          cursor: v.has_lat_lon ? "pointer" : "not-allowed",
                        }}
                      >
                        Preview in 3D
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {d.meta.lat_range[0]}–{d.meta.lat_range[1]}°N · {d.meta.lon_range[0]}–{d.meta.lon_range[1]}°E
                  · {d.meta.depths.length} depth level{d.meta.depths.length === 1 ? "" : "s"} · {d.meta.times.length} time step{d.meta.times.length === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t" style={{ borderColor: "var(--panel-border)" }}>
          <button
            onClick={close}
            className="px-4 py-1.5 rounded-lg text-sm"
            style={{ color: "var(--text-primary)", background: "transparent", border: "none", cursor: "pointer" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}