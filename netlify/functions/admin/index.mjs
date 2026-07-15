import { randomBytes } from "node:crypto";
import { getAdminConfig, readCookie, verifySession } from "./_security.mjs";
import { dashboardPage, loginPage, setupPage } from "./_ui.mjs";

function page(body, status, nonce) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy": `default-src 'none'; base-uri 'none'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'`,
      "Content-Type": "text/html; charset=utf-8",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

export default async function handler(request) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const nonce = randomBytes(18).toString("base64");
  const config = getAdminConfig();
  if (!config) {
    const body = request.method === "HEAD" ? "" : setupPage(nonce);
    return page(body, 503, nonce);
  }
  const token = readCookie(request.headers.get("cookie"), "fitjo_admin");
  const body = verifySession(token, config.sessionSecret) ? dashboardPage(nonce) : loginPage(nonce);
  return page(request.method === "HEAD" ? "" : body, 200, nonce);
}

export const config = {
  path: ["/admin", "/admin/"],
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "ip",
    windowLimit: 60,
    windowSize: 60,
  },
};
