import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Particolari segnati come verificati dall'utente (salvati nella libreria personale in Cloud). */
let verificati: string[] = [];
const ascoltatori = new Set<() => void>();
export function impostaVerificati(v: unknown) {
  verificati = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 5000) : [];
  ascoltatori.forEach((f) => f());
}
export function useVerificati() {
  return useSyncExternalStore((f) => { ascoltatori.add(f); return () => ascoltatori.delete(f); }, () => verificati, () => verificati);
}
export async function segnaVerificato(id: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Accedi per salvare.");
  const nuovi = [...new Set([...verificati, id])];
  const { error: e1 } = await supabase.from("librerie_lps").upsert({ utente: data.user.id }, { onConflict: "utente", ignoreDuplicates: true });
  if (e1) throw new Error("Libreria non disponibile.");
  const { error } = await supabase.from("librerie_lps").update({ particolari_verificati: nuovi }).eq("utente", data.user.id);
  if (error) throw new Error("Salvataggio non riuscito.");
  impostaVerificati(nuovi);
}
