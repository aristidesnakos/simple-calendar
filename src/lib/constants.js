/* ============================ constants ============================ */
export const HOUR_PX = 52;
export const GRID_H = HOUR_PX * 24;

// Calendar swatch palette, reused for user calendars and imported feeds.
export const PALETTE = [
  "#6a93f0", "#46b89a", "#e0823f", "#c77dff",
  "#e0533b", "#d9a441", "#5fb3d4", "#9aa05a",
];

export const STORE_KEY = "smartcal-data-v3";
export const VIEW_KEY = "smartcal-view"; // remembers day/week/month between visits
// Auto-refresh feeds hourly. This is far more responsive than Google (which
// re-polls external .ics subscriptions every ~8–24h) while staying polite to
// providers; conditional GETs (ETag/If-Modified-Since) make most polls cheap.
export const REFRESH_MS = 60 * 60 * 1000;

// How far around "now" to expand recurring (RRULE) events into instances.
export const RECUR_BACK_DAYS = 31;
export const RECUR_FWD_DAYS = 366;
