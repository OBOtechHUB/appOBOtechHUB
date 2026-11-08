import { useState, type ReactNode } from "react";
import { Copy, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/Campo";
import { db, gestione, type Profilo } from "@/lib/accesso";
import type { PersonaMappa } from "./MappaUtente";

const URL_HUB = "https://loveteremarco1981-coder.github.io/obo-hub/";

function testoInvito(nome: string, email: string, password: string) {
  return `Ciao ${nome.split(" ")[0] || ""},
ti ho attivato l'accesso a OBO Hub, dove trovi le app dell'ufficio tecnico (tra cui la Mappa carichi).

1. Apri ${URL_HUB} e premi "Accedi"
2. Email: ${email}
3. Password iniziale: ${password}
4. Scegli la tua password personale (almeno 10 caratteri con lettere e numeri)
5. Inquadra il codice QR con l'app Microsoft Authenticator (+ > Altro account) e inserisci il codice a 6 cifre

Da lì in poi entri sempre con la tua password e il codice di Authenticator. Puoi installare OBO Hub come app su PC e telefono.`;
}

interface Inviato { nome: string; email: string }

/** Inviti diretti: l'amministratore crea l'accesso e copia il messaggio da mandare al collega. */
export function InvitaUtenti({ profili, persone, password, predefinite, scelta, onFatto }: {
  profili: Profilo[]; persone: PersonaMappa[]; password: string; predefinite: string[];
  scelta: (valore: string[], onChange: (v: string[]) => void) => ReactNode; onFatto: () => Promise<void>;
}) {
  const [nome, setNome] = useState(""); const [email, setEmail] = useState(""); const [azienda, setAzienda] = useState("OBO Italia");
  const [sezioni, setSezioni] = useState<string[]>(predefinite);
  const [mappaRuolo, setMappaRuolo] = useState<"admin" | "guest" | "visitor">("guest"); const [mappaPersona, setMappaPersona] = useState("");
  const [emailPersona, setEmailPersona] = useState<Record<string, string>>({});
  const [ruoloPersona, setRuoloPersona] = useState<Record<string, "admin" | "guest" | "visitor">>({});
  const [inviati, setInviati] = useState<Inviato[]>([]);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);

  const collegate = new Set(profili.map((p) => (p.mappa_persona ?? "").toLowerCase()).filter(Boolean));
  const senzaAccesso = persone.filter((x) => !x.is_visitor && !collegate.has(x.name.toLowerCase()));

  async function invita(dati: Record<string, unknown>, chi: Inviato) {
    setBusy(true); setMsg("");
    try {
      if (!password) throw new Error("Imposta prima la password iniziale comune nella scheda Impostazioni.");
      await gestione("invita", dati);
      setInviati((v) => [chi, ...v]);
      setMsg(`Accesso creato per ${chi.email}: copia il messaggio qui sotto e mandaglielo.`);
      await onFatto();
      return true;
    } catch (e) { setMsg(e instanceof Error ? e.message : "Invito non riuscito."); return false; } finally { setBusy(false); }
  }

  return <div className="space-y-8">
    {msg && <p role="status" className="rounded-lg border-l-4 border-primary bg-muted p-3 text-sm">{msg}</p>}

    {inviati.length > 0 && <section className="rounded-lg border-[0.8px] border-primary p-4">
      <h3 className="font-semibold">Messaggi da mandare</h3>
      <p className="mt-1 text-xs text-muted-foreground">Le email automatiche partono solo verso il tuo indirizzo finché non colleghi un dominio a Resend: manda tu il messaggio (email o Teams).</p>
      <ul className="mt-3 space-y-3">{inviati.map((x) => { const t = testoInvito(x.nome, x.email, password); return <li key={x.email} className="rounded-lg bg-muted p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{x.nome} · {x.email}</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(t).then(() => setMsg(`Messaggio per ${x.email} copiato.`)); }}><Copy />Copia</Button>
            <Button size="sm" variant="outline" asChild><a href={`mailto:${x.email}?subject=${encodeURIComponent("Accesso a OBO Hub")}&body=${encodeURIComponent(t)}`}><Mail />Apri email</a></Button>
          </span></div>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-muted-foreground">{t}</pre>
      </li>; })}</ul>
    </section>}

    <section>
      <h3 className="font-semibold">Persone della Mappa carichi senza accesso ({senzaAccesso.length})</h3>
      <p className="mt-1 text-sm text-muted-foreground">Scrivi l'email e premi Invita: la persona riceve l'accesso alla sola Mappa carichi, già collegata al suo nome. Altre app le aggiungi dopo da Utenti → Cambia sezioni.</p>
      {!persone.length && <p className="mt-3 text-sm text-muted-foreground">Nessuna persona trovata: hai eseguito 3-accesso-obo-hub.sql e importato le persone nella Mappa?</p>}
      <div className="mt-3 divide-y border-y">{senzaAccesso.map((x) => <div key={x.name} className="flex flex-wrap items-center gap-2 py-2">
        <span className="min-w-[180px] flex-1 font-semibold">{x.name}</span>
        <input aria-label={`Email di ${x.name}`} type="email" className={`${inputCls} max-w-[260px]`} placeholder="nome.cognome@obo.it" value={emailPersona[x.name] ?? ""} onChange={(e) => setEmailPersona({ ...emailPersona, [x.name]: e.target.value })} />
        <select aria-label={`Ruolo di ${x.name} nella Mappa`} className="rounded border px-2 py-2 text-sm" value={ruoloPersona[x.name] ?? (x.is_admin ? "admin" : "guest")} onChange={(e) => setRuoloPersona({ ...ruoloPersona, [x.name]: e.target.value as "admin" | "guest" | "visitor" })}>
          <option value="guest">Guest</option><option value="admin">Admin Mappa</option><option value="visitor">Visitatore</option>
        </select>
        <Button size="sm" disabled={busy || !(emailPersona[x.name] ?? "").includes("@")} onClick={() => { const em = (emailPersona[x.name] ?? "").trim(); void invita({ email: em, nome: x.name, azienda: "OBO Italia", sezioni: ["app_mappa"], mappa_ruolo: ruoloPersona[x.name] ?? (x.is_admin ? "admin" : "guest"), mappa_persona: x.name }, { nome: x.name, email: em }); }}><Send />Invita</Button>
      </div>)}</div>
    </section>

    <section className="max-w-2xl">
      <h3 className="font-semibold">Invita un'altra persona</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <input aria-label="Nome e cognome" className={inputCls} placeholder="Nome e cognome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input aria-label="Email" type="email" className={inputCls} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input aria-label="Azienda" className={inputCls} placeholder="Azienda" value={azienda} onChange={(e) => setAzienda(e.target.value)} />
      </div>
      <p className="mb-2 mt-4 text-sm font-semibold">App e sezioni che potrà vedere</p>
      {scelta(sezioni, setSezioni)}
      {(sezioni.includes("app_mappa") || sezioni.includes("tutte")) && <div className="mt-3 flex flex-wrap gap-2">
        <select aria-label="Ruolo nella Mappa" className="rounded border px-2 py-2 text-sm" value={mappaRuolo} onChange={(e) => setMappaRuolo(e.target.value as "admin" | "guest" | "visitor")}>
          <option value="guest">Mappa: Guest</option><option value="admin">Mappa: Admin</option><option value="visitor">Mappa: Visitatore</option>
        </select>
        {mappaRuolo !== "visitor" && <select aria-label="Persona nella Mappa" className="rounded border px-2 py-2 text-sm" value={mappaPersona} onChange={(e) => setMappaPersona(e.target.value)}>
          <option value="">Persona della Mappa: nessuna</option>
          {nome.trim() && !persone.some((x) => x.name.toLowerCase() === nome.trim().toLowerCase()) && <option value="__nuova">+ Crea “{nome.trim()}” nella Mappa</option>}
          {persone.filter((x) => !x.is_visitor).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
        </select>}
      </div>}
      <Button className="mt-4" disabled={busy || !nome.trim() || !email.includes("@")} onClick={async () => {
        let persona = mappaPersona;
        if (persona === "__nuova") {
          const { error } = await db().rpc("mappa_aggiungi_persona", { nome: nome.trim() });
          if (error) { setMsg(error.message); return; }
          persona = nome.trim();
        }
        const ok = await invita({ email: email.trim(), nome: nome.trim(), azienda, sezioni, mappa_ruolo: mappaRuolo, mappa_persona: persona }, { nome: nome.trim(), email: email.trim() });
        if (ok) { setNome(""); setEmail(""); }
      }}><Send />Crea accesso</Button>
    </section>
  </div>;
}
