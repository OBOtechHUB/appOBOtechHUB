import { Button } from "@/components/ui/button";
import { CodiceObo } from "@/components/prodotti/CodiceObo";
import { etichettaParticolare, type RisultatoPosizioni } from "@/calcoli/particolari/posizioni";

const NOMI_ORIGINE = { progetto: "progetto", "proposta-captazione": "proposta captazione", "proposta-terra": "proposta terra" } as const;

/** Elenco dei particolari usati nel progetto (e nelle proposte non ancora accettate) e dei codici senza particolare. */
export function ParticolariProgetto({ risultato, onScheda }: { risultato: RisultatoPosizioni; onScheda: (idParticolare: string) => void }) {
  if (!risultato.usati.length && !risultato.senzaParticolare.length) {
    return <p className="text-sm text-muted-foreground">Nessun componente posizionato: accetta una proposta di captazione o di terra per vedere i particolari usati.</p>;
  }
  return <div className="space-y-4">
    {risultato.usati.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
      <thead><tr className="border-b text-left"><th className="p-2">Particolare</th><th className="p-2">Descrizione</th><th className="p-2 text-right">Punti</th><th className="p-2">Origine</th><th className="p-2" /></tr></thead>
      <tbody>{risultato.usati.map((u) => <tr key={u.idParticolare} className="border-b">
        <td className="p-2 font-mono">{etichettaParticolare(u.idParticolare)}</td>
        <td className="p-2">{u.nome}</td>
        <td className="p-2 text-right font-mono">{u.punti}</td>
        <td className="p-2 text-muted-foreground">{u.origini.map((o) => NOMI_ORIGINE[o]).join(", ")}</td>
        <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => onScheda(u.idParticolare)}>Scheda</Button></td>
      </tr>)}</tbody>
    </table></div>}
    {risultato.senzaParticolare.length > 0 && <div>
      <h4 className="font-semibold">Codici senza particolare</h4>
      <ul className="mt-1 text-sm text-muted-foreground">{risultato.senzaParticolare.map((c) => <li key={`${c.codiceOBO}-${c.tipoComponente}`}><CodiceObo codice={c.codiceOBO} /> · {c.tipoComponente} ×{c.quantita}</li>)}</ul>
    </div>}
  </div>;
}
