export default function LoadingOverlay() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: "rgba(11, 18, 32, 0.7)", zIndex: 20 }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--accent-cyan)", borderTopColor: "transparent" }}
        />
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading ocean data...
        </span>
      </div>
    </div>
  );
}
