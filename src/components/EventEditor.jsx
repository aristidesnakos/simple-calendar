import React, { useState, useEffect, useRef } from "react";
import { X, Clock, MapPin, Trash2, Check, Eye } from "lucide-react";
import { pad, parseLocal, dateKey, addMinutesISO } from "../lib/dates.js";

/* ============================ event editor ============================ */
export default function EventEditor({ event, calendars, onClose, onSave, onDelete }) {
  const readOnly = !!event.readOnly; // events synced from a feed can't be edited
  const s = parseLocal(event.start),
    e = parseLocal(event.end);
  const [title, setTitle] = useState(event.title);
  const [calId, setCalId] = useState(event.calendarId);
  const [allDay, setAllDay] = useState(!!event.allDay);
  const [date, setDate] = useState(dateKey(s));
  const [start, setStart] = useState(`${pad(s.getHours())}:${pad(s.getMinutes())}`);
  const [end, setEnd] = useState(`${pad(e.getHours())}:${pad(e.getMinutes())}`);
  const [loc, setLoc] = useState(event.location || "");
  const titleRef = useRef(null);
  useEffect(() => {
    if (!readOnly) setTimeout(() => titleRef.current?.focus(), 30);
  }, [readOnly]);

  const save = () => {
    let st, en;
    if (allDay) {
      st = `${date}T00:00`;
      en = `${date}T00:00`;
    } else {
      st = `${date}T${start}`;
      en = `${date}T${end}`;
      if (parseLocal(en) <= parseLocal(st)) en = addMinutesISO(st, 60);
    }
    onSave({
      ...event,
      title: title.trim() || "(no title)",
      calendarId: calId,
      allDay,
      location: loc.trim(),
      start: st,
      end: en,
    });
  };

  const feedCal = calendars.find((c) => c.id === event.calendarId);

  return (
    <div className="modal-bg" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{readOnly ? "Event" : event._isNew ? "New event" : "Edit event"}</span>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <input
          ref={titleRef}
          className="field title-field"
          placeholder="Add title"
          value={title}
          disabled={readOnly}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !readOnly) save(); }}
        />

        {!readOnly && (
          <label className="row toggle-row" onClick={() => setAllDay((v) => !v)}>
            <span className={`switch ${allDay ? "on" : ""}`}>
              <span className="knob" />
            </span>
            <span>All day</span>
          </label>
        )}

        <div className="row">
          <Clock size={15} className="row-ico" />
          <input type="date" className="field" value={date} disabled={readOnly} onChange={(e) => setDate(e.target.value)} />
          {!allDay && (
            <>
              <input type="time" className="field tight" value={start} disabled={readOnly} onChange={(e) => setStart(e.target.value)} />
              <span className="dash">–</span>
              <input type="time" className="field tight" value={end} disabled={readOnly} onChange={(e) => setEnd(e.target.value)} />
            </>
          )}
        </div>

        <div className="row">
          <span className="row-ico" style={{ display: "flex" }}>
            <span className="dot" style={{ background: calendars.find((c) => c.id === calId)?.color }} />
          </span>
          {readOnly ? (
            <input className="field" value={feedCal?.name || "Subscribed"} disabled />
          ) : (
            <select className="field" value={calId} onChange={(e) => setCalId(e.target.value)}>
              {calendars.filter((c) => !c.isFeed).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {(loc || !readOnly) && (
          <div className="row">
            <MapPin size={15} className="row-ico" />
            <input className="field" placeholder="Location (optional)" value={loc} disabled={readOnly} onChange={(e) => setLoc(e.target.value)} />
          </div>
        )}

        <div className="modal-foot">
          {readOnly ? (
            <span className="ro-badge"><Eye size={12} /> Synced — read only</span>
          ) : !event._isNew ? (
            <button className="btn danger" onClick={() => onDelete(event.id)}>
              <Trash2 size={14} /> Delete
            </button>
          ) : (
            <span />
          )}
          <div className="foot-right">
            <button className="btn ghost" onClick={onClose}>{readOnly ? "Close" : "Cancel"}</button>
            {!readOnly && (
              <button className="btn primary" onClick={save}>
                <Check size={14} /> Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
