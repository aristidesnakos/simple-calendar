/* ============================ persistence ============================
 * A tiny async key/value wrapper. It prefers a host-provided `window.storage`
 * (e.g. the Claude artifact sandbox) and falls back to localStorage. Keeping it
 * async behind one interface means a real backend can be slotted in later
 * without touching callers.
 * ===========================================================================*/
export const storage = {
  async get(key) {
    if (typeof window !== "undefined" && window.storage?.get) {
      try {
        const r = await window.storage.get(key);
        return r?.value ?? null;
      } catch {
        /* fall through to localStorage */
      }
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async set(key, value) {
    if (typeof window !== "undefined" && window.storage?.set) {
      try {
        await window.storage.set(key, value, false);
        return;
      } catch {
        /* fall through to localStorage */
      }
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      /* quota / unavailable — nothing more we can do client-side */
    }
  },
};
