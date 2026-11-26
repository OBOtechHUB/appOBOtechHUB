/**
 * Relazione tecnica completa (Word, stile OBO) della protezione contro i fulmini delle antenne: sito, captazione con la
 * sfera rotolante, distanza di separazione, calate isolate isCon con il numero di conduttori in parallelo, collegamento
 * al palo (PAE) e collegamenti equipotenziali quota per quota, cavi, SPD e terra, prescrizioni di posa e materiali.
 * Riferimenti: CEI EN IEC 62305-3:2026-10 (6.3, Tab. 11-12, Allegato B), CEI EN IEC 62305-4:2026-10 (B.11, B.12),
 * dati del costruttore OBO isCon (IEC TS 62561-8). Testi scritti con parole nostre, nessun testo della norma copiato.
 */
import type { Blocco, Documento, Run, Testo } from "@/lib/docx";
import { PIEDE_OBO, dataLunga, dc, el, firma, h1, h2, it, oDc, p, tab, testataObo } from "@/calcoli/documenti/stileObo";
import { ISCON, ISCON_COMUNE, verificaIscon } from "@/calcoli/calate/iscon";
import { NOMI_STRUTTURA } from "@/calcoli/calate/isconAltezza";
import { NOMI_SITO, type DatiAntenne } from "./antenne";
import { CORRENTE_LPL } from "./palo";
import { calcolaProgettoAntenne, svgSchemaCalate } from "./progettoAntenne";

export interface IngressoRelazioneAntenne {
  dati: DatiAntenne;
  committente?: string | undefined; opera?: string | undefined; comune?: string | undefined; codice?: string | undefined;
  tecnico?: string | undefined; albo?: string | undefined; logo?: Blocco | undefined; data?: Date;
}

