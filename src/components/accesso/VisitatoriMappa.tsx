import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { db, urlHubCompleto } from "@/lib/accesso";


/** Password dei visitatori di OBO Hub (sola consultazione, esterni: tutte le app tranne Admin) e link da condividere. */
export function VisitatoriMappa() {
  const LINK = `${urlHubCompleto()}?visitatore`;
  const [pw, setPw] = useState(""); const [mostra, setMostra] = useState(false);
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { void db().rpc("mappa_password_visitatori").then(({ data }) => setPw((data as string | null) ?? "")); }, []);
  async function salva() {
    setBusy(true); setMsg("");
    const { error } = await db().rpc("mappa_imposta_password_visitatori", { pw });
    setBusy(false);
    setMsg(error ? (/function|schema/i.test(error.message) ? "Esegui prima mappa-carichi/database/4-visitatori.sql su Supabase." : error.message) : "Password visitatori salvata: chi era dentro con la vecchia deve rientrare.");
  }
  const testo = `Ciao, puoi consultare OBO Hub, gli strumenti dell'ufficio tecnico (Mappa carichi, Progettazione LPS…), in sola consultazione:\n${LINK}\nScrivi il tuo nome e la password visitatori: ${pw}`;
  return <div className="space-y-3 rounded-lg border-[0.8px] border-bordo-scheda p-4">
    <p className="font-semibold">Visitatori di OBO Hub (sola consultazione)</p>
    <p className="text-xs text-muted-foreground">Per esterni (es. sales promoter): entrano in OBO Hub con il loro nome e questa password, senza account né Authenticator. Vedono tutte le app tranne Admin (Mappa carichi in sola lettura, Progettazione LPS senza salvare progetti nel cloud). Lasciala vuota per chiudere l'accesso visitatori.</p>
    <Campo etichetta="Password visitatori (almeno 6 caratteri)">
      <span className="flex gap-2"><input className={inputCls} type={mostra ? "text" : "password"} autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} /><Button type="button" variant="outline" size="icon" aria-label={mostra ? "Nascondi" : "Mostra"} onClick={() => setMostra(!mostra)}>{mostra ? <EyeOff /> : <Eye />}</Button></span>
    </Campo>
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy || (pw.length > 0 && pw.length < 6)} onClick={() => void salva()}><Save strokeWidth={1.5} />Salva password visitatori</Button>
      <Button variant="outline" disabled={!pw} onClick={() => { void navigator.clipboard.writeText(testo).then(() => setMsg("Messaggio per i visitatori copiato.")); }}><Copy />Copia link e password</Button>
    </div>
    <p className="break-all text-xs">Link visitatori: <a className="text-primary underline" href={LINK} target="_blank" rel="noreferrer">{LINK}</a></p>
    {msg && <p role="status" className="text-sm">{msg}</p>}
  </div>;
}
