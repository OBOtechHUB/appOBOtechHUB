import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { salvaAttivo } from "@/components/ProjectSync";
import { impostaAttivo } from "@/lib/statoProgetto";

export function AppHeader() {
  const {user}=useAuth();const qc=useQueryClient();const navigate=useNavigate();
  return (
    <header className="bg-primary text-primary-foreground border-b-4 border-accent">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-foreground">
            <Zap className="h-5 w-5" />
          </span>
          Progettazione LPS
        </Link>
        <nav className="ml-auto flex flex-wrap items-center gap-3 text-sm"><Link to="/strumenti">Strumenti</Link><Link to="/guida">Guida</Link><Link to="/download-cad">CAD</Link>{user?<><Link to="/progetti">I miei progetti</Link><Link to="/profilo">Profilo</Link><Button variant="secondary" size="sm" onClick={async()=>{try{await salvaAttivo();await qc.cancelQueries();qc.clear();impostaAttivo(null);await supabase.auth.signOut();await navigate({to:"/auth",replace:true});}catch{window.alert("Salvataggio non riuscito. Riprova prima di uscire.");}}}>Esci</Button></>:<Button variant="secondary" size="sm" asChild><Link to="/auth">Accedi</Link></Button>}</nav>
      </div>
    </header>
  );
}
