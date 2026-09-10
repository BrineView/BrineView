import { useOceanStore } from "../state/useOceanStore";
import OceanBackground from "../components/OceanBackground";

export default function AboutPage() {
  const setPage = useOceanStore((s) => s.setPage);
  const user = useOceanStore((s) => s.user);
  const logout = useOceanStore((s) => s.logout);

  const features = [
    {
      title: "3D Ocean Visualization",
      desc: "Interactive Three.js scene with orbit controls — rotate, pan, and zoom into Indian Ocean data across latitude, longitude, and depth.",
    },
    {
      title: "Multi-Variable Analysis",
      desc: "Switch between temperature, salinity, ocean currents (U/V), and chlorophyll concentration with dedicated color palettes for each.",
    },
    {
      title: "Depth Profiling",
      desc: "Drag the depth slider from surface to 1000m abyssal zones. Each layer reveals different ocean characteristics with plain-language labels.",
    },
    {
      title: "Argo Float Observations",
      desc: "Toggle real-time Argo float markers on the surface. Click any float to compare observed depth profiles against model predictions.",
    },
    {
      title: "Time Series Playback",
      desc: "Step through 8 time intervals to observe how ocean properties evolve over the course of a day.",
    },
    {
      title: "Model vs Observation",
      desc: "Directly compare satellite model output with in-situ Argo float measurements to assess prediction accuracy.",
    },
  ];

  return (
    <div className="relative flex flex-col min-h-screen w-screen ocean-bg-animated">
      {/* Interactive ocean background */}
      <OceanBackground />

      {/* Navigation bar */}
      <nav
        className="relative z-10 flex items-center justify-between px-8 py-4"
        style={{ borderBottom: "1px solid rgba(30, 41, 59, 0.5)" }}
      >
        <div className="flex items-center gap-6">
          <button
            onClick={() => setPage("landing")}
            className="text-lg font-bold"
            style={{ color: "var(--accent-cyan)", background: "none", border: "none", cursor: "pointer" }}
          >
            BrineView
          </button>
          <button
            onClick={() => setPage(user ? "dashboard" : "login")}
            className="text-xs transition-colors"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            Dashboard
          </button>
        </div>
        {user && (
          <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>{user.name}</span>
            <button
              onClick={logout}
              className="px-2 py-1 rounded text-xs"
              style={{ color: "#f87171", background: "rgba(248, 113, 113, 0.1)", border: "none", cursor: "pointer" }}
            >
              Logout
            </button>
          </div>
        )}
      </nav>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center px-8 py-16">
        <h1
          className="text-4xl md:text-5xl font-bold text-center mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          About <span style={{ color: "var(--accent-cyan)" }}>BrineView</span>
        </h1>

        <p
          className="max-w-2xl text-center text-sm md:text-base leading-relaxed mb-12"
          style={{ color: "var(--text-muted)" }}
        >
          BrineView (OceanLens 3D) is a browser-native 3D workspace built for
          Smart India Hackathon 2026 (Problem Statement 26067). It visualizes
          Indian Ocean model fields together with real point observations from
          Argo floats, across depth and time.
        </p>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full mb-16">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-xl transition-all"
              style={{
                background: "rgba(17, 24, 39, 0.7)",
                border: "1px solid rgba(30, 41, 59, 0.6)",
                backdropFilter: "blur(8px)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(6, 182, 212, 0.4)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(30, 41, 59, 0.6)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--accent-cyan)" }}>
                {f.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Architecture note */}
        <div
          className="max-w-2xl w-full p-6 rounded-xl text-xs leading-relaxed"
          style={{
            background: "rgba(17, 24, 39, 0.7)",
            border: "1px solid rgba(30, 41, 59, 0.6)",
            backdropFilter: "blur(8px)",
            color: "var(--text-muted)",
          }}
        >
          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--accent-cyan)" }}>
            Technical Architecture
          </h3>
          <p className="mb-2">
            <strong style={{ color: "var(--text-primary)" }}>Frontend:</strong>{" "}
            React + TypeScript, Three.js (OrbitControls, CanvasTexture surface),
            Chart.js depth-profiles, Zustand state management.
          </p>
          <p className="mb-2">
            <strong style={{ color: "var(--text-primary)" }}>Backend:</strong>{" "}
            FastAPI + Uvicorn, xarray + netCDF4, dependency-injected data adapter.
          </p>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>Data:</strong>{" "}
            Synthetic Indian Ocean grid (lat 0–25°N, lon 60–95°E) with 20 mock
            Argo floats. Swappable adapter for future INCOIS and Argo GDAC integration.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12">
          <button
            onClick={() => setPage(user ? "dashboard" : "login")}
            className="px-8 py-3 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: "var(--accent-cyan)",
              color: "#000",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 0 30px rgba(6, 182, 212, 0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 0 50px rgba(6, 182, 212, 0.5)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 0 30px rgba(6, 182, 212, 0.3)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {user ? "Open Dashboard" : "Sign In to Explore"}
          </button>
        </div>
      </div>
    </div>
  );
}