export function relazioneAntenne(x: IngressoRelazioneAntenne): Documento {
  const d = x.dati, P = calcolaProgettoAntenne(d), r = P.r, ca = P.ca, data = x.data ?? new Date();
  const D = ca.versione ? ISCON[ca.versione] : null, piano = d.tipo === "tetto" ? "piano del tetto" : "terreno";
  const struttura = d.struttura ?? "metallica", continuo = d.isconFinoATerra !== false;
  const B: Blocco[] = [
    ...testataObo("Relazione tecnica – protezione contro i fulmini delle antenne", "Captazione isolata e calate OBO isCon · CEI EN IEC 62305-3 e 62305-4:2026-10", x.logo),
    tab(["Dato", "Valore"], [
      ["Committente", oDc(x.committente, "committente")],
      ["Opera", oDc(x.opera, "descrizione dell'opera (es. stazione radio base)")],
      ["Comune", oDc(x.comune, "comune")],
      ["Codice progetto", oDc(x.codice, "codice CRM / numero progetto")],
      ["Data", dataLunga(data)],
    ], [4, 8]),
    h1("1. Oggetto"),
    p("La relazione dimensiona la protezione delle antenne dalla fulminazione diretta con un'asta di captazione in sommità, isolata dalle antenne, e calate isolate ad alta tensione OBO isCon. Indica il numero di conduttori in parallelo, la versione del conduttore, la quota del collegamento al palo (PAE) e i collegamenti equipotenziali da realizzare fino all'impianto di terra, con i materiali.", { allinea: "giustificato" }),
    h1("2. Dati del sito"),
    tab(["Grandezza", "Valore"], [
      ["Tipo di installazione", NOMI_SITO[d.tipo]],
      ["Struttura di sostegno", NOMI_STRUTTURA[struttura]],
      ["Livello di protezione (LPL)", d.lpl],
      [`Sommità delle antenne (dal ${piano})`, `${it(d.sommita, 2)} m`],
      ["Antenna più bassa da isolare", `${it(P.apparatoBasso, 2)} m`],
      ["Bordo esterno delle antenne dall'asse dell'asta", `${it(d.sbraccio, 2)} m`],
      ["Distanza reale asta nuda – antenne", `${it(d.distanzaReale, 2)} m`],
    ], [7, 5]),
    h1("3. Captazione"),
    p(`Metodo della sfera rotolante (CEI EN IEC 62305-3) con raggio r = ${it(r.r, 0)} m per LPL ${d.lpl}. La sfera più sfavorevole tocca la punta dell'asta e il ${piano}, oppure, quando l'asta supera il raggio, la punta e l'asta stessa sotto la punta: le antenne devono restare sotto la superficie della sfera.`, { allinea: "giustificato" }),
    tab(["Verifica", "Valore"], [
      ["Punta minima dell'asta", `${it(r.astaMinima, 2)} m (${it(r.astaMinima - d.sommita, 2)} m sopra le antenne)`],
      ["Punta adottata", `${it(r.asta, 2)} m`],
      ["Esito", r.protette ? "antenne protette dalla fulminazione diretta" : [{ t: "antenne ESPOSTE: alzare l'asta o avvicinarla", b: true }]],
    ], [6, 6]),
    h1("4. Distanza di separazione e conduttori isolati"),
    p("La distanza di separazione si calcola con il metodo semplificato (CEI EN IEC 62305-3, 6.3.2):", { allinea: "giustificato" }),
    p([{ t: "s = k" }, { t: "i", sub: true }, { t: " × k" }, { t: "c", sub: true }, { t: " / k" }, { t: "m", sub: true }, { t: " × l" }], { formula: true }),
    el(`ki = ${it(r.ki, 2)} (LPL ${d.lpl}, Tab. 11);`,
      "kc = 1 con un conduttore, 0,66 con due, 0,44 con tre o più (ripartizione della corrente tra le calate in parallelo);",
      "km = 1 in aria (Tab. 12);",
      "l = lunghezza lungo captazione e calata dalla punta al collegamento equipotenziale più vicino (PAE)."),
    p(`Un conduttore isCon è adeguato se s ≤ se, distanza equivalente certificata dal costruttore (prova ${ISCON_COMUNE.norma}); cioè se l ≤ l max = se × km / (ki × kc). Con LPL I e un solo conduttore serve la classe H2 (Premium 90).`, { allinea: "giustificato" }),
    tab(["Versione OBO isCon", "Codice", "se in aria", "Classe", "Zona x"], (["basic", "proplus", "premium"] as const).map((v) => [ISCON[v].nome, ISCON[v].codici[0]!.codice, `${it(ISCON[v].sAria, 2)} m`, `${ISCON[v].classe} (${ISCON[v].iimp} kA)`, `${it(ISCON[v].zonaPotenziale, 2)} m`]), [3.6, 2, 2, 2.4, 2]),
    h1("5. Numero di conduttori in parallelo e versione isCon"),
    p(`Il collegamento al palo (PAE) si pone subito sotto l'antenna più bassa, lasciando libera la zona x del conduttore: così la lunghezza isolata l è la più corta possibile. Per ogni numero di calate da 1 a 4 si cerca la versione più semplice che soddisfa s ≤ se e la corrente; si adotta il numero minimo di calate che basta${d.calateAuto === false ? " (qui fissato dal progettista)" : ""}.`, { allinea: "giustificato" }),
    tab(["Calate in parallelo", "kc", "s richiesta (m)", "Corrente per calata", "isCon che basta", "l max (m)"],
      r.soluzione.opzioni.map((o) => [String(o.n), it(o.kc, 2), it(o.s, 3), `${it(CORRENTE_LPL[d.lpl] * o.kc, 0)} kA`, o.versione ? ISCON[o.versione].nome : "nessuno", o.lMax ? it(o.lMax, 1) : "—"]),
      [2.2, 1.2, 2.1, 2.3, 2.8, 1.6], r.soluzione.scelta ? { evidenziaRighe: [r.soluzione.scelta.n - 1] } : {}),
  ];
  if (ca.fattibile && D && ca.quotaPAE != null) {
    const v = verificaIscon(ca.versione!, ca.s, "aria");
    B.push(
      p([{ t: "Verifica della tenuta dell'isolamento: ", b: true }, { t: `s = ${it(ca.ki, 2)} × ${it(ca.kc, 2)} / 1 × ${it(ca.l, 2)} = ${it(ca.s, 3)} m ≤ se = ${it(D.sAria, 2)} m (${D.nome}) → ` }, { t: v.conforme ? "VERIFICATA" : "NON VERIFICATA", b: true }]),
      p([{ t: "Verifica della corrente: ", b: true }, { t: `${it(CORRENTE_LPL[d.lpl], 0)} kA × ${it(ca.kc, 2)} = ${it(P.correntePerConduttore ?? NaN, 0)} kA per calata ≤ ${D.iimp} kA (classe ${D.classe}) → ` }, { t: (P.correntePerConduttore ?? Infinity) <= D.iimp ? "VERIFICATA" : "NON VERIFICATA", b: true }]),
      p([{ t: "Soluzione: ", b: true }, { t: `${ca.n} ${ca.n === 1 ? "calata isolata" : "calate isolate"} ${D.nome} in parallelo, PAE a ${it(ca.quotaPAE, 2)} m, tratto isolato l = ${it(ca.l, 2)} m (l max ${it(ca.lMax, 1)} m)${continuo ? `; il cavo prosegue intero fino a terra (${it(r.asta, 1)} m per calata, senza tagli)` : ""}.` }]),
      p([{ t: "Collegamenti equipotenziali: ", b: true }, { t: `${ca.collegamentiTotali} in tutto: ${ca.collegamentiPAE} al PAE a ${it(ca.quotaPAE, 2)} m (uno per calata)${ca.livelliIntermedi ? ` e ${ca.livelliIntermedi} livelli intermedi con ${ca.n} collegamenti ciascuno` : ""}, più il collegamento all'impianto di terra alla base.` }]),
      p([{ t: "Parte nuda dell'asta: ", b: true }, { t: `distanza reale ${it(d.distanzaReale, 2)} m ${r.separazioneOk ? "≥" : "<"} s = ${it(r.s, 3)} m → ` }, { t: r.separazioneOk ? "VERIFICATA" : "NON VERIFICATA (supporto isolante più lungo)", b: true }]),
      h1("6. Collegamento al palo e collegamenti equipotenziali"),
      { tipo: "immagine", svg: svgSchemaCalate(r.asta, d.sommita, P.apparatoBasso, ca, continuo, piano), larghezza: 9, altezza: 11.1, allinea: "centro" },
      p("Figura – Schema verticale (non in scala orizzontale): asta, antenne, tratto isolato fino al PAE, livelli equipotenziali e base.", { allinea: "centro", dimensione: 9 }),
    );
    for (const l of ca.livelli) B.push(h2(`${l.titolo} – quota ${it(l.quota, 2)} m`), el(...l.cosa));
    if (ca.avvisi.length) B.push(h2("Note sul tratto sotto il PAE"), el(...ca.avvisi));
  } else {
    B.push(p([{ t: "Esito: ", b: true }, { t: "nessuna combinazione fino a 4 conduttori isola tutte le antenne. " }, ...ca.avvisi.map((a): Run => ({ t: a + " " }))]),
      p([dc("scegliere la soluzione: PAE più in alto con antenne basse collegate al palo, oppure punta più vicina alle antenne")]));
  }
  B.push(
    h1(ca.fattibile ? "7. Cavi, SPD e terra" : "6. Cavi, SPD e terra"),
    el(...r.misure.map((m): Testo => [{ t: m.obbligatoria ? "" : "(consiglio) " }, { t: m.testo }, { t: ` [CEI EN IEC ${m.rif}]` }])),
    h1(ca.fattibile ? "8. Prescrizioni di posa" : "7. Prescrizioni di posa"),
    el(...(D ? [D.equipotenziale.nota, `Zona di controllo del potenziale: nel tratto x = ${it(D.zonaPotenziale, 2)} m sopra il PAE nessuna parte conduttrice entro la distanza s.`,
      `Raggio minimo di curvatura ${D.raggioCurvatura.nero} mm; trazione massima ${ISCON_COMUNE.trazioneMax} N; temperatura di posa ${ISCON_COMUNE.temperaturaPosa}.`] : []),
      "Supporti lungo tutto il percorso al massimo ogni 1 m; impiegare solo componenti OBO provati con il conduttore isCon.",
      "Palo o struttura collegati all'impianto di terra alla base; schermi dei cavi d'antenna collegati al PAE e all'ingresso del locale apparati; SPD di tipo 1 sulle linee che entrano.",
      "Il modo di collegare il conduttore interno al palo al PAE senza interrompere il cavo va confermato con le istruzioni di montaggio OBO isCon."),
    h1(ca.fattibile ? "9. Materiali" : "8. Materiali"),
    P.materiali.length ? tab(["Codice", "Descrizione", "Quantità"], P.materiali.map((m) => [m.codice || "—", m.descrizione, `${m.quantita} ${m.unita}`]), [2, 8, 2]) : p([dc("materiali")]),
    p("Quantità con 1 m di riserva per calata; codici da verificare con il listino OBO in vigore.", { dimensione: 9 }),
  );
  if (d.note?.trim()) B.push(h2("Note del progetto"), p(d.note.trim()));
  B.push(...firma(`${x.comune || "Luogo"}, ${dataLunga(data)}`, "Il tecnico", [...oDc(x.tecnico, "nome del tecnico"), ...(x.albo ? [{ t: ` · ${x.albo}` } as Run] : [])]));
  return { blocchi: B, titolo: "Relazione tecnica protezione antenne", autore: "OBO Bettermann", piede: PIEDE_OBO };
}
