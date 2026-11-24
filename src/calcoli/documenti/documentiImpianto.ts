/**
 * Documenti dell'impianto LPS dai dati del progetto, in stile OBO:
 *  - bozza della dichiarazione di conformità (D.M. 22 gennaio 2008, n. 37, art. 7 e Allegato I), da completare
 *    e firmare dall'impresa installatrice;
 *  - verbale della prima verifica (CEI EN IEC 62305-3:2026-10, art. 7 e Allegato D), con la checklist
 *    dell'app e le tabelle delle misure per calata;
 *  - piano delle verifiche periodiche (intervalli D.7.2.2 e, per i luoghi di lavoro, D.P.R. 462/2001).
 * Logica pura: nessun accesso a rete o archivio.
 */
import type { Blocco, Documento, Run, Testo } from "@/lib/docx";
import type { Conduttore, Asta } from "@/calcoli/edificio/tipi";
import type { DatiRelazione } from "@/calcoli/relazione/relazioneTecnica";
import type { Sopralluogo } from "@/lib/statoProgetto";
import { CHECKLIST, INTERVALLI_SEVERI, INTERVALLI_TIPICI, aggiungiAnni, type Intervalli } from "@/calcoli/verifiche/verifiche";
import { PIEDE_OBO, casella, dataIt, dataLunga, dc, el, eln, firma, h1, h2, it, oDc, p, tab, testataObo } from "./stileObo";
import { formattaNome } from "@/lib/nomi";

export type Lpl = "I" | "II" | "III" | "IV";
export interface IngressoDocumenti {
  comune: string; indirizzo?: string | undefined; nomeProgetto: string;
  codice?: string | undefined; rev?: string | undefined; lpl: Lpl;
  aste: Asta[]; conduttori: Conduttore[]; picchetti: number; tipoTerra?: string | undefined;
  /** calate calcolate quando non sono disegnate */
  calateCalcolate?: number | undefined;
  dati: DatiRelazione;
  piano: { critico: boolean; intervalli: Intervalli | null };
  logo?: Blocco | undefined;
  /** dati del sopralluogo da tablet (misure, checklist, SPD, esito) */
  sopralluogo?: Sopralluogo | undefined;
  /** firma del verificatore (immagine) e foto del sopralluogo già preparate */
  firmaVerificatore?: Blocco | undefined;
  fotoSopralluogo?: { img: Blocco; didascalia: string }[] | undefined;
  data: Date;
}

function lunghezza(c: Conduttore): number {
  let t = 0; for (let i = 1; i < c.punti.length; i++) { const a = c.punti[i - 1]!, b = c.punti[i]!; t += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); } return t;
}
function riepilogoImpianto(x: IngressoDocumenti) {
  const capt = x.conduttori.filter((c) => c.tipo === "captazione"), cal = x.conduttori.filter((c) => c.tipo === "calata");
  const nCalate = Math.max(cal.length || x.calateCalcolate || 0, x.dati.calateNumero ?? 0);
  return { nCalate, lCapt: capt.reduce((a, c) => a + lunghezza(c), 0), lCal: cal.reduce((a, c) => a + lunghezza(c), 0), nAste: x.aste.length };
}
const titoloOpera = (x: IngressoDocumenti) => x.dati.titoloOpera || x.nomeProgetto;
const ubicazione = (x: IngressoDocumenti): Run[] => (x.comune ? [{ t: [x.comune + (x.dati.provincia ? ` (${x.dati.provincia})` : ""), x.indirizzo].filter(Boolean).join(", ") }] : [dc("comune e indirizzo")]);
const riferimentoProgetto = (x: IngressoDocumenti) => `progetto OBO${x.codice ? ` n. ${x.codice}` : ""}${x.rev ? ` Rev. ${x.rev}` : ""}`;
const luogoData = (x: IngressoDocumenti) => `${x.dati.luogo || "Rivoli"}, ${dataLunga(x.data)}`;

