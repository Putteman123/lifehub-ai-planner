import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORIES,
  mergeCategories,
  nextPaletteToken,
  type CategoryOption,
  type CustomCategoryRow,
} from "./categories";

/** Gör om ett fritt namn till ett stabilt kategorivärde. */
export function slugifyCategory(label: string) {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[åä]/g, "a")
      .replace(/ö/g, "o")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `kategori-${Date.now().toString(36)}`
  );
}

export function useCustomCategories() {
  return useQuery({
    queryKey: ["event_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as CustomCategoryRow[];
    },
  });
}

/** Inbyggda + egna kategorier i en enda lista. */
export function useCategoryOptions(): {
  options: CategoryOption[];
  custom: CustomCategoryRow[];
} {
  const { data } = useCustomCategories();
  const custom = useMemo(() => data ?? [], [data]);
  const options = useMemo(() => mergeCategories(custom), [custom]);
  return { options, custom };
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) => {
      const trimmed = label.trim();
      if (!trimmed) throw new Error("Ange ett namn på kategorin.");
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Du är inte inloggad.");

      const value = slugifyCategory(trimmed);
      const existing = (qc.getQueryData<CustomCategoryRow[]>(["event_categories"]) ?? []).length;
      if (CATEGORIES.some((c) => c.value === value)) {
        throw new Error("Den kategorin finns redan.");
      }

      const { data, error } = await supabase
        .from("event_categories")
        .insert({
          user_id: userData.user.id,
          value,
          label: trimmed,
          color_token: nextPaletteToken(existing + CATEGORIES.length),
          sort_order: existing,
        })
        .select()
        .single();
      if (error) {
        throw new Error(
          error.code === "23505" ? "Den kategorin finns redan." : error.message,
        );
      }
      return data as CustomCategoryRow;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["event_categories"] });
      toast.success("Kategorin skapades");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRenameCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const trimmed = label.trim();
      if (!trimmed) throw new Error("Ange ett namn på kategorin.");
      const { error } = await supabase
        .from("event_categories")
        .update({ label: trimmed })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["event_categories"] });
      toast.success("Kategorin uppdaterades");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Tar bort en egen kategori och flyttar dess händelser till Privat. */
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: CustomCategoryRow) => {
      const { error: moveError } = await supabase
        .from("events")
        .update({ category: "privat" })
        .eq("category", row.value);
      if (moveError) throw new Error(moveError.message);

      const { error } = await supabase.from("event_categories").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["event_categories"] });
      void qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Kategorin togs bort");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
