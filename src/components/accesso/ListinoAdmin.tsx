/** Amministrazione → Listino prezzi: carica il listino METEL OBO come nuova versione (le precedenti restano). */
import { useEffect, useState } from "react";
import { Upload, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { caricaListino, versioniListino, type VersioneListino } from "@/lib/listino";
import { PAGINA_LISTINO } from "@/lib/listinoMetel";

export function ListinoAdmin() {
  const [versioni, setVersioni] = useState<VersioneListino[] | null>(null), [errore, setErrore] = useState(""), [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null), [avanz, setAvanz] = useState<string | null>(null);
  const aggiorna = () => versioniListino().then(setVersioni, (e: unknown) => setErrore(e instanceof Error ? e.message : "Listino non disponibile."));
  useEffect(() => { void aggiorna(); }, []);
  async function carica() {
    if (!file) return;
    setErrore(""); setMsg(""); setAvanz("Lettura del file…");
    try {
      const r = await caricaListino(file, (f, t) => setAvanz(`Caricamento ${f.toLocaleString("it-IT")} / ${t.toLocaleString("it-IT")} articoli…`));
      setMsg(`Listino ${r.versione} caricato: ${r.righe.toLocaleString("it-IT")} articoli${r.scartate ? ` (${r.scartate} righe senza codice o prezzo saltate)` : ""}. Le offerte usano da ora questa versione.`);
      setFile(null); void aggiorna();
    } catch (e) { setErrore(e instanceof Error ? e.message : "Caricamento non riuscito."); }
    finally { setAvanz(null); }
  }
  return <div className="max-w-3xl space-y-4">
    <p className="text-sm text-muted-foreground">Il listino OBO in formato METEL (Excel) si scarica sempre aggiornato da <a className="inline-flex items-center gap-1 underline" href={PAGINA_LISTINO} target="_blank" rel="noreferrer">obo.it → Mediateca → Downloads <ExternalLink className="h-3 w-3" /></a>. Caricalo qui: diventa la versione usata dalle offerte del Computo materiali. Le versioni precedenti restano nell'archivio. I prezzi li vedono solo gli utenti con account, non i visitatori.</p>
    <div className="flex flex-wrap items-center gap-2">
      <input type="file" accept=".xlsx,.xls" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button type="button" disabled={!file || avanz !== null} onClick={() => void carica()}><Upload />Carica listino</Button>
    </div>
    {avanz && <p role="status" className="text-sm">{avanz}</p>}
    {msg && <p role="status" className="text-sm text-green-700 dark:text-green-400">{msg}</p>}
    {errore && <p role="alert" className="text-sm text-destructive">{errore}</p>}
    {versioni && <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b text-left"><th className="p-2">Versione</th><th className="p-2">File</th><th className="p-2 text-right">Articoli</th><th className="p-2">Caricato il</th></tr></thead>
      <tbody>{versioni.map((v, i) => <tr key={v.versione} className="border-b"><td className="p-2">{v.versione}{i === 0 && <span className="ml-2 rounded bg-accent/20 px-1.5 text-xs">in uso</span>}</td><td className="p-2">{v.nome_file}</td><td className="p-2 text-right">{v.righe.toLocaleString("it-IT")}</td><td className="p-2">{new Date(v.caricato_il).toLocaleString("it-IT")}</td></tr>)}
        {!versioni.length && <tr><td className="p-2 text-muted-foreground" colSpan={4}>Nessun listino caricato.</td></tr>}</tbody>
    </table></div>}
  </div>;
}
