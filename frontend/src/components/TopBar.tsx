import { useOceanStore } from "../state/useOceanStore";
import Legend from "./Legend";
import { formatTime } from "../lib/format";

export default function TopBar() {
  const field = useOceanStore((s) => s.field);
  const meta = useOceanStore((s) => s.meta);
  const timeIndex = useOceanStore((s) => s.timeIndex);
  const user = useOceanStore((s) => s.user);
  const setPage = useOceanStore((s) => s.setPage);
  const logout = useOceanStore((s) => s.logout);

  const currentTime = meta?.times?.[timeIndex] ?? field?.time ?? "";

  return (
    <header
      className="flex items-center justify-between px-4 py-2 border-b"
      style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPage("landing")}
          className="text-lg font-bold tracking-wide"
          style={{
            color: "var(--accent-cyan)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          title="Back to home"
        >
          BrineView
        </button>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          OceanLens 3D
        </span>
      </div>

      <div className="flex items-center gap-4">
        {field && (
          <div
            className="text-xs px-2 py-1 rounded"
            style={{ background: "#1e293b" }}
          >
            <span style={{ color: "var(--text-muted)" }}>Time: </span>
            <span style={{ color: "var(--text-primary)" }}>
              {formatTime(currentTime)}
            </span>
          </div>
        )}
        <Legend />

        {/* User info & logout */}
        {user && (
          <div className="flex items-center gap-2 text-xs ml-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
              style={{ background: "rgba(6, 182, 212, 0.2)", color: "var(--accent-cyan)" }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span style={{ color: "var(--text-muted)" }}>{user.name}</span>
            <button
              onClick={logout}
              className="px-2 py-0.5 rounded text-[10px]"
              style={{
                color: "#f87171",
                background: "rgba(248, 113, 113, 0.1)",
                border: "none",
                cursor: "pointer",
              }}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
