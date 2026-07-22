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
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};
const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

const validEmail = (e) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, "") || "/";
  /* Accounts and one-time access keys need strongly consistent reads:
     with the default eventual consistency, a just-created account is
     invisible to the duplicate-email check (a second signup could
     silently take over the account), and an access key could be
     consumed twice. The public gym list stays eventual — it's read on
     every app open and a propagation delay there is harmless. */
  const users = getStore({ name: "gymora-users", consistency: "strong" });
  const gymsStore = getStore("gymora-gyms");
  const keysStore = getStore({ name: "gymora-keys", consistency: "strong" });
  /* messages must be strongly consistent: a reply written a second ago
     has to be visible to the other side immediately. */
  const msgStore = getStore({ name: "gymora-msgs", consistency: "strong" });
  /* Announcements and the published design are written and read back
     immediately (publish → the admin console lists it → the app loads
     it). With the default eventual consistency that read comes back
     stale — a fresh announcement looks like it vanished and deleting
     it 404s — so both stores read strongly. */
  const noticeStore = getStore({ name: "gymora-notices", consistency: "strong" });
  const ticketStore = getStore({ name: "gymora-tickets", consistency: "strong" });
  const designStore = getStore({ name: "gymora-design", consistency: "strong" });

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
    // coaches see the members they train; owners, staff and admins
    // also see the coaches and staff working at the gym
    const visible = myRole === "coach" ? ["user"] : ["user", "coach", "staff"];
    const out = [];
    const { blobs } = await users.list();
    for (const b of blobs) {
      const rec = await users.get(b.key, { type: "json" });
      if (!rec) continue;
      const p = rec.profile || {};
      if (!visible.includes(p.role || "user")) continue;
      if (rec.email === me.email) continue;
      if (myRole !== "admin" && myGym && p.gymId && p.gymId !== myGym) continue;
      const weights = (Array.isArray(p.weights) ? p.weights : []).slice().sort((a, b) => a.date - b.date);
      const allowContact = !p.privacy || p.privacy.trainerContact !== false;
      out.push({
        id: p.id || rec.email, name: p.name || "", role: p.role || "user", goal: p.goal || "fit",
        staffRole: p.staffRole || null,
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

  /* ---- staff job role, assigned by the gym owner (or an admin) ---- */
  if (req.method === "PUT" && path === "/members") {
    const me = await requester();
    if (!me) return json(401, { error: "Not signed in" });
    if (!["owner", "admin"].includes(me.profile.role)) return json(403, { error: "Gym owners only" });
    let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
    const target = String(body.email || "").trim().toLowerCase();
    const rec = await users.get(target, { type: "json" });
    if (!rec) return json(404, { error: "Account not found" });
    const tp = rec.profile || {};
    if ((tp.role || "user") !== "staff") return json(400, { error: "Only gym staff accounts can be assigned a staff role" });
    if (me.profile.role !== "admin" && me.profile.gymId && tp.gymId && tp.gymId !== me.profile.gymId) {
      return json(403, { error: "That person works at a different gym" });
    }
    const STAFF_ROLES = ["manager", "reception", "trainer", "nutrition", "cleaning", "maintenance", "security"];
    const staffRole = body.staffRole ? String(body.staffRole) : null;
    if (staffRole && !STAFF_ROLES.includes(staffRole)) return json(400, { error: "Unknown staff role" });
    rec.profile = { ...tp, staffRole };
    await users.setJSON(target, rec);
    return json(200, { ok: true, staffRole });
  }

  /* ---- email verification ----
     The server generates the code, stores only its hash (15-min expiry,
     6 attempts, 60s resend cooldown) and emails it via Brevo when
     BREVO_API_KEY + SENDER_EMAIL are configured. Without them the code
     comes back in the response (demo mode) so the prototype still works. */
  const codeHash = (email, code) => createHash("sha256").update(email + "|" + code + "|" + SECRET).digest("hex");
  async function sendVerifyEmail(to, code) {
    const key = process.env.BREVO_API_KEY, sender = process.env.SENDER_EMAIL;
    if (!key || !sender) return false;
    try {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "GYMORA", email: sender },
          to: [{ email: to }],
          subject: `${code} — your GYMORA verification code`,
          htmlContent: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
            <h2 style="color:#22c55e;margin:0 0 4px">GYMORA</h2>
            <p style="color:#555;margin:0 0 20px">Optimize. Recover. Achieve.</p>
            <p>Your verification code / رمز التحقق الخاص بك:</p>
            <p style="font-size:34px;font-weight:bold;letter-spacing:8px;margin:12px 0">${code}</p>
            <p style="color:#888">The code expires in 15 minutes. If you didn't create a GYMORA account, ignore this email.<br>
            تنتهي صلاحية الرمز خلال 15 دقيقة. إذا لم تنشئ حساباً في GYMORA فتجاهل هذه الرسالة.</p>
          </div>`,
        }),
      });
      return r.ok;
    } catch { return false; }
  }

  if (req.method === "POST" && path === "/verify/send") {
    const me = await requester();
    if (!me) return json(401, { error: "Not signed in" });
    const record = await users.get(me.email, { type: "json" });
    if (!record) return json(404, { error: "Account not found" });
    if (record.profile && record.profile.verified) return json(200, { ok: true, already: true });
    const now = Date.now();
    if (record.verify && record.verify.lastSend && now - record.verify.lastSend < 60000) {
      return json(429, { error: "Please wait a minute before requesting a new code" });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    record.verify = { hash: codeHash(me.email, code), exp: now + 15 * 60 * 1000, attempts: 0, lastSend: now };
    await users.setJSON(me.email, record);
    const sent = await sendVerifyEmail(me.email, code);
    return json(200, sent ? { sent: true } : { sent: false, demoCode: code });
  }

  if (req.method === "POST" && path === "/verify/confirm") {
    const me = await requester();
    if (!me) return json(401, { error: "Not signed in" });
    let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
    const code = String(body.code || "").trim();
    const record = await users.get(me.email, { type: "json" });
    if (!record) return json(404, { error: "Account not found" });
    const v = record.verify;
    if (!v || v.exp < Date.now()) return json(400, { error: "Code expired — request a new one" });
    if (v.attempts >= 6) return json(429, { error: "Too many tries — request a new code" });
    if (codeHash(me.email, code) !== v.hash) {
      v.attempts = (v.attempts || 0) + 1;
      await users.setJSON(me.email, record);
      return json(400, { error: "Wrong code" });
    }
    delete record.verify;
    record.profile = { ...(record.profile || {}), verified: true };
    await users.setJSON(me.email, record);
    return json(200, { ok: true });
  }

  /* =============================================================
     MESSAGING — coaches ↔ members ↔ gym owner & staff
     One blob per conversation ("thread:<hash of the two emails>")
     plus a per-person index ("inbox:<email>") that holds the last
     line and the unread count, so opening the inbox is one read.
     Rule: members can't message each other; everyone else at the
     same gym can talk, and admins can reach anyone.
     ============================================================= */
  const threadId = (a, b) => "thread:" + createHash("sha256").update([a, b].sort().join("|")).digest("hex").slice(0, 32);
  const inboxId = (e) => "inbox:" + e;

  /* Who a member may write to: their coach, full stop. Reception,
     management and anything else at the gym goes through a support
     ticket (/tickets) so it lands in a queue someone owns. Staff-side
     people can still reach a member first, and a member may always
     reply inside a conversation somebody else started. */
  function canMessage(mine, theirs) {
    const r1 = mine.role || "user", r2 = theirs.role || "user";
    const sameGym = !(mine.gymId && theirs.gymId && mine.gymId !== theirs.gymId);
    if (r1 === "user" && r2 === "user") return false;           // no member-to-member DMs
    if (r1 === "user") return r2 === "coach" && sameGym;        // members start chats with coaches only
    if (r1 === "admin" || r2 === "admin") return true;          // GYMORA support reaches anyone
    return sameGym;                                             // coaches, staff and owners at one gym
  }

  /* update one side's inbox index after a message */
  async function bumpInbox(owner, other, otherName, otherRole, last, at, unreadDelta) {
    const id = inboxId(owner);
    const box = (await msgStore.get(id, { type: "json" })) || { threads: {} };
    if (!box.threads) box.threads = {};
    const cur = box.threads[other] || {};
    box.threads[other] = {
      with: other, name: otherName, role: otherRole,
      last: String(last).slice(0, 140), at,
      unread: unreadDelta ? (cur.unread || 0) + unreadDelta : 0,
    };
    await msgStore.setJSON(id, box);
  }

  if (path === "/messages") {
    const me = await requester();
    if (!me) return json(401, { error: "Not signed in" });

    if (req.method === "GET") {
      const other = String(url.searchParams.get("with") || "").trim().toLowerCase();
      if (!other) {
        const box = (await msgStore.get(inboxId(me.email), { type: "json" })) || { threads: {} };
        const list = Object.values(box.threads || {}).sort((a, b) => (b.at || 0) - (a.at || 0));
        return json(200, { threads: list, unread: list.reduce((n, x) => n + (x.unread || 0), 0) });
      }
      const th = (await msgStore.get(threadId(me.email, other), { type: "json" })) || { msgs: [] };
      // seeing the thread marks it read
      const box = (await msgStore.get(inboxId(me.email), { type: "json" })) || { threads: {} };
      if (box.threads && box.threads[other] && box.threads[other].unread) {
        box.threads[other].unread = 0;
        await msgStore.setJSON(inboxId(me.email), box);
      }
      const rec = await users.get(other, { type: "json" });
      const p = (rec && rec.profile) || {};
      return json(200, {
        messages: th.msgs || [],
        contact: { email: other, name: p.name || other, role: p.role || "user", staffRole: p.staffRole || null },
      });
    }

    if (req.method === "POST") {
      let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
      const to = String(body.to || "").trim().toLowerCase();
      const text = String(body.text || "").trim().slice(0, 2000);
      if (!text) return json(400, { error: "Write something first" });
      if (to === me.email) return json(400, { error: "You can't message yourself" });
      const rec = await users.get(to, { type: "json" });
      if (!rec) return json(404, { error: "That person doesn't have a GYMORA account yet" });
      const theirs = rec.profile || {};
      const m = { f: me.email, x: text, at: Date.now() };
      const tid = threadId(me.email, to);
      const th = (await msgStore.get(tid, { type: "json" })) || { a: me.email, b: to, msgs: [] };
      if (!canMessage(me.profile, theirs)) {
        // replying to whoever wrote to you first is always allowed
        const theyWroteFirst = (th.msgs || []).some(x => x.f === to);
        if (!theyWroteFirst) {
          return json(403, {
            error: (me.profile.role || "user") === "user"
              ? "Members can message their coach here — for anything else at the gym, open a support ticket"
              : "You can't message this person",
          });
        }
      }
      th.msgs = (th.msgs || []).concat(m).slice(-300);
      th.updatedAt = m.at;
      await msgStore.setJSON(tid, th);
      await bumpInbox(me.email, to, theirs.name || to, theirs.role || "user", text, m.at, 0);
      await bumpInbox(to, me.email, me.profile.name || me.email, me.profile.role || "user", text, m.at, 1);
      return json(200, { ok: true, message: m });
    }

    if (req.method === "PUT") { // mark a thread read
      let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
      const other = String(body.with || "").trim().toLowerCase();
      const box = (await msgStore.get(inboxId(me.email), { type: "json" })) || { threads: {} };
      if (box.threads && box.threads[other]) {
        box.threads[other].unread = 0;
        await msgStore.setJSON(inboxId(me.email), box);
      }
      return json(200, { ok: true });
    }
  }

  /* ---- who the signed-in person is allowed to message ---- */
  if (req.method === "GET" && path === "/contacts") {
    const me = await requester();
    if (!me) return json(401, { error: "Not signed in" });
    const out = [];
    const { blobs } = await users.list();
    for (const b of blobs) {
      const rec = await users.get(b.key, { type: "json" });
      if (!rec || rec.email === me.email) continue;
      const p = rec.profile || {};
      if (p.banned) continue;
      if (!canMessage(me.profile, p)) continue;
      out.push({
        email: rec.email, name: p.name || rec.email, role: p.role || "user",
        staffRole: p.staffRole || null, gymId: p.gymId || null, goal: p.goal || null,
      });
    }
    const rank = { admin: 0, owner: 1, coach: 2, staff: 3, user: 4 };
    out.sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9) || a.name.localeCompare(b.name));
    return json(200, { contacts: out });
  }

  /* =============================================================
     SUPPORT TICKETS — a member's line to the gym team
     Members chat with their coach; everything else (membership,
     payment, facilities, a complaint) is opened as a ticket that
     lands in the gym staff & owner queue. One blob per ticket plus a
     "list" index holding the summaries the two queues are built from.
     ============================================================= */
  const TICKET_CATS = ["membership", "payment", "facility", "class", "coach", "other"];
  const TICKET_STATUS = ["open", "answered", "closed"];
  const ticketSummary = (t) => ({
    id: t.id, subject: t.subject, category: t.category, by: t.by, byName: t.byName,
    gymId: t.gymId, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt,
    last: String((t.msgs[t.msgs.length - 1] || {}).x || "").slice(0, 140),
    staffUnread: 0, userUnread: 0,
  });

  if (path === "/tickets") {
    const me = await requester();
    if (!me) return json(401, { error: "Not signed in" });
    const myRole = me.profile.role || "user";
    const handlesTickets = ["staff", "owner", "admin"].includes(myRole);
    const myGym = me.profile.gymId || null;
    const list = (await ticketStore.get("list", { type: "json" })) || [];
    const mayOpen = (t) => handlesTickets
      ? (myRole === "admin" || !myGym || !t.gymId || t.gymId === myGym)
      : t.by === me.email;

    if (req.method === "GET") {
      const id = url.searchParams.get("id");
      if (id) {
        const t = await ticketStore.get("t:" + id, { type: "json" });
        if (!t) return json(404, { error: "Ticket not found" });
        if (!mayOpen(t)) return json(403, { error: "Not your ticket" });
        const i = list.findIndex(x => x.id === id);
        if (i >= 0) {                       // opening it clears your side's unread mark
          if (handlesTickets) list[i].staffUnread = 0; else list[i].userUnread = 0;
          await ticketStore.setJSON("list", list);
        }
        return json(200, { ticket: t });
      }
      const mine = list.filter(mayOpen);
      return json(200, {
        tickets: mine,
        unread: mine.reduce((n, x) => n + ((handlesTickets ? x.staffUnread : x.userUnread) || 0), 0),
      });
    }

    if (req.method === "POST") {
      let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
      const text = String(body.text || "").trim().slice(0, 2000);
      if (!text) return json(400, { error: "Write your message first" });

      if (!body.id) {                                            // open a new ticket
        const now = Date.now();
        const t = {
          id: "tk" + now + Math.random().toString(36).slice(2, 6),
          subject: String(body.subject || "").trim().slice(0, 120) || "Support request",
          category: TICKET_CATS.includes(body.category) ? body.category : "other",
          by: me.email, byName: me.profile.name || me.email,
          gymId: myGym, status: "open", createdAt: now, updatedAt: now,
          msgs: [{ f: me.email, x: text, at: now }],
        };
        await ticketStore.setJSON("t:" + t.id, t);
        const sum = ticketSummary(t);
        sum.staffUnread = 1;
        list.unshift(sum);
        await ticketStore.setJSON("list", list.slice(0, 500));
        return json(200, { ticket: t });
      }

      const t = await ticketStore.get("t:" + body.id, { type: "json" });     // reply
      if (!t) return json(404, { error: "Ticket not found" });
      if (!mayOpen(t)) return json(403, { error: "Not your ticket" });
      const at = Date.now();
      t.msgs.push({ f: me.email, x: text, at, staff: handlesTickets, name: me.profile.name || me.email });
      t.msgs = t.msgs.slice(-200);
      t.updatedAt = at;
      t.status = handlesTickets ? "answered" : "open";
      await ticketStore.setJSON("t:" + t.id, t);
      const i = list.findIndex(x => x.id === t.id);
      if (i >= 0) {
        const prev = list[i];
        list[i] = {
          ...ticketSummary(t),
          staffUnread: handlesTickets ? 0 : (prev.staffUnread || 0) + 1,
          userUnread: handlesTickets ? (prev.userUnread || 0) + 1 : 0,
        };
        await ticketStore.setJSON("list", list);
      }
      return json(200, { ticket: t });
    }

    if (req.method === "DELETE") {                               // the member who opened it, or an admin
      let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
      const t = await ticketStore.get("t:" + body.id, { type: "json" });
      if (!t) return json(404, { error: "Ticket not found" });
      if (t.by !== me.email && myRole !== "admin") return json(403, { error: "Only the person who opened it, or an admin, can delete a ticket" });
      await ticketStore.delete("t:" + t.id);
      await ticketStore.setJSON("list", list.filter(x => x.id !== t.id));
      return json(200, { ok: true });
    }

    if (req.method === "PUT") {                                  // change the status
      let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
      const status = TICKET_STATUS.includes(body.status) ? body.status : null;
      if (!status) return json(400, { error: "Unknown status" });
      const t = await ticketStore.get("t:" + body.id, { type: "json" });
      if (!t) return json(404, { error: "Ticket not found" });
      if (!mayOpen(t)) return json(403, { error: "Not your ticket" });
      if (!handlesTickets && status === "answered") return json(403, { error: "Only the gym team can answer a ticket" });
      t.status = status;
      t.updatedAt = Date.now();
      await ticketStore.setJSON("t:" + t.id, t);
      const i = list.findIndex(x => x.id === t.id);
      if (i >= 0) { list[i] = { ...list[i], status, updatedAt: t.updatedAt }; await ticketStore.setJSON("list", list); }
      return json(200, { ok: true, status });
    }
  }

  /* =============================================================
     ANNOUNCEMENTS — a message from GYMORA (or a gym owner) that
     shows up inside the app for the people it targets.
     ============================================================= */
  const AUDIENCES = ["all", "members", "staff", "coaches", "owners"];
  if (path === "/notices") {
    const list = (await noticeStore.get("list", { type: "json" })) || [];

    if (req.method === "GET") {
      const me = await requester();
      const role = me ? (me.profile.role || "user") : null;
      const gym = me ? (me.profile.gymId || null) : null;
      const now = Date.now();
      const mineGym = (n) => !n.gymId || n.gymId === gym;
      const visible = list.filter(n => {
        if (!n.active) return false;
        if (n.until && n.until < now) return false;
        if (n.audience === "all") return mineGym(n);
        if (!role) return false;
        if (n.audience === "members") return role === "user" && mineGym(n);
        if (n.audience === "staff") return ["coach", "staff", "owner"].includes(role) && mineGym(n);
        if (n.audience === "coaches") return role === "coach" && mineGym(n);
        if (n.audience === "owners") return role === "owner";
        return false;
      });
      return json(200, { notices: visible.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50) });
    }

    const me = await requester();
    if (!me) return json(401, { error: "Not signed in" });
    const myRole = me.profile.role;
    if (myRole !== "admin" && myRole !== "owner") return json(403, { error: "Admins and gym owners only" });
    let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

    if (req.method === "POST") {
      const title = String(body.title || "").trim().slice(0, 120);
      const text = String(body.body || "").trim().slice(0, 2000);
      if (!title && !text) return json(400, { error: "Write a title or a message" });
      const audience = AUDIENCES.includes(body.audience) ? body.audience : "all";
      const n = {
        id: "n" + Date.now() + Math.random().toString(36).slice(2, 6),
        title, body: text, audience,
        // a gym owner can only speak to their own gym
        gymId: myRole === "owner" ? (me.profile.gymId || null) : (body.gymId || null),
        kind: ["info", "warn", "good"].includes(body.kind) ? body.kind : "info",
        until: body.until ? Number(body.until) : null,
        createdAt: Date.now(), active: true, by: me.email, byRole: myRole,
      };
      if (myRole === "owner" && n.audience === "owners") n.audience = "all";
      list.unshift(n);
      await noticeStore.setJSON("list", list.slice(0, 200));
      return json(200, { notice: n });
    }

    const i = list.findIndex(x => x.id === body.id);
    if (i < 0) return json(404, { error: "Announcement not found" });
    if (myRole === "owner" && list[i].by !== me.email) return json(403, { error: "Not your announcement" });

    if (req.method === "PUT") {
      list[i] = {
        ...list[i],
        active: body.active === undefined ? list[i].active : !!body.active,
        title: body.title === undefined ? list[i].title : String(body.title).slice(0, 120),
        body: body.body === undefined ? list[i].body : String(body.body).slice(0, 2000),
      };
      await noticeStore.setJSON("list", list);
      return json(200, { notice: list[i] });
    }
    if (req.method === "DELETE") {
      list.splice(i, 1);
      await noticeStore.setJSON("list", list);
      return json(200, { ok: true });
    }
  }

  /* =============================================================
     DESIGN — the look of the app, edited visually in the admin
     console and published here. The app reads this on every open
     and applies it over its own stylesheet, so the interface can
     be changed without touching the code.
     ============================================================= */
  if (path === "/design") {
    if (req.method === "GET") {
      const doc = (await designStore.get("current", { type: "json" })) || null;
      return json(200, { design: doc });
    }
    if (!(await adminEmail())) return json(403, { error: "Admin only" });
    if (req.method === "PUT") {
      let body; try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
      const doc = body.design && typeof body.design === "object" ? body.design : {};
      if (JSON.stringify(doc).length > 400000) return json(413, { error: "Design is too big" });
      doc.updatedAt = Date.now();
      // keep the previous version so a bad edit can be rolled back
      const prev = await designStore.get("current", { type: "json" });
      if (prev) await designStore.setJSON("previous", prev);
      await designStore.setJSON("current", doc);
      return json(200, { ok: true, design: doc });
    }
    if (req.method === "DELETE") {
      const prev = await designStore.get("current", { type: "json" });
      if (prev) await designStore.setJSON("previous", prev);
      await designStore.delete("current");
      return json(200, { ok: true });
    }
    if (req.method === "POST") { // restore the previous published version
      const prev = await designStore.get("previous", { type: "json" });
      if (!prev) return json(404, { error: "Nothing to undo" });
      await designStore.setJSON("current", prev);
      return json(200, { ok: true, design: prev });
    }
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
