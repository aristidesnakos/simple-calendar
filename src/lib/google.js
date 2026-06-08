/* ============================ Google Calendar (OAuth, read-only) ============
 *
 * A "Connect Google Calendar" source that slots into the same read-only feed
 * model as .ics subscriptions — no backend required. The flow:
 *
 *   1. Load Google Identity Services (GIS) and request an access token for the
 *      `calendar.readonly` scope. The user sees Google's own consent popup.
 *   2. List their calendars (calendarList) so they can pick which to subscribe.
 *   3. For each chosen calendar, list events with singleEvents=true so Google
 *      expands recurrences for us and hands back absolute instants — which means
 *      we get correct named-timezone handling for free (the one hard part of the
 *      raw .ics path), and no RRULE expansion of our own.
 *
 * The access token lives in memory only and is never persisted (a bearer token
 * in localStorage would be a real risk). On reload we silently re-acquire it
 * while the Google session is alive; if that needs a gesture we surface a
 * "reconnect" state. Tokens are short-lived (~1h) and refreshed on demand.
 *
 * Why browser-only is fine here: Google's Calendar API sends CORS headers, so
 * (unlike opaque .ics endpoints) we can call it straight from the page without a
 * proxy. The cost is the developer-side one-time OAuth client setup; see README.
 * ===========================================================================*/
import { toLocalISO, parseLocal, addDays } from "./dates.js";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const API = "https://www.googleapis.com/calendar/v3/";

/* ---------------------------------------------------------------- GIS loader */
let _gisPromise = null;
function loadGis() {
  if (_gisPromise) return _gisPromise;
  _gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () =>
      window.google?.accounts?.oauth2
        ? resolve()
        : reject(new Error("Google sign-in failed to initialize"));
    s.onerror = () => {
      _gisPromise = null; // allow a retry on a later attempt
      reject(new Error("Couldn't load Google sign-in (offline or blocked?)"));
    };
    document.head.appendChild(s);
  });
  return _gisPromise;
}

/* ----------------------------------------------------------- token manager */
let _clientId = null;
let _tokenClient = null;
let _token = null; // { value, expiry } — in-memory only, never persisted

/** Point the manager at an OAuth client id. Re-configuring with a different id
 *  resets any cached client/token. Safe to call repeatedly with the same id. */
export function configureGoogle(clientId) {
  const id = (clientId || "").trim() || null;
  if (id !== _clientId) {
    _clientId = id;
    _tokenClient = null;
    _token = null;
  }
}

export function isConfigured() {
  return !!_clientId;
}

function tokenClient() {
  if (!_tokenClient) {
    _tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: _clientId,
      scope: SCOPE,
      callback: () => {}, // replaced per-request in getToken()
    });
  }
  return _tokenClient;
}

/**
 * Return a valid access token, reusing the cached one until ~1 min before it
 * expires. `interactive: true` is used for the user-initiated Connect click
 * (Google may show the consent/account popup); `false` is the background path
 * used on load and during auto-refresh (silent while the session is alive).
 */
export function getToken({ interactive = false } = {}) {
  if (!_clientId) return Promise.reject(new Error("Google isn't configured yet"));
  if (_token && _token.expiry - 60_000 > Date.now()) {
    return Promise.resolve(_token.value);
  }
  return loadGis().then(
    () =>
      new Promise((resolve, reject) => {
        const tc = tokenClient();
        tc.callback = (resp) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          _token = {
            value: resp.access_token,
            expiry: Date.now() + (resp.expires_in || 3600) * 1000,
          };
          resolve(_token.value);
        };
        // error_callback fires for popup-closed / blocked / silent-denied cases.
        tc.error_callback = (err) =>
          reject(new Error(err?.message || err?.type || "Authorization failed"));
        try {
          // '' lets Google decide: silent when it can, consent the first time.
          tc.requestAccessToken({ prompt: interactive ? "" : "" });
        } catch (e) {
          reject(e);
        }
      })
  );
}

