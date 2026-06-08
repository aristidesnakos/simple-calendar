import { describe, it, expect } from "vitest";
import { parse } from "./nlp.js";
import { dateKey, addDays, startOfDay } from "./dates.js";

// Fixed reference point for deterministic relative-date tests.
const NOW = new Date(2026, 5, 7, 10, 0); // Sun Jun 7 2026, 10:00 local
const today = dateKey(startOfDay(NOW));
const p = (text) => parse(text, NOW);

describe("times", () => {
  it("parses 'lunch with George at 1pm'", () => {
    const r = p("lunch with George at 1pm");
    expect(r.title).toBe("Lunch with George");
    expect(r.date).toBe(today);
    expect(r.start).toBe("13:00");
    expect(r.end).toBe(null); // default +60 applied at event build time
    expect(r.allDay).toBe(false);
    expect(r.location).toBe("");
  });

  it("parses a time range '3-4pm'", () => {
    const r = p("team sync 3-4pm");
    expect(r.title).toBe("Team sync");
    expect(r.start).toBe("15:00");
    expect(r.end).toBe("16:00");
  });

  it("parses '9:30 to 10:45'", () => {
    const r = p("standup 9:30 to 10:45");
    expect(r.start).toBe("09:30");
    expect(r.end).toBe("10:45");
  });

  it("handles 'at 7' as morning, 'at 3' as afternoon", () => {
    expect(p("gym at 7").start).toBe("07:00");
    expect(p("call at 3").start).toBe("15:00");
  });

  it("handles noon and midnight", () => {
    expect(p("lunch at noon").start).toBe("12:00");
    expect(p("deploy at midnight").start).toBe("00:00");
  });

  it("applies a duration", () => {
    const r = p("focus block 2pm for 90 min");
    expect(r.start).toBe("14:00");
    expect(r.end).toBe("15:30");
  });

  it("is all-day when no time is given", () => {
    const r = p("Olive grove maintenance");
    expect(r.allDay).toBe(true);
    expect(r.start).toBe(null);
  });
});

describe("dates", () => {
  it("parses 'tomorrow'", () => {
    expect(p("dentist tomorrow 9am").date).toBe(dateKey(addDays(NOW, 1)));
  });

  it("parses 'next tuesday' (following week)", () => {
    // Sun Jun 7 → coming Tue is Jun 9 (+2); "next" pushes a week → Jun 16.
    expect(p("review next tuesday").date).toBe(dateKey(addDays(startOfDay(NOW), 9)));
  });

  it("parses a plain weekday as the coming one", () => {
    expect(p("call friday").date).toBe(dateKey(addDays(startOfDay(NOW), 5)));
  });

  it("parses 'Dec 24'", () => {
    expect(p("flight dec 24").date).toBe("2026-12-24");
  });

  it("parses '24 December'", () => {
    expect(p("party 24 december at 8pm").date).toBe("2026-12-24");
  });

  it("parses numeric 12/25", () => {
    expect(p("holiday 12/25").date).toBe("2026-12-25");
  });

  it("parses 'in 3 days'", () => {
    expect(p("ship in 3 days").date).toBe(dateKey(addDays(startOfDay(NOW), 3)));
  });

  it("rolls a past day-of-month to next month", () => {
    // NOW is the 7th; "the 5th" already passed → July 5.
    expect(p("rent the 5th").date).toBe("2026-07-05");
  });
});

describe("title + location", () => {
  it("extracts an @ location", () => {
    const r = p("coffee with Amir @ Blue Bottle 9am");
    expect(r.title).toBe("Coffee with Amir");
    expect(r.location).toBe("Blue Bottle");
  });

  it("extracts a trailing 'at <place>' location", () => {
    const r = p("meeting at the office tomorrow 2pm");
    expect(r.title).toBe("Meeting");
    expect(r.location).toBe("office");
  });

  it("strips date/time words from the title", () => {
    const r = p("Strategy review next monday 10-11am");
    expect(r.title).toBe("Strategy review");
  });

  it("falls back to a default title", () => {
    expect(p("3pm").title).toBe("New event");
  });

  it("does not treat a street number as a date (regression: '5th avenue')", () => {
    const r = p("meet at 9 at 5th avenue");
    expect(r.date).toBe(today); // not the 5th of next month
    expect(r.start).toBe("09:00");
    expect(r.location.toLowerCase()).toContain("5th avenue");
  });

  it("strips a time-of-day word even when an explicit time is present", () => {
    const r = p("Sync at 10 tomorrow morning");
    expect(r.title).toBe("Sync");
    expect(r.start).toBe("10:00");
    expect(r.date).toBe(dateKey(addDays(NOW, 1)));
  });
});
