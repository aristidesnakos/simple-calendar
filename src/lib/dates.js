/* ============================ date utilities ============================ */
export const pad = (n) => String(n).padStart(2, "0");

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];

// Local wall-clock ISO, e.g. "2026-06-07T13:30" — deliberately no timezone
// suffix so the string always means "this time, in the user's local zone".
export const toLocalISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;

export const dateKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseLocal = (s) => {
  // "YYYY-MM-DDTHH:mm"
  const [date, time] = s.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h = 0, mi = 0] = (time || "").split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi);
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const addMinutesISO = (iso, mins) => {
  const d = parseLocal(iso);
  d.setMinutes(d.getMinutes() + mins);
  return toLocalISO(d);
};

export const startOfWeek = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
};

export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const minutesOf = (d) => d.getHours() * 60 + d.getMinutes();

export const fmtTime = (d) => {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return m ? `${h}:${pad(m)} ${ap}` : `${h} ${ap}`;
};

export const fmtHour = (h) => {
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh} ${ap}`;
};

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
