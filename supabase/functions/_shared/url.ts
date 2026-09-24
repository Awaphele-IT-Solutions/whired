// Provider base URLs are entered by an admin and fetched by the server, so
// they are restricted to public HTTPS hosts. This blocks the classic SSRF
// targets (localhost, private and link-local IPs, cloud metadata) even if an
// admin account were compromised.

export function validateBaseUrl(input: string): { ok: true; url: string } | { ok: false; reason: string } {
  let u: URL;
  try {
    u = new URL(String(input).trim());
  } catch {
    return { ok: false, reason: "Base URL is not a valid URL." };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "Base URL must use https." };
  if (u.username || u.password) return { ok: false, reason: "Base URL must not contain credentials." };
  if (u.port && u.port !== "443") return { ok: false, reason: "Base URL must use the default HTTPS port." };

  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "Base URL must be a public host." };
  }
  // Reject IP literals outright (IPv4 dotted, IPv6 in brackets, decimal/hex forms).
  if (host.startsWith("[") || /^[0-9.]+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) {
    return { ok: false, reason: "Use a hostname, not an IP address." };
  }
  if (!host.includes(".")) return { ok: false, reason: "Base URL must be a public host." };

  return { ok: true, url: (u.origin + u.pathname).replace(/\/+$/, "") };
}
