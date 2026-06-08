# SmartCal — Manual QA Test Checklist

Hand-run, in-the-browser tests to confirm SmartCal works before shipping.
Work top to bottom. Each test has **Steps** and an **Expected** result. Tick the
`- [ ]` box when it passes.

> Date assumptions in the examples below were written for a tester running this
> on or near **Sunday, June 7, 2026**. The natural-language parser is relative to
> "today", so if you run it on a different day, the *day-of-week* and *date* in
> the expected results will shift accordingly — the parsing *behaviour* is what
> you're checking, not the literal date. Where a result depends on today's date,
> it's called out.

---

## Setup

- [ ] **S1. Install & run the dev server**
  - **Steps:**
    1. In a terminal: `npm install`
    2. `npm run dev`
    3. Open the printed local URL (typically `http://localhost:5173`) in a modern browser (Chrome/Edge/Firefox/Safari).
  - **Expected:** Vite starts with no errors. The page loads a dark-themed calendar with a left **Sidebar** (SmartCal logo, "Quick add", a mini-month, "Calendars", "Subscriptions", and "Import .ics / Export .ics" buttons) and a main calendar area.

- [ ] **S2. Run the automated suite (sanity before manual testing)**
  - **Steps:** In a separate terminal: `npm test`
  - **Expected:** Vitest runs and **all suites pass** — `src/lib/nlp.test.js`, `src/lib/ics.test.js`, `src/lib/recur.test.js`. No failures.

> Tip: To start from a clean slate at any time, open DevTools → Application →
> Local Storage → delete keys `smartcal-data-v3` and `smartcal-view`, then
> reload. The app re-seeds its sample data.

---

## 1. Setup & first load

- [ ] **1.1. Seeded sample events appear**
  - **Steps:** On a fresh load (clear localStorage first if needed), look at the current week.
  - **Expected:** Sample events are visible in the **current week**, including:
    - "Client standup" (Mon, 9:30–10:00 AM)
    - "Deep work — RAG pipeline" (Mon, 10:30 AM–12:30 PM)
    - "Strength session" (Tue, 7–8 AM)
    - "Architecture review" (Wed, 2–3 PM)
    - "Olive grove maintenance" (Sat, **all-day** — shown in the all-day row at the top, not in the time grid)
  - The three seeded calendars **Work** (blue), **Personal** (green), **Family** (orange) appear under "Calendars".

- [ ] **1.2. Defaults to week view**
  - **Steps:** Look at the view switcher (top-right segmented control: Day / Week / Month) on a fresh load.
  - **Expected:** **Week** is the active (highlighted) segment, and the grid shows 7 day-columns.

---

## 2. Natural-language quick add (offline parser)

