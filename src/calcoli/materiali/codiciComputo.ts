/**
 * Codici OBO per le righe generiche del computo (conduttori, supporti, morsetti, calate, terra),
 * presi dai particolari costruttivi della libreria attiva: se un particolare cambia articolo, il computo lo segue.
 * I valori scritti qui sono solo la riserva quando il particolare non c'è.
 */
import { allinea, type ParticolareLib } from "../particolari/allinea";
import { allineaCatalogo, allineaSupporto, catalogoPerCopertura, SUPPORTI_CALATA, SUPPORTI_FALDA } from "../captazione/proponiCaptazione";
import { componentiTerra } from "../terra/proponiTerra";

export interface CodiceRiga { codice: string; descrizione: string; riferimento: string | null }
export type CodiciComputo = Partial<Record<string, CodiceRiga>>;

export interface ContestoComputo {
  /** copertura del progetto (es. "Piana", "A falde", oppure "guaina", "ghiaia", "carrabile") */
  copertura?: string | undefined;
  /** materiale del conduttore sul tetto piano */
  materialeConduttore?: "alluminio" | "acciaio" | undefined;
  /** manto dei tetti a falde (chiave dei supporti di falda) */
  manto?: string | undefined;
  /** parete delle calate (chiave dei supporti di calata) */
  parete?: string | undefined;
}

export function codiciComputo(lib: readonly ParticolareLib[], ctx: ContestoComputo = {}): CodiciComputo {
  const cop = (ctx.copertura ?? "").toLowerCase();
  const falde = cop.includes("falde");
  const chiave = (["ghiaia", "carrabile"] as const).find((v) => cop.includes(v)) ?? "guaina";
  const cat = allineaCatalogo(catalogoPerCopertura(chiave, ctx.materialeConduttore ?? "alluminio"), lib);
  const supF = allineaSupporto((SUPPORTI_FALDA[ctx.manto ?? "tegole"] ?? SUPPORTI_FALDA["tegole"]!).falda, lib);
  const supC = allineaSupporto(SUPPORTI_CALATA[ctx.parete ?? "muratura"] ?? SUPPORTI_CALATA["muratura"]!, lib);
  const condCalata = supC.conduttore ?? allinea({ codice: "5021294", descrizione: "RD 8-ALU-T – conduttore tondo Ø8 alluminio" }, supC.riferimento, lib, 0, "conduttore");
  const giunzione = allinea({ codice: "5311519", descrizione: "249 8-10 ALU – connettore rapido Vario" }, "OBO-TBS-250-T1.01", lib, 0, "connettore");
  const sezionamento = allinea({ codice: "5336341", descrizione: "233 VA – giunto di sezionamento" }, "OBO-TBS-200-T5.03", lib, 0, "sezionamento");
  const picchetto = allinea({ codice: "5000017", descrizione: "219 20 OMEX FT – picchetto OMEX" }, "OBO-TBS-200-T5.02", lib, 0, "picchetto");
  const terra = componentiTerra(lib);
  const r = (v: { codice: string; descrizione: string }, rif: string | null | undefined): CodiceRiga => ({ codice: v.codice, descrizione: v.descrizione, riferimento: rif ?? null });
  const out: CodiciComputo = {
    "captazione-conduttore": r(cat.conduttore, cat.riferimento),
    "maglia-giunzioni": r(giunzione, "OBO-TBS-250-T1.01"),
    "maglia-incroci": r(cat.connettore, cat.riferimento),
    "calate-conduttore": r(condCalata, supC.riferimento),
    "calate-sezionamenti": r(sezionamento, "OBO-TBS-200-T5.03"),
    "terra-picchetti": r(picchetto, "OBO-TBS-200-T5.02"),
    "terra-anello": r(terra.piattoInox, terra.piattoInox.rif),
  };
  const sup = falde ? supF : cat.supporto ? { ...cat.supporto, riferimento: cat.riferimento } : null;
  if (sup && sup.codice) out["captazione-supporti"] = r(sup, sup.riferimento);
  return out;
}
