import React from "react";
import {
  DAY_NAMES, startOfMonth, startOfWeek, addDays, parseLocal, sameDay, fmtTime,
} from "../lib/dates.js";

/* ============================ month view ============================ */
export default function MonthView({ anchor, events, calMap, today, onDay, onEvent, onEmpty }) {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  return (
    <div className="month">
      <div className="month-dow">
        {DAY_NAMES.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = sameDay(d, today);
          const dayEvents = events
            .filter((e) => sameDay(parseLocal(e.start), d))
            .sort((a, b) => b.allDay - a.allDay || parseLocal(a.start) - parseLocal(b.start));
          const shown = dayEvents.slice(0, 3);
          return (
            <div key={i} className={`mcell ${inMonth ? "" : "dim"}`} onClick={() => onEmpty(d)}>
              <div className="mcell-head">
                <span
                  className={`mcell-num ${isToday ? "today" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onDay(d); }}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="mcell-events">
                {shown.map((ev) => {
                  const c = calMap[ev.calendarId];
                  return (
                    <div
                      key={ev.id}
                      className="mchip"
                      onClick={(e) => { e.stopPropagation(); onEvent(ev); }}
                    >
                      <span className="mchip-dot" style={{ background: c?.color }} />
                      <span className="mchip-text">
                        {!ev.allDay && <em>{fmtTime(parseLocal(ev.start))} </em>}
                        {ev.title}
                      </span>
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="mmore" onClick={(e) => { e.stopPropagation(); onDay(d); }}>
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
