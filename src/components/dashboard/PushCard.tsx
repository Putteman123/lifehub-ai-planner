import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Send, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { enablePush, pushPlatform, type PushStatus } from "@/lib/push";
import { getPushStatus, savePushToken, sendTestPush } from "@/lib/push.functions";

const MESSAGES: Record<PushStatus, string> = {
  registered: "Pushnotiser är påslagna på den här enheten.",
  "not-configured": "Firebase är inte kopplat ännu, så push kan inte slås på.",
  unsupported: "Den här webbläsaren stödjer inte pushnotiser.",
  "open-in-new-tab": "Öppna appen i en egen flik och försök igen – frågan blockeras i förhandsvisningen.",
  "install-on-home-screen": "Lägg till appen på hemskärmen på iPhone, öppna den därifrån och försök igen.",
  denied: "Notiser är blockerade. Tillåt notiser för sajten i webbläsarens inställningar.",
};

/** Slå på riktiga pushnotiser och skicka en testnotis. */
export function PushCard() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getPushStatus);
  const saveToken = useServerFn(savePushToken);
  const test = useServerFn(sendTestPush);
  const [note, setNote] = useState<string | null>(null);

  const statusQ = useQuery({
    queryKey: ["push-status"],
    queryFn: () => fetchStatus({}),
    staleTime: 60_000,
  });

  const enableM = useMutation({
    mutationFn: async () => {
      const result = await enablePush();
      if (result.status === "registered" && result.token) {
        await saveToken({
          data: {
            token: result.token,
            platform: pushPlatform(),
            userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
          },
        });
        localStorage.setItem("lifehub_push_on", "1");
      }
      return result.status;
    },
    onSuccess: (status) => {
      setNote(MESSAGES[status]);
      if (status === "registered") {
        toast.success("Pushnotiser påslagna");
        void qc.invalidateQueries({ queryKey: ["push-status"] });
      }
    },
    onError: (e: Error) => setNote(e.message),
  });

  const testM = useMutation({
    mutationFn: () => test({}),
    onSuccess: (r) => {
      if (r.sent > 0) toast.success("Testnotis skickad");
      else toast.error(r.error ?? "Kunde inte skicka");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const devices = statusQ.data?.devices ?? [];

  return (
    <SectionCard title="Aviseringar" icon={BellRing} accent="text-primary" tint="bg-primary/12">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {devices.length > 0
            ? `Påslaget på ${devices.length} ${devices.length === 1 ? "enhet" : "enheter"}. Du får notiser även när appen är stängd.`
            : "Slå på notiser så når påminnelser dig även när appen är stängd."}
        </p>

        {note ? <p className="text-sm">{note}</p> : null}

        {statusQ.data && !statusQ.data.connected ? (
          <p className="text-sm text-destructive">
            Firebase-kopplingen saknas ännu – notiser kan inte skickas förrän den är på plats.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => enableM.mutate()} disabled={enableM.isPending}>
            <Smartphone className="mr-2 size-4" />
            {devices.length > 0 ? "Registrera den här enheten" : "Slå på pushnotiser"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => testM.mutate()}
            disabled={testM.isPending || devices.length === 0}
          >
            <Send className="mr-2 size-4" />
            Skicka testnotis
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
