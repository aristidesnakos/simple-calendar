import { describe, it, expect } from "vitest";
import { expandRecurrence } from "./recur.js";

// Generous default window covering all of 2026 (and beyond) so window
// filtering is not in play unless a test deliberately narrows it.
const WIDE = {
  rangeStart: new Date(2026, 0, 1),
  rangeEnd: new Date(2027, 0, 1),
};

// Convenience: pull just the start strings.
const starts = (occ) => occ.map((o) => o.start);

describe("expandRecurrence", () => {
  it("weekly with COUNT yields N occurrences a week apart, preserving duration", () => {
    const base = { start: "2026-01-05T09:00", end: "2026-01-05T09:30" };
    const occ = expandRecurrence(base, { rrule: "FREQ=WEEKLY;COUNT=4" }, WIDE);

    expect(starts(occ)).toEqual([
      "2026-01-05T09:00",
      "2026-01-12T09:00",
      "2026-01-19T09:00",
      "2026-01-26T09:00",
    ]);
    // duration preserved -> every end is 09:30
    for (const o of occ) {
      expect(o.end.endsWith("T09:30")).toBe(true);
    }
  });

  it("WEEKLY;BYDAY=MO,WE,FR emits only those weekdays, DTSTART included", () => {
    // 2026-01-05 is a Monday.
    const base = { start: "2026-01-05T09:00", end: "2026-01-05T10:00" };
    const occ = expandRecurrence(
      base,
      { rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR" },
      { rangeStart: new Date(2026, 0, 5), rangeEnd: new Date(2026, 0, 17) }
    );

    expect(starts(occ)).toEqual([
      "2026-01-05T09:00", // Mon
      "2026-01-07T09:00", // Wed
      "2026-01-09T09:00", // Fri
      "2026-01-12T09:00", // Mon
      "2026-01-14T09:00", // Wed
      "2026-01-16T09:00", // Fri
    ]);
  });

  it("WEEKLY;INTERVAL=2;BYDAY skips alternate weeks", () => {
    const base = { start: "2026-01-05T09:00", end: "2026-01-05T09:30" };
    const occ = expandRecurrence(
      base,
      { rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE" },
      { rangeStart: new Date(2026, 0, 1), rangeEnd: new Date(2026, 0, 31) }
    );
    expect(starts(occ)).toEqual([
      "2026-01-05T09:00", // Mon wk1
      "2026-01-07T09:00", // Wed wk1
      "2026-01-19T09:00", // Mon wk3
      "2026-01-21T09:00", // Wed wk3
    ]);
  });

  it("DAILY;INTERVAL=2;UNTIL stops at the inclusive bound", () => {
    const base = { start: "2026-03-01T08:00", end: "2026-03-01T08:15" };
    const occ = expandRecurrence(
      base,
      { rrule: "FREQ=DAILY;INTERVAL=2;UNTIL=20260309T000000Z" },
      WIDE
    );
    // Every other day: Mar 1,3,5,7,9. UNTIL is Mar 9 00:00 but our times are
    // 08:00 -> Mar 9 08:00 is AFTER 00:00, so it is excluded.
    expect(starts(occ)).toEqual([
      "2026-03-01T08:00",
      "2026-03-03T08:00",
      "2026-03-05T08:00",
      "2026-03-07T08:00",
    ]);
  });

  it("DAILY;UNTIL date-only inclusive includes the same-day occurrence end", () => {
    const base = { start: "2026-03-01T08:00", end: "2026-03-01T08:30" };
    const occ = expandRecurrence(
      base,
      { rrule: "FREQ=DAILY;UNTIL=20260304" },
      WIDE
    );
    // UNTIL=20260304 -> Mar 4 00:00; Mar 4 08:00 is after, so last kept is Mar 3.
    expect(starts(occ)).toEqual([
      "2026-03-01T08:00",
      "2026-03-02T08:00",
      "2026-03-03T08:00",
    ]);
  });

  it("MONTHLY same day-of-month, with a window that skips ahead", () => {
    const base = { start: "2026-01-15T12:00", end: "2026-01-15T13:00" };
    const occ = expandRecurrence(
      base,
      { rrule: "FREQ=MONTHLY;COUNT=12" },
      // window starts in April -> Jan/Feb/Mar excluded by window, but COUNT
      // still counted them, and we cap at the year window.
      { rangeStart: new Date(2026, 3, 1), rangeEnd: new Date(2026, 7, 1) }
    );
    expect(starts(occ)).toEqual([
      "2026-04-15T12:00",
      "2026-05-15T12:00",
      "2026-06-15T12:00",
      "2026-07-15T12:00",
    ]);
  });

  it("MONTHLY on day 31 skips months without that day", () => {
    const base = { start: "2026-01-31T10:00", end: "2026-01-31T10:30" };
    const occ = expandRecurrence(
      base,
      { rrule: "FREQ=MONTHLY;COUNT=4" },
      WIDE
    );
    // Jan31, (Feb skipped), Mar31, (Apr30 skipped), May31, (Jun skipped), Jul31
    expect(starts(occ)).toEqual([
      "2026-01-31T10:00",
      "2026-03-31T10:00",
      "2026-05-31T10:00",
      "2026-07-31T10:00",
    ]);
  });

  it("MONTHLY;BYDAY=3FR picks the third Friday each month", () => {
    const base = { start: "2026-01-16T09:00", end: "2026-01-16T10:00" };
    // 2026-01-16 is the 3rd Friday of January.
    const occ = expandRecurrence(
      base,
      { rrule: "FREQ=MONTHLY;BYDAY=3FR;COUNT=3" },
      WIDE
    );
    expect(starts(occ)).toEqual([
      "2026-01-16T09:00",
      "2026-02-20T09:00",
      "2026-03-20T09:00",
    ]);
  });

  it("MONTHLY;BYDAY=-1MO picks the last Monday each month", () => {
    const base = { start: "2026-01-26T09:00", end: "2026-01-26T09:30" };
    const occ = expandRecurrence(
      base,
      { rrule: "FREQ=MONTHLY;BYDAY=-1MO;COUNT=3" },
      WIDE
    );
    expect(starts(occ)).toEqual([
      "2026-01-26T09:00", // last Mon Jan
      "2026-02-23T09:00", // last Mon Feb
      "2026-03-30T09:00", // last Mon Mar
    ]);
  });

  it("YEARLY repeats the same month+day each year", () => {
    const base = { start: "2026-07-04T00:00", end: "2026-07-04T01:00" };
    const occ = expandRecurrence(
      base,
      { rrule: "FREQ=YEARLY;COUNT=3" },
      { rangeStart: new Date(2026, 0, 1), rangeEnd: new Date(2029, 0, 1) }
    );
    expect(starts(occ)).toEqual([
      "2026-07-04T00:00",
      "2027-07-04T00:00",
      "2028-07-04T00:00",
    ]);
  });

  it("EXDATE removes a specific occurrence", () => {
    const base = { start: "2026-01-05T09:00", end: "2026-01-05T09:30" };
    const occ = expandRecurrence(
      base,
      {
        rrule: "FREQ=WEEKLY;COUNT=4",
        exdates: ["20260112T090000"],
      },
      WIDE
    );
    expect(starts(occ)).toEqual([
      "2026-01-05T09:00",
      "2026-01-19T09:00",
      "2026-01-26T09:00",
    ]);
  });

  it("EXDATE supports comma-separated multi-value strings", () => {
    const base = { start: "2026-01-05T09:00", end: "2026-01-05T09:30" };
    const occ = expandRecurrence(
      base,
      {
        rrule: "FREQ=WEEKLY;COUNT=5",
        // one entry holding two values + a trailing Z variant
        exdates: ["20260112T090000,20260119T090000Z"],
      },
      WIDE
    );
    expect(starts(occ)).toEqual([
      "2026-01-05T09:00",
      "2026-01-26T09:00",
      "2026-02-02T09:00",
    ]);
  });

  it("DTSTART is always included even when it doesn't match BYDAY", () => {
    // 2026-01-06 is a Tuesday; BYDAY only lists MO/WE/FR.
    const base = { start: "2026-01-06T09:00", end: "2026-01-06T09:30" };
    const occ = expandRecurrence(
      base,
      { rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=4" },
      WIDE
    );
    expect(starts(occ)[0]).toBe("2026-01-06T09:00"); // DTSTART first
    expect(starts(occ)).toEqual([
      "2026-01-06T09:00", // Tue (DTSTART, off-pattern)
      "2026-01-07T09:00", // Wed
      "2026-01-09T09:00", // Fri
      "2026-01-12T09:00", // Mon
    ]);
  });

  it("window filtering excludes pre-rangeStart occurrences but COUNT counts them", () => {
    const base = { start: "2026-01-05T09:00", end: "2026-01-05T09:30" };
    // 6 weekly occurrences; window only covers the last few.
    const occ = expandRecurrence(
      base,
      { rrule: "FREQ=WEEKLY;COUNT=6" },
      { rangeStart: new Date(2026, 1, 1), rangeEnd: new Date(2026, 11, 31) }
    );
    // Occurrences: Jan5,12,19,26 (before Feb 1), Feb2, Feb9.
    expect(starts(occ)).toEqual(["2026-02-02T09:00", "2026-02-09T09:00"]);
  });

  it("respects the max cap on generated occurrences", () => {
    const base = { start: "2026-01-01T00:00", end: "2026-01-01T00:30" };
    const occ = expandRecurrence(
      base,
      { rrule: "FREQ=DAILY" }, // unbounded
      { rangeStart: new Date(2026, 0, 1), rangeEnd: new Date(2030, 0, 1), max: 5 }
    );
    expect(occ).toHaveLength(5);
    expect(starts(occ)).toEqual([
      "2026-01-01T00:00",
      "2026-01-02T00:00",
      "2026-01-03T00:00",
      "2026-01-04T00:00",
      "2026-01-05T00:00",
    ]);
  });

  it("empty/null rrule returns just the base when within window", () => {
    const base = { start: "2026-06-15T14:00", end: "2026-06-15T15:00" };
    const occ = expandRecurrence(base, { rrule: null }, WIDE);
    expect(occ).toEqual([
      { start: "2026-06-15T14:00", end: "2026-06-15T15:00" },
    ]);

    const occ2 = expandRecurrence(base, { rrule: "" }, WIDE);
    expect(occ2).toEqual([
      { start: "2026-06-15T14:00", end: "2026-06-15T15:00" },
    ]);
  });

  it("empty rrule returns [] when base is outside the window", () => {
    const base = { start: "2026-06-15T14:00", end: "2026-06-15T15:00" };
    const occ = expandRecurrence(base, { rrule: null }, {
      rangeStart: new Date(2026, 0, 1),
      rangeEnd: new Date(2026, 0, 31),
    });
    expect(occ).toEqual([]);
  });

  it("preserves multi-hour durations across occurrences", () => {
    const base = { start: "2026-01-05T22:00", end: "2026-01-06T01:30" };
    const occ = expandRecurrence(base, { rrule: "FREQ=DAILY;COUNT=2" }, WIDE);
    expect(occ).toEqual([
      { start: "2026-01-05T22:00", end: "2026-01-06T01:30" },
      { start: "2026-01-06T22:00", end: "2026-01-07T01:30" },
    ]);
  });
});
