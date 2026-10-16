import ipaddr from "ipaddr.js";

/**
 * True only for globally routable unicast addresses. Everything else — private,
 * loopback, link-local (incl. cloud metadata 169.254.169.254), CGNAT, multicast,
 * reserved/documentation, unique-local, NAT64/6to4/Teredo — is rejected.
 * Deny-by-default: unknown ranges are not public.
 */
export function isPublicIp(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  let parsed = ipaddr.parse(address);
  if (parsed.kind() === "ipv6") {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) parsed = v6.toIPv4Address();
    // Deprecated IPv4-compatible ::/96 (e.g. ::7f00:1) is classed "unicast" by ipaddr.js.
    else if (v6.parts.slice(0, 6).every((x) => x === 0)) return false;
  }
  return parsed.range() === "unicast";
}

export function isIpLiteral(host: string): boolean {
  const h = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  return ipaddr.isValid(h);
}

export function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/** Hostnames that resolve to internal services in common environments. */
const BLOCKED_HOST_SUFFIXES = [
  "localhost",
  ".localhost",
  ".local",
  ".internal",
  ".localdomain",
  ".home.arpa",
  ".lan",
  ".intranet",
  ".corp",
];

export function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h === "metadata.google.internal" || h === "metadata") return true;
  return BLOCKED_HOST_SUFFIXES.some((s) => (s.startsWith(".") ? h.endsWith(s) : h === s));
}
