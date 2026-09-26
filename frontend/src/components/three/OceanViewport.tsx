import { useEffect, useRef, useState } from "react";
import { OceanScene } from "./OceanScene";
import { useDataStore } from "../../state/useDataStore";
import { useOceanStore } from "../../state/useOceanStore";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { toFieldResponse } from "../../types/ocean";
import LoadingOverlay from "../LoadingOverlay";
import ErrorBanner from "../ErrorBanner";
import Tooltip from "../Tooltip";

export default function OceanViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OceanScene | null>(null);

  const field = useDataStore((s) => s.field);
  const fieldLoading = useDataStore((s) => s.fieldLoading);
  const fieldError = useDataStore((s) => s.fieldError);
  const colorscale = useOceanStore((s) => s.colorscale);
  const opacity = useOceanStore((s) => s.opacity);
  const showFloats = useOceanStore((s) => s.showFloats);
  const showGliders = useOceanStore((s) => s.showGliders);
  const showAnomalies = useOceanStore((s) => s.showAnomalies);
  const showAssimilated = useOceanStore((s) => s.showAssimilated);
  const selectedFloatId = useDataStore((s) => s.selectedFloatId);
  const floats = useDataStore((s) => s.floats);
  const gliders = useDataStore((s) => s.gliders);
  const floatMetrics = useDataStore((s) => s.floatMetrics);
  const assimilated = useDataStore((s) => s.assimilated);
  const bathymetry = useDataStore((s) => s.bathymetry);
  const variable = useOceanStore((s) => s.variable);
  const depth = useOceanStore((s) => s.depth);
  const timeIndex = useOceanStore((s) => s.timeIndex);
  const loadField = useDataStore((s) => s.loadField);
  const selectFloat = useDataStore((s) => s.selectFloat);
  const loadFloatDetail = useDataStore((s) => s.loadFloatDetail);
  const selectGlider = useDataStore((s) => s.selectGlider);
  const loadGliderDetail = useDataStore((s) => s.loadGliderDetail);

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
    scene.onGliderClick = (id) => {
      selectGlider(id);
      loadGliderDetail(id);
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

  // Update gliders
  useEffect(() => {
    sceneRef.current?.setGliders(gliders);
  }, [gliders]);

  // Animate float + glider positions along their tracks
  useEffect(() => {
    sceneRef.current?.setTimeIndex(timeIndex);
  }, [timeIndex]);

  // Anomaly highlighting (AI detector output)
  useEffect(() => {
    const ids = floatMetrics.filter((m) => m.anomaly).map((m) => m.id);
    sceneRef.current?.setAnomalyIds(ids, showAnomalies);
  }, [floatMetrics, showAnomalies]);

  // Assimilation-corrected field overlay
  useEffect(() => {
    sceneRef.current?.setAssimilated(assimilated ? toFieldResponse(assimilated) : null, colorscale);
  }, [assimilated, colorscale]);
  useEffect(() => {
    sceneRef.current?.setShowAssimilated(showAssimilated);
  }, [showAssimilated]);

  // Update bathymetry terrain
  useEffect(() => {
    if (sceneRef.current && bathymetry) {
      sceneRef.current.setBathymetry(bathymetry);
    }
  }, [bathymetry]);

  // Update selected float
  useEffect(() => {
    sceneRef.current?.setSelectedFloatId(selectedFloatId);
  }, [selectedFloatId]);

  // Update show/hide
  useEffect(() => {
    sceneRef.current?.setShowFloats(showFloats);
  }, [showFloats]);
  useEffect(() => {
    sceneRef.current?.setShowGliders(showGliders);
  }, [showGliders]);

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