function tabellaImpianto(x: IngressoDocumenti): Blocco {
  const r = riepilogoImpianto(x);
  const righe: Testo[][] = [
    ["Struttura", titoloOpera(x) ? [{ t: titoloOpera(x) }] : [dc("nome della struttura")]],
    ["Ubicazione", ubicazione(x)],
    ["Committente / proprietario", oDc(x.dati.committente, "committente")],
    ["Destinazione d'uso", oDc(x.dati.destinazione, "destinazione d'uso")],
    ["Classe dell'LPS", `LPS di classe ${x.lpl} (CEI EN IEC 62305-3:2026-10)`],
    ["Progetto di riferimento", riferimentoProgetto(x)],
    ["Captazione", `${r.nAste} aste${r.lCapt > 0 ? `, ${it(r.lCapt, 0)} m di conduttori` : ""}`],
    ["Calate", `${r.nCalate}${r.lCal > 0 ? ` (${it(r.lCal, 0)} m)` : ""}`],
    ["Impianto di terra", x.tipoTerra ? `${x.tipoTerra}${x.picchetti ? `, ${x.picchetti} dispersori` : ""}` : x.picchetti ? `${x.picchetti} dispersori` : [dc("tipo di impianto di terra")]],
  ];
  return tab(["Dato", "Valore"], righe, [5, 11]);
}

// ---------------------------------------------------------------- dichiarazione di conformità
const INTERVENTO: Record<DatiRelazione["tipoIntervento"], string> = { nuovo: "nuovo impianto", adeguamento: "trasformazione / adeguamento", integrazione: "ampliamento / integrazione" };

export function dichiarazioneConformita(x: IngressoDocumenti): Documento {
  const d = x.dati, imp = d;
  const B: Blocco[] = [
    ...testataObo("Dichiarazione di conformità dell'impianto alla regola dell'arte", "D.M. 22 gennaio 2008, n. 37 – art. 7 · impianto di protezione contro le scariche atmosferiche · bozza precompilata", x.logo),
    p([{ t: "Bozza precompilata da OBO Bettermann con i dati del progetto. La dichiarazione è rilasciata e firmata dall'impresa installatrice abilitata, che ne verifica e completa ogni parte; le parti evidenziate sono da compilare.", i: true }], { dimensione: 9 }),
    p([{ t: "Il sottoscritto " }, ...oDc(formattaNome(imp.impresaResponsabile), "nome del titolare o legale rappresentante"), { t: ", titolare o legale rappresentante dell'impresa " }, ...oDc(imp.impresaNome, "ragione sociale dell'impresa"), { t: " operante nel settore degli impianti elettrici e di protezione contro le scariche atmosferiche, con sede in " }, ...oDc(imp.impresaSede, "sede dell'impresa"), { t: ", partita IVA " }, ...oDc(imp.impresaPiva, "partita IVA"), { t: ", iscritta nel registro delle imprese / albo provinciale delle imprese artigiane " }, ...oDc(imp.impresaCciaa, "CCIAA e numero di iscrizione"), { t: "," }], { allinea: "giustificato" }),
    p([{ t: "esecutrice dell'impianto di " }, { t: "protezione contro le scariche atmosferiche (art. 1, comma 2, lettera a)", b: true }, { t: `, inteso come ${INTERVENTO[d.tipoIntervento]}, commissionato da ` }, ...oDc(d.committente, "committente"), { t: " e installato nella struttura " }, ...(titoloOpera(x) ? [{ t: `«${titoloOpera(x)}»` }] : [dc("nome della struttura")]), { t: " sita in " }, ...ubicazione(x), { t: ", adibita a " }, ...oDc(d.destinazione, "destinazione d'uso"), { t: "," }], { allinea: "giustificato" }),
    p([{ t: "DICHIARA", b: true }], { allinea: "centro", spazioPrima: 8 }),
    p("sotto la propria personale responsabilità, che l'impianto è stato realizzato in modo conforme alla regola dell'arte, secondo quanto previsto dall'art. 6, tenuto conto delle condizioni di esercizio e degli usi a cui è destinato l'edificio, avendo in particolare:", { allinea: "giustificato" }),
    el(
      [{ t: "rispettato il progetto redatto ai sensi dell'art. 5 (" }, { t: riferimentoProgetto(x) }, { t: `, LPS di classe ${x.lpl})` }, ...(d.tecnico ? [{ t: `, a firma di ${formattaNome(d.tecnico)}` }] : []), { t: ";" }],
      "seguito la normativa tecnica applicabile all'impiego: serie CEI EN IEC 62305 (2026-10) e CEI EN IEC 62561 per i componenti;",
      "installato componenti e materiali costruiti a regola d'arte e adatti al luogo di installazione (artt. 5 e 6);",
      "controllato l'impianto ai fini della sicurezza e della funzionalità con esito positivo, avendo eseguito le verifiche richieste dalle norme e dalle disposizioni di legge (verbale di prima verifica allegato).",
    ),
    h2("Allegati obbligatori"),
    eln(
      `Progetto ai sensi degli artt. 5 e 7 (${riferimentoProgetto(x)}): relazione tecnica e disegni.`,
      "Relazione con le tipologie dei materiali utilizzati (elenco materiale OBO del progetto).",
      "Schema dell'impianto realizzato (disegni di posizionamento della captazione, delle calate e dei dispersori).",
      [{ t: "Riferimento a dichiarazioni di conformità precedenti o parziali, se esistenti: " }, ...(d.tipoIntervento === "nuovo" ? [{ t: "nessuna (nuovo impianto)." }] : [dc("estremi della dichiarazione precedente")])],
      "Copia del certificato di riconoscimento dei requisiti tecnico-professionali dell'impresa.",
    ),
    h2("Allegati facoltativi"),
    el("Verbale di prima verifica dell'LPS con le misure di continuità e di resistenza di terra.", "Piano delle verifiche periodiche e schede tecniche dei componenti OBO."),
    p("Declina ogni responsabilità per sinistri a persone o a cose derivanti da manomissione dell'impianto da parte di terzi ovvero da carenze di manutenzione o riparazione.", { allinea: "giustificato", spazioPrima: 8 }),
    p([{ t: "Luoghi di lavoro (D.P.R. 22 ottobre 2001, n. 462): ", b: true }, { t: "la dichiarazione di conformità equivale a omologazione dell'impianto; il datore di lavoro la trasmette all'INAIL entro 30 giorni dalla messa in esercizio e fa eseguire le verifiche periodiche previste." }], { dimensione: 9, allinea: "giustificato" }),
    ...firma(luogoData(x), "Il dichiarante (timbro e firma)", oDc(formattaNome(imp.impresaResponsabile), "nome del dichiarante")),
    p([{ t: "Il responsabile tecnico", b: true }], { allinea: "destra", spazioPrima: 12, spazioDopo: 26 }),
    p("______________________________", { allinea: "destra" }),
  ];
  return { titolo: `Dichiarazione di conformità – ${titoloOpera(x) || x.comune || "LPS"}`, intestazione: `Dichiarazione di conformità D.M. 37/2008 · ${titoloOpera(x) || "impianto LPS"}${x.comune ? ` – ${x.comune}` : ""}`, piede: PIEDE_OBO, blocchi: B };
}

