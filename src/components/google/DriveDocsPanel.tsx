import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ExternalLink, FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createGoogleDoc, searchDrive } from "@/lib/google.functions";

/** Dokument från Google Drive plus snabb skapa-anteckning i Google Docs. */
export function DriveDocsPanel({ contextTitle }: { contextTitle?: string }) {
  const driveFn = useServerFn(searchDrive);
  const docFn = useServerFn(createGoogleDoc);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);

  const filesQ = useQuery({
    queryKey: ["drive", term],
    queryFn: () => driveFn({ data: { query: term, max: 8 } }),
    retry: false,
  });

  async function newNote() {
    setCreating(true);
    try {
      const title = `Mötesanteckning – ${contextTitle ?? "Juristärende"} ${new Date().toLocaleDateString("sv-SE")}`;
      const doc = await docFn({
        data: {
          title,
          text: `${title}\n\nNärvarande:\n\nAnteckningar:\n\nAtt göra:\n`,
        },
      });
      window.open(doc.link, "_blank", "noopener");
      toast.success("Dokumentet är skapat i Google Docs");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skapa dokumentet");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="card-soft mt-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-[hsl(var(--cat-jurist))]" /> Dokument (Google Drive)
        </h2>
        <Button size="sm" variant="secondary" disabled={creating} onClick={newNote}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          Ny mötesanteckning
        </Button>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(query.trim());
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök filnamn i Drive…"
        />
        <Button type="submit" size="icon" variant="ghost" aria-label="Sök i Drive">
          <Search className="size-4" />
        </Button>
      </form>

      {filesQ.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Hämtar filer…</p>
      ) : !filesQ.data?.connected ? (
        <p className="mt-3 text-sm text-muted-foreground">Google Drive är inte kopplat.</p>
      ) : filesQ.data.files.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Inga filer hittades.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {filesQ.data.files.map((f) => (
            <li
              key={f.id}
              className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2"
            >
              <span className="truncate text-sm">{f.name}</span>
              {f.link ? (
                <a
                  href={f.link}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={`Öppna ${f.name}`}
                >
                  <ExternalLink className="size-4" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
