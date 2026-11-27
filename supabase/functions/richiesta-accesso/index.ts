// Funzione Supabase "richiesta-accesso" (pubblica): salva la richiesta e avvisa l'amministratore via email (Resend).
// Due casi:
//  - nuovo account (pagina di accesso di OBO Hub): salva in richieste_accesso e manda l'email;
//  - richiesta di un'app da chi ha già l'account ({ tipo: "app", id }): la richiesta è già salvata da richiedi_app
//    (SQL 21); qui si controlla che sia della persona collegata, in attesa e non ancora avvisata, e si manda l'email una volta.
// Segreti richiesti: RESEND_API_KEY (facoltativo EMAIL_MITTENTE). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già disponibili.
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
  if (dati.tipo === "app") return avvisoApp(req, dati);
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
  const app = pulisci(dati.app, 300) || "https://obotechhub.github.io/appOBOtechHUB/";
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

const NOMI_APP: Record<string, string> = { lps: "Progettazione LPS", mappa: "Mappa carichi ufficio tecnico", prodotti: "Prodotti OBO", zavorra: "Zavorra telai inverter WRR", torrette: "Configuratore torrette" };

/** Email all'amministratore per una richiesta di accesso a un'app (una sola volta per richiesta). */
async function avvisoApp(req: Request, dati: Record<string, unknown>): Promise<Response> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const id = pulisci(dati.id, 60);
  if (!jwt || !/^[0-9a-f-]{36}$/i.test(id)) return risposta({ errore: "Dati non validi" }, 400);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return risposta({ errore: "Accesso non valido" }, 401);
  const { data: r } = await db.from("richieste_app").select("*").eq("id", id).eq("utente", u.user.id).maybeSingle();
  if (!r || r.stato !== "in_attesa" || r.avvisata_il) return risposta({ ok: true, gia: true });
  // segna subito come avvisata: un secondo invio della stessa richiesta non manda un'altra email
  const { data: segnata } = await db.from("richieste_app").update({ avvisata_il: new Date().toISOString() }).eq("id", id).is("avvisata_il", null).select("id");
  if (!segnata?.length) return risposta({ ok: true, gia: true });
  const { data: imp } = await db.from("impostazioni_admin").select("valore").eq("chiave", "email_admin").maybeSingle();
  const destinatario = imp?.valore, chiave = Deno.env.get("RESEND_API_KEY");
  if (!destinatario || !chiave) return risposta({ ok: true, email: false });
  const nomeApp = NOMI_APP[r.app] ?? r.app, chi = r.nome || r.email;
  const ris = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("EMAIL_MITTENTE") ?? "OBO Hub <onboarding@resend.dev>",
      to: [destinatario],
      reply_to: r.email || undefined,
      subject: `Richiesta di accesso a ${nomeApp}: ${chi}`,
      html: `<p><strong>${html(chi)}</strong> (${html(r.email)}) chiede l'accesso a <strong>${html(nomeApp)}</strong> in OBO Hub.</p>${r.motivo ? `<p>Motivo: <em>${html(r.motivo)}</em></p>` : ""}<p>Approva o rifiuta da <a href="https://obotechhub.github.io/appOBOtechHUB/admin">Amministrazione → Richieste</a>.</p>`,
    }),
  }).catch(() => null);
  return risposta({ ok: true, email: !!ris?.ok });
}
