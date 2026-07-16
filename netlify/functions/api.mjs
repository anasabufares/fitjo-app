/* =============================================================
   GYMORA — backend API (Netlify Function + Netlify Blobs storage)
   -------------------------------------------------------------
   Real accounts with server-side password hashing (scrypt) and
   signed session tokens (HS256 JWT). Profiles (favorites, weights,
   plans, points…) sync to the cloud so users can sign in from any
   device — including the mobile app.

   Endpoints (all under /api):
     GET  /api/health            → { ok: true }
     POST /api/signup            { email, password, profile }
     POST /api/login             { email, password }
     GET  /api/profile           (Bearer token) → { profile }
     PUT  /api/profile           (Bearer token) { profile }

   Set a strong JWT_SECRET in Netlify → Site configuration →
   Environment variables. A fallback is used until then (fine for
   the prototype, not for production).
   ============================================================= */

import { getStore } from "@netlify/blobs";
import { scryptSync, randomBytes, createHmac, timingSafeEqual, createHash, createCipheriv, createDecipheriv } from "node:crypto";

const SECRET = process.env.JWT_SECRET || "gymora-dev-secret-change-me";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/* ---- access keys (AES-128) ----
   One-time keys for staff-role accounts: gym owner keys are created
   only by admins; coach & staff keys by admins or gym owners. The
   key itself is a random 128-bit code; its record is stored in
   Netlify Blobs encrypted with AES-128-GCM (set ACCESS_KEY_SECRET
   in the environment, else a key derived from JWT_SECRET is used). */
const KEY_AES = createHash("sha256").update((process.env.ACCESS_KEY_SECRET || SECRET) + "|access-keys").digest().subarray(0, 16);
const KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ023456789"; // 32 symbols, no 1/I/L/O
const KEY_PREFIX = { owner: "GO", coach: "CH", staff: "ST" };
const KEY_ROLES = ["owner", "coach", "staff"];
const normalizeKey = (k) => String(k || "").trim().toUpperCase().replace(/\s+/g, "");
const keyBlobId = (key) => createHash("sha256").update(normalizeKey(key)).digest("hex");
function newKeyString(role) {
  const bytes = randomBytes(26);
  let s = "";
  for (const b of bytes) s += KEY_ALPHABET[b % 32];
  return KEY_PREFIX[role] + "-" + [s.slice(0, 6), s.slice(6, 11), s.slice(11, 16), s.slice(16, 21), s.slice(21, 26)].join("-");
}
function encryptKeyRecord(rec) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-128-gcm", KEY_AES, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(rec), "utf8"), c.final()]);
  return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), ct: ct.toString("base64") };
}
function decryptKeyRecord(row) {
  try {
    const d = createDecipheriv("aes-128-gcm", KEY_AES, Buffer.from(row.iv, "base64"));
    d.setAuthTag(Buffer.from(row.tag, "base64"));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(row.ct, "base64")), d.final()]).toString("utf8"));
  } catch { return null; }
}

/* ---- tokens (HS256 JWT, no dependencies) ---- */
const b64u = (data) => Buffer.from(data).toString("base64url");
function signToken(email) {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const pay = b64u(JSON.stringify({ sub: email, exp: Date.now() + TOKEN_TTL_MS }));
  const sig = createHmac("sha256", SECRET).update(`${head}.${pay}`).digest("base64url");
  return `${head}.${pay}.${sig}`;
}
function verifyToken(token) {
  try {
    const [head, pay, sig] = token.split(".");
    const expect = createHmac("sha256", SECRET).update(`${head}.${pay}`).digest("base64url");
    const a = Buffer.from(sig), b = Buffer.from(expect);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(pay, "base64url").toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload.sub || null;
  } catch { return null; }
}

/* ---- passwords ---- */
const hashPassword = (pw, salt) => scryptSync(String(pw), salt, 32).toString("hex");

/* ---- responses ---- */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};
const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

