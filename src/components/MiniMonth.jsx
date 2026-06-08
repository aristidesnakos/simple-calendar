import React, { useState, useEffect } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import {
  MONTHS, startOfMonth, startOfWeek, addDays, sameDay,
} from "../lib/dates.js";

/* ============================ mini month (sidebar) ============================ */
export default function MiniMonth({ anchor, onPick, today }) {
  const [m, setM] = useState(() => startOfMonth(anchor));
  useEffect(() => {
    setM(startOfMonth(anchor));
  }, [anchor.getFullYear(), anchor.getMonth()]);

  const gridStart = startOfWeek(startOfMonth(m));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  return (
    <div className="mini">
      <div className="mini-head">
        <span>
          {MONTHS[m.getMonth()].slice(0, 3)} {m.getFullYear()}
        </span>
        <span className="mini-nav">
          <button className="icon-btn xs" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
            <ChevronUp size={13} />
          </button>
          <button className="icon-btn xs" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
            <ChevronDown size={13} />
          </button>
        </span>
      </div>
      <div className="mini-dow">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mini-grid">
        {cells.map((d, i) => {
          const inM = d.getMonth() === m.getMonth();
          const isToday = sameDay(d, today);
          const isSel = sameDay(d, anchor);
          return (
            <button
              key={i}
              className={`mini-cell ${inM ? "" : "dim"} ${isToday ? "today" : ""} ${isSel ? "sel" : ""}`}
              onClick={() => onPick(d)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
