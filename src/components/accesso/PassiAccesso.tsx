import { useEffect, useState } from "react";
import { KeyRound, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { SaettaFigura } from "@/components/Saetta";
import { supabase } from "@/integrations/supabase/client";
import { aggiornaAccesso, db, useAccesso } from "@/lib/accesso";

function Riquadro({ titolo, icona: I, children }: { titolo: string; icona: typeof KeyRound; children: React.ReactNode }) {
  return <main className="mx-auto max-w-lg px-4 py-10">
    <div className="rounded-2xl border-[0.8px] border-bordo-scheda p-6 shadow-sm">
      <div className="flex items-center gap-3"><SaettaFigura className="h-14 w-11" /><h1 className="flex items-center gap-2 text-2xl font-bold"><I className="size-6 text-primary" strokeWidth={1.5} />{titolo}</h1></div>
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  </main>;
}

const esci = async () => { await supabase.auth.signOut(); await aggiornaAccesso(); };

/** Nuova password al primo accesso (o dopo una reimpostazione dell'amministratore). */
export function CambiaPassword() {
  const [p1, setP1] = useState(""), [p2, setP2] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  async function invia() {
    if (p1.length < 10 || !/[A-Za-z]/.test(p1) || !/\d/.test(p1)) { setMsg("Almeno 10 caratteri, con lettere e numeri."); return; }
    if (p1 !== p2) { setMsg("Le due password non coincidono."); return; }
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.updateUser({ password: p1 });
    if (error) { setMsg(error.message.includes("different") ? "La nuova password deve essere diversa da quella iniziale." : `Password non aggiornata: ${error.message}`); setBusy(false); return; }
    await db().rpc("password_cambiata");
    await db().rpc("registra_accesso", { evento: "password_cambiata" });
    await aggiornaAccesso();
    setBusy(false);
  }
  return <Riquadro titolo="Scegli la tua password" icona={KeyRound}>
    <p className="text-sm">Stai usando la password iniziale comune. Per continuare scegline una personale.</p>
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void invia(); }}>
      <Campo etichetta="Nuova password"><input className={inputCls} type="password" autoComplete="new-password" required minLength={10} value={p1} onChange={(e) => setP1(e.target.value)} /></Campo>
      <Campo etichetta="Ripeti la password"><input className={inputCls} type="password" autoComplete="new-password" required value={p2} onChange={(e) => setP2(e.target.value)} /></Campo>
      <Button className="w-full" disabled={busy}>Salva la password</Button>
    </form>
    {msg && <p role="alert" className="text-sm text-[#b3261e]">{msg}</p>}
    <Button variant="link" className="p-0" onClick={() => void esci()}><LogOut />Esci</Button>
  </Riquadro>;
}

