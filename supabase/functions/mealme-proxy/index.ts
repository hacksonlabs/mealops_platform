import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

type Env = { get(k: string): string | undefined };
declare const Deno: { env: Env };

const defaultBaseUrls: Record<string, string> = {
  sandbox: "https://api-sandbox.mealme.ai",
  production: "https://api.mealme.ai",
  staging: "https://api-staging.mealme.ai",
};

const resolveBaseUrl = () => {
  const explicit = Deno.env.get("MEALME_BASE_URL");
  if (explicit && explicit.trim()) return explicit.trim();
  const env = (Deno.env.get("MEALME_ENV") || "sandbox").toLowerCase();
  return defaultBaseUrls[env] || defaultBaseUrls.sandbox;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("MEALME_API_KEY");
    if (!apiKey) throw new Error("MEALME_API_KEY missing");

    const baseUrl = resolveBaseUrl().replace(/\/$/, "");
    const payload = await req.json();
    const method = (payload?.method || "GET").toUpperCase();
    const rawPath = payload?.path;
    if (!rawPath || typeof rawPath !== "string") throw new Error("Request payload requires `path`");

    const timeoutMs = Number(payload?.timeoutMs) || Number(Deno.env.get("MEALME_TIMEOUT_MS") || 15000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstreamUrl = (() => {
        if (/^https?:\/\//i.test(rawPath)) return new URL(rawPath);
        const normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
        return new URL(`${baseUrl}${normalized}`);
      })();

      const query = payload?.query;
      if (query && typeof query === "object") {
        Object.entries(query).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          if (Array.isArray(value)) {
            value.forEach((v) => upstreamUrl.searchParams.append(key, String(v)));
            return;
          }
          upstreamUrl.searchParams.set(key, String(value));
        });
      }

      const headers = new Headers({
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      });

      const extraHeaders = payload?.headers;
      if (extraHeaders && typeof extraHeaders === "object") {
        Object.entries(extraHeaders).forEach(([key, value]) => {
          if (typeof value === "string") headers.set(key, value);
        });
      }

      let upstreamBody: string | undefined;
      if (payload?.body !== undefined && method !== "GET" && method !== "HEAD") {
        if (typeof payload.body === "string") {
          upstreamBody = payload.body;
        } else {
          upstreamBody = JSON.stringify(payload.body);
          if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
        }
      }

      const upstreamResponse = await fetch(upstreamUrl.toString(), {
        method,
        headers,
        body: upstreamBody,
        signal: controller.signal,
      });

      const responseText = await upstreamResponse.text();
      let parsed: unknown = null;
      try {
        parsed = responseText ? JSON.parse(responseText) : null;
      } catch {
        parsed = responseText;
      }

      const okPayload = {
        ok: upstreamResponse.ok,
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        result: parsed,
      };

      return new Response(JSON.stringify(okPayload), {
        status: upstreamResponse.ok ? 200 : upstreamResponse.status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as any)?.code || undefined;
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    return new Response(JSON.stringify({ error: { message, code } }), {
      status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
});