This parser is **fully offline** (no network). For each phrase:
1. Type it into the **Quick add** input in the sidebar (placeholder "Lunch with Sam Tuesday 1pm…").
2. Press **Enter** (or click the `>` button).
3. A **preview card** appears showing **title**, a **"when" line**, and a **calendar dropdown**, with **Add / Edit / Cancel** buttons.
4. Verify the preview matches **Expected**, then click **Add** and confirm the event lands on the right day/time in the grid (the app jumps the view to the event's day).

Time display format: on-the-hour times show as `1 PM`; with minutes as `1:30 PM`.

- [ ] **2.1. `Lunch with George at 1pm`**
  - **Expected:** Title **"Lunch with George"**; when = **today, 1 PM–2 PM** (default 1-hour duration). Lands today at 1 PM.

- [ ] **2.2. `team sync 3-4pm`**
  - **Expected:** Title **"Team sync"**; when = **today, 3 PM–4 PM**.

- [ ] **2.3. `standup 9:30 to 10:45`**
  - **Expected:** Title **"Standup"**; when = **today, 9:30 AM–10:45 AM**.

- [ ] **2.4. `gym at 7`**
  - **Expected:** Title **"Gym"**; when = **today, 7 AM–8 AM** (a bare `7` with no am/pm and the hour 7 stays as written → 7 AM).

- [ ] **2.5. `call at 3`**
  - **Expected:** Title **"Call"**; when = **today, 3 PM–4 PM** (a bare `3` in the 1–6 range is read as afternoon → 3 PM).

- [ ] **2.6. `focus block 2pm for 90 min`**
  - **Expected:** Title **"Focus block"**; when = **today, 2 PM–3:30 PM** (duration applied to start).

- [ ] **2.7. `dentist tomorrow 9am`**
  - **Expected:** Title **"Dentist"**; when = **tomorrow, 9 AM–10 AM**. Adding it jumps the view to tomorrow.

- [ ] **2.8. `review next tuesday`**
  - **Expected:** Title **"Review"**; **all-day** (no time given), dated **next Tuesday**. (Run on Sun Jun 7, 2026 → **Tue Jun 16, 2026**.) "next" always means the Tuesday of *next* week, not this week.

- [ ] **2.9. `flight Dec 24`**
  - **Expected:** Title **"Flight"**; **all-day**, dated **Dec 24** of the nearest upcoming year (Jun 7, 2026 → **Dec 24, 2026**).

- [ ] **2.10. `coffee with Amir @ Blue Bottle 9am`**
  - **Expected:** Title **"Coffee with Amir"**; when = **today, 9 AM–10 AM**; **location = "Blue Bottle"**. After Add, open the event and confirm the location field shows "Blue Bottle" (also visible inline on the event chip in the grid).

- [ ] **2.11. `Olive grove maintenance`** (no date/time at all)
  - **Expected:** Title **"Olive grove maintenance"**; **all-day**, dated **today**. Appears in the all-day row.

- [ ] **2.12. Preview — Edit button**
  - **Steps:** Type `Lunch with George at 1pm`, Enter, then click **Edit** on the preview.
  - **Expected:** The full **Event editor** modal opens, pre-filled (title "Lunch with George", today's date, 1:00–2:00 PM). You can change fields and **Save**; the event is created with your edits. The preview card is dismissed.

- [ ] **2.13. Preview — Cancel button**
  - **Steps:** Type `team sync 3-4pm`, Enter, then click **Cancel**.
  - **Expected:** Preview disappears, **no event is created**, and the typed text remains so you can retry/clear.

- [ ] **2.14. Preview — change target calendar**
  - **Steps:** Type any phrase, Enter, then use the **calendar dropdown** in the preview to pick "Personal", then **Add**.
  - **Expected:** Dropdown lists only your **user** calendars (not subscriptions). The added event uses the chosen calendar's color.

- [ ] **2.15. Unparseable input**
  - **Steps:** Type gibberish like `asdfghjkl` ... actually that parses as a title. Instead clear the box and press Enter with **empty** input.
  - **Expected:** Nothing happens on empty input. (Note: almost any non-empty phrase parses into at least an all-day event titled from the text — there is no hard "error" for normal words; the inline error "Couldn't read that…" is a defensive fallback.)

---

## 3. Views & navigation

- [ ] **3.1. Switch Day / Week / Month**
  - **Steps:** Click each segment in the top-right switcher.
  - **Expected:** Day shows a single day column; Week shows 7; Month shows a 6-row calendar grid. The title at top-left updates (e.g. "Sun, June 7" / "Jun 7 – Jun 13, 2026" / "June 2026").

- [ ] **3.2. Today button**
  - **Steps:** Navigate away with the arrows, then click **Today**.
  - **Expected:** View jumps back to the period containing today's date.

- [ ] **3.3. Prev/next arrows**
  - **Steps:** Click the `‹` and `›` arrows in Day, Week, and Month views.
  - **Expected:** Day moves ±1 day, Week moves ±7 days, Month moves ±1 month. Title updates accordingly.

- [ ] **3.4. Mini-month date pick**
  - **Steps:** In the sidebar mini-month, click a date; also use its up/down chevrons to change month.
  - **Expected:** Clicking a date sets the main view's anchor to that date (selected cell highlights). The chevrons page the mini-month without changing the main view until you click a day.

- [ ] **3.5. "now" line on today (Day/Week)**
  - **Steps:** In Day or Week view, look at today's column.
  - **Expected:** A horizontal **"now" line** with a small dot is drawn at the current time, only in today's column.

- [ ] **3.6. Scroll lands ~7am**
  - **Steps:** Switch into Week or Day view (or change the anchor date).
  - **Expected:** The time grid auto-scrolls so roughly **7 AM** is near the top of the visible area (not midnight).

- [ ] **3.7. Month "+N more" drill-in**
  - **Steps:** In Month view, find a day with more than 3 events (add a few to one day first if needed). Click the **"+N more"** link.
  - **Expected:** The view switches to **Day** view for that date, showing all events.

- [ ] **3.8. Month day-number drill-in**
  - **Steps:** In Month view, click the **date number** in a cell.
  - **Expected:** Switches to **Day** view for that date.

- [ ] **3.9. Month empty-cell create**
  - **Steps:** In Month view, click an empty area of a day cell (not on the number or an event chip).
  - **Expected:** The Event editor opens for a new event at **9:00 AM** on that day.

---

## 4. Create / edit / delete events

- [ ] **4.1. Click an empty time slot to create**
  - **Steps:** In Week or Day view, click an empty part of a day column at, say, ~11 AM.
  - **Expected:** Event editor opens titled "New event", with that day's date and a 1-hour slot snapped to the nearest 30 min from where you clicked. Title field is auto-focused.

- [ ] **4.2. "Event" button**
  - **Steps:** Click the **+ Event** button (top-right).
  - **Expected:** New-event editor opens for the current day at roughly the current hour (capped so it stays on the grid).

- [ ] **4.3. Fill in and save**
  - **Steps:** Set a title, pick a calendar, optionally set a location, choose start/end times, **Save**.
  - **Expected:** Modal closes, toast "Event added" appears, and the event renders in the grid in the calendar's color with a left color bar.

- [ ] **4.4. All-day toggle**
  - **Steps:** Open a new event, click the **All day** toggle on.
  - **Expected:** The start/end **time inputs disappear** (only a date remains). Saving creates an event in the **all-day row** at the top.

- [ ] **4.5. Click an empty all-day cell**
  - **Steps:** Click an empty spot in the **all-day row** of a day (Week or Day view).
  - **Expected:** New-event editor opens with **All day already enabled** for that day.

- [ ] **4.6. Reopen & edit**
  - **Steps:** Click an existing (non-subscribed) event, change its title/time/calendar/location, **Save**.
  - **Expected:** Modal title reads "Edit event". After save, toast "Event updated" and the event reflects the changes (color changes if you changed calendar).

- [ ] **4.7. Delete**
  - **Steps:** Open an existing event, click **Delete**.
  - **Expected:** Event removed from the grid, toast "Event deleted". (Note: the Delete button only appears when editing an existing event, not on a brand-new one.)

- [ ] **4.8. Auto-corrected end time**
  - **Steps:** Open an event and set the end time **earlier than or equal to** the start, then Save.
  - **Expected:** The app forces a sensible end (start + 60 min) rather than a zero/negative-length event.

---

## 5. Calendars

- [ ] **5.1. Add a calendar**
  - **Steps:** Click the **+** next to "Calendars". A browser **prompt** asks for a name. Enter e.g. "Side project", confirm.
  - **Expected:** A new calendar row appears with the next palette color and is visible by default. (Cancelling the prompt or entering blank adds nothing.)

- [ ] **5.2. Toggle visibility hides/shows events**
  - **Steps:** Click a calendar row (e.g. "Work") to toggle it off, then on again.
  - **Expected:** When off, the row dims, the eye icon becomes "eye-off", the swatch goes hollow, and **all that calendar's events disappear** from every view. Toggling on restores them.

- [ ] **5.3. Color swatches**
  - **Steps:** Compare each calendar's swatch color to its events.
  - **Expected:** Event chips/blocks use their calendar's color (left bar + tint). Each new calendar cycles through the palette.

---

## 6. Feed subscriptions (read-only .ics) — important

Real public test feeds you can use:
- **US public holidays (Google):**
  `https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics`
- Any **Google "Secret address in iCal format"** (Settings → your calendar → "Integrate calendar"), any **Apple `webcal://`** public-share link, or an **Outlook published** `.ics` URL also work.

> CORS note: SmartCal tries a **direct fetch first**, then falls back to a **CORS proxy** (`https://corsproxy.io/?url=...` by default). The Google holidays feed above usually needs the proxy, which the app uses automatically. If your network/firewall blocks the proxy too, the feed will show an error — that's environment, not an app bug; try a different network or feed.

- [ ] **6.1. Subscribe to a feed**
  - **Steps:** In "Subscriptions", click **+**. Paste the US holidays URL above. Optionally set a name. Click **Subscribe**.
  - **Expected:** A toast "Subscribed — syncing…". A new **feed row** appears under Subscriptions with a spinner, then status **"synced just now"**. A matching calendar (named after the host, or your custom name) appears and its events (holidays) render across the calendar.

- [ ] **6.2. Feed events are read-only**
  - **Steps:** Click one of the synced holiday events.
  - **Expected:** The editor opens in read-only mode: fields are disabled, there is **no Save and no Delete**, and a **"Synced — read only"** badge is shown. Only a **Close** button.

- [ ] **6.3. Manual refresh spins**
  - **Steps:** Click the small **refresh (circular arrow)** icon on the feed row (or "Refresh all" at the section header).
  - **Expected:** The refresh icon **spins** while syncing, then status returns to "synced just now". Events remain present.

- [ ] **6.4. Toggle feed visibility**
  - **Steps:** Click the feed's **color swatch**.
  - **Expected:** The feed's events hide; clicking again shows them. (Same hide/show behaviour as user calendars.)

- [ ] **6.5. Unsubscribe removes its events**
  - **Steps:** Click the **trash** icon on the feed row.
  - **Expected:** Toast "Unsubscribed". The feed, its calendar, and **all its events disappear**.

- [ ] **6.6. NEGATIVE test — bad URL must not blank existing events**
  - **Steps:**
    1. First subscribe successfully (e.g. holidays feed) and confirm events render.
    2. Subscribe to a **bad** URL: `https://example.com/nope.ics` (does not return iCalendar).
  - **Expected:** The bad feed's row shows an **error status** in red (e.g. "Couldn't reach the feed…" or "That URL didn't return an iCalendar feed"). Importantly, the **previously-synced holidays events are NOT removed**. Then: click **refresh** on the good feed — a failed/again-bad refresh of any feed must **keep** that feed's last-good events rather than blanking them. (To prove the "keep on failure" path on a single feed: subscribe to a good feed, then disconnect your network and hit refresh — status goes red but the events stay.)

---

## 7. Recurring events

Feeds and imported files with **RRULE** are expanded into multiple instances within a window (~31 days back to ~366 days forward).

- [ ] **7.1. Yearly recurrence from the holidays feed**
  - **Steps:** With the US holidays feed subscribed, navigate forward month by month over the coming year.
  - **Expected:** Recurring annual holidays appear on their dates across the year (not just once).

- [ ] **7.2. Weekly recurrence via a handmade import**
  - **Steps:** Create a file `weekly-test.ics` with the exact text below, then Import it (see Section 8 for the Import button). Adjust `DTSTART` to a Monday near today if you want the instances to fall in the current window (the example uses a fixed June 2026 Monday).
    ```
    BEGIN:VCALENDAR
    VERSION:2.0
    PRODID:-//QA//Weekly//EN
    CALSCALE:GREGORIAN
    BEGIN:VEVENT
    UID:weekly-standup@qa
    SUMMARY:Weekly QA standup
    DTSTART:20260608T090000
    DTEND:20260608T093000
    RRULE:FREQ=WEEKLY;COUNT=4
    END:VEVENT
    END:VCALENDAR
    ```
  - **Expected:** **Four** "Weekly QA standup" instances appear, one per week on consecutive Mondays at 9:00–9:30 AM (Jun 8, 15, 22, 29, 2026). Stepping the week view forward shows each instance on its week.

---

## 8. Import / Export

- [ ] **8.1. Export .ics**
  - **Steps:** Click **Export .ics** in the sidebar footer.
  - **Expected:** A file `smartcal.ics` downloads. Toast "Exported .ics". Open it in a text editor and confirm it contains `BEGIN:VCALENDAR` and `VEVENT` blocks for **your own** events. **Subscribed feed events are NOT included** (only events you own are exported).

- [ ] **8.2. Import .ics**
  - **Steps:** Create `import-test.ics` with the text below, then click **Import .ics** and choose it.
    ```
    BEGIN:VCALENDAR
    VERSION:2.0
    PRODID:-//QA//Import//EN
    BEGIN:VEVENT
    UID:imp-1@qa
    SUMMARY:Imported meeting
    LOCATION:Room 4
    DTSTART:20260610T140000
    DTEND:20260610T150000
    END:VEVENT
    BEGIN:VEVENT
    UID:imp-2@qa
    SUMMARY:Imported holiday
    DTSTART;VALUE=DATE:20260612
    END:VEVENT
    END:VCALENDAR
    ```
  - **Expected:** Toast "Imported 2 events". A new **"Imported"** calendar appears. "Imported meeting" shows Jun 10, 2:00–3:00 PM (location "Room 4"); "Imported holiday" shows as an **all-day** event on Jun 12. Imported events are **editable** (unlike feed events).

- [ ] **8.3. Round-trip check**
  - **Steps:** After importing, click **Export .ics**, then re-import the exported `smartcal.ics` into a freshly cleared instance (clear localStorage first).
  - **Expected:** The exported file re-imports with the same titles, times, all-day flags, and locations preserved (all under the "Imported" calendar).

- [ ] **8.4. Empty / non-event file**
  - **Steps:** Import a `.ics` file with a VCALENDAR header but no VEVENTs.
  - **Expected:** Toast "No events found in that file"; nothing added.

---

## 9. Persistence

- [ ] **9.1. Events + view survive reload**
  - **Steps:**
    1. Add a distinctive event (e.g. quick-add `persistence test 4pm`).
    2. Switch to **Month** view.
    3. **Reload** the page (F5).
  - **Expected:** After reload, the "Persistence test" event is **still there**, and the app opens in **Month** view (the chosen view is remembered via localStorage). Subscriptions and imported calendars also persist.

---

## 10. Programmatic API (browser console)

Open DevTools → Console. A global `window.smartcal` object is exposed.

- [ ] **10.1. `window.smartcal.getSnapshot()`**
  - **Expected:** Returns an object `{ view, date, calendars, events }` describing the current state — `view` is "day"/"week"/"month", `date` is the anchor as "YYYY-MM-DD", `calendars` is the full list, and `events` contains only events on **visible** calendars.

- [ ] **10.2. `window.smartcal.addEvent("dinner tomorrow 7pm")`**
  - **Expected:** Returns the created event object and the **event appears** in the grid (tomorrow 7:00–8:00 PM). Passing a full event object instead of a string also works.

- [ ] **10.3. `window.smartcal.parse("lunch friday 1pm")`**
  - **Expected:** Returns a parsed object (without adding anything), e.g. `{ title: "Lunch", date: "<this Friday>", start: "13:00", end: null, allDay: false, location: "" }`. Nothing is added to the calendar.

- [ ] **10.4. `window.smartcal.refresh()`**
  - **Expected:** Triggers a refresh of all subscribed feeds (feed rows spin and update their "synced" status). With no feeds subscribed it's a harmless no-op.

---

## 11. Known-limitation sanity checks (don't be surprised)

These are expected behaviours, not bugs:

- [ ] **11.1. Multi-day all-day events show only on their start day**
  - **Steps:** Import an all-day event spanning several days (e.g. `DTSTART;VALUE=DATE:20260615` / `DTEND;VALUE=DATE:20260618`).
  - **Expected:** It renders on its **start day only**, not stretched across the range. (Acceptable known limitation.)

- [ ] **11.2. Named-timezone (TZID) times shown as wall-clock**
  - **Steps:** Subscribe to / import a feed whose events use `DTSTART;TZID=...` (not a `Z` UTC suffix).
  - **Expected:** The time is displayed **exactly as written** (wall-clock), with no timezone offset conversion. UTC (`...Z`) times *are* converted to your local zone correctly; only named-TZID offsets are not resolved.

- [ ] **11.3. Very complex RRULEs may not fully expand**
  - **Steps:** Import an event using `BYSETPOS` or `BYMONTH`.
  - **Expected:** Common rules (DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT, UNTIL, BYDAY ordinals, BYMONTHDAY) expand correctly. Exotic combinations like `BYSETPOS` or `BYMONTH` may not expand to every instance — this is a known limitation.

---

## Automated tests

Run `npm test`. The Vitest suite covers the **natural-language parser**
(`nlp.test.js`), **ICS parse/export** (`ics.test.js`), and **recurrence
expansion** (`recur.test.js`). A green ship-ready build should report **all
suites passing** with no failures.
