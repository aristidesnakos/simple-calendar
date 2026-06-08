/* ============================ ICS parsing / export ============================ */
import { pad, parseLocal, toLocalISO, addMinutesISO, addDays } from "./dates.js";

export function parseICSDate(val, raw) {
  const isDate = /VALUE=DATE(?!-TIME)/.test(raw) || /^\d{8}$/.test(val);
  if (isDate && /^\d{8}/.test(val)) {
    const y = val.slice(0, 4),
      mo = val.slice(4, 6),
      d = val.slice(6, 8);
    return { iso: `${y}-${mo}-${d}T00:00`, allDay: true };
  }
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (z === "Z") {
    // UTC instant — convert to the viewer's local wall clock.
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, 0));
    return { iso: toLocalISO(dt), allDay: false };
  }
  // Floating or TZID time: keep the wall-clock value as written. (We don't yet
  // resolve VTIMEZONE offsets; the vast majority of personal feeds use UTC "Z"
  // or floating times, which this handles correctly.)
  return { iso: `${y}-${mo}-${d}T${h}:${mi}`, allDay: false };
}

export const unescapeICS = (s) =>
  (s || "")
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();

export function parseICS(text) {
  // Unfold folded lines (RFC 5545: a CRLF + space/tab continues the prior line).
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);
  const out = [];
  for (const b of blocks) {
    const body = b.split("END:VEVENT")[0];
    const lines = body.split(/\r?\n/);
    let summary = "",
      location = "",
      uid = "",
      ds = null,
      de = null,
      dsRaw = "",
      deRaw = "",
      rrule = "";
    const exdates = [];
    for (const line of lines) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const left = line.slice(0, idx);
      const val = line.slice(idx + 1).trim();
      const name = left.split(";")[0].toUpperCase();
      if (name === "SUMMARY") summary = val;
      else if (name === "LOCATION") location = val;
      else if (name === "UID") uid = val;
      else if (name === "RRULE") rrule = val;
      else if (name === "EXDATE") exdates.push(val);
      else if (name === "DTSTART") {
        ds = val;
        dsRaw = left;
      } else if (name === "DTEND") {
        de = val;
        deRaw = left;
      }
    }
    if (!ds) continue;
    const s = parseICSDate(ds, dsRaw);
    if (!s) continue;
    const e = de ? parseICSDate(de, deRaw) : null;

    let end;
    if (s.allDay) {
      // All-day DTEND is *exclusive* (the day after the last covered day), so
      // the last visible day is DTEND − 1. Missing DTEND ⇒ single day.
      end = e && e.allDay ? toLocalISO(addDays(parseLocal(e.iso), -1)) : s.iso;
      if (parseLocal(end) < parseLocal(s.iso)) end = s.iso;
    } else {
      end = e ? e.iso : addMinutesISO(s.iso, 60);
    }

    out.push({
      uid: unescapeICS(uid) || null,
      title: unescapeICS(summary) || "(no title)",
      location: unescapeICS(location),
      allDay: s.allDay,
      start: s.iso,
      end,
      rrule: rrule || null,
      exdates,
    });
  }
  return out;
}

const icsDT = (iso) => {
  const d = parseLocal(iso);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(
    d.getHours()
  )}${pad(d.getMinutes())}00`;
};

const esc = (s) => (s || "").replace(/[\n,;]/g, " ");

export function buildICS(events) {
  const L = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SmartCal//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const ev of events) {
    L.push("BEGIN:VEVENT", `UID:${ev.id}@smartcal`);
    if (ev.allDay) {
      const day = (iso) => iso.slice(0, 10).replace(/-/g, "");
      // DTEND for all-day is exclusive, so write the day *after* the last day.
      const endExclusive = day(toLocalISO(addDays(parseLocal(ev.end), 1)));
      L.push(`DTSTART;VALUE=DATE:${day(ev.start)}`, `DTEND;VALUE=DATE:${endExclusive}`);
    } else {
      L.push(`DTSTART:${icsDT(ev.start)}`, `DTEND:${icsDT(ev.end)}`);
    }
    L.push(`SUMMARY:${esc(ev.title)}`);
    if (ev.location) L.push(`LOCATION:${esc(ev.location)}`);
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}