// ---------------------------------------------------------------- verbale di prima verifica
const PIENO = "■";
const scelta = (v: boolean | null | undefined, si: string, no: string) => (v == null ? `${casella} ${si}  ${casella} ${no}` : v ? `${PIENO} ${si}  ${casella} ${no}` : `${casella} ${si}  ${PIENO} ${no}`);
const ohm = (v: number | null | undefined) => (v == null ? "" : it(v, 3));

export function verbalePrimaVerifica(x: IngressoDocumenti): Documento {
  const r = riepilogoImpianto(x), so = x.sopralluogo;
  const esitoTxt = (id: string) => { const e = so?.esiti[id]; return (["C", "NC", "NA"] as const).map((k) => `${e?.esito === k ? PIENO : casella} ${k}`).join("   "); };
  const sezioni = [...new Set(CHECKLIST.map((v) => v.sezione))];
  const val = (v: string | undefined, cosa: string): Run[] => (v && v.trim() ? [{ t: v.trim() }] : [dc(cosa)]);
  const B: Blocco[] = [
    ...testataObo("Verbale di prima verifica dell'LPS", "CEI EN IEC 62305-3:2026-10 – art. 7 e Allegato D · verifica completa prima della messa in esercizio", x.logo),
    h1("1. Dati dell'impianto"), tabellaImpianto(x),
    tab(["Verifica", "Valore"], [
      ["Data della verifica", so?.dataVerifica ? dataIt(so.dataVerifica) : [dc("data")]], ["Verificatore", val(so?.verificatore, "nome e qualifica del verificatore")],
      ["Strumenti utilizzati", val(so?.strumenti, "misuratore di terra, milliohmmetro: modello e matricola")],
      ["Condizioni del terreno", val(so?.condizioni, "asciutto / umido, temperatura")],
    ], [5, 11]),
    h1("2. Esame a vista e prove"),
    p("Per ogni voce: C = conforme, NC = non conforme (descrivere nelle note), NA = non applicabile.", { dimensione: 9 }),
  ];
  for (const s of sezioni) B.push(tab([s, "Esito", "Note"], CHECKLIST.filter((v) => v.sezione === s).map((v) => [v.testo, esitoTxt(v.id), so?.esiti[v.id]?.nota ?? ""]), [9, 3.5, 3.5], { dimensione: 9 }));
  const calate = so?.calate.length ? so.calate : Array.from({ length: Math.max(r.nCalate, 2) }, (_, i) => ({ nome: `C${i + 1}`, continuita: null, resistenza: null, giunto: null, note: "" }));
  const spd = so?.spd.length ? so.spd : [{ quadro: "", tipo: "", indicatoreOk: null, collegatoOk: null }, { quadro: "", tipo: "", indicatoreOk: null, collegatoOk: null }];
  B.push(
    h1("3. Misure per calata"),
    p("Continuità misurata tra la captazione e il giunto di sezionamento di ogni calata; resistenza del dispersore a giunto aperto (dispersori di tipo A) e resistenza dell'intero impianto a giunti chiusi.", { allinea: "giustificato" }),
    tab(["Calata", "Continuità (Ω)", "Resistenza di terra (Ω)", "Giunto accessibile", "Note"],
      calate.map((c) => [c.nome, ohm(c.continuita), ohm(c.resistenza), scelta(c.giunto, "sì", "no"), c.note]), [2, 3, 3.5, 3.5, 4], { dimensione: 9 }),
    tab(["Misura dell'intero impianto", "Valore"], [["Resistenza di terra a giunti chiusi (Ω)", ohm(so?.resistenzaTotale)], ["Metodo di misura", val(so?.metodo, "voltamperometrico / a pinza / altro")]], [8, 8]),
    h1("4. Limitatori di sovratensione (SPD)"),
    tab(["Quadro / linea", "Tipo e codice OBO", "Stato indicatore", "Collegamento all'equipotenziale"], spd.map((x2) => [x2.quadro, x2.tipo, scelta(x2.indicatoreOk, "ok", "guasto"), scelta(x2.collegatoOk, "ok", "no")]), [4, 5, 3.5, 3.5], { dimensione: 9 }),
    h1("5. Esito"),
    p(`${so?.esitoFinale === "conforme" ? PIENO : casella} Impianto conforme al progetto e alla norma: può essere messo in esercizio.`),
    p(`${so?.esitoFinale === "non-conforme" ? PIENO : casella} Impianto con non conformità da correggere prima della messa in esercizio (vedi note).`),
    p([{ t: "Note: " }, ...(so?.note.trim() ? [{ t: so.note.trim() }] : [dc("eventuali osservazioni e prescrizioni")])]),
  );
  if (x.firmaVerificatore) B.push(p(luogoData(x), { spazioPrima: 18 }), p([{ t: "Il verificatore", b: true }], { allinea: "destra", spazioPrima: 6, spazioDopo: 2 }), p(val(so?.verificatore, "nome"), { allinea: "destra" }), x.firmaVerificatore, ...(so?.firmatoIl ? [p(`Firmato sul dispositivo il ${new Date(so.firmatoIl).toLocaleString("it-IT")}`, { allinea: "destra", dimensione: 8 })] : []));
  else B.push(...firma(luogoData(x), "Il verificatore", so?.verificatore ? [{ t: so.verificatore }] : [dc("nome e firma")]));
  if (x.fotoSopralluogo?.length) { B.push(h1("6. Documentazione fotografica")); for (const f of x.fotoSopralluogo) B.push(f.img, p(f.didascalia || "Foto del sopralluogo", { allinea: "centro", dimensione: 9 })); }
  return { titolo: `Verbale di prima verifica – ${titoloOpera(x) || x.comune || "LPS"}`, intestazione: `Verbale di prima verifica LPS · ${titoloOpera(x) || "impianto"}${x.comune ? ` – ${x.comune}` : ""}`, piede: PIEDE_OBO, blocchi: B };
}

