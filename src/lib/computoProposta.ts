import type { StatoEsteso } from "./statoProgetto";
import type { Categoria, RigaComputo } from "@/calcoli/materiali/tipi";
import base from "@/dati/particolari/particolari.json";

type Comp = { codiceOBO: string | null; descrizione: string };
const libreria = (base as { componenti: Comp[] }[]).flatMap((p) => p.componenti);

/** Descrizione dalla libreria dei particolari per codice OBO. */
export function descrizioneOBO(codice: string, fallback: string, extra: { componenti: Comp[] }[] = []): string {
  return [...extra.flatMap((p) => p.componenti), ...libreria].find((c) => c.codiceOBO === codice)?.descrizione ?? fallback;
}

/** Righe del computo dalla captazione proposta accettata, raggruppate per codice OBO. */
export function righeProposta(s: StatoEsteso): RigaComputo[] {
  const terra: RigaComputo[] = (s.terra?.distinta ?? []).map((v, i) => ({ id: `terra-distinta-${i}-${v.codice}`, codice: v.codice, descrizione: v.descrizione, categoria: "terra", unita: v.unita, quantita: v.quantita, provenienza: `Impianto di terra accettato${v.riferimento ? ` – ${v.riferimento}` : ""}`, materiale: "", sezione: "" }));
  if (s.distinta?.length) return [...s.distinta.map((v, i): RigaComputo => ({ id: `distinta-${i}-${v.codice}`, codice: v.codice, descrizione: v.descrizione, categoria: /T4\./.test(v.riferimento ?? "") ? "calate" : categoriaDa(v.descrizione, v.unita), unita: v.unita, quantita: v.quantita, provenienza: `Proposta accettata${v.riferimento ? ` – ${v.riferimento}` : ""}`, materiale: "", sezione: "" })), ...terra];
  const proposti = s.conduttori.filter((c) => c.origine === "proposta");
  const aste = s.aste.filter((a) => a.origine === "proposta");
  if (!proposti.length && !aste.length && !s.compensatori.length) return terra;
  const mappa = new Map<string, RigaComputo>();
  const add = (codice: string, categoria: Categoria, unita: "m" | "pz", q: number, fallback: string, prov: string) => {
    const k = `${categoria}|${codice || fallback}`;
    const r = mappa.get(k);
    if (r) { r.quantita += q; return; }
    mappa.set(k, { id: `proposta-${k}`, codice, descrizione: codice ? descrizioneOBO(codice, fallback, s.particolari) : fallback, categoria, unita, quantita: q, provenienza: prov, materiale: "", sezione: "" });
  };
  for (const c of proposti) {
    let m = 0;
    for (let i = 1; i < c.punti.length; i++) { const a = c.punti[i - 1]!, b = c.punti[i]!; m += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
    add(c.codiceOBO, c.tipo === "calata" ? "calate" : "conduttori", "m", m, c.tipo === "calata" ? "Conduttore di calata" : "Conduttore di captazione", "Captazione proposta – conduttori");
  }
  s.supporti.forEach((x) => add(x.codiceOBO ?? "", "supporti", "pz", 1, "Supporto conduttore", "Captazione proposta – supporti"));
  s.morsetti.forEach((x) => add(x.codiceOBO ?? "", "morsetti", "pz", 1, "Connettore", "Captazione proposta – connettori"));
  s.compensatori.forEach((x) => add(x.codiceOBO ?? "", "accessori", "pz", 1, "Compensatore di dilatazione", "Captazione proposta – compensatori"));
  aste.forEach((a) => add(a.codiceOBO, "captazione", "pz", 1, `Asta di captazione h ${a.altezza} m`, "Captazione proposta – aste"));
  return [...[...mappa.values()].map((r) => ({ ...r, quantita: r.unita === "m" ? Math.round(r.quantita * 100) / 100 : r.quantita })), ...terra];
}

function categoriaDa(d: string, u: "m" | "pz"): Categoria {
  const x = d.toLowerCase();
  if (x.includes("calat")) return u === "m" ? "calate" : "supporti";
  if (x.includes("compens")) return "accessori";
  if (x.includes("asta")) return "captazione";
  if (x.includes("support") || x.includes("porta")) return "supporti";
  if (x.includes("morset") || x.includes("connett") || x.includes("giunt")) return "morsetti";
  return u === "m" ? "conduttori" : "accessori";
}
