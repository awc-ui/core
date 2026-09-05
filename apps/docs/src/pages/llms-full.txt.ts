/** The complete hosted AI build director under the conventional root name. */

import type { APIRoute } from "astro";
import { mainLlmWeb } from "../lib/llm-web";

export const GET: APIRoute = () =>
  new Response(mainLlmWeb, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
