import type { PageId } from "../state/useAuthStore";

const VALID_PAGES: PageId[] = ["landing", "login", "signup", "dashboard", "about"];

/** Read the current page from a location hash like "#/dashboard". */
export function hashToPage(hash: string): PageId {
  const clean = hash.replace(/^#\/?/, "").split("?")[0].split("/")[0];
  return (VALID_PAGES as string[]).includes(clean) ? (clean as PageId) : "landing";
}

/** Bump a page id onto the URL hash so every page is deep-linkable. */
export function pageToHash(page: PageId): string {
  return `#/${page}`;
}