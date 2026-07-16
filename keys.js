/* =============================================================
   GYMORA — access keys (AES-128)
   Staff-role accounts (gym owner / coach / gym staff) are created
   with a one-time access key. Gym owner keys come only from the
   admin console; coach & staff keys come from the admin console or
   the gym owner's dashboard.

   Keys are 128-bit codes (26 characters from a 32-symbol alphabet).
   Key records are stored AES-128-GCM encrypted — in Netlify Blobs
   via /api when the backend is reachable (see api.mjs), and in this
   browser via WebCrypto as the offline/prototype fallback. This
   module is the browser-local half; cloud.js carries the API calls.
   ============================================================= */

(function () {
  const STORE = "gym_access_keys";   // encrypted records [{iv,ct}] (or {plain} where WebCrypto is unavailable, e.g. file://)
  const DEVKEY = "gym_access_kdev";  // this device's AES-128 key (base64)
  const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ023456789"; // 32 symbols, no 1/I/L/O
  const PREFIX = { owner: "GO", coach: "CH", staff: "ST" };

  /* ---- 128-bit key string, e.g. CH-A7KQ2X-9MPWD-4TZNV-8RHCF-E23GY ---- */
  function randomKeyString(role) {
    const bytes = new Uint8Array(26);
    crypto.getRandomValues(bytes);
    let s = "";
    for (const b of bytes) s += ALPHABET[b % 32];
    return (PREFIX[role] || "AK") + "-" + [s.slice(0, 6), s.slice(6, 11), s.slice(11, 16), s.slice(16, 21), s.slice(21, 26)].join("-");
  }

  /* ---- AES-128-GCM at rest (WebCrypto) ---- */
  const b64k = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const b64kbuf = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const subtle = (window.crypto && crypto.subtle) || null;

  let devKeyPromise = null;
  function deviceKey() {
    if (!devKeyPromise) {
      devKeyPromise = (async () => {
        let raw = localStorage.getItem(DEVKEY);
        if (!raw) { raw = b64k(crypto.getRandomValues(new Uint8Array(16))); localStorage.setItem(DEVKEY, raw); }
        return subtle.importKey("raw", b64kbuf(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
      })();
    }
    return devKeyPromise;
  }
  async function encryptRecord(rec) {
    if (!subtle) return { plain: rec };
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: "AES-GCM", iv }, await deviceKey(), new TextEncoder().encode(JSON.stringify(rec)));
    return { iv: b64k(iv), ct: b64k(ct) };
  }
  async function decryptRecord(row) {
    if (row && row.plain) return row.plain;
    if (!subtle || !row || !row.iv || !row.ct) return null;
    try {
      const pt = await subtle.decrypt({ name: "AES-GCM", iv: b64kbuf(row.iv) }, await deviceKey(), b64kbuf(row.ct));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch (e) { return null; }
  }

  const readRows = () => { try { const v = JSON.parse(localStorage.getItem(STORE) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const writeRows = (rows) => localStorage.setItem(STORE, JSON.stringify(rows));

  async function allRecords() {
    const rows = readRows(), out = [];
    for (let i = 0; i < rows.length; i++) {
      const r = await decryptRecord(rows[i]);
      if (r && r.key) out.push({ ...r, _i: i });
    }
    return out;
  }
  async function saveRecord(rec, index) {
    const rows = readRows();
    const clean = { ...rec }; delete clean._i;
    const enc = await encryptRecord(clean);
    if (index == null || index < 0) rows.push(enc); else rows[index] = enc;
    writeRows(rows);
  }

  const normalize = (k) => String(k || "").trim().toUpperCase().replace(/\s+/g, "");

  window.GymoraKeys = {
    normalize,

    /* create a key on this device (admin console / owner dashboard, offline mode) */
    async create(role, gymId, issuedBy) {
      const rec = { key: randomKeyString(role), role, gymId: gymId || null, issuedBy: issuedBy || null, createdAt: Date.now(), usedBy: null, usedAt: null, revoked: false };
      await saveRecord(rec, null);
      return rec;
    },

    async list(filter) {
      const all = (await allRecords()).sort((a, b) => b.createdAt - a.createdAt);
      return filter ? all.filter(filter) : all;
    },

    async revoke(key) {
      const k = normalize(key);
      const r = (await allRecords()).find(x => x.key === k);
      if (!r) return false;
      const i = r._i; r.revoked = true;
      await saveRecord(r, i);
      return true;
    },

    async remove(key) {
      const k = normalize(key);
      const r = (await allRecords()).find(x => x.key === k);
      if (!r) return false;
      const rows = readRows(); rows.splice(r._i, 1); writeRows(rows);
      return true;
    },

    /* validate + consume one key during sign-up (offline mode) */
    async consume(key, role, email) {
      const k = normalize(key);
      const r = (await allRecords()).find(x => x.key === k && x.role === role && !x.usedBy && !x.revoked);
      if (!r) return null;
      const i = r._i; r.usedBy = email; r.usedAt = Date.now();
      await saveRecord(r, i);
      const out = { ...r }; delete out._i;
      return out;
    },
  };
})();
