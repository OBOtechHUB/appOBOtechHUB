import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { paginaHead } from "@/lib/head";
export const Route = createFileRoute("/reset-password")({ head: () => paginaHead("Nuova password", "Imposta una nuova password per il tuo account LPS."), component: ResetPassword });
function ResetPassword() {
  const [valida, setValida] = useState(false); const [password, setPassword] = useState(""); const [messaggio, setMessaggio] = useState("");
  useEffect(() => { const recovery = window.location.hash.includes("type=recovery")||sessionStorage.getItem("lps-recovery")==="true";if(recovery)sessionStorage.setItem("lps-recovery","true");void supabase.auth.getUser().then(({ data }) => setValida(recovery && Boolean(data.user)));const {data}=supabase.auth.onAuthStateChange((event)=>{if(event==="PASSWORD_RECOVERY"){sessionStorage.setItem("lps-recovery","true");setValida(true);}});return()=>data.subscription.unsubscribe(); }, []);
  return <main className="mx-auto max-w-md px-4 py-10"><h1 className="font-display text-2xl font-bold">Nuova password</h1>{valida ? <form className="mt-5 space-y-4" onSubmit={async (e) => { e.preventDefault(); const { error } = await supabase.auth.updateUser({ password }); setMessaggio(error ? error.message : "Password aggiornata."); }}><Campo etichetta="Nuova password"><input className={inputCls} type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Campo><Button>Salva password</Button></form> : <p className="mt-4">Apri il link di recupero ricevuto via email.</p>}<p role="status" className="mt-4">{messaggio}</p></main>;
}