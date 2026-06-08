# SmartCal

A fast, single-view calendar for your browser — with an offline natural-language quick-add and read-only subscriptions to your existing calendar feeds, so everything shows up in one place.

SmartCal is a React + Vite app with a dark, keyboard-friendly UI and day / week / month views. It is **local-first**: there is no backend, and all your data lives in your browser.

---

## Features

- **Offline natural-language quick-add.** Type `Lunch with George at 1pm` and SmartCal parses it into an event preview you confirm (or tweak) before it is added. No API key, no network call — the parser runs entirely on-device.
- **Day / week / month views**, with your last-used view remembered between visits.
- **Calendar feed subscriptions.** Subscribe to remote `.ics` feeds — a Google "secret address in iCal format", an Apple/iCloud `webcal://` link, or an Outlook published `.ics` URL. Feeds **auto-refresh hourly** and can be refreshed manually (per feed or all at once).
- **`.ics` import / export.** Import an iCalendar file into an "Imported" calendar; export the events you own to `smartcal.ics`.
- **Recurring-event (RRULE) expansion.** Repeating events from feeds and imported files are expanded into individual instances for display.
- **Multiple color-coded calendars** with one-click show/hide. Subscriptions each get their own calendar too.
- **Overlap-aware day/week layout.** Concurrent events are packed into side-by-side lanes so nothing is hidden.
- **A small `window.smartcal` programmatic API** — a seam for a future chat / agent interface that can read the calendar and add events.

---

## Quick start

Requires **Node 18+** (the app uses `crypto.randomUUID`).

```bash
npm install      # install dependencies
npm run dev      # start the Vite dev server
npm run build    # production build to dist/
npm run preview  # preview the production build locally
npm test         # run the vitest suite
```

---

## How natural-language quick-add works

The quick-add box uses a dependency-free, **fully offline/on-device** heuristic parser. It is instant, costs nothing, and keeps everything private — no text ever leaves your browser. It scans the phrase for the highest-confidence date/time signals, removes the characters they consumed, and treats whatever survives as the title (plus an optional location).

| You type | SmartCal produces |
| --- | --- |
| `Lunch with George at 1pm` | "Lunch with George", today at 1:00 PM (1 hour default) |
| `Standup tomorrow 9am` | "Standup", tomorrow at 9:00 AM |
| `Review next tuesday 3-4pm` | "Review", next Tuesday, 3:00–4:00 PM |
| `Deep work for 90 min at 10am` | "Deep work", today, 10:00–11:30 AM |
| `Call Sam from 3 until 4pm` | "Call Sam", today, 3:00–4:00 PM |
| `Dentist Dec 24 @ Clinic` | "Dentist", Dec 24, location "Clinic" |
| `Yoga friday morning` | "Yoga", Friday at 9:00 AM |
| `Trip in 2 weeks` | "Trip", 14 days out, all-day |

It understands clock times (`1pm`, `9:30`, `13:00`, `noon`, `midnight`), ranges (`3-4pm`, `9:30 to 10:45`), durations (`for 90 min`, `for 1.5h`), coarse times of day (`morning` → 9am, `afternoon` → 2pm, `evening`/`tonight` → 7pm), relative dates (`today`, `tomorrow`, `day after tomorrow`, `yesterday`, `in 3 days`, `in 2 weeks`), weekdays (`tuesday`, `next tuesday`, `this fri`), explicit dates (`Dec 24`, `December 24, 2026`, `24 Dec`, `12/5`, `the 15th`), and a location after `@` or a trailing `at`.

**Ambiguous bare hours use a heuristic.** When no am/pm is given, `1`–`6` are read as afternoon/evening (`1` → 1:00 PM … `6` → 6:00 PM) and `7`–`12` stay as written (so `7` → 7:00 AM, `12` → noon). Prefixing with `at` (e.g. `at 7`) keeps the same heuristic; an explicit am/pm always wins.

If the parser can't make sense of a phrase it asks you to rephrase rather than guessing.

---

## Subscribing to calendars

Subscriptions are **read-only** — SmartCal never writes back to the provider. Each subscription becomes its own color-coded calendar that you can show/hide, and all feeds **auto-refresh hourly** (plus a manual refresh button per feed, and a refresh-all button).

Open the **Subscriptions** section in the sidebar, click **+**, paste the feed URL (and an optional name), and **Subscribe**. `https://` and `webcal://` URLs are both accepted (`webcal://` is just an iCal scheme hint and is rewritten to `https://`).

- **Google Calendar:** Settings → select your calendar → **Integrate calendar** → copy the **Secret address in iCal format**.
- **Apple / iCloud:** Share the calendar publicly, then copy the `webcal://` link it gives you.
- **Outlook:** Publish the calendar, then copy the published **ICS URL**.

Refreshes use conditional GETs (ETag / If-Modified-Since) so most polls are cheap, and a transient network/CORS error or an unchanged (`304`) response never blanks your already-synced events.

---

## The CORS proxy

