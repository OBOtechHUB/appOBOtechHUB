/**
 * Relazione tecnica (Word, stile OBO) dell'impianto su palo con calate isolate isCon: dati dimensionali,
 * tenuta dell'isolamento (s richiesta ≤ distanza equivalente del conduttore), corrente per conduttore,
 * numero di conduttori in parallelo, verifica degli apparati, posa e materiali.
 * Riferimenti: CEI EN IEC 62305-3:2026-10 (6.3, Tab. 11-12, Allegato B), CEI EN IEC 62305-1:2026-10 (Allegato D),
 * certificati OBO isCon secondo IEC TS 62561-8. Nessun testo della norma è copiato.
 */
import type { Blocco, Documento, Run, Testo } from "@/lib/docx";
import { PIEDE_OBO, dataLunga, dc, el, firma, h1, h2, it, oDc, p, tab, testataObo } from "@/calcoli/documenti/stileObo";
import { ISCON, ISCON_COMUNE, ISCON_GR_CONTATTO, verificaIscon } from "@/calcoli/calate/iscon";
import { CORRENTE_LPL, calcolaPalo, type DatiPalo } from "@/calcoli/antenne/palo";

export interface IngressoRelazionePalo {
  dati: DatiPalo;
  committente?: string | undefined; opera?: string | undefined; comune?: string | undefined; codice?: string | undefined;
  tecnico?: string | undefined; albo?: string | undefined; logo?: Blocco | undefined; data?: Date;
}

