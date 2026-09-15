import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-center justify-center h-screen w-screen" style={{ background: "var(--ocean-bg)" }}>
            <div className="text-center p-8">
              <h2 className="text-xl font-bold mb-2" style={{ color: "#f87171" }}>
                Something went wrong
              </h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                {this.state.error?.message ?? "An unexpected error occurred"}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent-cyan)", color: "#000", border: "none", cursor: "pointer" }}
              >
                Reload page
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
