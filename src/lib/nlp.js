/* ============================ natural language parsing ============================
 *
 * A dependency-free, offline parser that turns a short phrase like
 * "lunch with George at 1pm" into a calendar event. It runs instantly, costs
 * nothing, and keeps everything on-device.
 *
 * Strategy: scan the phrase for the highest-confidence date/time signals,
 * "blank out" the characters they consumed, and treat whatever text survives as
 * the title (+ an optional location). Working on character spans means a token
 * is never interpreted twice and the leftover title comes out clean.
 *
 * The exported shape matches what parsedToEvent() consumes:
 *   { title, date: "YYYY-MM-DD", start: "HH:mm"|null, end: "HH:mm"|null,
 *     allDay, location }
 * ===========================================================================*/
import { pad, dateKey, addMinutesISO, parseLocal, startOfDay } from "./dates.js";

const WD = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tues: 2, tue: 2,
  wednesday: 3, weds: 3, wed: 3,
  thursday: 4, thurs: 4, thur: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const MON = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8,
  sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11,
  december: 11,
};

// Alternations sorted longest-first so e.g. "january" wins over "jan".
const MON_RE = Object.keys(MON).sort((a, b) => b.length - a.length).join("|");
const WD_RE = Object.keys(WD).sort((a, b) => b.length - a.length).join("|");

// A clock time: hour, optional :minutes, optional am/pm. Reused in several spots.
const TIME = "(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)?";

function to24(h, mi, ap) {
  h = +h;
  const m = mi ? +mi : 0;
  if (ap) {
    ap = ap.replace(/\./g, "").toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
  }
  return h * 60 + m;
}

// No am/pm given: assume the most likely meaning. 1–6 read as afternoon/evening
// (1→13:00 … 6→18:00); 7–12 and 0 stay as written (7am, noon, …).
function bareGuess(h, mi) {
  h = +h;
  const m = mi ? +mi : 0;
  if (h >= 1 && h <= 6) h += 12;
  return h * 60 + m;
}

const tmin = (h, mi, ap) => (ap ? to24(h, mi, ap) : bareGuess(h, mi));
const hhmm = (mins) =>
  `${pad(Math.floor(mins / 60) % 24)}:${pad(((mins % 60) + 60) % 60)}`;

