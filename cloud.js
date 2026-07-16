/* =============================================================
   GYMORA — cloud sync client
   Talks to the backend API (netlify/functions/api.mjs). Every call
   fails silently, so the app keeps working offline / from file://
   exactly as before — the cloud is a bonus, never a requirement.
   ============================================================= */

(function () {
  const BASE = (window.GYMORA_CONFIG && window.GYMORA_CONFIG.apiBase) || "/api";
  const getToken = () => localStorage.getItem("gym_cloud_token");
  const setToken = (t) => localStorage.setItem("gym_cloud_token", t);
  const clearToken = () => localStorage.removeItem("gym_cloud_token");

  async function call(path, method, body, auth) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (auth) {
        const tok = getToken();
        if (!tok) return null;
        headers.Authorization = "Bearer " + tok;
      }
      const r = await fetch(BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  /* like call(), but keeps the server's error message and separates
     "the backend said no" from "the backend is unreachable" */
  async function callFull(path, method, body, auth) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (auth) {
        const tok = getToken();
        if (!tok) return { ok: false, offline: true, data: null };
        headers.Authorization = "Bearer " + tok;
      }
      const r = await fetch(BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await r.json().catch(() => null);
      // A failure without a JSON body isn't the API talking (404 from a
      // static host, proxy error page…) — treat it as unreachable.
      return { ok: r.ok, offline: !r.ok && data == null, status: r.status, data };
    } catch (e) { return { ok: false, offline: true, data: null }; }
  }

  let pushTimer = null;

  window.GymoraCloud = {
    hasSession: () => !!getToken(),

    /* create the cloud account right after a local signup */
    async signup(email, password, profile) {
      const r = await call("/signup", "POST", { email, password, profile });
      if (r && r.token) setToken(r.token);
      return r;
    },

    /* staff-role signup: the backend validates & consumes the access
       key. Returns { ok, offline, error, profile } — offline means
       the backend was unreachable, not that the key was rejected. */
    async signupWithKey(email, password, profile, accessKey) {
      const r = await callFull("/signup", "POST", { email, password, profile, accessKey });
      if (r.ok && r.data && r.data.token) setToken(r.data.token);
      return { ok: r.ok, offline: r.offline, error: r.data && r.data.error, profile: r.data && r.data.profile };
    },

    /* members of the requesting staff account's gym (coach portal) */
    listMembers: () => callFull("/members", "GET", null, true),

    /* owner assigns a job role to a staff account */
    setStaffRole: (email, staffRole) => callFull("/members", "PUT", { email, staffRole }, true),

    /* access keys (admin console / owner dashboard) */
    createKey: (role, gymId) => callFull("/keys", "POST", { role, gymId }, true),
    listKeys: () => callFull("/keys", "GET", null, true),
    revokeKey: (key) => callFull("/keys", "PUT", { key }, true),
    deleteKey: (key) => callFull("/keys", "DELETE", { key }, true),

    /* sign in against the cloud; returns { token, profile } or null */
    async login(email, password) {
      const r = await call("/login", "POST", { email, password });
      if (r && r.token) setToken(r.token);
      return r;
    },

    logout() { clearToken(); },

    async pull() { return call("/profile", "GET", null, true); },

    /* gyms managed from the admin console; null → keep built-in defaults */
    async loadGyms() {
      const r = await call("/gyms", "GET");
      return r && Array.isArray(r.gyms) && r.gyms.length ? r.gyms : null;
    },

    /* debounced profile upload — call freely after every local change */
    pushSoon(profile) {
      if (!getToken()) return;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => call("/profile", "PUT", { profile }, true), 1500);
    },
  };
})();
