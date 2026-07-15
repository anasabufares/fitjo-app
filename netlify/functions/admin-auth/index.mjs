import {
  createSession,
  expiredSessionCookie,
  getAdminConfig,
  sessionCookie,
  verifyPassword,
  verifyTotp,
} from "../admin/_security.mjs";

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function isSecure(request) {
  return new URL(request.url).protocol === "https:";
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return json(405, { error: "Use POST." }, { Allow: "POST" });
  }
  if (!sameOrigin(request)) return json(403, { error: "Request rejected." });

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8192) return json(413, { error: "Request too large." });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid request." });
  }

  if (body?.action === "logout") {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": expiredSessionCookie(isSecure(request)),
      },
    });
  }
  if (body?.action !== "login") return json(400, { error: "Invalid request." });

  const config = getAdminConfig();
  if (!config) {
    return json(503, { error: "Admin access is not configured yet." });
  }

  const passwordOk = verifyPassword(body.password, config.passwordHash);
  const codeOk = verifyTotp(config.totpSecret, body.code);
  if (!passwordOk || !codeOk) {
    return json(401, { error: "The password or authenticator code is incorrect." });
  }

  const token = createSession(config.sessionSecret);
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": sessionCookie(token, isSecure(request)),
    },
  });
}

export const config = {
  path: "/admin/auth",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowLimit: 5,
    windowSize: 60,
  },
};