export function parse(text, now = new Date()) {
  const src = (text || "").trim();
  if (!src) return null;

  let buf = src.toLowerCase();
  const titleArr = [...src];
  // Erase a matched span from both the lowercase scan buffer (so later regexes
  // can't re-match it) and the title accumulator (so it won't pollute the title).
  const blank = (a, b) => {
    buf = buf.slice(0, a) + " ".repeat(b - a) + buf.slice(b);
    for (let i = a; i < b; i++) titleArr[i] = " ";
  };
  const eat = (m) => blank(m.index, m.index + m[0].length);

  const today0 = startOfDay(now);
  let date = null; // Date at local midnight, or null = "today"
  let startMin = null;
  let endMin = null;
  let durMin = null;

  /* ---- duration: "for 90 min", "for 2 hours", "for 1.5h" ---- */
  let m = buf.match(/\bfor\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i);
  if (m) {
    const n = parseFloat(m[1]);
    durMin = /^h/i.test(m[2]) ? Math.round(n * 60) : Math.round(n);
    eat(m);
  }

  /* ---- time range: "1-2pm", "9:30 to 10:45", "from 3 until 4pm" ---- */
  const rangeRe = new RegExp(
    `\\b(?:from\\s+)?${TIME}\\s*(?:-|–|—|to|until|till|til)\\s*${TIME}`,
    "i"
  );
  m = buf.match(rangeRe);
  if (m) {
    let [, h1, mi1, ap1, h2, mi2, ap2] = m;
    if (!ap1 && ap2) ap1 = ap2; // "1-2pm" → both pm
    startMin = tmin(h1, mi1, ap1);
    endMin = tmin(h2, mi2, ap2);
    eat(m);
  }

  /* ---- single start time (only if no range matched) ---- */
  if (startMin === null) {
    // Priority 1: an explicit am/pm — highest confidence. Consume a leading
    // "at" too so "lunch at 1pm" doesn't strand the preposition in the title.
    let t = buf.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
    if (t) {
      startMin = to24(t[1], t[2], t[3]);
      eat(t);
    }
  }
  if (startMin === null) {
    const t = buf.match(/\b(?:at\s+)?(noon|midday|midnight)\b/i);
    if (t) {
      startMin = /midnight/i.test(t[1]) ? 0 : 12 * 60;
      eat(t);
    }
  }
  if (startMin === null) {
    // Priority 2: "at 7", "at 9:30" — the "at" disambiguates a bare number.
    const t = buf.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/i);
    if (t) {
      startMin = tmin(t[1], t[2], null);
      eat(t);
    }
  }
  if (startMin === null) {
    // Priority 3: a 24h colon time, "13:00".
    const t = buf.match(/\b(?:at\s+)?(\d{1,2}):(\d{2})\b/);
    if (t) {
      startMin = +t[1] * 60 + +t[2];
      eat(t);
    }
  }

  /* ---- coarse time-of-day words ("morning", "tonight", …) ----
   * Always strip these from the title (so "10am tomorrow morning" doesn't keep
   * "morning"), but only let them set the time when no explicit time was found. */
  {
    const tod = [
      [/\b(morning)\b/i, 9 * 60],
      [/\b(afternoon)\b/i, 14 * 60],
      [/\b(evening|tonight)\b/i, 19 * 60],
    ];
    for (const [re, mins] of tod) {
      const t = buf.match(re);
      if (t) {
        if (startMin === null) startMin = mins;
        eat(t);
        break;
      }
    }
  }

  /* ---- dates ---- */
  const setDate = (d) => {
    if (date === null) date = startOfDay(d);
  };
  const shift = (n) => {
    const d = new Date(today0);
    d.setDate(d.getDate() + n);
    return d;
  };

  // relative words
  m = buf.match(/\bday after tomorrow\b/i);
  if (m) {
    setDate(shift(2));
    eat(m);
  }
  m = buf.match(/\b(today|tonight)\b/i);
  if (m) {
    setDate(today0);
    eat(m);
  }
  m = buf.match(/\b(tomorrow|tmrw|tmw|tmrrw)\b/i);
  if (m) {
    setDate(shift(1));
    eat(m);
  }
  m = buf.match(/\byesterday\b/i);
  if (m) {
    setDate(shift(-1));
    eat(m);
  }

  // "in 3 days" / "in 2 weeks"
  m = buf.match(/\bin\s+(\d{1,2})\s+(days?|weeks?)\b/i);
  if (m) {
    setDate(shift(+m[1] * (/^w/i.test(m[2]) ? 7 : 1)));
    eat(m);
  }

  // weekday, optionally prefixed by next/this/coming/on
  m = buf.match(new RegExp(`\\b(next|this|coming|on)?\\s*(${WD_RE})\\b`, "i"));
  if (m) {
    const prefix = (m[1] || "").toLowerCase();
    const target = WD[m[2].toLowerCase()];
    let delta = (target - today0.getDay() + 7) % 7; // 0 = today
    if (prefix === "next") delta = delta === 0 ? 7 : delta + 7;
    setDate(shift(delta));
    eat(m);
  }

  // "Dec 24", "December 24, 2026"
  m = buf.match(
    new RegExp(`\\b(${MON_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`, "i")
  );
  if (m) {
    const mon = MON[m[1].toLowerCase()];
    const day = +m[2];
    const year = m[3] ? +m[3] : guessYear(today0, mon, day);
    setDate(new Date(year, mon, day));
    eat(m);
  }

  // "24 Dec", "24th of December"
  if (date === null) {
    m = buf.match(
      new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MON_RE})\\b`, "i")
    );
    if (m) {
      const day = +m[1];
      const mon = MON[m[2].toLowerCase()];
      setDate(new Date(guessYear(today0, mon, day), mon, day));
      eat(m);
    }
  }

  // numeric "12/5" or "12/5/2026" (interpreted month/day)
  if (date === null) {
    m = buf.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (m) {
      const mo = +m[1] - 1,
        day = +m[2];
      if (mo >= 0 && mo <= 11 && day >= 1 && day <= 31) {
        let year = m[3] ? +m[3] : guessYear(today0, mo, day);
        if (year < 100) year += 2000;
        setDate(new Date(year, mo, day));
        eat(m);
      }
    }
  }

  // ordinal day-of-month: "the 15th", "on the 5th", "on 5th" → that day of the
  // current/next month. A leading "on"/"the" is required so street numbers and
  // the like ("5th avenue") aren't mistaken for dates.
  if (date === null) {
    m = buf.match(/\b(?:on\s+the\s+|on\s+|the\s+)(\d{1,2})(?:st|nd|rd|th)\b/i);
    if (m) {
      const day = +m[1];
      if (day >= 1 && day <= 31) {
        let d = new Date(today0.getFullYear(), today0.getMonth(), day);
        if (d < today0) d = new Date(today0.getFullYear(), today0.getMonth() + 1, day);
        setDate(d);
        eat(m);
      }
    }
  }

  /* ---- finalize times ---- */
  if (durMin && startMin !== null && endMin === null) endMin = startMin + durMin;
  if (endMin !== null) {
    if (endMin <= startMin) endMin = null; // let the default (+60) apply downstream
    else if (endMin > 1439) endMin = 1439;
  }

  /* ---- title + location from the surviving text ---- */
  let title = titleArr.join("").replace(/\s+/g, " ").trim();

  let location = "";
  let loc = title.match(/(?:^|\s)@\s*(.+)$/);
  if (!loc) loc = title.match(/\sat\s+(.+)$/i);
  if (loc) {
    location = loc[1].trim().replace(/^the\s+/i, "");
    title = title.slice(0, loc.index).trim();
  }

  title = cleanTitle(title);

  return {
    title,
    date: dateKey(date || today0),
    start: startMin === null ? null : hhmm(startMin),
    end: endMin === null ? null : hhmm(endMin),
    allDay: startMin === null,
    location,
  };
}

// Pick the year that puts a month/day on or after today (so "Dec 24" in January
// means this year, but in late December means it could be either — we stay in
// the current year unless the date has clearly passed).
function guessYear(today0, mon, day) {
  const y = today0.getFullYear();
  const candidate = new Date(y, mon, day);
  return candidate < today0 ? y + 1 : y;
}

function cleanTitle(t) {
  let s = t
    .replace(/^(?:on|at|from|the|a|an|to|for|with|-|–|—|,|:)\s+/i, "")
    .replace(/[\s,;:–—-]+$/g, "")
    .replace(/^[\s,;:–—-]+/g, "")
    .replace(/\s+(?:at|on|from|by|in|for)$/i, "") // strip a stranded trailing preposition
    .trim();
  if (!s) return "New event";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ============================ parsed → event ============================ */
export function parsedToEvent(p, calendarId) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.date || "")
    ? p.date
    : dateKey(new Date());
  const ev = {
    id: crypto.randomUUID(),
    calendarId,
    title: (p.title || "New event").trim(),
    location: p.location || "",
  };
  if (p.allDay || !p.start) {
    ev.allDay = true;
    ev.start = `${date}T00:00`;
    ev.end = `${date}T00:00`;
  } else {
    ev.allDay = false;
    ev.start = `${date}T${p.start}`;
    ev.end = p.end ? `${date}T${p.end}` : addMinutesISO(`${date}T${p.start}`, 60);
    if (parseLocal(ev.end) <= parseLocal(ev.start))
      ev.end = addMinutesISO(ev.start, 60);
  }
  return ev;
}
