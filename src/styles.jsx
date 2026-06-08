import React from "react";

/* ============================ styles ============================ */
export default function Style() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

* { box-sizing: border-box; }
body { margin: 0; }
.app, .app * { font-family: 'Hanken Grotesk', sans-serif; }
:root {
  --bg:#0c0c0e; --panel:#141418; --panel2:#1a1a1f; --raise:#202028;
  --line:#26262d; --line-soft:#1d1d23;
  --text:#ece8df; --dim:#9b988f; --faint:#6b685f;
  --accent:#d9a441; --accent-soft:rgba(217,164,65,.16);
  --now:#e0533b; --ok:#46b89a; --err:#e0533b;
}
.app {
  display:flex; height:100vh; min-height:560px;
  background:var(--bg); color:var(--text); overflow:hidden;
  font-size:14px;
}
.loadwrap { align-items:center; justify-content:center; gap:12px; color:var(--dim); }
.spin { animation:spin 1s linear infinite; } @keyframes spin { to { transform:rotate(360deg); } }
button { cursor:pointer; font-family:inherit; }
::-webkit-scrollbar { width:10px; height:10px; }
::-webkit-scrollbar-thumb { background:#2c2c34; border-radius:8px; border:2px solid var(--bg); }
::-webkit-scrollbar-thumb:hover { background:#3a3a44; }

/* ---------- sidebar ---------- */
.sidebar { width:288px; flex-shrink:0; background:var(--panel); border-right:1px solid var(--line);
  display:flex; flex-direction:column; padding:16px 14px; gap:14px; overflow-y:auto; }
.brand { display:flex; align-items:center; gap:10px; }
.brand-mark { width:32px; height:32px; border-radius:9px; background:var(--accent-soft); color:var(--accent);
  display:flex; align-items:center; justify-content:center; }
.brand-name { font-family:'Fraunces',serif; font-size:19px; font-weight:600; letter-spacing:.2px; }
.brand-sub { font-size:11px; color:var(--faint); margin-top:-2px; }

.nl-box { background:var(--panel2); border:1px solid var(--line); border-radius:12px; padding:11px; }
.nl-head { display:flex; align-items:center; gap:6px; font-size:11px; text-transform:uppercase;
  letter-spacing:.7px; color:var(--accent); font-weight:600; margin-bottom:8px; }
.nl-input-row { display:flex; gap:6px; }
.nl-input { flex:1; background:var(--bg); border:1px solid var(--line); border-radius:8px; color:var(--text);
  padding:9px 10px; font-size:13.5px; outline:none; transition:border-color .15s; min-width:0; }
.nl-input:focus { border-color:var(--accent); }
.nl-input::placeholder { color:var(--faint); }
.nl-go { width:36px; flex-shrink:0; background:var(--accent); border:none; border-radius:8px; color:#1c1404;
  display:flex; align-items:center; justify-content:center; transition:filter .15s; }
.nl-go:hover { filter:brightness(1.08); } .nl-go:disabled { opacity:.4; cursor:default; }
.nl-note { font-size:11.5px; color:var(--dim); margin-top:7px; line-height:1.4; }

.preview { display:flex; gap:9px; margin-top:10px; padding-top:10px; border-top:1px solid var(--line);
  animation:rise .2s ease; }
@keyframes rise { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
.preview-dot { width:4px; border-radius:3px; flex-shrink:0; }
.preview-body { flex:1; min-width:0; }
.preview-title { font-weight:600; font-size:14px; }
.preview-when { font-size:12px; color:var(--dim); margin:2px 0 7px; font-family:'JetBrains Mono',monospace; }
.preview-cal { width:100%; background:var(--bg); border:1px solid var(--line); border-radius:7px;
  color:var(--text); padding:5px 7px; font-size:12.5px; margin-bottom:8px; }
.preview-actions { display:flex; gap:6px; }

.mini { background:var(--panel2); border:1px solid var(--line); border-radius:12px; padding:11px; }
.mini-head { display:flex; justify-content:space-between; align-items:center; font-size:12.5px; font-weight:600; margin-bottom:8px; }
.mini-nav { display:flex; gap:2px; }
.mini-dow { display:grid; grid-template-columns:repeat(7,1fr); margin-bottom:3px; }
.mini-dow span { text-align:center; font-size:10px; color:var(--faint); }
.mini-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:1px; }
.mini-cell { aspect-ratio:1; border:none; background:transparent; color:var(--dim); font-size:11.5px;
  border-radius:6px; font-family:'JetBrains Mono',monospace; transition:background .12s; }
.mini-cell:hover { background:var(--raise); color:var(--text); }
.mini-cell.dim { color:var(--faint); opacity:.5; }
.mini-cell.sel { background:var(--raise); color:var(--text); }
.mini-cell.today { color:var(--accent); font-weight:600; }
.mini-cell.today.sel { background:var(--accent); color:#1c1404; }

.cal-section { display:flex; flex-direction:column; }
.section-head { display:flex; justify-content:space-between; align-items:center; font-size:11px;
  text-transform:uppercase; letter-spacing:.7px; color:var(--faint); font-weight:600; padding:0 4px 6px; }
.cal-row { display:flex; align-items:center; gap:9px; padding:7px 8px; border:none; background:transparent;
  border-radius:8px; width:100%; text-align:left; color:var(--text); transition:background .12s; }
.cal-row:hover { background:var(--panel2); }
.cal-row.off { color:var(--faint); }
.cal-swatch { width:13px; height:13px; border-radius:4px; border:1.5px solid; flex-shrink:0; }
.cal-name { flex:1; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cal-eye { color:var(--faint); flex-shrink:0; }
.cal-sync { color:var(--faint); flex-shrink:0; display:flex; }

/* ---------- feeds ---------- */
.feed-row { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:8px; }
.feed-row:hover { background:var(--panel2); }
.feed-main { flex:1; min-width:0; display:flex; flex-direction:column; }
.feed-name { font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.feed-status { font-size:10.5px; color:var(--faint); font-family:'JetBrains Mono',monospace;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.feed-status.err { color:var(--err); }
.feed-status.ok { color:var(--dim); }
.feed-add { background:var(--panel2); border:1px solid var(--line); border-radius:8px; padding:9px; margin-top:6px;
  display:flex; flex-direction:column; gap:7px; animation:rise .18s ease; }
.feed-add input { background:var(--bg); border:1px solid var(--line); border-radius:7px; color:var(--text);
  padding:7px 9px; font-size:12.5px; outline:none; }
.feed-add input:focus { border-color:var(--accent); }
.feed-hint { font-size:10.5px; color:var(--faint); line-height:1.45; }
.feed-hint a { color:var(--dim); }
.feed-hint.err-hint { color:#e0823f; padding:2px 8px 4px; }

/* ---------- Google connect ---------- */
.btn.google-connect { width:100%; justify-content:center; margin:4px 0 2px;
  background:var(--panel2); color:var(--text); border:1px solid var(--line); }
.btn.google-connect:hover { background:var(--raise); border-color:var(--accent); }
.btn.google-connect:disabled { opacity:.6; cursor:default; }
.feed-disconnect { display:block; width:100%; text-align:center; background:transparent; border:none;
  color:var(--faint); font-size:10.5px; padding:2px 0 4px; cursor:pointer; }
.feed-disconnect:hover { color:#e0533b; }

.gpick-list { display:flex; flex-direction:column; gap:2px; max-height:300px; overflow-y:auto;
  margin:4px 0 8px; }
.gpick-row { display:flex; align-items:center; gap:9px; padding:8px 8px; border-radius:8px;
  cursor:pointer; transition:background .12s; }
.gpick-row:hover { background:var(--panel2); }
.gpick-row.added { opacity:.55; cursor:default; }
.gpick-row input { accent-color:var(--accent); width:15px; height:15px; flex-shrink:0; }
.gpick-swatch { width:12px; height:12px; border-radius:4px; flex-shrink:0; }
.gpick-name { font-size:13px; color:var(--text); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gpick-added { font-size:10px; color:var(--faint); text-transform:uppercase; letter-spacing:.04em; }

.sidebar-foot { margin-top:auto; display:flex; flex-direction:column; gap:6px; padding-top:8px; }

/* ---------- buttons ---------- */
.btn { display:inline-flex; align-items:center; gap:6px; border-radius:9px; padding:8px 13px;
  font-size:13px; font-weight:600; border:1px solid transparent; transition:all .14s; white-space:nowrap; }
.btn.sm { padding:5px 9px; font-size:12px; border-radius:7px; }
.btn.wide { justify-content:center; }
.btn.primary { background:var(--accent); color:#1c1404; }
.btn.primary:hover { filter:brightness(1.08); }
.btn.primary:disabled { opacity:.5; cursor:default; }
.btn.ghost { background:var(--panel2); color:var(--text); border-color:var(--line); }
.btn.ghost:hover { background:var(--raise); }
.btn.danger { background:transparent; color:#e0533b; border-color:transparent; }
.btn.danger:hover { background:rgba(224,83,59,.12); }
.icon-btn { display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:8px;
  background:transparent; border:none; color:var(--dim); transition:all .12s; flex-shrink:0; }
.icon-btn:hover { background:var(--panel2); color:var(--text); }
.icon-btn:disabled { opacity:.4; cursor:default; }
.icon-btn.xs { width:22px; height:22px; }
.icon-btn.tiny { width:24px; height:24px; }

/* ---------- main ---------- */
.main { flex:1; display:flex; flex-direction:column; min-width:0; }
.topbar { display:flex; justify-content:space-between; align-items:center; padding:14px 18px;
  border-bottom:1px solid var(--line); gap:12px; }
.topbar-left { display:flex; align-items:center; gap:12px; min-width:0; }
.nav-pair { display:flex; }
.cal-title { font-family:'Fraunces',serif; font-size:21px; font-weight:500; margin:0; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis; }
.topbar-right { display:flex; align-items:center; gap:10px; }
.seg { display:flex; background:var(--panel2); border:1px solid var(--line); border-radius:9px; padding:2px; }
.seg-btn { background:transparent; border:none; color:var(--dim); padding:5px 12px; border-radius:7px;
  font-size:12.5px; font-weight:600; transition:all .12s; }
.seg-btn.active { background:var(--raise); color:var(--text); box-shadow:0 1px 2px rgba(0,0,0,.3); }

/* ---------- time grid ---------- */
.grid-wrap { flex:1; display:flex; flex-direction:column; min-height:0; }
.grid-header { display:grid; border-bottom:1px solid var(--line); }
.gh-corner { border-right:1px solid var(--line-soft); }
.gh-day { display:flex; flex-direction:column; align-items:center; gap:1px; padding:9px 0 8px;
  border-left:1px solid var(--line-soft); }
.gh-dow { font-size:10.5px; text-transform:uppercase; letter-spacing:.8px; color:var(--faint); font-weight:600; }
.gh-num { font-family:'JetBrains Mono',monospace; font-size:18px; color:var(--text); width:32px; height:32px;
  display:flex; align-items:center; justify-content:center; border-radius:50%; }
.gh-num.today { background:var(--accent); color:#1c1404; font-weight:500; }

.allday { display:grid; border-bottom:1px solid var(--line); max-height:84px; overflow-y:auto; }
.ad-label { font-size:10px; color:var(--faint); text-transform:uppercase; letter-spacing:.6px;
  padding:7px 6px 0; text-align:right; border-right:1px solid var(--line-soft); }
.ad-cell { border-left:1px solid var(--line-soft); padding:5px 4px; display:flex; flex-direction:column; gap:3px; min-height:30px; }
.ad-chip { display:flex; align-items:center; gap:5px; font-size:12px; padding:3px 7px; border-radius:6px;
  border-left:3px solid; cursor:pointer; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.ad-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }

.grid-scroll { flex:1; overflow-y:auto; }
.grid-body { display:grid; position:relative; }
.gutter { position:relative; }
.gutter-cell { position:relative; border-right:1px solid var(--line-soft); }
.gutter-cell span { position:absolute; top:-7px; right:8px; font-size:10.5px; color:var(--faint);
  font-family:'JetBrains Mono',monospace; }
.day-col { position:relative; border-left:1px solid var(--line-soft); }
.day-col:hover { background:rgba(255,255,255,.012); }
.hline { position:absolute; left:0; right:0; height:1px; background:var(--line-soft); pointer-events:none; }
.event { position:absolute; border-radius:6px; padding:3px 7px; overflow:hidden; cursor:pointer;
  transition:filter .12s, transform .06s; z-index:2; }
.event:hover { filter:brightness(1.18); }
.event.readonly { cursor:default; }
.event-title { font-size:12.5px; font-weight:600; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.event-time { font-size:11px; color:var(--dim); font-family:'JetBrains Mono',monospace; margin-top:1px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.now-line { position:absolute; left:0; right:0; height:2px; background:var(--now); z-index:5; pointer-events:none; }
.now-dot { position:absolute; left:-4px; top:-3px; width:8px; height:8px; border-radius:50%; background:var(--now); }

/* ---------- month ---------- */
.month { flex:1; display:flex; flex-direction:column; min-height:0; }
.month-dow { display:grid; grid-template-columns:repeat(7,1fr); border-bottom:1px solid var(--line); }
.month-dow div { padding:8px 0; text-align:center; font-size:10.5px; text-transform:uppercase;
  letter-spacing:.8px; color:var(--faint); font-weight:600; }
.month-grid { flex:1; display:grid; grid-template-columns:repeat(7,1fr); grid-template-rows:repeat(6,1fr); min-height:0; }
.mcell { border-left:1px solid var(--line-soft); border-bottom:1px solid var(--line-soft);
  padding:5px 5px 3px; overflow:hidden; cursor:pointer; display:flex; flex-direction:column; gap:3px; transition:background .1s; }
.mcell:hover { background:rgba(255,255,255,.015); }
.mcell.dim { background:rgba(0,0,0,.18); }
.mcell.dim .mcell-num { color:var(--faint); }
.mcell-head { display:flex; justify-content:flex-end; }
.mcell-num { font-family:'JetBrains Mono',monospace; font-size:13px; color:var(--text); width:24px; height:24px;
  display:flex; align-items:center; justify-content:center; border-radius:50%; }
.mcell-num:hover { background:var(--raise); }
.mcell-num.today { background:var(--accent); color:#1c1404; font-weight:500; }
.mcell-events { display:flex; flex-direction:column; gap:2px; overflow:hidden; }
.mchip { display:flex; align-items:center; gap:5px; font-size:11.5px; padding:1px 2px; border-radius:4px;
  white-space:nowrap; overflow:hidden; }
.mchip:hover { background:var(--raise); }
.mchip-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.mchip-text { overflow:hidden; text-overflow:ellipsis; }
.mchip-text em { color:var(--dim); font-style:normal; font-family:'JetBrains Mono',monospace; font-size:10.5px; }
.mmore { font-size:11px; color:var(--faint); padding-left:2px; }
.mmore:hover { color:var(--accent); }

/* ---------- modal ---------- */
.modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.5); backdrop-filter:blur(3px);
  display:flex; align-items:center; justify-content:center; z-index:100; animation:fade .15s; }
@keyframes fade { from { opacity:0; } to { opacity:1; } }
.modal { width:420px; max-width:92vw; background:var(--panel); border:1px solid var(--line); border-radius:16px;
  padding:18px; box-shadow:0 30px 70px rgba(0,0,0,.6); animation:pop .18s ease; }
@keyframes pop { from { opacity:0; transform:scale(.97) translateY(6px); } to { opacity:1; transform:none; } }
.modal-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;
  font-family:'Fraunces',serif; font-size:17px; font-weight:500; }
.field { background:var(--bg); border:1px solid var(--line); border-radius:8px; color:var(--text);
  padding:9px 11px; font-size:14px; outline:none; transition:border-color .14s; }
.field:focus { border-color:var(--accent); }
.field::placeholder { color:var(--faint); }
.field:disabled { opacity:.7; cursor:default; }
.title-field { width:100%; font-size:16px; margin-bottom:12px; }
.row { display:flex; align-items:center; gap:9px; margin-bottom:10px; }
.row .field { flex:1; }
.row .field.tight { flex:0 0 92px; }
.row-ico { color:var(--dim); flex-shrink:0; width:16px; }
.dot { width:13px; height:13px; border-radius:4px; display:inline-block; }
.dash { color:var(--faint); }
.ro-badge { display:inline-flex; align-items:center; gap:5px; font-size:11px; color:var(--dim);
  background:var(--panel2); border:1px solid var(--line); border-radius:20px; padding:3px 9px; }
.toggle-row { cursor:pointer; user-select:none; }
.switch { width:34px; height:19px; border-radius:20px; background:var(--raise); position:relative; transition:background .15s; flex-shrink:0; }
.switch.on { background:var(--accent); }
.knob { position:absolute; top:2px; left:2px; width:15px; height:15px; border-radius:50%; background:#fff; transition:left .15s; }
.switch.on .knob { left:17px; }
.modal-foot { display:flex; justify-content:space-between; align-items:center; margin-top:16px; }
.foot-right { display:flex; gap:8px; }

/* ---------- toast ---------- */
.toast { position:fixed; bottom:26px; left:50%; transform:translateX(-50%); z-index:200;
  background:var(--raise); border:1px solid var(--line); color:var(--text); padding:9px 16px; border-radius:10px;
  font-size:13px; font-weight:500; display:flex; align-items:center; gap:7px; box-shadow:0 12px 30px rgba(0,0,0,.5);
  animation:rise .2s ease; }
.toast svg { color:var(--accent); }
`}</style>
  );
}
