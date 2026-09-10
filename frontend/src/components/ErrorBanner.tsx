interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      className="absolute top-3 left-3 right-3 px-4 py-3 rounded text-sm flex items-center justify-between"
      style={{
        background: "rgba(220, 38, 38, 0.15)",
        border: "1px solid #dc2626",
        color: "#fca5a5",
        zIndex: 20,
      }}
    >
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-3 px-3 py-1 rounded text-xs font-semibold"
          style={{ background: "#dc2626", color: "#fff", border: "none", cursor: "pointer" }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
