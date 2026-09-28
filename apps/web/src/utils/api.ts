/**
 * Resolve API endpoint URL.
 * Supports VITE_API_URL environment variable for cross-origin deployments (e.g. Vercel -> Render)
 * and falls back to relative path for same-origin or proxy setups.
 */
function getApiBaseUrl(): string {
  try {
    const meta = import.meta as any;
    if (meta?.env?.VITE_API_URL) {
      return String(meta.env.VITE_API_URL).replace(/\/$/, '');
    }
  } catch {
    // fallback to relative path
  }
  return '';
}

export const API_BASE_URL = getApiBaseUrl();

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) return cleanPath;
  return `${API_BASE_URL}${cleanPath}`;
}
