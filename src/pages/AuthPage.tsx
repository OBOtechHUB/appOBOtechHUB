import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { urlApp } from "@/lib/base";
import { aggiornaAccesso, salvaRitorno } from "@/lib/accesso";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { LogoLps } from "@/components/LogoLps";

/** Accesso con email e password (gli account li crea l'amministratore); poi nuova password e Authenticator. */
export function AuthPage() {
  const [recupero, setRecupero] = useState(false);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [messaggio, setMessaggio] = useState(""); const [busy, setBusy] = useState(false); const navigate = useNavigate();
  useEffect(() => { salvaRitorno(new URLSearchParams(window.location.search).get("ritorno")); }, []);
  async function invia() {
    setBusy(true); setMessaggio("");
    try {
      if (recupero) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlApp("reset-password") }); if (error) throw error;
        setMessaggio("Se l'indirizzo è abilitato, riceverai il link per reimpostare la password.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(/invalid/i.test(error.message) ? "Email o password non corrette." : error.message);
        await aggiornaAccesso();
        await navigate({ to: "/" });
      }
    } catch (e) { setMessaggio(e instanceof Error ? e.message : "Accesso non riuscito."); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md px-4 py-10">
    <div className="rounded-2xl border-[0.8px] border-bordo-scheda p-6 shadow-sm">
      <div className="flex items-center gap-3"><LogoLps className="h-14 w-11" /><h1 className="text-2xl font-bold">{recupero ? "Recupero password" : "Accedi"}</h1></div>
      <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void invia(); }}>
        <Campo etichetta="Email"><input className={inputCls} required type="email" maxLength={254} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
        {!recupero && <Campo etichetta="Password"><input className={inputCls} required type="password" minLength={6} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Campo>}
        <Button className="w-full" size="lg" disabled={busy}><LogIn strokeWidth={1.5} />{recupero ? "Invia il link" : "Accedi"}</Button>
      </form>
      {messaggio && <p role="status" className="mt-4 text-sm">{messaggio}</p>}
      <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
        <Button variant="link" className="p-0" onClick={() => { setRecupero(!recupero); setMessaggio(""); }}>{recupero ? "Torna all'accesso" : "Password dimenticata?"}</Button>
        <Link to="/richiesta-accesso" className="text-primary hover:underline">Non hai un accesso? Richiedilo</Link>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Dopo la password ti verrà chiesto il codice dell'app Microsoft Authenticator. Al primo accesso sceglierai la tua password e collegherai l'app.</p>
    </div>
  </main>;
}
