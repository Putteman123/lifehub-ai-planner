import { Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { groupCategories, type Category, type EventRow } from "@/lib/categories";
import { suggestCategory } from "@/lib/calendar";
import { learnCategory, learnedCategory } from "@/lib/category-learn";
import { suggestCategoryAi } from "@/lib/categorize.functions";
import { useCalendars, useCases, useChildren, useDeleteRow, useUpsertRow } from "@/lib/db";
import { useCategoryOptions, useCreateCategory } from "@/lib/event-categories";

const NONE = "__none__";
const NEW_CATEGORY = "__ny_kategori__";


function toLocalInput(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
  defaultCategory,
  defaultChildId,
  defaultCaseId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: EventRow | null;
  defaultDate?: Date;
  defaultCategory?: Category;
  defaultChildId?: string | null;
  defaultCaseId?: string | null;
}) {
  const upsert = useUpsertRow("events", "Händelsen sparades");
  const remove = useDeleteRow("events", "Händelsen togs bort");
  const { data: calendars = [] } = useCalendars();
  const { data: children = [] } = useChildren();
  const { data: cases = [] } = useCases();
  const { options: categoryOptions } = useCategoryOptions();
  const createCategory = useCreateCategory();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const askAi = useServerFn(suggestCategoryAi);
  const [aiReason, setAiReason] = useState<string | null>(null);
  const categoryTouched = useRef(false);
  const groups = useMemo(() => groupCategories(categoryOptions), [categoryOptions]);




  const [form, setForm] = useState({
    title: "",
    startsAt: "",
    endsAt: "",
    allDay: false,
    category: (defaultCategory ?? "privat") as Category,
    location: "",
    description: "",
    calendarId: NONE,
    childId: NONE,
    caseId: NONE,
  });

  useEffect(() => {
    if (!open) return;
    if (event) {
      setForm({
        title: event.title,
        startsAt: toLocalInput(event.starts_at),
        endsAt: toLocalInput(event.ends_at),
        allDay: event.all_day,
        category: event.category,
        location: event.location ?? "",
        description: event.description ?? "",
        calendarId: event.calendar_id ?? NONE,
        childId: event.child_id ?? NONE,
        caseId: event.case_id ?? NONE,
      });
      return;
    }
    const base = defaultDate ? new Date(defaultDate) : new Date();
    base.setMinutes(0, 0, 0);
    if (!defaultDate) base.setHours(base.getHours() + 1);
    else base.setHours(9);
    const end = new Date(base.getTime() + 60 * 60 * 1000);
    setForm({
      title: "",
      startsAt: toLocalInput(base.toISOString()),
      endsAt: toLocalInput(end.toISOString()),
      allDay: false,
      category: defaultCategory ?? "privat",
      location: "",
      description: "",
      calendarId: NONE,
      childId: defaultChildId ?? NONE,
      caseId: defaultCaseId ?? NONE,
    });
  }, [open, event, defaultDate, defaultCategory, defaultChildId, defaultCaseId]);

  useEffect(() => {
    if (!open) return;
    categoryTouched.current = false;
    setAiReason(null);
  }, [open, event]);

  // AI föreslår kategori kort efter att du slutat skriva – bara för nya händelser
  // och bara om du inte redan valt kategori själv.
  const title = form.title;
  useEffect(() => {
    if (event || categoryTouched.current || title.trim().length < 6) return;
    const options = categoryOptions.map((c) => ({ value: String(c.value), label: c.label }));
    let cancelled = false;
    const timer = setTimeout(() => {
      void askAi({ data: { text: title, options } })
        .then((res) => {
          if (cancelled || !res.category || categoryTouched.current) return;
          setForm((prev) => ({ ...prev, category: res.category as Category }));
          setAiReason(res.reason || null);
        })
        .catch(() => undefined);
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [title, event, categoryOptions, askAi]);



  function addCategory() {
    createCategory.mutate(newLabel, {
      onSuccess: (row) => {
        setForm((prev) => ({ ...prev, category: row.value }));
        setAdding(false);
        setNewLabel("");
      },
    });
  }

  const isGoogleCalendar =
    form.calendarId !== NONE &&
    calendars.some((c) => c.id === form.calendarId && c.source === "google");

  function save() {

    if (!form.title.trim() || !form.startsAt || !form.endsAt) return;
    const eventId = event?.id ?? crypto.randomUUID();
    upsert.mutate(
      {
        id: eventId,
        title: form.title.trim(),
        starts_at: new Date(form.startsAt).toISOString(),
        ends_at: new Date(form.endsAt).toISOString(),
        all_day: form.allDay,
        category: form.category,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
        calendar_id: form.calendarId === NONE ? null : form.calendarId,
        child_id: form.childId === NONE ? null : form.childId,
        case_id: form.caseId === NONE ? null : form.caseId,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          if (!isGoogleCalendar) return;
          void pushToGoogle({ data: { eventId } })
            .then((res) => {
              if (res.pushed) toast.success("Lagd i din Google-kalender");
            })
            .catch((error: unknown) =>
              toast.error(
                error instanceof Error
                  ? `Kunde inte skriva till Google: ${error.message}`
                  : "Kunde inte skriva till Google-kalendern.",
              ),
            );
        },
      },
    );
  }

  function removeEvent() {
    if (!event) return;
    const calendarId = event.calendar_id;
    const externalId = event.external_id;
    remove.mutate(event.id, {
      onSuccess: () => {
        onOpenChange(false);
        if (!calendarId || !externalId?.startsWith("gcal:")) return;
        void removeFromGoogle({ data: { calendarId, externalId } }).catch(() => undefined);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Redigera händelse" : "Ny händelse"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              value={form.title}
              placeholder="T.ex. Juristmöte"
              onChange={(e) => {
                const value = e.target.value;
                const next = { ...form, title: value };
                if (!event && !categoryTouched.current && value.length >= 3) {
                  const learned = learnedCategory(value);
                  next.category = (learned ?? suggestCategory(value)) as Category;
                }
                setForm(next);
              }}
            />
            {!event && form.title.length >= 3 ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Föreslagen kategori:{" "}
                <span className="font-medium text-foreground">
                  {categoryOptions.find((c) => c.value === form.category)?.label}
                </span>
                {aiReason ? <span className="truncate">– {aiReason}</span> : null}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end">Slut</Label>
              <Input
                id="end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <Label htmlFor="allday">Heldag</Label>
            <Switch
              id="allday"
              checked={form.allDay}
              onCheckedChange={(v) => setForm({ ...form, allDay: v })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Kategori</Label>
            {adding ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={newLabel}
                  maxLength={40}
                  placeholder="T.ex. Träning"
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCategory();
                    }
                    if (e.key === "Escape") setAdding(false);
                  }}
                />
                <Button size="sm" onClick={addCategory} disabled={createCategory.isPending}>
                  Spara
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Avbryt
                </Button>
              </div>
            ) : (
              <Select
                value={form.category}
                onValueChange={(v) => {
                  if (v === NEW_CATEGORY) {
                    setNewLabel("");
                    setAdding(true);
                    return;
                  }
                  categoryTouched.current = true;
                  setAiReason(null);
                  if (form.title.trim().length >= 3) learnCategory(form.title, v);
                  setForm({ ...form, category: v as Category });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectGroup key={group.value}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.items.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="flex items-center gap-2">
                            <span className={`size-2.5 rounded-full ${c.dot}`} />
                            {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                  <SelectItem value={NEW_CATEGORY}>
                    <span className="flex items-center gap-2 text-primary">
                      <Plus className="size-3.5" /> Ny kategori…
                    </span>
                  </SelectItem>
                </SelectContent>

              </Select>
            )}
          </div>


          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Kalender</Label>
              <Select
                value={form.calendarId}
                onValueChange={(v) => setForm({ ...form, calendarId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ingen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Ingen</SelectItem>
                  {calendars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Barn</Label>
              <Select value={form.childId} onValueChange={(v) => setForm({ ...form, childId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Inget" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Inget</SelectItem>
                  {children.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Ärende</Label>
              <Select value={form.caseId} onValueChange={(v) => setForm({ ...form, caseId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Inget" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Inget</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Plats</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="desc">Anteckning</Label>
            <Textarea
              id="desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {event ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => remove.mutate(event.id, { onSuccess: () => onOpenChange(false) })}
            >
              Ta bort
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={upsert.isPending}>
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
