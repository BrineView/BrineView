import { useEffect } from "react";
import { useAuthStore } from "./state/useAuthStore";
import { hashToPage, pageToHash } from "./lib/router";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import DashboardPage from "./pages/DashboardPage";
import AboutPage from "./pages/AboutPage";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  const currentPage = useAuthStore((s) => s.currentPage);
  const authLoading = useAuthStore((s) => s.authLoading);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const setPage = useAuthStore((s) => s.setPage);

  // Keep the page id in sync with the URL hash (deep links, back/forward).
  useEffect(() => {
    if (window.location.hash) {
      setPage(hashToPage(window.location.hash));
    }
    const onHash = () => setPage(hashToPage(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [setPage]);

  useEffect(() => {
    const h = pageToHash(currentPage);
    if (window.location.hash !== h) window.location.hash = h;
  }, [currentPage]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  // Remembered session check — avoid flashing the landing page while the
  // stored token is being validated against the backend.
  if (authLoading) {
    return (
      <div
        className="flex items-center justify-center h-screen w-screen"
        style={{ background: "var(--ocean-bg)" }}
      >
        <div className="text-center">
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: "var(--accent-cyan)" }}
          >
            BrineView
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Restoring your session…
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {(() => {
        switch (currentPage) {
          case "login":
            return <LoginPage />;
          case "signup":
            return <SignUpPage />;
          case "about":
            return <AboutPage />;
          case "dashboard":
            return <DashboardPage />;
          default:
            return <LandingPage />;
        }
      })()}
    </ErrorBoundary>
  );
}