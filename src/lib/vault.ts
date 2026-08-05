import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type VaultItem = Tables<"vault_items">;
export type VaultFile = Tables<"vault_files">;
export type VaultKind = VaultItem["kind"];

export const VAULT_KINDS: { value: VaultKind; label: string }[] = [
  { value: "losenord", label: "Lösenord" },
  { value: "pinkod", label: "Pinkod" },
  { value: "kod", label: "Kod" },
  { value: "anteckning", label: "Anteckning" },
];

export const BUCKET = "kassaskap";

export function useVaultItems() {
  return useQuery({
    queryKey: ["vault_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_items")
        .select("*")
        .order("title", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useVaultFiles() {
  return useQuery({
    queryKey: ["vault_files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_files")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Du är inte inloggad.");
  return data.user.id;
}

export function useSaveVaultItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown> & { title: string }) => {
      const user_id = await currentUserId();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("vault_items").upsert({ ...values, user_id } as any);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault_items"] });
      toast.success("Sparat i kassaskåpet");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteVaultItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vault_items").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault_items"] });
      toast.success("Borttaget");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUploadVaultFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const user_id = await currentUserId();
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user_id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (uploadError) throw new Error(uploadError.message);

        const { error } = await supabase.from("vault_files").insert({
          user_id,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
        });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault_files"] });
      toast.success("Uppladdat");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteVaultFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: VaultFile) => {
      await supabase.storage.from(BUCKET).remove([file.storage_path]);
      const { error } = await supabase.from("vault_files").delete().eq("id", file.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault_files"] });
      toast.success("Filen är borttagen");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Tidsbegränsad länk till en privat fil (1 timme). */
export async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw new Error(error?.message ?? "Kunde inte skapa länk.");
  return data.signedUrl;
}

export function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImage(mime: string | null) {
  return Boolean(mime?.startsWith("image/"));
}
