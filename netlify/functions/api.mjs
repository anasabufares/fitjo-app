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
import { scryptSync, randomBytes, createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.JWT_SECRET || "gymora-dev-secret-change-me";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

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

  if (req.method === "GET" && path === "/health") return json(200, { ok: true, service: "gymora-api" });

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
    const salt = randomBytes(16).toString("hex");
    const record = {
      email, salt,
      hash: hashPassword(password, salt),
      createdAt: Date.now(),
      profile: body.profile || null,
    };
    await users.setJSON(email, record);
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