// ---------------------------------------------------------------- piano delle verifiche periodiche
export interface Scadenza { data: string; tipo: "a vista" | "completa" | "D.P.R. 462/2001" }
/** Scadenze per `anni` anni dalla messa in esercizio. Una verifica completa comprende quella a vista. */
export function scadenzePiano(inizio: string, iv: Intervalli, critico: boolean, dpr: number | null, anni = 10): Scadenza[] {
  const out = new Map<string, Scadenza>();
  const fine = aggiungiAnni(inizio, anni);
  const passoC = critico ? iv.critica : iv.completa;
  for (let k = 1; ; k++) { const dd = aggiungiAnni(inizio, k * passoC); if (dd > fine) break; out.set(dd, { data: dd, tipo: "completa" }); }
  for (let k = 1; ; k++) { const dd = aggiungiAnni(inizio, k * iv.visiva); if (dd > fine) break; if (!out.has(dd)) out.set(dd, { data: dd, tipo: "a vista" }); }
  const lista = [...out.values()];
  if (dpr) for (let k = 1; ; k++) { const dd = aggiungiAnni(inizio, k * dpr); if (dd > fine) break; lista.push({ data: dd, tipo: "D.P.R. 462/2001" }); }
  return lista.sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));
}

export function pianoVerifichePeriodiche(x: IngressoDocumenti): Documento {
  const d = x.dati;
  const iv = x.piano.intervalli ?? (d.ambienteSevero ? INTERVALLI_SEVERI : INTERVALLI_TIPICI[x.lpl]);
  const inizio = /^\d{4}-\d{2}-\d{2}$/.test(d.dataMessaEsercizio) ? d.dataMessaEsercizio : x.data.toISOString().slice(0, 10);
  const dpr = d.luogoDiLavoro ? (d.ambienteSevero ? 2 : 5) : null;
  const lista = scadenzePiano(inizio, iv, x.piano.critico, dpr);
  const anniTxt = (a: number) => (a < 1 ? `${Math.round(a * 12)} mesi` : a === 1 ? "1 anno" : `${it(a)} anni`);
  const B: Blocco[] = [
    ...testataObo("Piano delle verifiche periodiche dell'LPS", "CEI EN IEC 62305-3:2026-10 – D.7.2.2 · manutenzione e verifiche", x.logo),
    h1("1. Impianto"), tabellaImpianto(x),
    p([{ t: "Messa in esercizio: " }, ...(/^\d{4}-\d{2}-\d{2}$/.test(d.dataMessaEsercizio) ? [{ t: dataIt(d.dataMessaEsercizio) }] : [{ t: `${dataIt(inizio)} ` }, dc("data effettiva di messa in esercizio")])]),
    h1("2. Intervalli"),
    tab(["Verifica", "Intervallo", "Contenuto"], [
      ["Esame a vista", anniTxt(iv.visiva), "Integrità di captazione, calate, giunti, fissaggi e connessioni; nuovi impianti sul tetto; SPD"],
      ["Verifica completa", anniTxt(x.piano.critico ? iv.critica : iv.completa), "Esame a vista più prove: continuità elettrica, resistenza di terra, equipotenzialità, distanze di sicurezza"],
      ["Dopo un fulmine o modifiche", "subito", "Verifica completa dopo una fulminazione accertata, lavori sulla struttura o sugli impianti"],
      ...(dpr ? [["D.P.R. 462/2001 (luogo di lavoro)", anniTxt(dpr), "Verifica periodica da INAIL / ASL / ARPA o organismo abilitato, richiesta dal datore di lavoro"] as Testo[]] : []),
    ], [4, 3, 9]),
    p(x.piano.critico ? "Struttura con sistemi critici (rischio di esplosione, impianti sensibili o affollamento): verifica completa ogni anno." : d.ambienteSevero ? "Condizioni ambientali severe: esame a vista ogni 6 mesi e verifica completa ogni anno." : "Intervalli tipici della norma; il proprietario o le prescrizioni locali possono richiederne di più brevi.", { dimensione: 9 }),
    h1("3. Calendario dei prossimi 10 anni"),
    tab(["Scadenza", "Verifica", "Eseguita il", "Firma"], lista.map((s) => [dataIt(s.data), s.tipo, "", ""]), [3.5, 5, 3.5, 4], { dimensione: 9 }),
    h1("4. Registro"),
    p("Ogni verifica si registra con data, esito, misure e firma del verificatore (in Progettazione LPS: sezione Verifiche). Le non conformità vanno corrette senza ritardo e annotate.", { allinea: "giustificato" }),
    ...firma(luogoData(x), "Il tecnico", d.tecnico ? [{ t: formattaNome(d.tecnico) + (d.albo ? `\n${d.albo}` : "") }] : [dc("nome e iscrizione all'albo")]),
  ];
  return { titolo: `Piano delle verifiche – ${titoloOpera(x) || x.comune || "LPS"}`, intestazione: `Piano delle verifiche periodiche LPS · ${titoloOpera(x) || "impianto"}${x.comune ? ` – ${x.comune}` : ""}`, piede: PIEDE_OBO, blocchi: B };
}
