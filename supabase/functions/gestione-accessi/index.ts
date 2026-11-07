// Funzione Supabase "gestione-accessi" (solo amministratori): approva/rifiuta richieste, crea gli account con la
// password iniziale comune, modifica sezioni e ruolo, sospende, reimposta password e Authenticator, elimina.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const risposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const SEZIONI = ["tutte", "assistente", "progetti", "edificio", "rischio", "captazione", "calate", "terra", "spd", "computo", "particolari", "verifiche", "prodotti", "modelli3d", "cad"];
const sezioniValide = (v: unknown) => (Array.isArray(v) ? v.map(String).filter((s) => SEZIONI.includes(s)) : []);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // chi chiama deve essere un amministratore attivo, entrato con l'Authenticator (aal2)
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: io } = await admin.auth.getUser(token);
  if (!io.user) return risposta({ errore: "Accesso richiesto" }, 401);
  const aal = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")))?.aal;
  const { data: profilo } = await admin.from("accessi_profili").select("ruolo,stato").eq("utente", io.user.id).maybeSingle();
  if (profilo?.ruolo !== "admin" || profilo.stato !== "attivo" || aal !== "aal2") return risposta({ errore: "Solo per amministratori con Authenticator attivo" }, 403);

  let d: Record<string, unknown>;
  try { d = await req.json(); } catch { return risposta({ errore: "Dati non validi" }, 400); }
  const registra = (evento: string, dettagli: Record<string, unknown>) => admin.from("registro_accessi").insert({ utente: io.user!.id, email: io.user!.email, evento, dettagli });
  const passwordIniziale = async () => (await admin.from("impostazioni_admin").select("valore").eq("chiave", "password_iniziale").maybeSingle()).data?.valore ?? "";

  switch (d.azione) {
    case "approva": {
      const { data: r } = await admin.from("richieste_accesso").select("*").eq("id", String(d.richiesta)).maybeSingle();
      if (!r || r.stato !== "in_attesa") return risposta({ errore: "Richiesta non trovata o già gestita" }, 404);
      const pw = await passwordIniziale();
      if (pw.length < 6) return risposta({ errore: "Imposta prima la password iniziale (almeno 6 caratteri) nelle impostazioni admin." }, 400);
      const sezioni = sezioniValide(d.sezioni);
      let utente: string | null = null;
      const creato = await admin.auth.admin.createUser({ email: r.email, password: pw, email_confirm: true, user_metadata: { nome_visualizzato: r.nome } });
      if (creato.error) {
        // account già esistente: lo si riattiva con la password iniziale
        const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const esistente = lista?.users.find((u) => u.email?.toLowerCase() === r.email.toLowerCase());
        if (!esistente) return risposta({ errore: creato.error.message }, 400);
        utente = esistente.id;
        await admin.auth.admin.updateUserById(utente, { password: pw });
      } else utente = creato.data.user.id;
      await admin.from("accessi_profili").upsert({ utente, email: r.email, nome: r.nome, azienda: r.azienda, ruolo: "utente", stato: "attivo", sezioni, deve_cambiare_password: true });
      await admin.from("richieste_accesso").update({ stato: "approvata", sezioni, gestita_il: new Date().toISOString(), gestita_da: io.user.id }).eq("id", r.id);
      await registra("approvazione", { email: r.email, sezioni });
      return risposta({ ok: true });
    }
    case "rifiuta": {
      await admin.from("richieste_accesso").update({ stato: "rifiutata", gestita_il: new Date().toISOString(), gestita_da: io.user.id }).eq("id", String(d.richiesta));
      await registra("rifiuto", { richiesta: d.richiesta });
      return risposta({ ok: true });
    }
    case "aggiorna": {
      const campi: Record<string, unknown> = {};
      if (d.sezioni !== undefined) campi.sezioni = sezioniValide(d.sezioni);
      if (d.ruolo === "admin" || d.ruolo === "utente") campi.ruolo = d.ruolo;
      if (d.stato === "attivo" || d.stato === "sospeso") campi.stato = d.stato;
      if (String(d.utente) === io.user.id && (campi.ruolo === "utente" || campi.stato === "sospeso")) return risposta({ errore: "Non puoi togliere i permessi a te stesso" }, 400);
      await admin.from("accessi_profili").update(campi).eq("utente", String(d.utente));
      if (campi.stato === "sospeso") await admin.auth.admin.signOut(String(d.utente)).catch(() => undefined);
      await registra("modifica_utente", { utente: d.utente, ...campi });
      return risposta({ ok: true });
    }
    case "reimposta": {
      const pw = await passwordIniziale();
      if (pw.length < 6) return risposta({ errore: "Password iniziale non impostata." }, 400);
      const id = String(d.utente);
      await admin.auth.admin.updateUserById(id, { password: pw });
      if (d.authenticator) {
        const { data: fattori } = await admin.auth.admin.mfa.listFactors({ userId: id });
        for (const f of fattori?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ userId: id, id: f.id });
      }
      await admin.from("accessi_profili").update({ deve_cambiare_password: true }).eq("utente", id);
      await registra("reimpostazione", { utente: id, authenticator: Boolean(d.authenticator) });
      return risposta({ ok: true });
    }
    case "elimina": {
      const id = String(d.utente);
      if (id === io.user.id) return risposta({ errore: "Non puoi eliminare te stesso" }, 400);
      await admin.auth.admin.deleteUser(id);
      await registra("eliminazione", { utente: id });
      return risposta({ ok: true });
    }
    case "fattori": {
      // utenti che hanno attivato l'Authenticator
      const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      return risposta({ conAuthenticator: (lista?.users ?? []).filter((u) => (u.factors ?? []).some((f) => f.status === "verified")).map((u) => u.id) });
    }
    default:
      return risposta({ errore: "Azione sconosciuta" }, 400);
  }
});