export function relazionePalo(x: IngressoRelazionePalo): Documento {
  const d = x.dati, r = calcolaPalo(d), sc = r.scelta, data = x.data ?? new Date();
  const D = sc?.versione ? ISCON[sc.versione] : null, gr = !!d.esigenze.tensioniContatto && sc?.versione === "proplus";
  const nomeCavo = D ? `${D.nome}${gr ? " GR" : ""}` : "—";
  const se = D ? (d.materiale === "aria" ? D.sAria : D.sSolido) : NaN;
  const B: Blocco[] = [
    ...testataObo("Relazione tecnica – impianto su palo", "Captazione isolata con conduttori OBO isCon · CEI EN IEC 62305-3:2026-10", x.logo),
    tab(["Dato", "Valore"], [
      ["Committente", oDc(x.committente, "committente")],
      ["Opera", oDc(x.opera, "descrizione dell'opera (es. palo per antenne)")],
      ["Comune", oDc(x.comune, "comune")],
      ["Codice progetto", oDc(x.codice, "codice CRM / numero progetto")],
      ["Data", dataLunga(data)],
    ], [4, 8]),
    h1("1. Oggetto"),
    p(`La presente relazione verifica la protezione contro la fulminazione diretta degli apparati installati sul palo mediante un'asta di captazione in sommità e calate isolate ad alta tensione OBO isCon fino al punto di collegamento equipotenziale; sotto tale punto la corrente di fulmine scende lungo il palo metallico collegato all'impianto di terra (o lungo una calata). Sono determinati la tenuta dell'isolamento delle calate, la corrente che ciascuna deve portare e il numero di conduttori in parallelo necessari.`, { allinea: "giustificato" }),
    h1("2. Dati dimensionali"),
    tab(["Grandezza", "Valore"], [
      ["Livello di protezione (LPL)", d.lpl],
      ["Quota della punta dell'asta di captazione", `${it(d.quotaPunta, 2)} m`],
      ["Quota del collegamento equipotenziale", `${it(d.quotaCollegamento, 2)} m`],
      ["Lunghezza l del tratto isolato (punta – collegamento)", `${it(r.l, 2)} m`],
      ["Lunghezza del palo isolato isFang", `${it(d.mastoIsolato, 1)} m`],
      ["Posa dei conduttori", d.materiale === "aria" ? "in aria lungo il palo (km = 1)" : "su / in materiale solido (km = 0,5)"],
      ["Raggio della sfera rotolante", `${it(r.r, 0)} m`],
    ], [7, 5]),
    p("Apparati installati sul palo:"),
    d.apparati.length ? tab(["Apparato", "Quota sommità (m)", "Sporgenza dall'asse (m)", "Distanza reale dalla captazione (m)"], d.apparati.map((a) => [a.nome || "Apparato", it(a.quota, 2), it(a.sbraccio, 2), it(a.distanza, 2)]), [5, 2.3, 2.3, 2.4]) : p([dc("apparati installati sul palo (quota, sporgenza, distanza)")]),
    h1("3. Metodo di calcolo"),
    p("La distanza di separazione richiesta tra le parti della captazione e gli apparati, e quindi la tensione che l'isolamento delle calate deve sopportare, si calcola con il metodo semplificato della CEI EN IEC 62305-3:2026-10 (6.3.2):", { allinea: "giustificato" }),
    p([{ t: "s = k" }, { t: "i", sub: true }, { t: " × k" }, { t: "c", sub: true }, { t: " / k" }, { t: "m", sub: true }, { t: " × l" }], { formula: true }),
    el(`ki = ${it(r.ki, 2)}: coefficiente della classe di LPS ${d.lpl} (Tab. 11);`,
      "kc: ripartizione della corrente tra i conduttori in parallelo: 1 con un conduttore, 0,66 con due, 0,44 con tre o più (Tab. 13 e Allegato B; valori adottati anche nella tabella delle lunghezze massime del costruttore);",
      "km: materiale isolante, 1 in aria e 0,5 nel solido (Tab. 12);",
      "l: lunghezza lungo la captazione e la calata dal punto considerato al collegamento equipotenziale."),
    p(`Un conduttore isolato è adeguato quando s ≤ se, distanza di separazione equivalente dichiarata e certificata dal costruttore (CEI EN IEC 62305-3, 6.3; prova secondo ${ISCON_COMUNE.norma}). Equivalentemente la lunghezza isolata non deve superare l max = se × km / (ki × kc). Ogni conduttore deve inoltre portare la propria quota della corrente di fulmine, I = I(LPL) × kc (CEI EN IEC 62305-1, Allegato D), entro la sua classe: H1 = 150 kA, H2 = 200 kA (10/350 µs).`, { allinea: "giustificato" }),
    tab(["Versione OBO isCon", "se in aria", "se nel solido", "Classe", "Ø esterno"], (["basic", "proplus", "premium"] as const).map((v) => [ISCON[v].nome, `${it(ISCON[v].sAria, 2)} m`, `${it(ISCON[v].sSolido, 2)} m`, `${ISCON[v].classe} (${ISCON[v].iimp} kA)`, `${ISCON[v].diametro.nero} mm${ISCON[v].diametro.grigio ? ` / GR ${ISCON[v].diametro.grigio} mm` : ""}`]), [4, 2, 2, 2.2, 2.3]),
    h1("4. Tenuta dell'isolamento e numero di conduttori in parallelo"),
    tab(["Conduttori in parallelo", "kc", "s richiesta (m)", "Corrente per conduttore", d.versione ? `${ISCON[d.versione].nome}` : "Versione isCon sufficiente", "l max (m)"],
      r.opzioni.map((o) => [String(o.n), it(o.kc, 2), it(o.s, 3), `${it(o.correntePerConduttore, 0)} kA`, o.versione ? (d.versione ? "sufficiente" : ISCON[o.versione].nome) : (d.versione ? "non sufficiente" : "nessuna"), o.lMax ? it(o.lMax, 2) : "—"]),
      [2.2, 1.3, 2, 2.3, 3, 1.6], { ...(sc ? { evidenziaRighe: [sc.n - 1] } : {}) }),
  ];
  if (sc && D) {
    const v = verificaIscon(sc.versione!, sc.s, d.materiale);
    B.push(
      p([{ t: "Verifica della tenuta dell'isolamento: ", b: true }, { t: `s = ${it(r.ki, 2)} × ${it(sc.kc, 2)} / ${it(r.km, 0)} × ${it(r.l, 2)} = ${it(sc.s, 3)} m ≤ se = ${it(se, 2)} m (${nomeCavo}, ${d.materiale === "aria" ? "in aria" : "nel solido"}) → ` }, { t: v.conforme ? "VERIFICATA" : "NON VERIFICATA", b: true }, { t: `, margine ${it(v.margine, 3)} m.` }]),
      p([{ t: "Verifica della corrente: ", b: true }, { t: `${it(CORRENTE_LPL[d.lpl], 0)} kA × ${it(sc.kc, 2)} = ${it(sc.correntePerConduttore, 0)} kA per conduttore ≤ ${D.iimp} kA (classe ${D.classe}) → ` }, { t: sc.correntePerConduttore <= D.iimp ? "VERIFICATA" : "NON VERIFICATA", b: true }, { t: "." }]),
      p([{ t: "Esito: ", b: true }, { t: `servono ${sc.n} conduttor${sc.n === 1 ? "e" : "i"} ${nomeCavo} in parallelo${d.conduttori ? " (numero scelto dal progettista)" : " (numero minimo che soddisfa le verifiche)"}${d.versione ? ", versione scelta dal progettista" : ""}, ciascuno lungo ${it(r.l, 2)} m dalla punta al collegamento equipotenziale.` }]),
    );
    const motivi = [d.esigenze.verniciabile && "verniciabile", d.esigenze.atex && "posa in zona ATEX", d.esigenze.protezioneMeccanica && "protezione meccanica della guaina", d.esigenze.tensioniContatto && "protezione dalle tensioni di contatto"].filter(Boolean) as string[];
    if (motivi.length) B.push(p(`Scelta della versione secondo la guida OBO per le esigenze di posa indicate: ${motivi.join(", ")}.`));
    if (gr) B.push(p(`Protezione dalle tensioni di contatto: il conduttore Pro+ 75 GR resiste a 100 kV (1,2/50 µs) sotto pioggia; tratto protetto al massimo ${ISCON_GR_CONTATTO.lunghezzaMax} m, guaina collegata al supporto metallico isCon H VA dopo ${it(ISCON_GR_CONTATTO.collegamentoGuaina, 1)} m dal collegamento superiore.`));
  } else B.push(p([{ t: "Esito: nessuna combinazione fino a 4 conduttori soddisfa le verifiche. ", b: true }, dc("ridurre l (collegamento equipotenziale più in alto) o rivedere la soluzione")]));
  B.push(
    h1("5. Verifica degli apparati"),
    p(`Ogni apparato deve trovarsi nel volume protetto dall'asta (metodo della sfera rotolante, r = ${it(r.r, 0)} m) e alla distanza d ≥ s dalle parti nude della captazione (caso peggiore con l intera).`, { allinea: "giustificato" }),
    r.apparati.length ? tab(["Apparato", "Protezione (sfera)", "s (m)", "d reale (m)", "Separazione"], r.apparati.map((a): Testo[] => [a.nome || "Apparato", a.protetto ? "protetto" : [{ t: "esposto", b: true }], it(a.sNuda, 3), it(a.distanza, 2), a.distanzaOk ? "d ≥ s" : [{ t: "d < s", b: true }]]), [4.5, 2.4, 1.6, 1.6, 2]) : p([dc("apparati")]),
    h1("6. Prescrizioni di posa"),
    el(...(D ? [D.equipotenziale.nota, `Zona di controllo del potenziale: nel tratto x = ${it(D.zonaPotenziale, 2)} m vicino al collegamento non devono esserci parti conduttrici entro la distanza s.`,
      `Raggio minimo di curvatura ${gr ? D.raggioCurvatura.grigio ?? D.raggioCurvatura.nero : D.raggioCurvatura.nero} mm; trazione massima ${ISCON_COMUNE.trazioneMax} N; posa tra ${ISCON_COMUNE.temperaturaPosa}.`] : []),
      "Fissaggio al palo isolato con il set isCon HM SET (fino a 4 conduttori), supporti ogni 1 m al massimo; con palo oltre 6 m l'estensione isCon HM ERW; fascetta MBS 100 almeno 20 cm sotto il supporto più basso; al massimo 2 conduttori per fascetta di messa a terra.",
      "Impiegare solo componenti OBO provati con il conduttore isCon (IEC TS 62561-8, Allegato F).",
      "Il palo metallico, sotto il collegamento equipotenziale, deve essere collegato all'impianto di terra con conduttori di sezione adeguata; schermi dei cavi d'antenna collegati al palo e SPD all'ingresso dei cavi nel locale apparati (CEI EN IEC 62305-4)."),
    h1("7. Materiali OBO"),
    r.materiali.length ? tab(["Codice", "Descrizione", "Quantità"], r.materiali.map((m) => [m.codice, m.descrizione, `${m.quantita} ${m.unita}`]), [2, 8, 2]) : p([dc("materiali")]),
    p("Asta, palo isolato isFang, elementi di collegamento e morsetti dal catalogo OBO.", { dimensione: 9 }),
    ...firma(`${x.comune || "Luogo"}, ${dataLunga(data)}`, "Il tecnico", [...oDc(x.tecnico, "nome del tecnico"), ...(x.albo ? [{ t: ` · ${x.albo}` } as Run] : [])]),
  );
  if (r.avvisi.length) B.splice(B.length - 4, 0, h2("Avvertenze"), el(...r.avvisi));
  return { blocchi: B, titolo: "Relazione tecnica impianto su palo", autore: "OBO Bettermann", piede: PIEDE_OBO };
}
