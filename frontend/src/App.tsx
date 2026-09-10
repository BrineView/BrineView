import { useEffect } from "react";
import { useOceanStore } from "./state/useOceanStore";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import DashboardPage from "./pages/DashboardPage";
import AboutPage from "./pages/AboutPage";

export default function App() {
  const currentPage = useOceanStore((s) => s.currentPage);
  const authLoading = useOceanStore((s) => s.authLoading);
  const restoreSession = useOceanStore((s) => s.restoreSession);

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

  switch (currentPage) {
    case "landing":
      return <LandingPage />;
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
}