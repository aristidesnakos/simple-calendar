import React, { useState } from "react";
import {
  Calendar, Plus, ChevronRight, Sparkles, Check, Upload, Download,
  Eye, EyeOff, RefreshCw, Trash2, Rss,
} from "lucide-react";
import { DAY_NAMES, MONTHS, parseLocal, fmtTime } from "../lib/dates.js";
import MiniMonth from "./MiniMonth.jsx";

function relTime(iso, now) {
  if (!iso) return "never";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export default function Sidebar({
  data, calMap, anchor, setAnchor, now,
  nlText, setNlText, nlError, runNL, preview, setPreview, acceptPreview, editFromPreview,
  toggleCal, addCal,
  addFeed, removeFeed, refreshFeed, refreshAll, syncing,
  onImport, onExport, fileRef,
}) {
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [feedName, setFeedName] = useState("");

  const userCals = data.calendars.filter((c) => !c.isFeed);
  const feeds = data.feeds || [];

  const submitFeed = () => {
    if (!feedUrl.trim()) return;
    addFeed(feedUrl.trim(), feedName.trim());
    setFeedUrl("");
    setFeedName("");
    setShowAddFeed(false);
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><Calendar size={17} /></span>
        <div>
          <div className="brand-name">SmartCal</div>
          <div className="brand-sub">one place, fast entry</div>
        </div>
      </div>

      {/* natural language quick add */}
      <div className="nl-box">
        <div className="nl-head"><Sparkles size={13} /> Quick add</div>
        <div className="nl-input-row">
          <input
            className="nl-input"
            value={nlText}
            placeholder="Lunch with Sam Tuesday 1pm…"
            onChange={(e) => setNlText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runNL(); }}
          />
          <button className="nl-go" onClick={runNL} disabled={!nlText.trim()} title="Parse">
            <ChevronRight size={16} />
          </button>
        </div>
        {nlError && <div className="nl-note">{nlError}</div>}
        {preview && (
          <div className="preview">
            <div className="preview-dot" style={{ background: calMap[preview.event.calendarId]?.color }} />
            <div className="preview-body">
              <div className="preview-title">{preview.event.title}</div>
              <div className="preview-when">{preview.label}</div>
              <select
                className="preview-cal"
                value={preview.event.calendarId}
                onChange={(e) =>
                  setPreview((p) => ({ ...p, event: { ...p.event, calendarId: e.target.value } }))
                }
              >
                {userCals.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="preview-actions">
                <button className="btn primary sm" onClick={acceptPreview}><Check size={13} /> Add</button>
                <button className="btn ghost sm" onClick={editFromPreview}>Edit</button>
                <button className="btn ghost sm" onClick={() => setPreview(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <MiniMonth anchor={anchor} onPick={(d) => setAnchor(d)} today={now} />

      {/* user calendars */}
      <div className="cal-section">
        <div className="section-head">
          <span>Calendars</span>
          <button className="icon-btn tiny" onClick={addCal} title="Add calendar"><Plus size={14} /></button>
        </div>
        {userCals.map((c) => (
          <button key={c.id} className={`cal-row ${c.visible ? "" : "off"}`} onClick={() => toggleCal(c.id)}>
            <span className="cal-swatch" style={{ background: c.visible ? c.color : "transparent", borderColor: c.color }} />
            <span className="cal-name">{c.name}</span>
            {c.visible ? <Eye size={13} className="cal-eye" /> : <EyeOff size={13} className="cal-eye" />}
          </button>
        ))}
      </div>

      {/* feed subscriptions */}
      <div className="cal-section">
        <div className="section-head">
          <span>Subscriptions</span>
          <span style={{ display: "flex", gap: 2 }}>
            {feeds.length > 0 && (
              <button className="icon-btn tiny" onClick={refreshAll} title="Refresh all" disabled={syncing.all}>
                <RefreshCw size={13} className={syncing.all ? "spin" : ""} />
              </button>
            )}
            <button className="icon-btn tiny" onClick={() => setShowAddFeed((v) => !v)} title="Subscribe to a calendar">
              <Plus size={14} />
            </button>
          </span>
        </div>

        {feeds.map((f) => {
          const cal = calMap[f.calendarId];
          const busy = syncing.all || syncing.ids?.[f.id];
          return (
            <div key={f.id} className="feed-row">
              <button
                className="cal-swatch"
                style={{ background: cal?.visible ? cal.color : "transparent", borderColor: cal?.color, cursor: "pointer" }}
                onClick={() => toggleCal(f.calendarId)}
                title={cal?.visible ? "Hide" : "Show"}
              />
              <div className="feed-main">
                <span className="feed-name">{cal?.name || "Feed"}</span>
                <span className={`feed-status ${f.lastError ? "err" : "ok"}`}>
                  {f.lastError ? f.lastError : `synced ${relTime(f.lastSync, now)}`}
                </span>
              </div>
              <button className="icon-btn tiny" onClick={() => refreshFeed(f.id)} disabled={busy} title="Refresh now">
                <RefreshCw size={12} className={busy ? "spin" : ""} />
              </button>
              <button className="icon-btn tiny" onClick={() => removeFeed(f.id)} title="Unsubscribe">
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}

        {feeds.length === 0 && !showAddFeed && (
          <div className="feed-hint" style={{ padding: "2px 8px 4px" }}>
            <Rss size={11} style={{ verticalAlign: "-1px" }} /> Subscribe to Google, Apple or Outlook
            calendars by their secret <code>.ics</code> link.
          </div>
        )}

        {showAddFeed && (
          <div className="feed-add">
            <input
              placeholder="Calendar feed URL (https:// or webcal://)"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitFeed(); }}
              autoFocus
            />
            <input
              placeholder="Name (optional)"
              value={feedName}
              onChange={(e) => setFeedName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitFeed(); }}
            />
            <div className="feed-hint">
              Google: Settings → your calendar → “Secret address in iCal format”.
              Apple: share a calendar publicly and copy the <code>webcal://</code> link.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn primary sm" onClick={submitFeed} disabled={!feedUrl.trim()}>
                <Check size={13} /> Subscribe
              </button>
              <button className="btn ghost sm" onClick={() => setShowAddFeed(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-foot">
        <button className="btn ghost wide" onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> Import .ics
        </button>
        <button className="btn ghost wide" onClick={onExport}>
          <Download size={14} /> Export .ics
        </button>
        <input ref={fileRef} type="file" accept=".ics,text/calendar" hidden onChange={onImport} />
      </div>
    </aside>
  );
}

// Build the human-friendly "when" label shown in the quick-add preview.
export function previewLabel(ev) {
  const d = parseLocal(ev.start);
  const head = `${DAY_NAMES[d.getDay()]} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  return ev.allDay
    ? `${head} · all day`
    : `${head} · ${fmtTime(d)}–${fmtTime(parseLocal(ev.end))}`;
}
