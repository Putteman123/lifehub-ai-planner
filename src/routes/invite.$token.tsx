import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite } from "@/lib/care.functions";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "Tacka ja till inbjudan – LifeHub Vård" },
      {
        name: "description",
        content:
          "Aktivera din inbjudan till LifeHub Vård och kom in i verksamhetens schema, uppgifter och medicinlista.",
      },
      { property: "og:title", content: "Tacka ja till inbjudan – LifeHub Vård" },
      {
        property: "og:description",
        content: "Aktivera din inbjudan och kom in i LifeHub Vård.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const accept = useServerFn(acceptInvite);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  async function onAccept() {
    setBusy(true);
    setError(null);
    try {
      const result = await accept({ data: { token } });
      setDone(result.orgName);
      setTimeout(() => void navigate({ to: "/v" }), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-5 px-6">
      <h1 className="text-2xl font-semibold text-foreground">Din inbjudan till LifeHub Vård</h1>

      {done ? (
        <p className="text-muted-foreground">
          Klart! Du är nu med i {done}. Vi tar dig vidare…
        </p>
      ) : signedIn === false ? (
        <>
          <p className="text-muted-foreground">
            Logga in med den e-postadress inbjudan skickades till, så kommer du tillbaka hit.
          </p>
          <Button asChild>
            <Link to="/auth">Logga in</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">
            Tryck på knappen för att tacka ja och komma in i verksamheten.
          </p>
          <Button onClick={() => void onAccept()} disabled={busy || signedIn === null}>
            {busy ? "Aktiverar…" : "Tacka ja till inbjudan"}
          </Button>
        </>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </main>
  );
}

export default InvitePage;
