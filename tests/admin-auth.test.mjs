import assert from "node:assert/strict";
import test from "node:test";
import authHandler from "../netlify/functions/admin-auth/index.mjs";
import pageHandler from "../netlify/functions/admin/index.mjs";
import {
  createPasswordHash,
  createSession,
  encodeBase32,
  totpAt,
  verifyPassword,
  verifySession,
  verifyTotp,
} from "../netlify/functions/admin/_security.mjs";

const PASSWORD = "a-strong-test-password";
const TOTP_SECRET = encodeBase32(Buffer.from("12345678901234567890"));
const SESSION_SECRET = "test-session-secret-that-is-longer-than-32-characters";

test("admin credentials, TOTP, session, and protected page work together", async () => {
  const now = Date.now();
  const passwordHash = createPasswordHash(PASSWORD, Buffer.alloc(24, 7));
  assert.equal(verifyPassword(PASSWORD, passwordHash), true);
  assert.equal(verifyPassword("wrong password", passwordHash), false);

  const code = totpAt(TOTP_SECRET, now);
  assert.match(code, /^\d{6}$/);
  assert.equal(totpAt(TOTP_SECRET, 59000), "287082");
  assert.equal(verifyTotp(TOTP_SECRET, code, now), true);
  assert.equal(verifyTotp(TOTP_SECRET, "12345", now), false);

  const token = createSession(SESSION_SECRET, now);
  assert.equal(verifySession(token, SESSION_SECRET, now), true);
  assert.equal(verifySession(token, SESSION_SECRET, now + 9 * 60 * 60 * 1000), false);

  const previous = {
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    ADMIN_TOTP_SECRET: process.env.ADMIN_TOTP_SECRET,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  };
  process.env.ADMIN_PASSWORD_HASH = passwordHash;
  process.env.ADMIN_TOTP_SECRET = TOTP_SECRET;
  process.env.ADMIN_SESSION_SECRET = SESSION_SECRET;

  try {
    const login = await authHandler(new Request("https://fitjo.test/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://fitjo.test" },
      body: JSON.stringify({ action: "login", password: PASSWORD, code: totpAt(TOTP_SECRET) }),
    }));
    assert.equal(login.status, 204);
    const cookie = login.headers.get("set-cookie");
    assert.match(cookie, /fitjo_admin=.*HttpOnly.*SameSite=Strict.*Secure/);

    const dashboard = await pageHandler(new Request("https://fitjo.test/admin", {
      headers: { Cookie: cookie.split(";")[0] },
    }));
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /Platform overview/);

    const anonymous = await pageHandler(new Request("https://fitjo.test/admin"));
    assert.match(await anonymous.text(), /Verify it’s you/);

    const wrongPassword = await authHandler(new Request("https://fitjo.test/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://fitjo.test" },
      body: JSON.stringify({ action: "login", password: "wrong password", code: totpAt(TOTP_SECRET) }),
    }));
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongPassword.headers.has("set-cookie"), false);

    const rejected = await authHandler(new Request("https://fitjo.test/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.test" },
      body: JSON.stringify({ action: "login", password: PASSWORD, code }),
    }));
    assert.equal(rejected.status, 403);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
