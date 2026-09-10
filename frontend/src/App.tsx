import { useEffect } from "react";
import { useOceanStore } from "./state/useOceanStore";
import TopBar from "./components/TopBar";
import ControlPanel from "./components/ControlPanel";
import OceanViewport from "./components/three/OceanViewport";
import DepthProfilePanel from "./components/DepthProfilePanel";
import Footer from "./components/Footer";

export default function App() {
  const loadMeta = useOceanStore((s) => s.loadMeta);
  const loadFloats = useOceanStore((s) => s.loadFloats);

  useEffect(() => {
    loadMeta();
    loadFloats();
  }, [loadMeta, loadFloats]);

  return (
    <div className="flex flex-col h-screen w-screen" style={{ background: "var(--ocean-bg)" }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <ControlPanel />
        <div className="relative flex-1 overflow-hidden">
          <OceanViewport />
          <DepthProfilePanel />
        </div>
      </div>
      <Footer />
    </div>
  );
}
