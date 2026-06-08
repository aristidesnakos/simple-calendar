/* ============================ overlap layout ============================
 * Given timed events for one day (each {s, e} in minutes), assign each a lane
 * and a lane count so overlapping events sit side by side without covering one
 * another. Non-overlapping clusters are laid out independently.
 * ===========================================================================*/
export function layoutDay(items) {
  const sorted = [...items].sort((a, b) => a.s - b.s || a.e - b.e);
  const clusters = [];
  let cur = [],
    curEnd = -1;
  for (const ev of sorted) {
    if (cur.length && ev.s >= curEnd) {
      clusters.push(cur);
      cur = [];
      curEnd = -1;
    }
    cur.push(ev);
    curEnd = Math.max(curEnd, ev.e);
  }
  if (cur.length) clusters.push(cur);

  const out = [];
  for (const cl of clusters) {
    const lanes = [];
    for (const ev of cl) {
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        if (ev.s >= lanes[i]) {
          ev._lane = i;
          lanes[i] = ev.e;
          placed = true;
          break;
        }
      }
      if (!placed) {
        ev._lane = lanes.length;
        lanes.push(ev.e);
      }
    }
    for (const ev of cl) out.push({ ...ev, lane: ev._lane, lanes: lanes.length });
  }
  return out;
}
