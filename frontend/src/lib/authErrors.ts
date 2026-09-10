// Map backend OAuth redirect error codes to human-readable messages.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: "Sign-in failed. Please try again.",
  oauth_missing_email: "Could not retrieve your email from the provider.",
  oauth_state_mismatch: "Sign-in session expired. Please try again.",
  oauth_not_configured: "This provider is not configured on the server yet.",
  account_exists_with_email:
    "This email is already registered. Sign in with your email and password instead.",
  account_exists_with_google:
    "This email is already linked to a Google account. Sign in with Google.",
  account_exists_with_github:
    "This email is already linked to a GitHub account. Sign in with GitHub.",
};

export function oauthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return OAUTH_ERROR_MESSAGES[code] ?? "Sign-in failed. Please try again.";
}