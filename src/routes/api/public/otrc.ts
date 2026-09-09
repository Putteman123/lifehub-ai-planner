import { createFileRoute } from "@tanstack/react-router";

/**
 * Levererar en färdig OwnTracks-konfiguration (.otrc) så telefonen kan
 * hämta adress, nyckel och lägen med ett tryck – ingen inklistring behövs.
 */
function timingSafeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export const Route = createFileRoute("/api/public/otrc")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const provided = url.searchParams.get("token") ?? "";
        const mode = url.searchParams.get("mode") === "significant" ? "significant" : "move";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("location_settings")
          .select("token")
          .limit(1)
          .maybeSingle();

        const active = (data?.token as string | undefined) ?? "";
        const legacy = process.env["LOCATION_INGEST_TOKEN_V2"] ?? "";
        const valid =
          (active !== "" && timingSafeEqual(provided, active)) ||
          (legacy !== "" && timingSafeEqual(provided, legacy));
        if (!valid) return new Response("Unauthorized", { status: 401 });

        const ingestUrl = `${url.origin}/api/public/plats?token=${encodeURIComponent(provided)}`;

        const config = {
          _type: "configuration",
          mode: 3, // HTTP
          url: ingestUrl,
          auth: false,
          username: "lifehub",
          deviceId: "iphone",
          tid: "LH",
          encryptionKey: "",
          monitoring: mode === "move" ? 2 : 1,
          locatorDisplacement: mode === "move" ? 50 : 200,
          locatorInterval: mode === "move" ? 60 : 300,
          ignoreStaleLocations: 0,
          pubExtendedData: true,
          allowRemoteLocation: true,
          cmd: true,
          ws: false,
          tls: true,
        };

        return new Response(JSON.stringify(config, null, 2), {
          headers: {
            "content-type": "application/json",
            "content-disposition": 'attachment; filename="lifehub.otrc"',
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
