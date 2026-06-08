import { describe, it, expect } from "vitest";
import { parseICS, buildICS } from "./ics.js";

const SAMPLE = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:abc-123",
  "SUMMARY:Quarterly planning\\, all teams",
  "LOCATION:Room 4",
  "DTSTART:20260610T140000Z",
  "DTEND:20260610T150000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:all-day-1",
  "SUMMARY:Company holiday",
  "DTSTART;VALUE=DATE:20260704",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseICS", () => {
  it("parses summary, location, uid and unescapes commas", () => {
    const ev = parseICS(SAMPLE);
    expect(ev).toHaveLength(2);
    expect(ev[0].title).toBe("Quarterly planning, all teams");
    expect(ev[0].location).toBe("Room 4");
    expect(ev[0].uid).toBe("abc-123");
    expect(ev[0].allDay).toBe(false);
  });

  it("treats VALUE=DATE as an all-day event", () => {
    const ev = parseICS(SAMPLE);
    expect(ev[1].allDay).toBe(true);
    expect(ev[1].start.startsWith("2026-07-04")).toBe(true);
  });

  it("treats all-day DTEND as exclusive (last day = DTEND - 1)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:multi",
      "SUMMARY:Conference",
      "DTSTART;VALUE=DATE:20260628",
      "DTEND;VALUE=DATE:20260709", // exclusive → covers through Jul 8
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const ev = parseICS(ics)[0];
    expect(ev.allDay).toBe(true);
    expect(ev.start.startsWith("2026-06-28")).toBe(true);
    expect(ev.end.startsWith("2026-07-08")).toBe(true);
  });

  it("captures RRULE and EXDATE for recurring events", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:rec",
      "SUMMARY:Standup",
      "DTSTART:20260105T090000Z",
      "DTEND:20260105T091500Z",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10",
      "EXDATE:20260107T090000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const ev = parseICS(ics)[0];
    expect(ev.rrule).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10");
    expect(ev.exdates).toEqual(["20260107T090000Z"]);
  });

  it("unfolds folded lines", () => {
    const folded = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:x",
      "SUMMARY:A very long title that has",
      "  been folded across lines",
      "DTSTART:20260101T090000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(parseICS(folded)[0].title).toBe(
      "A very long title that has been folded across lines"
    );
  });
});

describe("buildICS", () => {
  it("round-trips a multi-day all-day event without collapsing it", () => {
    const built = buildICS([
      { id: "h1", title: "Conference", allDay: true, start: "2026-07-04T00:00", end: "2026-07-07T00:00" },
    ]);
    const back = parseICS(built)[0];
    expect(back.allDay).toBe(true);
    expect(back.start.startsWith("2026-07-04")).toBe(true);
    expect(back.end.startsWith("2026-07-07")).toBe(true); // not collapsed to start
  });

  it("round-trips a timed event back through the parser", () => {
    const built = buildICS([
      {
        id: "e1",
        title: "Dinner",
        location: "Home",
        allDay: false,
        start: "2026-06-10T19:00",
        end: "2026-06-10T20:30",
      },
    ]);
    const back = parseICS(built);
    expect(back[0].title).toBe("Dinner");
    expect(back[0].start).toBe("2026-06-10T19:00");
    expect(back[0].end).toBe("2026-06-10T20:30");
  });
});
