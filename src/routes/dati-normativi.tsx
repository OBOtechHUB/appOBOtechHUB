import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { AuthPage } from "@/pages/AuthPage";
import { useAuth } from "@/lib/auth";
import { DatiNormativiPage } from "@/pages/DatiNormativiPage";
export const Route = createFileRoute("/dati-normativi")({
  head: () => ({ meta: [
    { title: "Dati normativi e catalogo – Progettazione LPS" },
    { name: "description", content: "Catalogo materiali LPS modificabile con importazione da Excel e CSV." },
    { property: "og:title", content: "Dati normativi e catalogo – Progettazione LPS" },
    { property: "og:description", content: "Gestione del catalogo di componenti per il computo LPS." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: CatalogoRiservato,
});
function CatalogoRiservato(){const {user,pronto}=useAuth();return <ClientOnly fallback={<p className="p-6">Caricamento…</p>}>{!pronto?<p className="p-6">Caricamento…</p>:user?<DatiNormativiPage/>:<AuthPage/>}</ClientOnly>;}