import { isIP } from 'net';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

function isPrivateOrLocalIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (v === '::1' || v === '0:0:0:0:0:0:0:1') return true;
  if (v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd')) return true;
  if (v.includes('.')) {
    const parts = v.split('.').map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  return false;
}

/**
 * Reject URLs that would allow SSRF against localhost, private networks, or link-local metadata.
 * Only http(s) is allowed.
 */
export function assertSafeOutboundUrl(raw: string, label = 'URL'): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) throw new Error(`${label} is required`);
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label} is invalid`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must use http or https`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not include credentials`);
  }
  const host = parsed.hostname.toLowerCase();
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error(`${label} host is not allowed`);
  }
  if (host === 'metadata.google.internal' || host.endsWith('.internal')) {
    throw new Error(`${label} host is not allowed`);
  }
  const ipVersion = isIP(host);
  if (ipVersion && isPrivateOrLocalIp(host)) {
    throw new Error(`${label} resolves to a private or local address`);
  }
  // Block decimal/hex IP tricks for common loopback encodings
  if (/^\d+$/.test(host)) {
    throw new Error(`${label} host is not allowed`);
  }
  return parsed.toString();
}

export function escapeRegex(input: string): string {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
