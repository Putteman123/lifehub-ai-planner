import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { CareClientChat } from "@/components/care/CareClientChat";
import { Button } from "@/components/ui/button";
import { listMyCareThreads } from "@/lib/care-messages.functions";

export const Route = createFileRoute("/_authenticated/v/samtal")({
  head: () => ({
    meta: [
      { title: "Samtal – LifeHub Vård" },
      {
        name: "description",
        content: "Meddelanden mellan personal, brukare och anhöriga i LifeHub Vård.",
      },
      { property: "og:title", content: "Samtal – LifeHub Vård" },
      {
        property: "og:description",
        content: "Meddelanden mellan personal, brukare och anhöriga i LifeHub Vård.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CareThreads,
});

function CareThreads() {
  const fetchThreads = useServerFn(listMyCareThreads);
  const [active, setActive] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["care-threads"],
    queryFn: () => fetchThreads({}),
  });

  const threads = (q.data ?? []) as { id: string; name: string; orgName: string; slug: string }[];
  const current = threads.find((t) => t.id === active) ?? threads[0];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Samtal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Skriv direkt med personalen, brukaren och anhöriga.
        </p>
      </header>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Hämtar…</p>
      ) : threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Du har inga samtal än. Be verksamheten lägga till dig som anhörig med din e-postadress.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {threads.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={current?.id === t.id ? "default" : "secondary"}
                onClick={() => setActive(t.id)}
              >
                {t.name}
                {t.orgName ? ` · ${t.orgName}` : ""}
              </Button>
            ))}
          </div>
          {current ? <CareClientChat clientId={current.id} title={current.name} /> : null}
        </>
      )}
    </div>
  );
}
