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

  let pushTimer = null;

  window.GymoraCloud = {
    hasSession: () => !!getToken(),

    /* create the cloud account right after a local signup */
    async signup(email, password, profile) {
      const r = await call("/signup", "POST", { email, password, profile });
      if (r && r.token) setToken(r.token);
      return r;
    },

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
