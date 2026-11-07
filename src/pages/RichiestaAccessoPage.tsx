import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { Saetta } from "@/components/Saetta";
import { supabase } from "@/integrations/supabase/client";
import { urlApp } from "@/lib/base";

export function RichiestaAccessoPage() {
  const [d, setD] = useState({ nome: "", email: "", azienda: "", motivo: "", sito: "" });
  const [stato, setStato] = useState<"" | "invio" | "ok" | "errore">("");
  const [msg, setMsg] = useState("");
  async function invia() {
    setStato("invio"); setMsg("");
    const { data, error } = await supabase.functions.invoke("richiesta-accesso", { body: { ...d, app: urlApp("") } });
    if (error || (data as { errore?: string })?.errore) { setStato("errore"); setMsg((data as { errore?: string })?.errore ?? "Invio non riuscito, riprova più tardi."); return; }
    setStato("ok");
  }
  return <main className="mx-auto max-w-xl px-4 py-10">
    <h1 className="text-3xl font-bold">Richiedi l'accesso</h1>
    {stato === "ok" ? <div className="mt-6"><Saetta saluto><strong>Richiesta inviata!</strong> L'amministratore riceve la tua richiesta via email. Quando la approva ti comunica la password iniziale: al primo accesso sceglierai la tua e collegherai Microsoft Authenticator.</Saetta><Button className="mt-4" variant="outline" asChild><Link to="/">Torna alla panoramica</Link></Button></div> :
      <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void invia(); }}>
        <Campo etichetta="Nome e cognome"><input className={inputCls} required maxLength={120} autoComplete="name" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <Campo etichetta="Email"><input className={inputCls} required type="email" maxLength={254} autoComplete="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} /></Campo>
        <Campo etichetta="Azienda"><input className={inputCls} maxLength={160} autoComplete="organization" value={d.azienda} onChange={(e) => setD({ ...d, azienda: e.target.value })} /></Campo>
        <Campo etichetta="Per cosa ti serve lo strumento?"><textarea className={`${inputCls} min-h-24`} maxLength={1000} value={d.motivo} onChange={(e) => setD({ ...d, motivo: e.target.value })} /></Campo>
        <input type="text" name="sito" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={d.sito} onChange={(e) => setD({ ...d, sito: e.target.value })} />
        <Button size="lg" disabled={stato === "invio"}><Send strokeWidth={1.5} />{stato === "invio" ? "Invio…" : "Invia la richiesta"}</Button>
        {msg && <p role="alert" className="text-sm text-[#b3261e]">{msg}</p>}
        <p className="text-xs text-muted-foreground">I dati servono solo a valutare la richiesta. Hai già un accesso? <Link to="/auth" className="text-primary underline">Accedi</Link></p>
      </form>}
  </main>;
}
