import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Plus, Check, Loader2,
} from "lucide-react";

import {
  DAY_NAMES, MONTHS, pad, dateKey, parseLocal, addDays, addMinutesISO,
  startOfWeek, sameDay, toLocalISO,
} from "./lib/dates.js";
import { parseICS, buildICS } from "./lib/ics.js";
import { parse, parsedToEvent } from "./lib/nlp.js";
import { fetchFeed, feedEventsToEvents, expandParsed, normalizeFeedUrl } from "./lib/sync.js";
import { storage } from "./lib/storage.js";
import {
  HOUR_PX, PALETTE, STORE_KEY, VIEW_KEY, REFRESH_MS, RECUR_BACK_DAYS, RECUR_FWD_DAYS,
} from "./lib/constants.js";

import Style from "./styles.jsx";
import Sidebar, { previewLabel } from "./components/Sidebar.jsx";
import TimeGrid from "./components/TimeGrid.jsx";
import MonthView from "./components/MonthView.jsx";
import EventEditor from "./components/EventEditor.jsx";

/* ============================ initial data ============================ */
function initialData() {
  const cals = [
    { id: "work", name: "Work", color: "#6a93f0", visible: true },
    { id: "personal", name: "Personal", color: "#46b89a", visible: true },
    { id: "family", name: "Family", color: "#e0823f", visible: true },
  ];
  const ws = startOfWeek(new Date());
  const at = (off, h, m) => {
    const d = addDays(ws, off);
    d.setHours(h, m, 0, 0);
    return toLocalISO(d);
  };
  const events = [
    { id: crypto.randomUUID(), calendarId: "work", title: "Client standup", start: at(1, 9, 30), end: at(1, 10, 0), allDay: false, location: "Meet" },
    { id: crypto.randomUUID(), calendarId: "work", title: "Deep work — RAG pipeline", start: at(1, 10, 30), end: at(1, 12, 30), allDay: false, location: "" },
    { id: crypto.randomUUID(), calendarId: "personal", title: "Strength session", start: at(2, 7, 0), end: at(2, 8, 0), allDay: false, location: "Gym" },
    { id: crypto.randomUUID(), calendarId: "family", title: "Olive grove maintenance", start: at(6, 9, 0), end: at(6, 9, 0), allDay: true, location: "" },
    { id: crypto.randomUUID(), calendarId: "work", title: "Architecture review", start: at(3, 14, 0), end: at(3, 15, 0), allDay: false, location: "" },
  ];
  return { calendars: cals, events, feeds: [], proxy: "" };
}

// Ensure older saved payloads gain newly-added fields.
function normalize(d) {
  return { feeds: [], proxy: "", calendars: [], events: [], ...d };
}

// Window over which recurring (RRULE) events are expanded into instances.
function recurWindow() {
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - RECUR_BACK_DAYS);
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + RECUR_FWD_DAYS);
  return { rangeStart, rangeEnd };
}

