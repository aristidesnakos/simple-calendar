/* ======================= iCalendar RRULE expander =======================
 *
 * Dependency-free expander for a useful subset of RFC 5545 recurrence rules.
 * Everything works in LOCAL WALL-CLOCK time: events are "YYYY-MM-DDTHH:mm"
 * strings with no timezone, and we treat any trailing "Z" on UNTIL/EXDATE
 * values as a wall-clock marker to strip (NOT a real UTC conversion).
 *
 * Public API:
 *   expandRecurrence(base, rule, opts) -> [{ start, end }, ...]
 *
 * See expandRecurrence below for the full contract.
 * ----------------------------------------------------------------------- */

import { parseLocal, toLocalISO, addDays, pad } from "./dates.js";

// Weekday codes in JS getDay() order (0 = Sunday ... 6 = Saturday).
const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const WEEKDAY_INDEX = WEEKDAY_CODES.reduce((acc, code, i) => {
  acc[code] = i;
  return acc;
}, {});

/* ----------------------------- RRULE parsing ---------------------------- */

// Parse "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE" into { FREQ, INTERVAL, BYDAY }.
// Keys are uppercased; values are kept as raw strings (caller splits lists).
function parseRRule(rrule) {
  const out = {};
  if (!rrule) return out;
  for (const part of String(rrule).split(";")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toUpperCase();
    const val = part.slice(eq + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

// Parse a BYDAY token like "MO", "3FR", "-1MO" into { ord, weekday }.
// `ord` is null for plain weekday tokens, otherwise the (possibly negative)
// ordinal. `weekday` is the JS getDay() index.
function parseByDayToken(token) {
  const m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(token.trim());
  if (!m) return null;
  return {
    ord: m[1] != null ? parseInt(m[1], 10) : null,
    weekday: WEEKDAY_INDEX[m[2]],
  };
}

// Parse a date or date-time value like "20261231T235959Z", "20261231T000000"
// or "20261231" into a local Date. Any trailing "Z" is stripped and the
// remaining digits are read as wall-clock components (no UTC conversion).
function parseICalDate(value) {
  if (!value) return null;
  const v = String(value).trim().replace(/Z$/i, "");
  const [datePart, timePart = ""] = v.split("T");
  const y = parseInt(datePart.slice(0, 4), 10);
  const mo = parseInt(datePart.slice(4, 6), 10);
  const d = parseInt(datePart.slice(6, 8), 10);
  const h = timePart.length >= 2 ? parseInt(timePart.slice(0, 2), 10) : 0;
  const mi = timePart.length >= 4 ? parseInt(timePart.slice(2, 4), 10) : 0;
  const s = timePart.length >= 6 ? parseInt(timePart.slice(4, 6), 10) : 0;
  return new Date(y, mo - 1, d, h, mi, s, 0);
}

/* --------------------------- EXDATE handling ---------------------------- */

// Build a Set of "comparison keys" for excluded occurrence starts. EXDATE
// strings may be comma-separated lists, so we flatten them all. We compare by
// local date + time down to the minute (the precision events carry), so we
// normalise each excluded value through a Date -> minute key.
function buildExdateSet(exdates) {
  const set = new Set();
  if (!Array.isArray(exdates)) return set;
  for (const raw of exdates) {
    if (!raw) continue;
    for (const token of String(raw).split(",")) {
      const d = parseICalDate(token);
      if (d) set.add(minuteKey(d));
    }
  }
  return set;
}

// Stable "YYYY-MM-DDTHH:mm" key (matches toLocalISO precision) for a Date.
function minuteKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* --------------------------- date arithmetic ---------------------------- */

// Add `n` calendar months to a Date, preserving the original day-of-month.
// Returns null if the target month does not have that day (e.g. Jan 31 -> Feb),
// so callers can SKIP rather than roll over into the next month.
function addMonthsKeepDay(d, n) {
  const targetMonthIndex = d.getMonth() + n;
  const year = d.getFullYear() + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const day = d.getDate();
  const candidate = new Date(
    year,
    month,
    day,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds()
  );
  // If JS rolled the day into the next month, this month lacks that day.
  if (candidate.getMonth() !== month) return null;
  return candidate;
}

// Number of days in a given (year, monthIndex).
function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Resolve a (possibly negative) BYMONTHDAY value to an absolute day-of-month
// for the given year/month, or null if it does not exist in that month.
function resolveMonthDay(year, monthIndex, dayNum) {
  const dim = daysInMonth(year, monthIndex);
  let day = dayNum;
  if (dayNum < 0) day = dim + dayNum + 1; // -1 => last day
  if (day < 1 || day > dim) return null;
  return day;
}

// All matching dates in a given month for a BYDAY token (handles ordinals).
// Returns an array of Date objects with the time copied from `time`.
function monthDatesForByDay(year, monthIndex, token, time) {
  const { ord, weekday } = token;
  const dim = daysInMonth(year, monthIndex);
  const matches = [];
  for (let day = 1; day <= dim; day++) {
    const d = new Date(year, monthIndex, day);
    if (d.getDay() === weekday) matches.push(day);
  }
  const make = (day) =>
    new Date(
      year,
      monthIndex,
      day,
      time.getHours(),
      time.getMinutes(),
      time.getSeconds()
    );
  if (ord == null) return matches.map(make); // every such weekday
  if (ord > 0) {
    const day = matches[ord - 1];
    return day != null ? [make(day)] : [];
  }
  // negative ordinal: -1 = last
  const day = matches[matches.length + ord];
  return day != null ? [make(day)] : [];
}

/* ------------------------- occurrence generation ------------------------ */

// Produce raw occurrence START Dates (chronological) for the given DTSTART and
// parsed rule, honouring COUNT / UNTIL / max and stopping once we pass
// rangeEnd. DTSTART is always the first occurrence (RFC 5545 §3.8.5.3).
//
// We generate from DTSTART forward (never before it) so COUNT can count
// occurrences that precede rangeStart; window filtering happens afterwards.
function generateStarts(dtstart, parsed, opts) {
  const { rangeEnd, max } = opts;
  const freq = (parsed.FREQ || "").toUpperCase();
  const interval = Math.max(1, parseInt(parsed.INTERVAL || "1", 10) || 1);
  const count = parsed.COUNT != null ? parseInt(parsed.COUNT, 10) : null;
  const until = parsed.UNTIL ? parseICalDate(parsed.UNTIL) : null;

  const byDay = parsed.BYDAY
    ? parsed.BYDAY.split(",").map(parseByDayToken).filter(Boolean)
    : null;
  const byMonthDay = parsed.BYMONTHDAY
    ? parsed.BYMONTHDAY.split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => !Number.isNaN(n))
    : null;

  const results = [];
  const seen = new Set(); // minute-keys already emitted, for dedup

  // Helper: try to accept a candidate start. Returns false when a hard stop
  // condition is hit (UNTIL exceeded / COUNT reached / max reached).
  const accept = (d) => {
    if (until && d.getTime() > until.getTime()) return false;
    if (d.getTime() >= dtstart.getTime()) {
      const key = minuteKey(d);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(new Date(d));
        if (count != null && results.length >= count) return false;
        if (results.length >= max) return false;
      }
    }
    return true;
  };

  // RFC 5545 §3.8.5.3: DTSTART is always the first occurrence, even when it
  // does not match the BYxxx pattern. Seed it up front so off-pattern starts
  // (e.g. a Tuesday DTSTART with BYDAY=MO,WE,FR) are still included.
  if (freq) {
    if (!accept(new Date(dtstart))) return results;
  }

  // Once results are past rangeEnd we can stop (ascending order) — UNLESS
  // COUNT is set, in which case we must keep counting until COUNT is reached.
  const pastWindow = (d) =>
    count == null && rangeEnd && d.getTime() > rangeEnd.getTime();

  if (!freq) {
    // No FREQ: treat as a single occurrence at DTSTART.
    results.push(new Date(dtstart));
    return results;
  }

  if (freq === "DAILY") {
    let cursor = new Date(dtstart);
    // hard iteration cap independent of `max` to avoid infinite loops
    for (let i = 0; i < max * 50 + 1000; i++) {
      if (!accept(cursor)) break;
      if (pastWindow(cursor)) break;
      cursor = addDays(cursor, interval);
    }
    return results;
  }

  if (freq === "WEEKLY") {
    // Anchor to the Sunday of DTSTART's week, then step interval weeks.
    const anchor = addDays(dtstart, -dtstart.getDay());
    anchor.setHours(
      dtstart.getHours(),
      dtstart.getMinutes(),
      dtstart.getSeconds(),
      0
    );
    // Which weekdays to emit: BYDAY if present, else DTSTART's own weekday.
    const weekdays = byDay
      ? byDay.map((t) => t.weekday).sort((a, b) => a - b)
      : [dtstart.getDay()];

    let weekStart = new Date(anchor);
    for (let w = 0; w < max * 10 + 1000; w++) {
      let stop = false;
      for (const wd of weekdays) {
        const d = addDays(weekStart, wd - weekStart.getDay());
        d.setHours(
          dtstart.getHours(),
          dtstart.getMinutes(),
          dtstart.getSeconds(),
          0
        );
        if (d.getTime() < dtstart.getTime()) continue; // never before DTSTART
        if (!accept(d)) {
          stop = true;
          break;
        }
      }
      if (stop) break;
      // Stop if the whole week is already beyond the window (no COUNT).
      if (pastWindow(addDays(weekStart, 6))) break;
      weekStart = addDays(weekStart, 7 * interval);
    }
    return results;
  }

  if (freq === "MONTHLY") {
    // Iterate month by month from DTSTART's month, stepping `interval` months.
    let monthCursor = new Date(
      dtstart.getFullYear(),
      dtstart.getMonth(),
      1,
      dtstart.getHours(),
      dtstart.getMinutes(),
      dtstart.getSeconds()
    );
    for (let m = 0; m < max * 5 + 1200; m++) {
      const year = monthCursor.getFullYear();
      const month = monthCursor.getMonth();
      let monthDates = [];

      if (byDay) {
        // BYDAY in MONTHLY: ordinal forms (3FR, -1MO) fully supported; a
        // plain weekday (e.g. "MO") yields every such weekday in the month.
        for (const token of byDay) {
          monthDates.push(...monthDatesForByDay(year, month, token, dtstart));
        }
      } else if (byMonthDay) {
        for (const dayNum of byMonthDay) {
          const day = resolveMonthDay(year, month, dayNum);
          if (day != null) {
            monthDates.push(
              new Date(
                year,
                month,
                day,
                dtstart.getHours(),
                dtstart.getMinutes(),
                dtstart.getSeconds()
              )
            );
          }
        }
      } else {
        // Same day-of-month as DTSTART; skip months lacking that day.
        const day = dtstart.getDate();
        if (day <= daysInMonth(year, month)) {
          monthDates.push(
            new Date(
              year,
              month,
              day,
              dtstart.getHours(),
              dtstart.getMinutes(),
              dtstart.getSeconds()
            )
          );
        }
      }

      monthDates.sort((a, b) => a.getTime() - b.getTime());
      let stop = false;
      for (const d of monthDates) {
        if (d.getTime() < dtstart.getTime()) continue;
        if (!accept(d)) {
          stop = true;
          break;
        }
      }
      if (stop) break;
      if (
        monthDates.length &&
        pastWindow(monthDates[monthDates.length - 1])
      )
        break;
      monthCursor = new Date(
        year,
        month + interval,
        1,
        dtstart.getHours(),
        dtstart.getMinutes(),
        dtstart.getSeconds()
      );
    }
    return results;
  }

  if (freq === "YEARLY") {
    // Step `interval` years. Without BYxxx, same month+day as DTSTART.
    // With BYMONTHDAY/BYDAY we apply them within DTSTART's month (best effort:
    // we do not implement BYMONTH, so the recurrence stays in DTSTART's month).
    let year = dtstart.getFullYear();
    const month = dtstart.getMonth();
    for (let y = 0; y < max + 1200; y++) {
      let yearDates = [];
      if (byDay) {
        for (const token of byDay) {
          yearDates.push(...monthDatesForByDay(year, month, token, dtstart));
        }
      } else if (byMonthDay) {
        for (const dayNum of byMonthDay) {
          const day = resolveMonthDay(year, month, dayNum);
          if (day != null) {
            yearDates.push(
              new Date(
                year,
                month,
                day,
                dtstart.getHours(),
                dtstart.getMinutes(),
                dtstart.getSeconds()
              )
            );
          }
        }
      } else {
        const day = dtstart.getDate();
        if (day <= daysInMonth(year, month)) {
          yearDates.push(
            new Date(
              year,
              month,
              day,
              dtstart.getHours(),
              dtstart.getMinutes(),
              dtstart.getSeconds()
            )
          );
        }
      }
      yearDates.sort((a, b) => a.getTime() - b.getTime());
      let stop = false;
      for (const d of yearDates) {
        if (d.getTime() < dtstart.getTime()) continue;
        if (!accept(d)) {
          stop = true;
          break;
        }
      }
      if (stop) break;
      if (yearDates.length && pastWindow(yearDates[yearDates.length - 1])) break;
      year += interval;
    }
    return results;
  }

  // Unknown FREQ: best effort -> just DTSTART.
  results.push(new Date(dtstart));
  return results;
}

/* ------------------------------- public API ----------------------------- */

/**
 * Expand a recurrence rule into concrete occurrences.
 *
 * @param {{start:string,end:string,allDay?:boolean}} base
 *        DTSTART/DTEND as local wall-clock ISO strings. The duration
 *        (parseLocal(end) - parseLocal(start)) is preserved for every
 *        occurrence.
 * @param {{rrule?:string|null, exdates?:string[]}} rule
 *        Raw RRULE value string and an array of raw EXDATE value strings
 *        (each EXDATE may itself be a comma-separated list).
 * @param {{rangeStart:Date, rangeEnd:Date, max?:number}} opts
 *        Window bounds (inclusive) and a safety cap on generated occurrences.
 * @returns {{start:string,end:string}[]}
 *        Occurrences whose START is within [rangeStart, rangeEnd], DTSTART
 *        always included, EXDATEs removed, sorted ascending, capped at max.
 */
export function expandRecurrence(base, rule, opts) {
  const { rangeStart, rangeEnd, max = 800 } = opts || {};
  const dtstart = parseLocal(base.start);
  const durationMs = parseLocal(base.end).getTime() - dtstart.getTime();

  const inWindow = (d) =>
    (!rangeStart || d.getTime() >= rangeStart.getTime()) &&
    (!rangeEnd || d.getTime() <= rangeEnd.getTime());

  const toOccurrence = (startDate) => ({
    start: toLocalISO(startDate),
    end: toLocalISO(new Date(startDate.getTime() + durationMs)),
  });

  const rrule = rule && rule.rrule ? String(rule.rrule).trim() : "";

  // No rule: just the base occurrence, if it falls within the window.
  if (!rrule) {
    return inWindow(dtstart) ? [toOccurrence(dtstart)] : [];
  }

  const parsed = parseRRule(rrule);
  const starts = generateStarts(dtstart, parsed, { rangeStart, rangeEnd, max });

  const exdateSet = buildExdateSet(rule && rule.exdates);

  // Filter by EXDATE, then by window, sort ascending, then cap at max.
  const occurrences = starts
    .filter((d) => !exdateSet.has(minuteKey(d)))
    .filter((d) => inWindow(d))
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, max)
    .map(toOccurrence);

  return occurrences;
}
