import { useEffect, useState } from "react";
import { useOceanStore } from "../state/useOceanStore";
import { oauthErrorMessage } from "../lib/authErrors";
import OceanBackground from "../components/OceanBackground";
import OAuthButtons from "../components/OAuthButtons";

export default function LoginPage() {
  const loginWithEmail = useOceanStore((s) => s.loginWithEmail);
  const handleOAuthToken = useOceanStore((s) => s.handleOAuthToken);
  const setPage = useOceanStore((s) => s.setPage);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pick up a session from an OAuth callback redirect (?token=...) or an
  // OAuth error (?error=...), then clean the URL so a refresh doesn't re-run.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const error = params.get("error");

    if (token) {
      setSubmitting(true);
      handleOAuthToken(token)
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Sign-in failed")
        )
        .finally(() => setSubmitting(false));
    } else if (error) {
      setError(oauthErrorMessage(error) ?? "Sign-in failed");
    }

    if (token || error) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [handleOAuthToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password");
      return;
    }
    setSubmitting(true);
    try {
      await loginWithEmail(email.trim(), password);
      // success → store navigates to the dashboard
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden ocean-bg-animated">
      <OceanBackground />

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6">
        <div
          className="w-full max-w-sm rounded-xl p-8"
          style={{
            background: "rgba(17, 24, 39, 0.85)",
            border: "1px solid rgba(30, 41, 59, 0.8)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--accent-cyan)" }}>
              BrineView
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Welcome back — sign in to access OceanLens 3D
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={submitting}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                style={{ background: "#1e293b", border: "1px solid #334155", color: "var(--text-primary)" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-cyan)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#334155"; }}
              />
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={submitting}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                style={{ background: "#1e293b", border: "1px solid #334155", color: "var(--text-primary)" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-cyan)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#334155"; }}
              />
            </div>

            {error && (
              <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: "var(--accent-cyan)",
                color: "#000",
                border: "none",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!submitting) e.currentTarget.style.boxShadow = "0 0 25px rgba(6, 182, 212, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div
            className="flex items-center gap-3 my-5 text-[10px] uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            <span className="flex-1 h-px" style={{ background: "#334155" }} />
            or
            <span className="flex-1 h-px" style={{ background: "#334155" }} />
          </div>

          <OAuthButtons />

          <div className="mt-6 text-center">
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => setPage("signup")}
                disabled={submitting}
                className="transition-colors"
                style={{
                  color: "var(--accent-cyan)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Sign up
              </button>
            </p>
            <button
              onClick={() => setPage("landing")}
              className="text-xs transition-colors"
              style={{
                color: "var(--text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-cyan)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              ← Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}