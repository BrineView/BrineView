import { useEffect } from "react";
import { useAuthStore } from "../state/useAuthStore";
import { useDataStore } from "../state/useDataStore";
import TopBar from "../components/TopBar";
import ControlPanel from "../components/ControlPanel";
import OceanViewport from "../components/three/OceanViewport";
import DepthProfilePanel from "../components/DepthProfilePanel";
import UserDataModal from "../components/UserDataModal";
import Footer from "../components/Footer";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const setPage = useAuthStore((s) => s.setPage);
  const loadMeta = useDataStore((s) => s.loadMeta);
  const loadFloats = useDataStore((s) => s.loadFloats);
  const loadBathymetry = useDataStore((s) => s.loadBathymetry);

  useEffect(() => {
    // Auth guard — redirect unauthenticated visitors to the login screen
    if (!user) {
      setPage("login");
      return;
    }
    loadMeta();
    loadFloats();
    loadBathymetry();
  }, [user, setPage, loadMeta, loadFloats, loadBathymetry]);

  // Avoid flashing dashboard content while redirecting
  if (!user) return null;

  return (
    <main id="main" className="flex flex-col h-screen w-screen" style={{ background: "var(--ocean-bg)" }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <ControlPanel />
        <div className="relative flex-1 overflow-hidden">
          <OceanViewport />
          <DepthProfilePanel />
        </div>
      </div>
      <UserDataModal />
      <Footer />
    </main>
  );
}
