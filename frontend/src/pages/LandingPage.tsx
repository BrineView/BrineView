import { useOceanStore } from "../state/useOceanStore";
import OceanBackground from "../components/OceanBackground";

export default function LandingPage() {
  const user = useOceanStore((s) => s.user);

  return (
    <main id="main" className="relative flex flex-col h-screen w-screen overflow-hidden ocean-bg-animated">
      {/* Interactive ocean background: waves, shimmer, bubbles */}
      <OceanBackground />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 text-center">
        {/* Logo */}
        <div className="mb-6">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm"
            style={{
              background: "rgba(6, 182, 212, 0.1)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              color: "var(--accent-cyan)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Smart India Hackathon 2026
          </div>
        </div>

        {/* Title */}
        <h1
          className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          Brine
          <span style={{ color: "var(--accent-cyan)" }}>View</span>
        </h1>

        <p
          className="text-lg md:text-xl mb-2"
          style={{ color: "var(--accent-cyan)" }}
        >
          Interactive 3D Ocean Explorer
        </p>

        <p
          className="max-w-xl text-sm md:text-base mb-10 leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          Explore the Indian Ocean in interactive 3D. Visualize temperature,
          salinity, currents, and chlorophyll across depth and time with
          real Argo float observations.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href={user ? "#/dashboard" : "#/login"}
            className="px-8 py-3 rounded-lg text-sm font-semibold"
            style={{
              background: "var(--accent-cyan)",
              color: "#000",
              border: "none",
              cursor: "pointer",
              textDecoration: "none",
              boxShadow: "0 0 30px rgba(6, 182, 212, 0.3)",
              transition: "box-shadow 0.2s ease, transform 0.2s ease",
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
            {user ? "Launch Dashboard" : "Get Started"}
          </a>

          <a
            href="#/about"
            className="px-8 py-3 rounded-lg text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--text-primary)",
              border: "1px solid rgba(148, 163, 184, 0.3)",
              cursor: "pointer",
              textDecoration: "none",
              transition: "border-color 0.2s ease, color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent-cyan)";
              e.currentTarget.style.color = "var(--accent-cyan)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.3)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
          >
            Learn More
          </a>
        </div>
      </div>

      {/* Bottom nav */}
      <div
        className="relative z-10 flex items-center justify-between px-8 py-4 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        <span>Problem Statement 26067</span>
        <span>Web-Based Interactive 3D Ocean Data Visualization</span>
      </div>
    </main>
  );
}