/** Collegamento dell'app Microsoft Authenticator (TOTP) tramite QR code. */
export function AttivaAuthenticator() {
  const [qr, setQr] = useState(""), [segreto, setSegreto] = useState(""), [fattore, setFattore] = useState(""), [codice, setCodice] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    let ok = true;
    void (async () => {
      // elimina eventuali collegamenti lasciati a metà, poi ne crea uno nuovo
      const { data: f } = await supabase.auth.mfa.listFactors();
      for (const x of f?.all ?? []) if (x.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: x.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toLocaleDateString("it-IT")}`, issuer: "OBO Hub" });
      if (!ok) return;
      if (error || !data) { setMsg(`Impossibile preparare il QR code: ${error?.message ?? ""}`); return; }
      setQr(data.totp.qr_code); setSegreto(data.totp.secret); setFattore(data.id);
    })();
    return () => { ok = false; };
  }, []);
  async function verifica() {
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fattore, code: codice.replace(/\s/g, "") });
    if (error) { setMsg("Codice non valido: controlla l'ora del telefono e riprova con il codice nuovo."); setBusy(false); return; }
    await db().rpc("registra_accesso", { evento: "authenticator_attivato" });
    await aggiornaAccesso();
    setBusy(false);
  }
  return <Riquadro titolo="Collega Microsoft Authenticator" icona={Smartphone}>
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      <li>Installa <strong>Microsoft Authenticator</strong> sul telefono (App Store o Google Play).</li>
      <li>Nell'app tocca <strong>+</strong> → <strong>Altro account</strong> (o "Account aziendale o dell'istituto di istruzione" → Scansiona codice QR).</li>
      <li>Inquadra il codice QR qui sotto e inserisci il codice a 6 cifre che compare.</li>
    </ol>
    {qr ? <img src={qr} alt="Codice QR per Microsoft Authenticator" className="mx-auto size-52 rounded-lg border bg-white p-2" /> : <div className="mx-auto size-52 animate-pulse rounded-lg bg-muted" />}
    {segreto && <p className="text-center text-xs text-muted-foreground">Se non puoi inquadrare il QR, inserisci a mano la chiave: <span className="select-all break-all font-mono">{segreto}</span></p>}
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void verifica(); }}>
      <Campo etichetta="Codice a 6 cifre"><input className={`${inputCls} text-center font-mono text-2xl tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={codice} onChange={(e) => setCodice(e.target.value.replace(/\D/g, ""))} /></Campo>
      <Button className="w-full" disabled={busy || !fattore || codice.length !== 6}>Conferma</Button>
    </form>
    {msg && <p role="alert" className="text-sm text-[#b3261e]">{msg}</p>}
    <Button variant="link" className="p-0" onClick={() => void esci()}><LogOut />Esci</Button>
  </Riquadro>;
}

/** Codice dell'Authenticator a ogni accesso. */
export function VerificaAuthenticator() {
  const [codice, setCodice] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  async function verifica() {
    setBusy(true); setMsg("");
    const { data: f } = await supabase.auth.mfa.listFactors();
    const totp = f?.totp.find((x) => x.status === "verified");
    if (!totp) { setMsg("Nessun Authenticator collegato: chiedi all'amministratore di reimpostarlo."); setBusy(false); return; }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: codice });
    if (error) { setMsg("Codice non valido o scaduto: usa il codice attuale dell'app."); setCodice(""); setBusy(false); return; }
    await aggiornaAccesso();
    setBusy(false);
  }
  return <Riquadro titolo="Codice Authenticator" icona={ShieldCheck}>
    <p className="text-sm">Apri <strong>Microsoft Authenticator</strong> e inserisci il codice a 6 cifre di <em>Progettazione LPS</em>.</p>
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void verifica(); }}>
      <Campo etichetta="Codice a 6 cifre"><input autoFocus className={`${inputCls} text-center font-mono text-2xl tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={codice} onChange={(e) => setCodice(e.target.value.replace(/\D/g, ""))} /></Campo>
      <Button className="w-full" disabled={busy || codice.length !== 6}>Entra</Button>
    </form>
    {msg && <p role="alert" className="text-sm text-[#b3261e]">{msg}</p>}
    <p className="text-xs text-muted-foreground">Hai cambiato telefono? Chiedi all'amministratore di reimpostare l'Authenticator.</p>
    <Button variant="link" className="p-0" onClick={() => void esci()}><LogOut />Esci</Button>
  </Riquadro>;
}

export function AccessoNonDisponibile() {
  const a = useAccesso();
  return <Riquadro titolo={a.stato === "sospeso" ? "Accesso sospeso" : "Accesso non ancora approvato"} icona={ShieldCheck}>
    <p className="text-sm">{a.stato === "sospeso" ? "Il tuo accesso è stato sospeso dall'amministratore." : `L'account ${a.email ?? ""} non è ancora abilitato. Se hai già inviato la richiesta, attendi l'approvazione dell'amministratore.`}</p>
    <Button variant="outline" onClick={() => void esci()}><LogOut />Esci</Button>
  </Riquadro>;
}
