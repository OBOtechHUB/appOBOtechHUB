/**
 * Aste di captazione a catalogo OBO usate dalla proposta automatica: altezza e diametro dei prodotti reali.
 * - treppiede: set asta con base (FangFix) 1,5 / 2 / 3 / 4 m, asta Ø 16 mm;
 * - parete: aste Ø 16 mm da fissare a parete o parapetto, 1,0–3,0 m;
 * - irod: aste telescopiche con treppiede 10 e 12 m sul tetto (14 e 19,5 m solo a terra), diametro alla base.
 */
export type PosaAsta = "treppiede" | "parete" | "irod";
export interface AstaCatalogo { posa: PosaAsta; altezza: number; diametro: number; codice: string; descrizione: string }

export const ASTE_CATALOGO: AstaCatalogo[] = [
  { posa: "treppiede", altezza: 1.5, diametro: 0.016, codice: "5403352", descrizione: "Set asta di captazione 1,5 m con base" },
  { posa: "treppiede", altezza: 2, diametro: 0.016, codice: "5403354", descrizione: "Set asta di captazione 2 m con base" },
  { posa: "treppiede", altezza: 3, diametro: 0.016, codice: "5403356", descrizione: "Set asta di captazione 3 m con base" },
  { posa: "treppiede", altezza: 4, diametro: 0.016, codice: "5403358", descrizione: "Set asta di captazione 4 m con base" },
  { posa: "parete", altezza: 1, diametro: 0.016, codice: "", descrizione: "Asta Ø 16 mm L 1,0 m a parete" },
  { posa: "parete", altezza: 1.5, diametro: 0.016, codice: "5401801", descrizione: "Asta Ø 16 mm L 1,5 m a parete" },
  { posa: "parete", altezza: 2, diametro: 0.016, codice: "", descrizione: "Asta Ø 16 mm L 2,0 m a parete" },
  { posa: "parete", altezza: 2.5, diametro: 0.016, codice: "", descrizione: "Asta Ø 16 mm L 2,5 m a parete" },
  { posa: "parete", altezza: 3, diametro: 0.016, codice: "5401879", descrizione: "Asta Ø 16 mm L 3,0 m a parete" },
  { posa: "irod", altezza: 10, diametro: 0.0483, codice: "5400810", descrizione: "irod 10 m con treppiede a 6 gambe" },
  { posa: "irod", altezza: 12, diametro: 0.085, codice: "5400812", descrizione: "irod 12 m con treppiede a 6 gambe" },
];

/** Aste ammesse fino all'altezza massima scelta (le irod solo se l'altezza massima lo consente). */
export function asteAmmesse(altezzaMax: number): AstaCatalogo[] { return ASTE_CATALOGO.filter((a) => a.altezza <= altezzaMax + 1e-9); }
export function astaCatalogoPer(altezza: number, posa?: PosaAsta): AstaCatalogo | undefined {
  return ASTE_CATALOGO.find((a) => Math.abs(a.altezza - altezza) < 1e-6 && (!posa || a.posa === posa)) ?? ASTE_CATALOGO.find((a) => Math.abs(a.altezza - altezza) < 1e-6);
}
