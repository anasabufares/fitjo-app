import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const PASSWORD_BYTES = 64;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function equalBuffers(left, right) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createPasswordHash(password, salt = randomBytes(24)) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("The admin password must be at least 12 characters long.");
  }
  const digest = scryptSync(password, salt, PASSWORD_BYTES, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

export function verifyPassword(password, storedHash) {
  try {
    const [scheme, saltText, digestText] = String(storedHash || "").split("$");
    if (scheme !== "scrypt" || !saltText || !digestText) return false;
    const expected = Buffer.from(digestText, "base64url");
    const actual = scryptSync(
      String(password || ""),
      Buffer.from(saltText, "base64url"),
      expected.length,
      SCRYPT_OPTIONS,
    );
    return equalBuffers(actual, expected);
  } catch {
    return false;
  }
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encodeBase32(input) {
  const bytes = Buffer.from(input);
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(input) {
  const normalized = String(input || "")
    .toUpperCase()
    .replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const output = [];
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Invalid base32 secret.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function totpAt(secret, now = Date.now(), offset = 0) {
  const counter = Math.floor(now / 30000) + offset;
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBytes).digest();
  const start = digest[digest.length - 1] & 15;
  const number = (digest.readUInt32BE(start) & 0x7fffffff) % 1000000;
  return String(number).padStart(6, "0");
}

export function verifyTotp(secret, code, now = Date.now()) {
  const supplied = Buffer.from(String(code || "").trim());
  if (!/^\d{6}$/.test(supplied.toString())) return false;
  return [-1, 0, 1].some((offset) => {
    const expected = Buffer.from(totpAt(secret, now, offset));
    return equalBuffers(supplied, expected);
  });
}

function signSessionPayload(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSession(secret, now = Date.now()) {
  const expires = Math.floor((now + SESSION_TTL_MS) / 1000);
  const payload = `${expires}.${randomBytes(18).toString("base64url")}`;
  return `v1.${payload}.${signSessionPayload(payload, secret)}`;
}

export function verifySession(token, secret, now = Date.now()) {
  try {
    const [version, expiresText, nonce, signature] = String(token || "").split(".");
    if (version !== "v1" || !/^\d+$/.test(expiresText) || !nonce || !signature) return false;
    const expires = Number(expiresText) * 1000;
    if (!Number.isFinite(expires) || expires <= now) return false;
    const payload = `${expiresText}.${nonce}`;
    return equalBuffers(
      Buffer.from(signature),
      Buffer.from(signSessionPayload(payload, secret)),
    );
  } catch {
    return false;
  }
}

export function readCookie(header, name) {
  const prefix = `${name}=`;
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) || "";
}

export function getAdminConfig(env = process.env) {
  const passwordHash = String(env.ADMIN_PASSWORD_HASH || "");
  const totpSecret = String(env.ADMIN_TOTP_SECRET || "").replace(/[\s=-]/g, "").toUpperCase();
  const sessionSecret = String(env.ADMIN_SESSION_SECRET || "");
  if (!/^scrypt\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(passwordHash)) return null;
  const [, saltText, digestText] = passwordHash.split("$");
  if (Buffer.from(saltText, "base64url").length < 16) return null;
  if (Buffer.from(digestText, "base64url").length !== PASSWORD_BYTES) return null;
  if (!/^[A-Z2-7]{16,}$/.test(totpSecret)) return null;
  if (sessionSecret.length < 32) return null;
  return { passwordHash, totpSecret, sessionSecret };
}

export function sessionCookie(token, secure = true) {
  const flags = [
    `fitjo_admin=${token}`,
    "Path=/admin",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${SESSION_TTL_MS / 1000}`,
  ];
  if (secure) flags.push("Secure");
  return flags.join("; ");
}

export function expiredSessionCookie(secure = true) {
  const flags = [
    "fitjo_admin=",
    "Path=/admin",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (secure) flags.push("Secure");
  return flags.join("; ");
}
