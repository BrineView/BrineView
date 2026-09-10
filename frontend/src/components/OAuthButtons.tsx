import { useEffect, useState } from "react";
import { getAuthStatus } from "../api/auth";
import { useOceanStore } from "../state/useOceanStore";
import type { AuthStatus } from "../types/auth";

export default function OAuthButtons() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const loginWithGoogle = useOceanStore((s) => s.loginWithGoogle);
  const loginWithGithub = useOceanStore((s) => s.loginWithGithub);

  useEffect(() => {
    let alive = true;
    getAuthStatus()
      .then((s) => {
        if (alive) setStatus(s);
      })
      .catch(() => {
        if (alive) setStatus({ google: false, github: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  const googleEnabled = status?.google ?? false;
  const githubEnabled = status?.github ?? false;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={loginWithGoogle}
        disabled={!googleEnabled}
        title={
          googleEnabled
            ? "Sign in with Google"
            : "Google sign-in not configured (set GOOGLE_CLIENT_ID)"
        }
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "rgba(255, 255, 255, 0.06)",
          color: "var(--text-primary)",
          border: "1px solid #334155",
          cursor: googleEnabled ? "pointer" : "not-allowed",
        }}
        onMouseEnter={(e) => {
          if (googleEnabled) e.currentTarget.style.borderColor = "var(--accent-cyan)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#334155";
        }}
      >
        <svg width="16" height="16" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 45 43.6 40.6 43.6 40.6 41 42.3 41 42.3 39.9 43.6 41.9 40 42.3 20 43.6 20.1z" />
        </svg>
        {googleEnabled ? "Continue with Google" : "Google sign-in not configured"}
      </button>

      <button
        type="button"
        onClick={loginWithGithub}
        disabled={!githubEnabled}
        title={
          githubEnabled
            ? "Sign up / in with GitHub"
            : "GitHub sign-in not configured (set GITHUB_CLIENT_ID)"
        }
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "rgba(255, 255, 255, 0.06)",
          color: "var(--text-primary)",
          border: "1px solid #334155",
          cursor: githubEnabled ? "pointer" : "not-allowed",
        }}
        onMouseEnter={(e) => {
          if (githubEnabled) e.currentTarget.style.borderColor = "var(--accent-cyan)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#334155";
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
        {githubEnabled ? "Continue with GitHub" : "GitHub sign-in not configured"}
      </button>
    </div>
  );
}