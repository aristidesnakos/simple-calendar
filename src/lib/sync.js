/* ============================ calendar feed sync ============================
 *
 * Read-only subscriptions to remote .ics feeds (Google "secret address",
 * Apple/iCloud public calendars, Outlook published calendars, etc). Each feed
 * owns a calendar; refreshing replaces that calendar's events with whatever the
 * feed currently contains. No login, no backend — purely client-side.
 *
 * Best practices baked in (validated against Google/Apple behaviour):
 *  - webcal:// is rewritten to https:// (it's just a scheme hint, not a protocol).
 *  - Conditional GET (If-None-Match / If-Modified-Since): a 304 means "unchanged",
 *    so we skip re-parsing and keep the current events.
 *  - On any failure the caller keeps the last-good events — a transient network
 *    or CORS error must never blank the calendar.
 *  - Subscriptions are strictly read-only.
 *  - Recurring (RRULE) events are expanded into instances for display.
 *
 * CORS: most providers don't send Access-Control-Allow-Origin, so a direct
 * browser fetch fails. We try direct first (fast path, fully private) and fall
 * back to a configurable CORS proxy.
 * ===========================================================================*/
import { parseICS } from "./ics.js";
import { expandRecurrence } from "./recur.js";

// Override-able default. `{url}` is replaced with the encoded feed URL.
export const DEFAULT_PROXY = "https://corsproxy.io/?url={url}";

// webcal:// is just https for ICS feeds; normalize so fetch() accepts it.
export function normalizeFeedUrl(raw) {
  const u = (raw || "").trim();
  if (/^webcal:\/\//i.test(u)) return u.replace(/^webcal:\/\//i, "https://");
  return u;
}

function proxied(url, proxyTemplate) {
  const tpl = proxyTemplate || DEFAULT_PROXY;
  return tpl.includes("{url}")
    ? tpl.replace("{url}", encodeURIComponent(url))
    : tpl + encodeURIComponent(url);
}

async function request(target, { signal, etag, lastModified }) {
  const headers = {};
  if (etag) headers["If-None-Match"] = etag;
  if (lastModified) headers["If-Modified-Since"] = lastModified;
  const res = await fetch(target, { signal, redirect: "follow", headers });
  if (res.status === 304) return { unchanged: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  // Cross-origin servers must opt into exposing these; if absent we simply skip
  // conditional GET next time and re-download (still correct, just less cheap).
  return {
    text,
    etag: res.headers.get("etag") || null,
    lastModified: res.headers.get("last-modified") || null,
  };
}

/**
 * Fetch + parse one feed. Returns one of:
 *   { unchanged: true }                          (server replied 304)
 *   { events, etag, lastModified }               (fresh content)
 * or throws with a human-readable message. Tries a direct request, then proxy.
 */
export async function fetchFeed(rawUrl, { proxy, signal, etag, lastModified } = {}) {
  const url = normalizeFeedUrl(rawUrl);
  if (!/^https?:\/\//i.test(url))
    throw new Error("Not a valid http(s) or webcal URL");

  const validators = { signal, etag, lastModified };
  let r;
  try {
    r = await request(url, validators);
  } catch (directErr) {
    if (signal?.aborted) throw directErr;
    // Direct failed (almost always CORS) — retry through the proxy.
    try {
      r = await request(proxied(url, proxy), validators);
    } catch (proxyErr) {
      throw new Error(
        `Couldn't reach the feed (direct: ${directErr.message}; proxy: ${proxyErr.message})`
      );
    }
  }

  if (r.unchanged) return { unchanged: true };
  if (!/BEGIN:VCALENDAR/i.test(r.text))
    throw new Error("That URL didn't return an iCalendar feed");

  return { events: parseICS(r.text), etag: r.etag, lastModified: r.lastModified };
}

/**
 * Expand parsed ICS events: recurring (RRULE) events become one entry per
 * occurrence within [rangeStart, rangeEnd]; non-recurring events pass through.
 * Shared by feed sync and file import so both render recurrences identically.
 */
export function expandParsed(parsed, window) {
  const out = [];
  for (const p of parsed) {
    if (!p.rrule) {
      out.push(p);
      continue;
    }
    const occ = expandRecurrence(
      { start: p.start, end: p.end, allDay: p.allDay },
      { rrule: p.rrule, exdates: p.exdates || [] },
      window
    );
    for (const o of occ) out.push({ ...p, start: o.start, end: o.end });
  }
  return out;
}

/**
 * Map a feed's (already-expanded) events onto the app's event shape, tagged with
 * feedId and the feed's calendar so refresh can cleanly swap them. Ids include
 * the start time so recurrence instances (which share a UID) stay distinct and
 * stable across re-syncs.
 */
export function feedEventsToEvents(parsed, feed) {
  return parsed.map((p, i) => ({
    id: `feed:${feed.id}:${p.uid || p.title || i}:${p.start}`,
    calendarId: feed.calendarId,
    feedId: feed.id,
    readOnly: true,
    title: p.title,
    location: p.location || "",
    allDay: p.allDay,
    start: p.start,
    end: p.end,
  }));
}
