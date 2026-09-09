// Address normalization for the wall. Two spellings of the same page must
// produce the same key, so the same story cannot be submitted twice on one
// date, and so two sources that are the same page do not count as two.
//
// What it does: lowercase the host, drop a leading www, force https, drop the
// fragment, remove every parameter starting utm_, remove the tracking
// parameters listed below, remove s only when the host is x.com or
// twitter.com, sort what is left, strip one trailing slash.
//
// What it never does: remove a parameter that changes which page you see. A
// YouTube v, a search q, a page number, an article id in the query string,
// all stay. When in doubt a parameter stays, because two keys for one page is
// a duplicate that a person can see and fix, and one key for two pages is a
// story that silently cannot be submitted.

/** Parameters that only say where a click came from. Removed on every host. */
const TRACKING = new Set([
  "fbclid", "gclid", "msclkid", "igshid", "mc_cid", "mc_eid",
  "ref", "ref_src", "cmpid", "si", "spm",
]);

/** Hosts on which s is a share tracking parameter and nothing else. */
const S_IS_TRACKING = new Set(["x.com", "twitter.com"]);

export function normalizeUrl(raw: string): string {
  const parsed = new URL(raw.trim());

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`wall: not a web address: ${raw}`);
  }

  let host = parsed.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);

  const kept: Array<[string, string]> = [];
  for (const [name, value] of parsed.searchParams) {
    const key = name.toLowerCase();
    if (key.startsWith("utm_")) continue;
    if (TRACKING.has(key)) continue;
    if (key === "s" && S_IS_TRACKING.has(host)) continue;
    kept.push([name, value]);
  }
  kept.sort((a, b) => {
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
    return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
  });
  const query = new URLSearchParams(kept).toString();

  // The default port is dropped by the URL parser for the scheme it was
  // given, so http://host:80 becomes host with no port. Any other explicit
  // port is part of which page you see and stays.
  const port = parsed.port && parsed.port !== "80" && parsed.port !== "443" ? `:${parsed.port}` : "";

  let path = parsed.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "/") path = "";

  return `https://${host}${port}${path}${query ? `?${query}` : ""}`;
}

/** The outlet a page belongs to, as its host with no www. */
export function outletOf(raw: string): string {
  const host = new URL(raw.trim()).hostname.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}