/** Drop the cached token and (best-effort) revoke it with Google. */
export function signOutGoogle() {
  const tok = _token?.value;
  _token = null;
  if (tok && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(tok, () => {});
    } catch {
      /* revoke is best-effort */
    }
  }
}

/* -------------------------------------------------------------- API helpers */
async function apiGet(path, token, params) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null) url.searchParams.set(k, v);
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    _token = null; // force a fresh token on the next attempt
    throw new Error("Google session expired — reconnect");
  }
  if (!res.ok) throw new Error(`Google API error ${res.status}`);
  return res.json();
}

/**
 * List the user's calendars (only ones they can read), mapped to a small shape:
 *   { id, name, primary, color }
 */
export async function listCalendars(token) {
  const out = [];
  let pageToken;
  do {
    const j = await apiGet("users/me/calendarList", token, {
      minAccessRole: "reader",
      maxResults: 250,
      pageToken,
    });
    for (const c of j.items || []) {
      out.push({
        id: c.id,
        name: c.summaryOverride || c.summary || c.id,
        primary: !!c.primary,
        color: c.backgroundColor || null,
      });
    }
    pageToken = j.nextPageToken;
  } while (pageToken);
  return out;
}

/**
 * List raw event resources for one calendar within [timeMin, timeMax].
 * singleEvents=true makes Google expand recurrences and return concrete
 * instances ordered by start time.
 */
export async function listEvents(token, calendarId, { timeMin, timeMax }) {
  const out = [];
  let pageToken;
  do {
    const j = await apiGet(`calendars/${encodeURIComponent(calendarId)}/events`, token, {
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      maxResults: 2500,
      timeMin,
      timeMax,
      pageToken,
    });
    out.push(...(j.items || []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return out;
}

/* ----------------------------------------------------------------- mapping */
/** RFC3339 instant (with offset, e.g. "2026-06-08T09:00:00-07:00") → the
 *  viewer's local wall-clock ISO. This is where named-TZID feeds "just work". */
export function rfc3339ToLocalISO(s) {
  return toLocalISO(new Date(s));
}

/**
 * Map one Google event resource onto the app's parsed-event shape:
 *   { uid, title, location, allDay, start, end }
 * Mirrors the .ics convention: all-day end.date is exclusive, so we store the
 * last *covered* day (DTEND − 1). Returns null for events with no usable start.
 */
export function googleEventToParsed(g) {
  const allDay = !!g.start?.date;
  let start, end;
  if (allDay) {
    start = `${g.start.date}T00:00`;
    // Google all-day end.date is exclusive (day after the last covered day).
    const endRaw = g.end?.date ? `${g.end.date}T00:00` : start;
    end = toLocalISO(addDays(parseLocal(endRaw), -1));
    if (parseLocal(end) < parseLocal(start)) end = start;
  } else if (g.start?.dateTime && g.end?.dateTime) {
    start = rfc3339ToLocalISO(g.start.dateTime);
    end = rfc3339ToLocalISO(g.end.dateTime);
  } else {
    return null;
  }
  return {
    uid: g.id || g.iCalUID || null,
    title: g.summary || "(no title)",
    location: g.location || "",
    allDay,
    start,
    end,
  };
}

/**
 * Fetch + map one Google-backed feed. Returns the same shape as sync.js's
 * fetchFeed fresh-content path ({ events, etag, lastModified }) so App's
 * applyFeedResult / expandParsed pipeline consumes it unchanged. The events are
 * already expanded, so expandParsed passes them straight through.
 *
 * `window` is { rangeStart, rangeEnd } Dates (App's recurWindow()).
 */
export async function fetchGoogleFeed(feed, window, { interactive = false } = {}) {
  const token = await getToken({ interactive });
  const timeMin = new Date(window.rangeStart).toISOString();
  const timeMax = new Date(window.rangeEnd).toISOString();
  const raw = await listEvents(token, feed.googleCalendarId, { timeMin, timeMax });
  const events = raw
    .filter((g) => g.status !== "cancelled")
    .map(googleEventToParsed)
    .filter(Boolean);
  return { events, etag: null, lastModified: null };
}
