import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { moduleLabel, ROLE_DESCRIPTIONS, ROLE_LABELS, type CareRole } from "@/lib/care";
import { getCareContext } from "@/lib/care.functions";

export const Route = createFileRoute("/_authenticated/v/")({
  head: () => ({
    meta: [
      { title: "Översikt – LifeHub Vård" },
      { name: "description", content: "Dina organisationer, roller och aktiva moduler." },
    ],
  }),
  component: CareOverview,
});

function CareOverview() {
  const fetchContext = useServerFn(getCareContext);
  const { data, isLoading } = useQuery({
    queryKey: ["care-context"],
    queryFn: () => fetchContext({}),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Vårdöversikt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Här ser du vilka verksamheter du tillhör och vad som är påslaget.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Hämtar…</p>
      ) : (
        <>
          {data?.isOwner ? (
            <div className="rounded-3xl border border-border/70 bg-card p-6">
              <h2 className="font-display text-lg font-semibold">Du är superadmin</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Du kan skapa organisationer och bestämma vilka moduler de får.
              </p>
              <Button asChild className="mt-4">
                <Link to="/v/organisationer">Hantera organisationer</Link>
              </Button>
            </div>
          ) : null}

          {(data?.memberships ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Du är inte med i någon vårdorganisation ännu.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {data?.memberships.map((m) => (
                <div key={`${m.orgId}-${m.role}`} className="rounded-3xl border border-border/70 bg-card p-6">
                  <h3 className="font-display text-lg font-semibold">{m.orgName}</h3>
                  <p className="mt-1 text-sm font-medium">{ROLE_LABELS[m.role as CareRole]}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {ROLE_DESCRIPTIONS[m.role as CareRole]}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.modules.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Inga moduler påslagna</span>
                    ) : (
                      m.modules.map((mod) => (
                        <span
                          key={mod}
                          className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                        >
                          {moduleLabel(mod)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
