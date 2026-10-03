/**
 * Resolve API endpoint URL.
 * Supports:
 * 1. VITE_API_URL environment variable for cross-origin builds
 * 2. User-configured localStorage override (mailtrace_api_url)
 * 3. Automatic Cloud Render backend fallback when deployed on Vercel or any non-localhost domain
 * 4. Local fallback for dev proxy
 */
function getApiBaseUrl(): string {
  try {
    const meta = import.meta as any;
    if (meta?.env?.VITE_API_URL) {
      return String(meta.env.VITE_API_URL).replace(/\/$/, '');
    }
  } catch {
    // fallback
  }

  if (typeof window !== 'undefined') {
    try {
      const custom = window.localStorage?.getItem('mailtrace_api_url');
      if (custom) return custom.replace(/\/$/, '');
    } catch {
      // ignore
    }

    if (window.location && window.location.hostname) {
      const host = window.location.hostname;
      if (host !== 'localhost' && host !== '127.0.0.1') {
        return 'https://mailtrace-api-7bx5.onrender.com';
      }
    }
  }

  return '';
}

export const API_BASE_URL = getApiBaseUrl();

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) return cleanPath;
  return `${API_BASE_URL}${cleanPath}`;
}
