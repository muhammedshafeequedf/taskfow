const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function accessToken(): string {
  try {
    return localStorage.getItem('pm_access_token') || '';
  } catch {
    return '';
  }
}

/** Resolve media URLs and append JWT for authenticated upload serving. */
export function resolveMediaUrl(url: string): string {
  const base = API_BASE.replace(/\/api\/?$/, '') || 'http://localhost:5000';
  if (!url) return url;
  let absolute = url;
  if (url.startsWith('http://') || url.startsWith('https://')) absolute = url;
  else if (url.startsWith('/api/')) absolute = `${base}${url}`;
  else if (url.startsWith('/uploads/')) absolute = `${base}/api${url}`;
  else if (url.startsWith('/')) absolute = `${base}${url}`;
  else return url;

  if (!absolute.includes('/api/uploads/')) return absolute;
  const token = accessToken();
  if (!token) return absolute;
  try {
    const u = new URL(absolute);
    if (!u.searchParams.has('token')) u.searchParams.set('token', token);
    return u.toString();
  } catch {
    return absolute;
  }
}
