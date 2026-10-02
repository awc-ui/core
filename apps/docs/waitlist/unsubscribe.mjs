import { hashToken, headers, json, readBody } from "./handler.mjs";
import { ORIGIN } from "./config.mjs";

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const html = (body) =>
  new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AWC UI waitlist</title><body><main><h1>AWC UI waitlist</h1>${body}</main></body></html>`,
    {
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      },
    },
  );

export function createUnsubscribeHandler({ store, clock = () => new Date() }) {
  return async (request) => {
    const url = new URL(request.url);
    if (url.origin !== ORIGIN || url.pathname !== "/api/waitlist/unsubscribe")
      return json(404, { ok: false });
    if (!["GET", "POST"].includes(request.method))
      return json(405, { ok: false }, { Allow: "GET, POST" });
    let token = url.searchParams.get("token");
    if (request.method === "POST") {
      if (
        request.headers.get("content-type")?.split(";")[0].trim() !==
        "application/x-www-form-urlencoded"
      )
        return json(415, { ok: false });
      try {
        const data = new URLSearchParams(await readBody(request, 1024));
        // Supports a normal confirmation form and RFC 8058 mailbox one-click.
        token =
          data.get("token") ??
          (data.get("List-Unsubscribe") === "One-Click" ? token : null);
      } catch {
        return json(400, { ok: false });
      }
    }
    if (!tokenPattern.test(token ?? "")) return json(400, { ok: false });
    if (request.method === "GET") {
      // GET never changes consent; link scanners must not unsubscribe people.
      return html(
        `<p>Stop Data Grid waitlist emails. Your early offer eligibility is retained.</p><form action="/api/waitlist/unsubscribe" method="post"><input type="hidden" name="token" value="${token}"><button type="submit">Unsubscribe</button></form>`,
      );
    }
    try {
      await store.unsubscribe({
        unsubscribeHash: hashToken(token),
        now: clock(),
      });
      return html(
        '<p>You will no longer receive waitlist emails. If you did not sign up, no further action is needed.</p><p><a href="https://awc-ui.dev/">Back to AWC UI</a></p>',
      );
    } catch {
      console.error("waitlist_unsubscribe_unavailable");
      return json(503, { ok: false }, { "Retry-After": "60" });
    }
  };
}
