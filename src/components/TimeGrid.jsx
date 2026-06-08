import React from "react";
import {
  DAY_NAMES, parseLocal, sameDay, minutesOf, fmtTime, fmtHour,
} from "../lib/dates.js";
import { HOUR_PX, GRID_H } from "../lib/constants.js";
import { layoutDay } from "../lib/layout.js";

/* ============================ time grid (day / week) ============================ */
export default function TimeGrid({ days, events, calMap, today, scrollRef, onSlot, onEvent, singular }) {
  const now = today;
  const allDayByDay = days.map((d) =>
    events.filter((e) => e.allDay && sameDay(parseLocal(e.start), d))
  );
  const hasAllDay = allDayByDay.some((a) => a.length);

  return (
    <div className={`grid-wrap ${singular ? "day" : ""}`}>
      {/* header */}
      <div className="grid-header" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
        <div className="gh-corner" />
        {days.map((d, i) => {
          const isToday = sameDay(d, now);
          return (
            <div key={i} className="gh-day">
              <span className="gh-dow">{DAY_NAMES[d.getDay()]}</span>
              <span className={`gh-num ${isToday ? "today" : ""}`}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* all-day row */}
      {hasAllDay && (
        <div className="allday" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
          <div className="ad-label">all-day</div>
          {days.map((d, i) => (
            <div key={i} className="ad-cell" onClick={() => onSlot(d, 0, 0, true)}>
              {allDayByDay[i].map((ev) => {
                const c = calMap[ev.calendarId];
                return (
                  <div
                    key={ev.id}
                    className="ad-chip"
                    style={{ background: (c?.color || "#888") + "33", borderColor: c?.color }}
                    onClick={(e) => { e.stopPropagation(); onEvent(ev); }}
                  >
                    <span className="ad-dot" style={{ background: c?.color }} />
                    {ev.title}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* scrollable body */}
      <div className="grid-scroll" ref={scrollRef}>
        <div className="grid-body" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)`, height: GRID_H }}>
          {/* time gutter */}
          <div className="gutter">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="gutter-cell" style={{ height: HOUR_PX }}>
                {h > 0 && <span>{fmtHour(h)}</span>}
              </div>
            ))}
          </div>

          {days.map((d, di) => {
            const dayEvents = events.filter((e) => !e.allDay && sameDay(parseLocal(e.start), d));
            const items = dayEvents.map((e) => {
              const s = parseLocal(e.start),
                en = parseLocal(e.end);
              return { ev: e, s: minutesOf(s), e: Math.max(minutesOf(en), minutesOf(s) + 20) };
            });
            const laid = layoutDay(items);
            const isToday = sameDay(d, now);
            return (
              <div
                key={di}
                className="day-col"
                onMouseDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const mins = Math.max(0, Math.min(23 * 60 + 30, Math.round((y / HOUR_PX) * 60 / 30) * 30));
                  onSlot(d, Math.floor(mins / 60), mins % 60);
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="hline" style={{ top: h * HOUR_PX }} />
                ))}
                {laid.map(({ ev, s, e, lane, lanes }) => {
                  const c = calMap[ev.calendarId];
                  const top = (s / 60) * HOUR_PX;
                  const height = Math.max(((e - s) / 60) * HOUR_PX - 2, 18);
                  const w = 100 / lanes;
                  return (
                    <div
                      key={ev.id}
                      className={`event ${ev.readOnly ? "readonly" : ""}`}
                      style={{
                        top, height,
                        left: `calc(${lane * w}% + 3px)`,
                        width: `calc(${w}% - 6px)`,
                        background: (c?.color || "#888") + "26",
                        borderLeft: `3px solid ${c?.color || "#888"}`,
                      }}
                      onClick={(ed) => { ed.stopPropagation(); onEvent(ev); }}
                    >
                      <div className="event-title">{ev.title}</div>
                      {height > 32 && (
                        <div className="event-time">
                          {fmtTime(parseLocal(ev.start))}
                          {ev.location ? ` · ${ev.location}` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
                {isToday && <NowLine now={now} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NowLine({ now }) {
  const top = (minutesOf(now) / 60) * HOUR_PX;
  return (
    <div className="now-line" style={{ top }}>
      <span className="now-dot" />
    </div>
  );
}