Browsers can't fetch most providers' `.ics` files directly: those servers don't send the `Access-Control-Allow-Origin` header, so a cross-origin `fetch` is blocked. SmartCal handles this by **trying a direct fetch first** (the fast, fully private path) and, if that fails, **falling back to a CORS proxy**.

- The default proxy is `https://corsproxy.io/?url={url}` (the `{url}` placeholder is replaced with the encoded feed URL).
- The proxy is **configurable** via the persisted `data.proxy` field. If your template contains `{url}` it is substituted; otherwise the encoded URL is appended.
- **The proxy sees the feed URLs it fetches.** For production use or anything privacy-sensitive, **run your own proxy** and set `data.proxy` to it rather than relying on the public default.

---

## Programmatic API

SmartCal installs a small object on `window.smartcal`. It is intended as the seam for a future chat interface that can "see" the calendar and edit it — an agent can read the current view and add events without touching the DOM.

```js
// What the user currently sees.
window.smartcal.getSnapshot();
// → { view, date, calendars, events }  (events filtered to visible calendars)

// Parse a phrase without adding anything.
window.smartcal.parse("Lunch with George at 1pm");
// → { title, date, start, end, allDay, location } | null

// Add an event — accepts a natural-language phrase or a full event object.
window.smartcal.addEvent("Lunch with George at 1pm");
window.smartcal.addEvent({ calendarId: "personal", title: "Call", start: "2026-06-09T15:00", end: "2026-06-09T15:30", allDay: false });
// → the created event (with an assigned id)

// Re-sync all subscribed feeds.
window.smartcal.refresh();
```

---

## Architecture

A small, dependency-light module map (only runtime deps are React and `lucide-react` icons):

**Library (`src/lib/`)**

- `dates.js` — local wall-clock date/time helpers (formatting, `parseLocal`, week/month math). All times are stored as `YYYY-MM-DDTHH:mm` strings with no timezone suffix.
- `ics.js` — iCalendar parsing (`parseICS`) and export (`buildICS`), including folded-line unfolding and exclusive all-day `DTEND` handling.
- `nlp.js` — the offline natural-language parser (`parse`) and `parsedToEvent`.
- `recur.js` — the RFC 5545 RRULE expander (`expandRecurrence`).
- `sync.js` — feed fetching with direct→proxy fallback and conditional GET (`fetchFeed`), plus recurrence expansion and feed→event mapping.
- `layout.js` — overlap detection that assigns side-by-side lanes for the day/week grid (`layoutDay`).
- `storage.js` — an async key/value wrapper that prefers `window.storage` and falls back to `localStorage`.
- `constants.js` — palette, storage keys, refresh interval, and the recurrence window bounds.

**Components (`src/components/`)**

- `Sidebar.jsx` — quick-add box, mini-month, calendar/subscription lists, import/export.
- `TimeGrid.jsx` — the scrollable day/week grid with an all-day row and a "now" line.
- `MonthView.jsx` — the month grid with per-day event chips.
- `MiniMonth.jsx` — the compact month picker in the sidebar.
- `EventEditor.jsx` — the create/edit modal (read-only for synced feed events).

`src/App.jsx` wires these together and owns all state and persistence.

---

## Known limitations

These are honest, current constraints:

- **Recurrence (RRULE).** Supports `FREQ` of `DAILY` / `WEEKLY` / `MONTHLY` / `YEARLY`, plus `INTERVAL`, `COUNT`, `UNTIL`, `BYDAY` (weekly, and monthly/yearly ordinals like "3rd Friday" via `3FR` / `-1MO`), and `BYMONTHDAY`. It does **not** support `BYMONTH`, `BYSETPOS`, `BYWEEKNO`, `BYYEARDAY`, `WKST`, or `BYDAY` on `DAILY`. Instances are expanded over a window of roughly **−1 month to +12 months** around today (configurable in `constants.js`).
- **Timezones.** UTC times (`Z`) and floating local times are handled correctly. Named-`TZID` times are read as their **wall-clock value** — there is no offset conversion or `VTIMEZONE` parsing yet. (Most personal feeds use UTC or floating times, which this handles correctly.)
- **Multi-day all-day events.** The correct end date is computed (honoring the exclusive `DTEND` rule), but such events currently render **only on their start day** — there is no horizontal spanning across the grid yet.
- **Sync is read-only.** There is no write-back or two-way sync with providers.

---

## Roadmap

- Two-way OAuth sync with providers.
- Full `TZID` / `VTIMEZONE` support.
- RRULE `BYSETPOS` and `BYMONTH`.
- Multi-day spanning render across the day/week/month grid.
- Optional on-device LLM fallback for messy quick-add phrases.

---

## Tests

`npm test` runs the [vitest](https://vitest.dev/) suite, covering the natural-language parser (`src/lib/nlp.test.js`), ICS parsing/export (`src/lib/ics.test.js`), and recurrence expansion (`src/lib/recur.test.js`).

A manual QA checklist lives in `TESTING.md`.
