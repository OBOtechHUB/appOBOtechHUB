import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// URL e chiave pubblica (publishable/anon) del progetto Supabase: arrivano da .env o dalle
// variabili del repository GitHub (Settings → Secrets and variables → Actions → Variables).
// tollera URL copiati con "/rest/v1/" o "/" finale
const SUPABASE_URL = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.trim().replace(/\/(rest|auth|storage)\/v1\/?$/, "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const message = "Configurazione Supabase mancante: imposta VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.";
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Uso: import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
