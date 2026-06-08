import { describe, it, expect } from "vitest";
import { googleEventToParsed, rfc3339ToLocalISO } from "./google.js";
import { toLocalISO } from "./dates.js";

describe("googleEventToParsed", () => {
  it("maps a timed event to local wall-clock ISO", () => {
    const g = {
      id: "abc123",
      summary: "Standup",
      location: "Meet",
      start: { dateTime: "2026-06-08T09:00:00-07:00" },
      end: { dateTime: "2026-06-08T09:30:00-07:00" },
    };
    const p = googleEventToParsed(g);
    expect(p.allDay).toBe(false);
    expect(p.uid).toBe("abc123");
    expect(p.title).toBe("Standup");
    expect(p.location).toBe("Meet");
    // The instant must round-trip through the same conversion the app uses.
    expect(p.start).toBe(toLocalISO(new Date("2026-06-08T09:00:00-07:00")));
    expect(p.end).toBe(toLocalISO(new Date("2026-06-08T09:30:00-07:00")));
  });

  it("stores all-day end as the last covered day (exclusive DTEND − 1)", () => {
    // Google all-day end.date is exclusive; a single-day event spans 8th→9th.
    const single = googleEventToParsed({
      id: "d1",
      summary: "Holiday",
      start: { date: "2026-06-08" },
      end: { date: "2026-06-09" },
    });
    expect(single.allDay).toBe(true);
    expect(single.start).toBe("2026-06-08T00:00");
    expect(single.end).toBe("2026-06-08T00:00");

    // A 3-day event 8th→11th(excl) covers 8,9,10 — last covered day is the 10th.
    const multi = googleEventToParsed({
      id: "d3",
      summary: "Trip",
      start: { date: "2026-06-08" },
      end: { date: "2026-06-11" },
    });
    expect(multi.start).toBe("2026-06-08T00:00");
    expect(multi.end).toBe("2026-06-10T00:00");
  });

  it("never lets all-day end fall before start", () => {
    const p = googleEventToParsed({
      id: "x",
      summary: "Odd",
      start: { date: "2026-06-08" },
      end: { date: "2026-06-08" }, // degenerate / missing-day feed
    });
    expect(p.end).toBe(p.start);
  });

  it("falls back to a placeholder title", () => {
    const p = googleEventToParsed({
      id: "n",
      start: { dateTime: "2026-06-08T09:00:00Z" },
      end: { dateTime: "2026-06-08T10:00:00Z" },
    });
    expect(p.title).toBe("(no title)");
    expect(p.location).toBe("");
  });

  it("returns null for an event with no usable start", () => {
    expect(googleEventToParsed({ id: "z", summary: "Broken" })).toBeNull();
    // A timed event missing its end is also unusable.
    expect(googleEventToParsed({ id: "z2", start: { dateTime: "2026-06-08T09:00:00Z" } })).toBeNull();
  });
});

describe("rfc3339ToLocalISO", () => {
  it("yields no timezone suffix (a local wall-clock string)", () => {
    const iso = rfc3339ToLocalISO("2026-06-08T09:00:00Z");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("treats the same instant written in two zones identically", () => {
    // 16:00Z === 09:00-07:00 — same moment, so same local wall clock.
    expect(rfc3339ToLocalISO("2026-06-08T16:00:00Z"))
      .toBe(rfc3339ToLocalISO("2026-06-08T09:00:00-07:00"));
  });
});
