import { useDataStore } from "../state/useDataStore";
import { useAuthStore } from "../state/useAuthStore";
import { useOceanStore } from "../state/useOceanStore";
import Legend from "./Legend";
import { formatTime } from "../lib/format";

export default function TopBar() {
  const field = useDataStore((s) => s.field);
  const meta = useDataStore((s) => s.meta);
  const timeIndex = useOceanStore((s) => s.timeIndex);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const currentTime = meta?.times?.[timeIndex] ?? field?.time ?? "";

  return (
    <header
      className="flex items-center justify-between px-4 py-2 border-b"
      style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}
    >
      <div className="flex items-center gap-3">
        <a
          href="#/landing"
          className="font-display text-lg font-bold tracking-wide"
          style={{
            color: "var(--accent-cyan)",
            textDecoration: "none",
          }}
          title="Back to home"
        >
          BrineView
        </a>
        <span className="eyebrow">Andaman Sea · Sumatra Trench</span>
      </div>

      <div className="flex items-center gap-4">
        {field && (
          <div
            className="font-data text-xs px-2 py-1 rounded"
            style={{ background: "#1b2b44" }}
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