/* ============================ component ============================ */
export default function App() {
  const [data, setData] = useState(null);
  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [now, setNow] = useState(new Date());
  const [nlText, setNlText] = useState("");
  const [nlError, setNlError] = useState("");
  const [preview, setPreview] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");
  const [syncing, setSyncing] = useState({ all: false, ids: {} });

  const scrollRef = useRef(null);
  const skipSave = useRef(true);
  const skipViewSave = useRef(true);
  const fileRef = useRef(null);
  const dataRef = useRef(null);
  const firstSync = useRef(true);

  useEffect(() => { dataRef.current = data; }, [data]);

  /* load persisted data + remembered view */
  useEffect(() => {
    let alive = true;
    (async () => {
      const [raw, savedView] = await Promise.all([
        storage.get(STORE_KEY),
        storage.get(VIEW_KEY),
      ]);
      if (!alive) return;
      if (savedView && ["day", "week", "month"].includes(savedView)) setView(savedView);
      if (raw) {
        try { setData(normalize(JSON.parse(raw))); return; } catch { /* corrupt */ }
      }
      setData(initialData());
    })();
    return () => { alive = false; };
  }, []);

  /* remember the chosen view (skip the initial render) */
  useEffect(() => {
    if (skipViewSave.current) { skipViewSave.current = false; return; }
    storage.set(VIEW_KEY, view);
  }, [view]);

  /* save (skip the first render after load) */
  useEffect(() => {
    if (!data) return;
    if (skipSave.current) { skipSave.current = false; return; }
    storage.set(STORE_KEY, JSON.stringify(data));
  }, [data]);

  /* clock */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  /* scroll to ~7am on view change */
  useEffect(() => {
    if (scrollRef.current && view !== "month")
      scrollRef.current.scrollTop = 7 * HOUR_PX - 12;
  }, [view, anchor]);

  const toastTimer = useRef(null);
  const flash = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  const calMap = useMemo(() => {
    const m = {};
    (data?.calendars || []).forEach((c) => (m[c.id] = c));
    return m;
  }, [data]);

  const visibleEvents = useMemo(() => {
    if (!data) return [];
    return data.events.filter((e) => calMap[e.calendarId]?.visible !== false);
  }, [data, calMap]);

  /* ---------- mutations ---------- */
  const upsert = useCallback((ev) => setData((d) => {
    const exists = d.events.some((e) => e.id === ev.id);
    return { ...d, events: exists ? d.events.map((e) => (e.id === ev.id ? ev : e)) : [...d.events, ev] };
  }), []);
  const remove = useCallback((id) => setData((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) })), []);

  /* ---------- feed sync ---------- */
  const applyFeedResult = useCallback((feed, result, error) => {
    setData((d) => {
      const feeds = d.feeds.map((f) => {
        if (f.id !== feed.id) return f;
        if (error) return { ...f, lastError: error }; // keep lastSync + cached events
        return {
          ...f,
          lastError: null,
          lastSync: new Date().toISOString(),
          // Preserve validators on a 304; refresh them on fresh content.
          etag: result.unchanged ? f.etag : result.etag ?? null,
          lastModified: result.unchanged ? f.lastModified : result.lastModified ?? null,
        };
      });
      // Only swap events when we actually downloaded fresh content. On an error
      // or a 304 the existing events are kept untouched — never blank the feed.
      let events = d.events;
      if (!error && !result.unchanged) {
        const kept = d.events.filter((e) => e.feedId !== feed.id);
        const expanded = expandParsed(result.events, recurWindow());
        events = [...kept, ...feedEventsToEvents(expanded, feed)];
      }
      return { ...d, events, feeds };
    });
  }, []);

  const syncFeedObject = useCallback(async (feed) => {
    setSyncing((s) => ({ ...s, ids: { ...s.ids, [feed.id]: true } }));
    try {
      const result = await fetchFeed(feed.url, {
        proxy: dataRef.current?.proxy,
        etag: feed.etag,
        lastModified: feed.lastModified,
      });
      applyFeedResult(feed, result, null);
    } catch (e) {
      applyFeedResult(feed, null, e.message || "sync failed");
    } finally {
      setSyncing((s) => {
        const ids = { ...s.ids };
        delete ids[feed.id];
        return { ...s, ids };
      });
    }
  }, [applyFeedResult]);

  const refreshFeed = useCallback((id) => {
    const feed = (dataRef.current?.feeds || []).find((f) => f.id === id);
    if (feed) syncFeedObject(feed);
  }, [syncFeedObject]);

  const refreshAll = useCallback(async () => {
    const feeds = dataRef.current?.feeds || [];
    if (!feeds.length) return;
    setSyncing((s) => ({ ...s, all: true }));
    await Promise.all(feeds.map((f) => syncFeedObject(f)));
    setSyncing((s) => ({ ...s, all: false }));
  }, [syncFeedObject]);

  const addFeed = useCallback((url, name) => {
    const id = crypto.randomUUID();
    const color = PALETTE[(dataRef.current?.calendars.length || 0) % PALETTE.length];
    let nm = name;
    if (!nm) {
      try { nm = new URL(normalizeFeedUrl(url)).hostname.replace(/^www\./, ""); }
      catch { nm = "Subscription"; }
    }
    const cal = { id, name: nm, color, visible: true, isFeed: true };
    const feed = { id, url, calendarId: id, lastSync: null, lastError: null };
    setData((d) => ({ ...d, calendars: [...d.calendars, cal], feeds: [...d.feeds, feed] }));
    syncFeedObject(feed);
    flash("Subscribed — syncing…");
  }, [syncFeedObject, flash]);

  const removeFeed = useCallback((id) => {
    setData((d) => ({
      ...d,
      calendars: d.calendars.filter((c) => c.id !== id),
      events: d.events.filter((e) => e.feedId !== id),
      feeds: d.feeds.filter((f) => f.id !== id),
    }));
    flash("Unsubscribed");
  }, [flash]);

  /* sync feeds once on load, then on an interval */
  useEffect(() => {
    if (!data) return;
    if (firstSync.current) {
      firstSync.current = false;
      refreshAll();
    }
  }, [data, refreshAll]);

  useEffect(() => {
    const t = setInterval(() => refreshAll(), REFRESH_MS);
    return () => clearInterval(t);
  }, [refreshAll]);

  /* ---------- natural language (offline) ---------- */
  const firstUserCal = useCallback(() => {
    const cals = (dataRef.current?.calendars || []).filter((c) => !c.isFeed);
    return cals.find((c) => c.visible)?.id || cals[0]?.id;
  }, []);

  const runNL = useCallback(() => {
    const text = nlText.trim();
    if (!text) return;
    setNlError("");
    setPreview(null);
    const parsed = parse(text, new Date());
    if (!parsed) {
      setNlError("Couldn't read that — try e.g. “Lunch with Sam Tuesday 1pm”.");
      return;
    }
    const ev = parsedToEvent(parsed, firstUserCal());
    setPreview({ event: ev, label: previewLabel(ev) });
  }, [nlText, firstUserCal]);

  const acceptPreview = useCallback(() => {
    if (!preview) return;
    upsert(preview.event);
    const d = parseLocal(preview.event.start);
    d.setHours(0, 0, 0, 0);
    setAnchor(d);
    flash("Event added");
    setPreview(null);
    setNlText("");
    setNlError("");
  }, [preview, upsert, flash]);

  const editFromPreview = useCallback(() => {
    setEditing({ ...preview.event, _isNew: true });
    setPreview(null);
  }, [preview]);

  /* ---------- import / export ---------- */
  const onImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseICS(text);
    if (!parsed.length) {
      flash("No events found in that file");
      e.target.value = "";
      return;
    }
    setData((d) => {
      let cals = d.calendars;
      let imp = cals.find((c) => c.id === "imported");
      if (!imp) {
        imp = { id: "imported", name: "Imported", color: "#9aa05a", visible: true };
        cals = [...cals, imp];
      }
      const expanded = expandParsed(parsed, recurWindow());
      const newEvents = expanded.map((p) => ({
        id: crypto.randomUUID(), calendarId: "imported",
        title: p.title, location: p.location, allDay: p.allDay, start: p.start, end: p.end,
      }));
      return { ...d, calendars: cals, events: [...d.events, ...newEvents] };
    });
    flash(`Imported ${parsed.length} event${parsed.length > 1 ? "s" : ""}`);
    e.target.value = "";
  }, [flash]);

  const onExport = useCallback(() => {
    // Export only events you own — subscribed feed events stay with their source.
    const mine = (dataRef.current?.events || []).filter((e) => !e.feedId);
    const blob = new Blob([buildICS(mine)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "smartcal.ics";
    a.click();
    URL.revokeObjectURL(url);
    flash("Exported .ics");
  }, [flash]);

  /* ---------- calendars ---------- */
  const toggleCal = useCallback((id) => setData((d) => ({
    ...d,
    calendars: d.calendars.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
  })), []);

  const addCal = useCallback(() => {
    const name = (prompt("New calendar name") || "").trim();
    if (!name) return;
    setData((d) => {
      const color = PALETTE[d.calendars.length % PALETTE.length];
      return { ...d, calendars: [...d.calendars, { id: crypto.randomUUID(), name, color, visible: true }] };
    });
  }, []);

  /* ---------- slot click -> new event ---------- */
  const newAt = useCallback((date, hour, min, allDay = false) => {
    const start = `${dateKey(date)}T${pad(hour)}:${pad(min)}`;
    setEditing({
      id: crypto.randomUUID(), calendarId: firstUserCal(), title: "", location: "",
      allDay, start: allDay ? `${dateKey(date)}T00:00` : start,
      end: allDay ? `${dateKey(date)}T00:00` : addMinutesISO(start, 60), _isNew: true,
    });
  }, [firstUserCal]);

  /* ---------- nav ---------- */
  const step = useCallback((dir) => setAnchor((a) =>
    view === "month"
      ? new Date(a.getFullYear(), a.getMonth() + dir, 1)
      : addDays(a, dir * (view === "week" ? 7 : 1))
  ), [view]);
  const goToday = useCallback(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setAnchor(d);
  }, []);

  /* ---------- programmatic API (for a future chat / agent interface) ---------- */
  useEffect(() => {
    window.smartcal = {
      // "this is what I currently see"
      getSnapshot: () => ({
        view,
        date: dateKey(anchor),
        calendars: dataRef.current?.calendars || [],
        events: (dataRef.current?.events || []).filter(
          (e) => calMap[e.calendarId]?.visible !== false
        ),
      }),
      parse: (text) => parse(text, new Date()),
      // "add lunch with George at 1pm" — accepts a phrase or a full event object
      addEvent: (input) => {
        const ev =
          typeof input === "string"
            ? parsedToEvent(parse(input, new Date()), firstUserCal())
            : { id: crypto.randomUUID(), ...input };
        upsert(ev);
        return ev;
      },
      refresh: () => refreshAll(),
    };
  }, [view, anchor, calMap, upsert, refreshAll, firstUserCal]);

  /* ---------- render ---------- */
  if (!data) {
    return (
      <>
        <Style />
        <div className="app loadwrap">
          <Loader2 className="spin" size={26} />
          <span>Loading your calendar…</span>
        </div>
      </>
    );
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));
  const days = view === "week" ? weekDays : [anchor];
  const titleLabel =
    view === "month"
      ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
      : view === "week"
        ? `${MONTHS[weekDays[0].getMonth()].slice(0, 3)} ${weekDays[0].getDate()} – ${MONTHS[weekDays[6].getMonth()].slice(0, 3)} ${weekDays[6].getDate()}, ${weekDays[6].getFullYear()}`
        : `${DAY_NAMES[anchor.getDay()]}, ${MONTHS[anchor.getMonth()]} ${anchor.getDate()}`;

  return (
    <>
      <Style />
      <div className="app">
        <Sidebar
          data={data} calMap={calMap} anchor={anchor} setAnchor={setAnchor} now={now}
          nlText={nlText} setNlText={setNlText} nlError={nlError} runNL={runNL}
          preview={preview} setPreview={setPreview} acceptPreview={acceptPreview} editFromPreview={editFromPreview}
          toggleCal={toggleCal} addCal={addCal}
          addFeed={addFeed} removeFeed={removeFeed} refreshFeed={refreshFeed} refreshAll={refreshAll} syncing={syncing}
          onImport={onImport} onExport={onExport} fileRef={fileRef}
        />

        <main className="main">
          <header className="topbar">
            <div className="topbar-left">
              <button className="btn ghost" onClick={goToday}>Today</button>
              <div className="nav-pair">
                <button className="icon-btn" onClick={() => step(-1)}><ChevronLeft size={18} /></button>
                <button className="icon-btn" onClick={() => step(1)}><ChevronRight size={18} /></button>
              </div>
              <h1 className="cal-title">{titleLabel}</h1>
            </div>
            <div className="topbar-right">
              <div className="seg">
                {["day", "week", "month"].map((v) => (
                  <button key={v} className={`seg-btn ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
                    {v[0].toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
              <button
                className="btn primary"
                onClick={() => newAt(
                  view === "month" ? anchor : sameDay(anchor, now) ? now : anchor,
                  Math.min(now.getHours(), 22), 0
                )}
              >
                <Plus size={15} /> Event
              </button>
            </div>
          </header>

          {view === "month" ? (
            <MonthView
              anchor={anchor} events={visibleEvents} calMap={calMap} today={now}
              onDay={(d) => { setAnchor(d); setView("day"); }}
              onEvent={(ev) => setEditing(ev)}
              onEmpty={(d) => newAt(d, 9, 0)}
            />
          ) : (
            <TimeGrid
              days={days} events={visibleEvents} calMap={calMap} today={now}
              scrollRef={scrollRef} onSlot={newAt} onEvent={(ev) => setEditing(ev)} singular={view === "day"}
            />
          )}
        </main>
      </div>

      {editing && (
        <EventEditor
          event={editing}
          calendars={data.calendars}
          onClose={() => setEditing(null)}
          onSave={(ev) => {
            const { _isNew, ...clean } = ev;
            upsert(clean);
            setEditing(null);
            flash(_isNew ? "Event added" : "Event updated");
          }}
          onDelete={(id) => { remove(id); setEditing(null); flash("Event deleted"); }}
        />
      )}

      {toast && (
        <div className="toast"><Check size={14} /> {toast}</div>
      )}
    </>
  );
}