const validEmail = (e) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const users = getStore("gymora-users");
  const gymsStore = getStore("gymora-gyms");
  const keysStore = getStore("gymora-keys");

  /* Resolve the requesting user ({ email, profile }), or null. */
  async function requester() {
    const auth = req.headers.get("authorization") || "";
    const email = auth.startsWith("Bearer ") ? verifyToken(auth.slice(7)) : null;
    if (!email) return null;
    const rec = await users.get(email, { type: "json" });
    return rec ? { email, profile: rec.profile || {} } : null;
  }

  /* Resolve the requesting admin's email, or null. */
  async function adminEmail() {
    const me = await requester();
    return me && me.profile.role === "admin" ? me.email : null;
  }

  if (req.method === "GET" && path === "/health") return json(200, { ok: true, service: "gymora-api" });

  /* ---- gyms: public read (the app loads its gym list from here) ---- */
  if (req.method === "GET" && path === "/gyms") {
    const list = (await gymsStore.get("list", { type: "json" })) || [];
    return json(200, { gyms: list });
  }

  /* ---- gyms: admin add / edit / delete / seed ---- */
  if (path === "/admin/gyms") {
    if (!(await adminEmail())) return json(403, { error: "Admin only" });
    let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
    let list = (await gymsStore.get("list", { type: "json" })) || [];

    if (req.method === "POST" && Array.isArray(body.seed)) {
      // one-time import of the built-in sample gyms; only while the list is empty
      if (list.length) return json(409, { error: "Gyms already exist" });
      await gymsStore.setJSON("list", body.seed);
      return json(200, { ok: true, count: body.seed.length });
    }

    const g = body.gym;
    if (req.method === "POST" || req.method === "PUT") {
      if (!g || !g.name || !String(g.name.en || "").trim()) return json(400, { error: "Gym needs at least an English name" });
    }

    if (req.method === "POST") {
      g.id = "g" + Date.now();
      list.push(g);
      await gymsStore.setJSON("list", list);
      return json(200, { gym: g });
    }
    if (req.method === "PUT") {
      const i = list.findIndex(x => x.id === g.id);
      if (i < 0) return json(404, { error: "Gym not found" });
      list[i] = g;
      await gymsStore.setJSON("list", list);
      return json(200, { gym: g });
    }
    if (req.method === "DELETE") {
      const before = list.length;
      list = list.filter(x => x.id !== body.id);
      if (list.length === before) return json(404, { error: "Gym not found" });
      await gymsStore.setJSON("list", list);
      return json(200, { ok: true });
    }
  }

  /* ---- access keys: create / list / revoke / delete ----
     Admins can manage every key; a gym owner can create and manage
     coach & staff keys for their own gym. Gym owner keys are
     admin-only. Records live AES-128-GCM encrypted in Blobs. */
  if (path === "/keys") {
    const me = await requester();
    if (!me) return json(401, { error: "Not signed in" });
    const myRole = me.profile.role;
    if (myRole !== "admin" && myRole !== "owner") return json(403, { error: "Admins and gym owners only" });

    if (req.method === "POST") {
      let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
      const keyRole = String(body.role || "");
      if (!KEY_ROLES.includes(keyRole)) return json(400, { error: "Key type must be owner, coach or staff" });
      if (myRole === "owner" && keyRole === "owner") return json(403, { error: "Gym owner keys can only be generated by a GYMORA admin" });
      const gymId = myRole === "owner" ? (me.profile.gymId || null) : (body.gymId || null);
      const rec = { key: newKeyString(keyRole), role: keyRole, gymId, issuedBy: me.email, createdAt: Date.now(), usedBy: null, usedAt: null, revoked: false };
      await keysStore.setJSON(keyBlobId(rec.key), encryptKeyRecord(rec));
      return json(200, { record: rec });
    }

    if (req.method === "GET") {
      const out = [];
      const { blobs } = await keysStore.list();
      for (const b of blobs) {
        const row = await keysStore.get(b.key, { type: "json" });
        const rec = row && decryptKeyRecord(row);
        if (!rec) continue;
        if (myRole === "owner" && rec.issuedBy !== me.email) continue;
        out.push(rec);
      }
      out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return json(200, { keys: out });
    }

    if (req.method === "PUT" || req.method === "DELETE") {
      let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
      const id = keyBlobId(body.key);
      const row = await keysStore.get(id, { type: "json" });
      const rec = row && decryptKeyRecord(row);
      if (!rec) return json(404, { error: "Key not found" });
      if (myRole === "owner" && rec.issuedBy !== me.email) return json(403, { error: "Not your key" });
      if (req.method === "DELETE") {
        await keysStore.delete(id);
      } else {
        rec.revoked = true;
        await keysStore.setJSON(id, encryptKeyRecord(rec));
      }
      return json(200, { ok: true });
    }
  }

  /* ---- signup ---- */
  if (req.method === "POST" && path === "/signup") {
    let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!validEmail(email)) return json(400, { error: "Invalid email" });
    if (password.length < 6) return json(400, { error: "Password too short" });
    if (await users.get(email)) return json(409, { error: "Account already exists" });
    // Admin accounts can only be registered with the access code.
    const ADMIN_CODE = process.env.ADMIN_CODE || "GYMORA-ADMIN";
    if (body.profile && body.profile.role === "admin" && String(body.adminCode || "") !== ADMIN_CODE) {
      return json(403, { error: "Admin access code required" });
    }
    // Staff-role accounts (owner / coach / staff) need a one-time
    // access key; the key decides the role and gym, and is consumed.
    const profile = body.profile || null;
    let consumedKey = null;
    if (profile && KEY_ROLES.includes(profile.role)) {
      const key = normalizeKey(body.accessKey);
      if (!key) return json(403, { error: "An access key is required for this account type" });
      const id = keyBlobId(key);
      const row = await keysStore.get(id, { type: "json" });
      const rec = row && decryptKeyRecord(row);
      if (!rec || rec.revoked || rec.usedBy || rec.role !== profile.role) {
        return json(403, { error: "This access key isn't valid for this account type — it may be used, revoked, or mistyped" });
      }
      profile.role = rec.role;
      if (rec.gymId) profile.gymId = rec.gymId;
      consumedKey = { id, rec };
    }
    const salt = randomBytes(16).toString("hex");
    const record = {
      email, salt,
      hash: hashPassword(password, salt),
      createdAt: Date.now(),
      profile,
    };
    await users.setJSON(email, record);
    if (consumedKey) {
      consumedKey.rec.usedBy = email;
      consumedKey.rec.usedAt = Date.now();
      await keysStore.setJSON(consumedKey.id, encryptKeyRecord(consumedKey.rec));
    }
    return json(200, { token: signToken(email), profile: record.profile });
  }

  /* ---- login ---- */
  if (req.method === "POST" && path === "/login") {
    let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    /* Owner-configured master admin (chosen explicitly by the site owner):
       when ADMIN_EMAIL + ADMIN_PASSWORD are set in Netlify environment
       variables, that exact pair signs in as admin, creating the account
       on first use. Inactive unless both variables are set. */
    const bootEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const bootPw = process.env.ADMIN_PASSWORD || "";
    if (bootEmail && bootPw && email === bootEmail) {
      const a = Buffer.from(String(password)), b = Buffer.from(bootPw);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        let record = await users.get(email, { type: "json" });
        if (!record) {
          const salt = randomBytes(16).toString("hex");
          record = { email, salt, hash: hashPassword(password, salt), createdAt: Date.now(), profile: null };
        }
        record.profile = { ...(record.profile || {}), name: record.profile?.name || "Admin", email, role: "admin", verified: true, banned: false };
        await users.setJSON(email, record);
        return json(200, { token: signToken(email), profile: record.profile });
      }
      return json(401, { error: "Wrong email or password" });
    }

    const record = await users.get(email, { type: "json" });
    if (!record) return json(401, { error: "Wrong email or password" });
    const a = Buffer.from(hashPassword(password, record.salt));
    const b = Buffer.from(record.hash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return json(401, { error: "Wrong email or password" });
    return json(200, { token: signToken(email), profile: record.profile });
  }

  /* ---- admin: list & manage all users (requires admin Bearer token) ---- */
  if (path === "/admin/users") {
    const auth = req.headers.get("authorization") || "";
    const email = auth.startsWith("Bearer ") ? verifyToken(auth.slice(7)) : null;
    if (!email) return json(401, { error: "Not signed in" });
    const me = await users.get(email, { type: "json" });
    if (!me || !me.profile || me.profile.role !== "admin") return json(403, { error: "Admin only" });

    if (req.method === "GET") {
      const out = [];
      const { blobs } = await users.list();
      for (const b of blobs) {
        const rec = await users.get(b.key, { type: "json" });
        if (!rec) continue;
        const p = rec.profile || {};
        out.push({
          email: rec.email, name: p.name || "", role: p.role || "user",
          points: p.points || 0, checkins: (p.checkinDates || []).length,
          checkinDates: p.checkinDates || [],
          banned: !!p.banned, createdAt: rec.createdAt || null,
        });
      }
      return json(200, { users: out });
    }

    if (req.method === "PUT") {
      let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
      const target = String(body.email || "").trim().toLowerCase();
      const rec = await users.get(target, { type: "json" });
      if (!rec) return json(404, { error: "User not found" });
      if (target === email && body.banned) return json(400, { error: "You can't ban yourself" });
      rec.profile = { ...(rec.profile || {}), banned: !!body.banned };
      await users.setJSON(target, rec);
      return json(200, { ok: true });
    }

    if (req.method === "DELETE") {
      let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
      const target = String(body.email || "").trim().toLowerCase();
      if (target === email) return json(400, { error: "You can't delete yourself" });
      await users.delete(target);
      return json(200, { ok: true });
    }
  }

  /* ---- members list for gym staff (coach / staff / owner / admin) ----
     Returns member accounts (role "user") at the requester's gym so a
     coach can see who they train and what each member wants to achieve.
     Members who turned off "trainer contact" in privacy keep their
     email and phone hidden. ---- */
  if (req.method === "GET" && path === "/members") {
    const me = await requester();
    if (!me) return json(401, { error: "Not signed in" });
    const myRole = me.profile.role;
    if (!["coach", "staff", "owner", "admin"].includes(myRole)) return json(403, { error: "Staff accounts only" });
    const myGym = me.profile.gymId || null;
    const out = [];
    const { blobs } = await users.list();
    for (const b of blobs) {
      const rec = await users.get(b.key, { type: "json" });
      if (!rec) continue;
      const p = rec.profile || {};
      if ((p.role || "user") !== "user") continue;
      if (myRole !== "admin" && myGym && p.gymId && p.gymId !== myGym) continue;
      const weights = (Array.isArray(p.weights) ? p.weights : []).slice().sort((a, b) => a.date - b.date);
      const allowContact = !p.privacy || p.privacy.trainerContact !== false;
      out.push({
        id: p.id || rec.email, name: p.name || "", goal: p.goal || "fit",
        age: p.age || null, gender: p.gender || "na", gymId: p.gymId || null,
        email: allowContact ? rec.email : null,
        phone: allowContact ? (p.phone || null) : null,
        points: p.points || 0, checkins: (p.checkinDates || []).length,
        startKg: weights.length ? weights[0].kg : null,
        currentKg: weights.length ? weights[weights.length - 1].kg : null,
        joined: rec.createdAt || null, banned: !!p.banned,
      });
    }
    return json(200, { members: out });
  }

  /* ---- profile (requires Bearer token) ---- */
  if (path === "/profile") {
    const auth = req.headers.get("authorization") || "";
    const email = auth.startsWith("Bearer ") ? verifyToken(auth.slice(7)) : null;
    if (!email) return json(401, { error: "Not signed in" });
    const record = await users.get(email, { type: "json" });
    if (!record) return json(404, { error: "Account not found" });

    if (req.method === "GET") return json(200, { profile: record.profile });

    if (req.method === "PUT") {
      let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
      record.profile = body.profile ?? record.profile;
      record.updatedAt = Date.now();
      await users.setJSON(email, record);
      return json(200, { ok: true });
    }
  }

  return json(404, { error: "Not found" });
};

export const config = { path: "/api/*" };
