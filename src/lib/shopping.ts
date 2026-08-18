import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { canonicalKey, isNonGrocery } from "@/lib/pantry-name";

export { canonicalKey, isNonGrocery };

export type ShoppingList = Tables<"shopping_lists">;
export type ShoppingItem = Tables<"shopping_items">;
export type PantryItem = Tables<"pantry_items">;

/** Normaliserar ett varunamn så att "Mjölk" och "mjölk " räknas som samma vara. */
export function nameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function prettyName(name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Du är inte inloggad.");
  return data.user.id;
}

/** Hämtar den aktiva listan, eller skapar en om ingen finns. */
export function useActiveList() {
  return useQuery({
    queryKey: ["shopping_list", "aktiv"],
    queryFn: async (): Promise<ShoppingList> => {
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("*")
        .eq("status", "aktiv")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return data;

      const user_id = await currentUserId();
      const { data: created, error: insertError } = await supabase
        .from("shopping_lists")
        .insert({ user_id, title: "Inköpslista" })
        .select("*")
        .single();
      if (insertError) throw new Error(insertError.message);
      return created;
    },
  });
}

export function useShoppingItems(listId: string | undefined) {
  return useQuery({
    queryKey: ["shopping_items", listId],
    enabled: Boolean(listId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("list_id", listId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function usePantry() {
  return useQuery({
    queryKey: ["pantry_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("*")
        .order("times_added", { ascending: false })
        .order("last_added_at", { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

type PantryLite = { id: string; name_key: string; times_added: number };

/** Hämtar skafferiet en gång så vi kan matcha varor mot befintliga rader. */
async function loadPantryIndex(): Promise<PantryLite[]> {
  const { data } = await supabase.from("pantry_items").select("id, name_key, times_added");
  return (data ?? []) as PantryLite[];
}

/** Hittar befintlig vara på exakt nyckel eller kanonisk nyckel (Iste = Iste citron). */
function matchPantry(index: PantryLite[], name: string) {
  const key = nameKey(name);
  const canon = canonicalKey(name);
  return (
    index.find((row) => row.name_key === key) ??
    index.find((row) => canonicalKey(row.name_key) === canon) ??
    null
  );
}

/** Sparar varan i varuregistret så den kommer med som förslag nästa gång. */
async function rememberItems(
  userId: string,
  items: { name: string; source: "manuell" | "ai" }[],
) {
  const index = await loadPantryIndex();
  for (const item of items) {
    const key = nameKey(item.name);
    if (!key || isNonGrocery(item.name)) continue;
    const existing = matchPantry(index, item.name);

    if (existing) {
      existing.times_added += 1;
      await supabase
        .from("pantry_items")
        .update({
          times_added: existing.times_added,
          last_added_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      const { data: created } = await supabase
        .from("pantry_items")
        .insert({
          user_id: userId,
          name: prettyName(item.name),
          name_key: key,
          source: item.source,
        })
        .select("id, name_key, times_added")
        .maybeSingle();
      if (created) index.push(created as PantryLite);
    }
  }
}


export function useAddItems(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { names: string[]; source?: "manuell" | "ai" }) => {
      if (!listId) throw new Error("Ingen aktiv lista.");
      const source = input.source ?? "manuell";
      const user_id = await currentUserId();

      const { data: existing } = await supabase
        .from("shopping_items")
        .select("name, sort_order")
        .eq("list_id", listId);
      const taken = new Set((existing ?? []).map((row) => nameKey(row.name)));
      let order = Math.max(0, ...(existing ?? []).map((row) => row.sort_order));

      const fresh = input.names
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .filter((name) => {
          const key = nameKey(name);
          if (taken.has(key)) return false;
          taken.add(key);
          return true;
        });

      if (!fresh.length) return 0;

      const rows = fresh.map((name) => ({
        user_id,
        list_id: listId,
        name: prettyName(name),
        source,
        sort_order: ++order,
      }));
      const { error } = await supabase.from("shopping_items").insert(rows);
      if (error) throw new Error(error.message);

      await rememberItems(user_id, fresh.map((name) => ({ name, source })));
      return fresh.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping_items", listId] });
      qc.invalidateQueries({ queryKey: ["pantry_items"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useToggleItem(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: ShoppingItem) => {
      const next = !item.is_checked;
      const { error } = await supabase
        .from("shopping_items")
        .update({ is_checked: next, checked_at: next ? new Date().toISOString() : null })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
    },
    onMutate: async (item: ShoppingItem) => {
      await qc.cancelQueries({ queryKey: ["shopping_items", listId] });
      const previous = qc.getQueryData<ShoppingItem[]>(["shopping_items", listId]);
      qc.setQueryData<ShoppingItem[]>(["shopping_items", listId], (old) =>
        (old ?? []).map((row) =>
          row.id === item.id ? { ...row, is_checked: !row.is_checked } : row,
        ),
      );
      return { previous };
    },
    onError: (error: Error, _item, ctx) => {
      if (ctx?.previous) qc.setQueryData(["shopping_items", listId], ctx.previous);
      toast.error(error.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["shopping_items", listId] }),
  });
}

export function useDeleteItem(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_items").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping_items", listId] }),
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeletePantryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pantry_items").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pantry_items"] }),
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Lyssnar på ändringar från andra enheter och håller listan i synk i realtid. */
export function useShoppingRealtime(listId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("shopping-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items" },
        () => {
          if (listId) qc.invalidateQueries({ queryKey: ["shopping_items", listId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_lists" },
        () => qc.invalidateQueries({ queryKey: ["shopping_list", "aktiv"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pantry_items" },
        () => qc.invalidateQueries({ queryKey: ["pantry_items"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, listId]);
}

/** Dagar sedan varan senast köptes, eller null om det inte är känt. */
export function daysSincePurchase(row: PantryItem): number | null {
  const iso = row.last_purchased_at ?? null;
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

/**
 * Lägger inlästa kvittovaror i skafferiet (inte direkt i inköpslistan)
 * och stämplar när de köptes.
 */
export function useAddPantryItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { names: string[]; purchasedAt?: string }) => {
      const user_id = await currentUserId();
      const purchased = input.purchasedAt ?? new Date().toISOString();
      const index = await loadPantryIndex();
      let saved = 0;
      for (const raw of input.names) {
        const key = nameKey(raw);
        if (!key || isNonGrocery(raw)) continue;
        const existing = matchPantry(index, raw);
        if (existing) {
          existing.times_added += 1;
          await supabase
            .from("pantry_items")
            .update({
              times_added: existing.times_added,
              last_added_at: purchased,
              last_purchased_at: purchased,
            })
            .eq("id", existing.id);
        } else {
          const { data: created } = await supabase
            .from("pantry_items")
            .insert({
              user_id,
              name: prettyName(raw),
              name_key: key,
              source: "ai",
              last_added_at: purchased,
              last_purchased_at: purchased,
            })
            .select("id, name_key, times_added")
            .maybeSingle();
          if (created) index.push(created as PantryLite);
        }
        saved += 1;
      }
      return saved;
    },

    onSuccess: () => qc.invalidateQueries({ queryKey: ["pantry_items"] }),
    onError: (error: Error) => toast.error(error.message),
  });
}
