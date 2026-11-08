// Funzione Supabase "richiesta-accesso" (pubblica): salva la richiesta e avvisa l'amministratore via email (Resend).
// Segreti richiesti: RESEND_API_KEY. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già disponibili.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const risposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const pulisci = (v: unknown, max: number) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
const html = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return risposta({ errore: "Metodo non consentito" }, 405);
  let dati: Record<string, unknown>;
  try { dati = await req.json(); } catch { return risposta({ errore: "Dati non validi" }, 400); }
  const email = pulisci(dati.email, 254).toLowerCase();
  const nome = pulisci(dati.nome, 120), azienda = pulisci(dati.azienda, 160), motivo = pulisci(dati.motivo, 1000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !nome) return risposta({ errore: "Indica nome ed email validi." }, 400);
  if (pulisci(dati.sito, 50)) return risposta({ ok: true }); // campo trappola per i bot

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // massimo 3 richieste in attesa per email e 30 al giorno in totale
  const { count: perEmail } = await db.from("richieste_accesso").select("id", { count: "exact", head: true }).eq("email", email).eq("stato", "in_attesa");
  if ((perEmail ?? 0) >= 3) return risposta({ ok: true, gia: true });
  const ieri = new Date(Date.now() - 864e5).toISOString();
  const { count: oggi } = await db.from("richieste_accesso").select("id", { count: "exact", head: true }).gte("creata_il", ieri);
  if ((oggi ?? 0) >= 30) return risposta({ errore: "Troppe richieste oggi, riprova domani." }, 429);

  const { error } = await db.from("richieste_accesso").insert({ email, nome, azienda, motivo });
  if (error) return risposta({ errore: "Richiesta non salvata." }, 500);

  const { data: imp } = await db.from("impostazioni_admin").select("valore").eq("chiave", "email_admin").maybeSingle();
  const destinatario = imp?.valore;
  const chiave = Deno.env.get("RESEND_API_KEY");
  const app = pulisci(dati.app, 300) || "https://loveteremarco1981-coder.github.io/Lighting/";
  if (destinatario && chiave) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_MITTENTE") ?? "OBO Hub <onboarding@resend.dev>",
        to: [destinatario],
        subject: `Richiesta di accesso: ${nome}${azienda ? " · " + azienda : ""}`,
        html: `<p>Nuova richiesta di accesso a <strong>OBO Hub</strong>.</p><ul><li><strong>Nome:</strong> ${html(nome)}</li><li><strong>Email:</strong> ${html(email)}</li><li><strong>Azienda:</strong> ${html(azienda || "—")}</li><li><strong>Motivo:</strong> ${html(motivo || "—")}</li></ul><p>Approva o rifiuta dalla <a href="${html(app)}admin">sezione admin</a>.</p>`,
      }),
    }).catch(() => undefined);
  }
  return risposta({ ok: true });
});
