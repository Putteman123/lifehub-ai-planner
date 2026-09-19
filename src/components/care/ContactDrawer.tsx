import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Phone, Search, Users, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CareAvatar } from "@/components/care/CareUI";
import { CareClientChat } from "@/components/care/CareClientChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  listCareContacts,
  markThreadRead,
  startCareMeet,
  type CareContact,
} from "@/lib/care-messages.functions";

/**
 * Kontaktknapp som finns i hela vårddelen: en lista med alla personer
 * användaren får kontakta, med chatt, videosamtal och telefon.
 */
export function ContactDrawer() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<CareContact | null>(null);
  const qc = useQueryClient();

  const fetchContacts = useServerFn(listCareContacts);
  const markRead = useServerFn(markThreadRead);
  const startMeet = useServerFn(startCareMeet);

  const q = useQuery({
    queryKey: ["care-contacts"],
    queryFn: () => fetchContacts({}),
    refetchInterval: 60000,
  });

  const contacts = (q.data?.contacts ?? []) as CareContact[];
  const unread = q.data?.unread ?? 0;

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("sv-SE");
    if (!needle) return contacts;
    return contacts.filter((c) =>
      `${c.name} ${c.role} ${c.clientName}`.toLocaleLowerCase("sv-SE").includes(needle),
    );
  }, [contacts, search]);

  const meet = useMutation({
    mutationFn: (clientId: string) => startMeet({ data: { clientId } }),
    onSuccess: (res: { link: string }) => window.open(res.link, "_blank", "noopener"),
    onError: (e: Error) => toast.error(e.message),
  });

  function openChat(contact: CareContact) {
    setActive(contact);
    void markRead({ data: { clientId: contact.clientId } }).then(() => {
      void qc.invalidateQueries({ queryKey: ["care-contacts"] });
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setActive(null);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-2">
          <Users className="h-4 w-4" aria-hidden />
          Kontakta
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
              {unread}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{active ? active.name : "Kontakta"}</SheetTitle>
          <SheetDescription>
            {active
              ? `Samtal kring ${active.clientName}`
              : "Personal, brukare och anhöriga – välj vem du vill nå."}
          </SheetDescription>
        </SheetHeader>

        {active ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setActive(null)}>
                Tillbaka
              </Button>
              {active.phone ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${active.phone}`} className="gap-2">
                    <Phone className="h-4 w-4" aria-hidden />
                    Ring
                  </a>
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={meet.isPending}
                onClick={() => meet.mutate(active.clientId)}
              >
                <Video className="h-4 w-4" aria-hidden />
                Videosamtal
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CareClientChat clientId={active.clientId} title={active.clientName} />
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sök namn eller roll"
                className="pl-9"
              />
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {q.isLoading ? (
                <p className="text-sm text-muted-foreground">Hämtar kontakter…</p>
              ) : filtered.length === 0 ? (
                <p className="rounded-2xl border border-border/70 bg-secondary/40 p-4 text-sm text-muted-foreground">
                  Inga kontakter att visa ännu. Be verksamheten lägga till dig med din e-postadress.
                </p>
              ) : (
                filtered.map((c, i) => (
                  <button
                    key={`${c.clientId}-${c.name}-${i}`}
                    type="button"
                    onClick={() => openChat(c)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 text-left transition hover:border-primary/50"
                  >
                    <CareAvatar name={c.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.role} · {c.clientName}
                      </span>
                    </span>
                    {c.unread > 0 ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        {c.unread}
                      </span>
                    ) : (
                      <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
