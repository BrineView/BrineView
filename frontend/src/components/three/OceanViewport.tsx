import { useEffect, useRef, useState } from "react";
import { OceanScene } from "./OceanScene";
import { useOceanStore } from "../../state/useOceanStore";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import LoadingOverlay from "../LoadingOverlay";
import ErrorBanner from "../ErrorBanner";
import Tooltip from "../Tooltip";

export default function OceanViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OceanScene | null>(null);

  const field = useOceanStore((s) => s.field);
  const fieldLoading = useOceanStore((s) => s.fieldLoading);
  const fieldError = useOceanStore((s) => s.fieldError);
  const colorscale = useOceanStore((s) => s.colorscale);
  const opacity = useOceanStore((s) => s.opacity);
  const showFloats = useOceanStore((s) => s.showFloats);
  const selectedFloatId = useOceanStore((s) => s.selectedFloatId);
  const floats = useOceanStore((s) => s.floats);
  const variable = useOceanStore((s) => s.variable);
  const depth = useOceanStore((s) => s.depth);
  const timeIndex = useOceanStore((s) => s.timeIndex);
  const loadField = useOceanStore((s) => s.loadField);
  const selectFloat = useOceanStore((s) => s.selectFloat);
  const loadFloatDetail = useOceanStore((s) => s.loadFloatDetail);

  const [hoverInfo, setHoverInfo] = useState<{ lat: number; lon: number; value: number | null } | null>(null);

  // Debounced values for fetching
  const debouncedVariable = useDebouncedValue(variable, 150);
  const debouncedDepth = useDebouncedValue(depth, 150);
  const debouncedTimeIndex = useDebouncedValue(timeIndex, 150);

  // Fetch field when debounced params change
  useEffect(() => {
    loadField(debouncedVariable, debouncedDepth, debouncedTimeIndex);
  }, [debouncedVariable, debouncedDepth, debouncedTimeIndex, loadField]);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new OceanScene(containerRef.current);
    sceneRef.current = scene;

    // Callbacks
    scene.onFloatClick = (id) => {
      selectFloat(id);
      loadFloatDetail(id);
    };
    scene.onHover = (info) => setHoverInfo(info);

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        scene.resize(width, height);
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update field on scene
  useEffect(() => {
    if (sceneRef.current && field) {
      sceneRef.current.setField(field, colorscale);
    }
  }, [field, colorscale]);

  // Update opacity
  useEffect(() => {
    sceneRef.current?.setOpacity(opacity);
  }, [opacity]);

  // Update depth-layer visibility based on selected depth
  useEffect(() => {
    sceneRef.current?.setActiveDepth(depth);
  }, [depth]);

  // Update floats
  useEffect(() => {
    sceneRef.current?.setFloats(floats);
  }, [floats]);

  // Update selected float
  useEffect(() => {
    sceneRef.current?.setSelectedFloatId(selectedFloatId);
  }, [selectedFloatId]);

  // Update show/hide
  useEffect(() => {
    sceneRef.current?.setShowFloats(showFloats);
  }, [showFloats]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      {fieldLoading && !field && <LoadingOverlay />}
      {fieldError && <ErrorBanner message={fieldError} />}
      {hoverInfo && (
        <Tooltip
          lat={hoverInfo.lat}
          lon={hoverInfo.lon}
          depth={debouncedDepth}
          value={hoverInfo.value}
          variable={variable}
        />
      )}
    </div>
  );
}
