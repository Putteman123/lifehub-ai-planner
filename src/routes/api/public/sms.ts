import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Privat webhook för SMS från iPhone (Genvägar/Automationer).
 * Skyddas av SMS_INGEST_TOKEN – utan rätt token händer ingenting.
 *
 * POST  = inkommande SMS, eller kvittens på skickade meddelanden.
 * GET   = hämtar godkända meddelanden som telefonen ska skicka.
 */

const incomingSchema = z.object({
  direction: z.enum(["in", "out"]).optional(),
  phone: z.string().min(1).max(40),
  contact: z.string().max(120).nullish(),
  body: z.string().min(1).max(4000),
  sent_at: z.string().max(60).nullish(),
  external_id: z.string().max(200).nullish(),
});

const ackSchema = z.object({
  ack: z.array(z.string().uuid()).min(1),
  ok: z.boolean().optional(),
  error: z.string().max(500).nullish(),
});

function timingSafeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function authorize(request: Request) {
  const expected = process.env["SMS_INGEST_TOKEN"];
  if (!expected) return { error: new Response("Not configured", { status: 503 }) };
  const url = new URL(request.url);
  const provided = url.searchParams.get("token") ?? request.headers.get("x-ingest-token") ?? "";
  if (!timingSafeEqual(provided, expected)) {
    return { error: new Response("Unauthorized", { status: 401 }) };
  }
  const { ownerUserId } = await import("@/lib/visit-tracking.server");
  const userId = await ownerUserId();
  if (!userId) return { error: new Response("Owner not found", { status: 503 }) };
  return { userId };
}

export const Route = createFileRoute("/api/public/sms")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authorize(request);
        if (auth.error) return auth.error;
        const { pendingOutbox } = await import("@/lib/sms.server");
        const messages = await pendingOutbox(auth.userId!);
        return Response.json({ ok: true, count: messages.length, messages });
      },

      POST: async ({ request }) => {
        const auth = await authorize(request);
        if (auth.error) return auth.error;

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const sms = await import("@/lib/sms.server");

        const ack = ackSchema.safeParse(body);
        if (ack.success) {
          const res = await sms.ackOutbox(auth.userId!, ack.data.ack, {
            ok: ack.data.ok !== false,
            error: ack.data.error ?? null,
          });
          return Response.json({ ok: true, updated: res.count });
        }

        const parsed = incomingSchema.safeParse(body);
        if (!parsed.success) return Response.json({ ok: true, ignored: true });

        const result = await sms.ingestSms(auth.userId!, {
          direction: parsed.data.direction ?? "in",
          phone: parsed.data.phone,
          contact: parsed.data.contact ?? null,
          body: parsed.data.body,
          sent_at: parsed.data.sent_at ?? null,
          external_id: parsed.data.external_id ?? null,
        });
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
