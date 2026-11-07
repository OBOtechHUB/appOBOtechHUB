import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { urlApp } from "@/lib/base";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
export function AuthPage() {
  const [modo, setModo] = useState<"accesso" | "registrazione" | "recupero">("accesso");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [nome, setNome] = useState("");
  const [messaggio, setMessaggio] = useState(""); const [busy, setBusy] = useState(false); const navigate = useNavigate();
  async function invia() {
    setBusy(true); setMessaggio("");
    try {
      if (modo === "recupero") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlApp("reset-password") }); if (error) throw error;
        setMessaggio("Se l’indirizzo è registrato, riceverai il link per reimpostare la password.");
      } else if (modo === "registrazione") {
        const { error, data } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: urlApp("auth"), data: { nome_visualizzato: nome } } }); if (error) throw error;
        if (data.session) await navigate({ to: "/progetti" }); else setMessaggio("Controlla la tua email e conferma la registrazione prima di accedere.");
      } else { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; await navigate({ to: "/progetti" }); }
    } catch (e) { setMessaggio(e instanceof Error ? e.message : "Accesso non riuscito."); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md px-4 py-10"><h1 className="font-display text-2xl font-bold">{modo === "accesso" ? "Accedi" : modo === "registrazione" ? "Crea account" : "Recupero password"}</h1>
    <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void invia(); }}>
      {modo === "registrazione" && <Campo etichetta="Nome visualizzato"><input className={inputCls} maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>}
      <Campo etichetta="Email"><input className={inputCls} required type="email" maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
      {modo !== "recupero" && <Campo etichetta="Password"><input className={inputCls} required type="password" minLength={8} autoComplete={modo === "accesso" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></Campo>}
      <Button className="w-full" disabled={busy}>{modo === "accesso" ? "Accedi" : modo === "registrazione" ? "Registrati" : "Invia link"}</Button>
    </form>
    <div className="mt-3 flex flex-wrap gap-2"><Button variant="link" onClick={() => { setModo(modo === "registrazione" ? "accesso" : "registrazione"); setMessaggio(""); }}>{modo === "registrazione" ? "Hai già un account? Accedi" : "Crea account"}</Button><Button variant="link" onClick={() => { setModo("recupero"); setMessaggio(""); }}>Password dimenticata?</Button></div>
    {messaggio && <p role="status" className="mt-4 text-sm">{messaggio}</p>}
  </main>;
}