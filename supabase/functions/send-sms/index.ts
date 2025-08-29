import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

type Env = { get(k: string): string | undefined };
declare const Deno: { env: Env };

function toE164(input?: string): string | null {
  if (!input) return null;
  input = input.trim();
  // Already E.164?
  if (/^\+\d{8,15}$/.test(input)) return input;

  // Strip non-digits -> handle "(xxx) xxx-xxxx", "xxx.xxx.xxxx", etc.
  const digits = input.replace(/\D/g, "");
  // US shortcuts (10 or 11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return null; // Not a shape we can trust/send
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const { to, text } = await req.json(); // `to`: string|string[], raw phone numbers
    if (!text) throw new Error("Missing `text`");
    const rawRecipients = Array.isArray(to) ? to : [to];

    const sid   = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from  = Deno.env.get("TWILIO_FROM_NUMBER"); // e.g. +18889923974
    if (!sid || !token || !from) throw new Error("Twilio env not set");

    const auth = btoa(`${sid}:${token}`);

    // Normalize & split valid/invalid
    const normalized = rawRecipients.map((r) => ({ raw: r, e164: toE164(r) }));
    const valid = normalized.filter(n => n.e164).map(n => n.e164 as string);
    const invalid = normalized.filter(n => !n.e164).map(n => n.raw);

    const results = await Promise.allSettled(
      valid.map(async (num) => {
        const body = new URLSearchParams({ From: from, To: num, Body: text });
        const resp = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
          }
        );
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.message || "Twilio error");
        return { to: num, sid: json.sid, status: json.status };
      })
    );

    const ok = results
      .filter(r => r.status === "fulfilled")
      .map(r => (r as PromiseFulfilledResult<any>).value);
    const failed = results
      .filter(r => r.status === "rejected")
      .map((r, i) => ({
        to: valid[i],
        error: (r as PromiseRejectedResult).reason?.message || "Failed"
      }));

    return new Response(JSON.stringify({ ok, failed, invalid }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
