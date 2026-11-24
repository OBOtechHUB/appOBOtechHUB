/**
 * Progetto di prova completo (prova notturna e documenti d'esempio): edificio a tre blocchi con
 * aste di tipi diversi, calate, terra, separazione, rischio a due zone e due linee, sopralluogo compilato,
 * impresa installatrice, offerta e un tipologico disegnato con l'editor. Dati inventati.
 */
import { esempio } from "@/calcoli/relazione/esempioRelazione";
import type { IngressoRelazione } from "@/calcoli/relazione/relazioneTecnica";
import type { Zona } from "@/calcoli/rischio/rischioR1";
import { disegnoSchema, type DisegnoTip } from "@/calcoli/particolari/tipologico";
import type { VoceListino } from "@/lib/listinoMetel";
import type { ImpostazioniOfferta } from "@/calcoli/offerta/offerta";

export const TIPOLOGICO_PROVA: DisegnoTip = disegnoSchema.parse({
  larghezza: 820, altezza: 480,
  blocchi: [
    { id: "s", tipo: "copertura", x: 410, y: 420, scala: 2.6 },
    { id: "par", tipo: "parapetto", x: 735, y: 350 },
    { id: "a", tipo: "asta", x: 190, y: 240, codiceOBO: "5402864", descrizione: "101 3B-4000 Asta di captazione 4 m", unita: "per_asta" },
    { id: "t", tipo: "treppiede", x: 190, y: 350, codiceOBO: "5408902", descrizione: "isFang 3B-250-A Treppiede con blocchi in cls", unita: "per_asta" },
    { id: "m1", tipo: "morsetto", x: 330, y: 300, codiceOBO: "5311519", descrizione: "249 8-10 ALU Connettore Quick", unita: "per_asta" },
    { id: "p", tipo: "supporto-piano", x: 470, y: 380, codiceOBO: "5218700", descrizione: "165 MBG-8-10 Supporto conduttore tetto", quantita: 1, unita: "per_m" },
    { id: "c", tipo: "compensatore", x: 600, y: 375, codiceOBO: "5218926", descrizione: "172 AR Giunto di dilatazione", unita: "per_compensatore" },
  ],
  collegamenti: [
    { id: "k1", da: "a", a: "m1", codiceOBO: "5021296", descrizione: "RD 8-ALU-T 75 Conduttore rotondo", unita: "per_m" },
    { id: "k2", da: "m1", a: "p", ortogonale: true }, { id: "k3", da: "p", a: "c" }, { id: "k4", da: "c", a: "par" },
    { id: "q", da: "p", a: "c", tipo: "quota", testo: "max 1 m" },
  ],
  testi: [{ id: "x", x: 20, y: 30, t: "Sezione tipo – non in scala", dim: 12 }],
});

/** Lo stesso tipologico con i disegni 2D ufficiali OBO al posto dei simboli (public/obo-disegni). */
export const TIPOLOGICO_PROVA_OBO: DisegnoTip = disegnoSchema.parse({
  ...TIPOLOGICO_PROVA, larghezza: 900, altezza: 560,
  blocchi: [
    { id: "s", tipo: "copertura", x: 450, y: 500, scala: 2.8 },
    { id: "par", tipo: "parapetto", x: 815, y: 430 },
    { id: "a", tipo: "asta", x: 150, y: 215, codiceOBO: "5402864", descrizione: "101 3B-4000 Asta di captazione 4 m", unita: "per_asta", vista: "obo", larghezzaObo: 70 },
    { id: "t", tipo: "treppiede", x: 175, y: 405, codiceOBO: "5408902", descrizione: "isFang 3B-250-A Treppiede con blocchi in cls", unita: "per_asta", vista: "obo", larghezzaObo: 230 },
    { id: "m1", tipo: "morsetto", x: 360, y: 250, codiceOBO: "5311519", descrizione: "249 8-10 ALU Connettore Quick", unita: "per_asta", vista: "obo", larghezzaObo: 90 },
    { id: "p", tipo: "supporto-piano", x: 520, y: 440, codiceOBO: "5218700", descrizione: "165 MBG-8-10 Supporto conduttore tetto", quantita: 1, unita: "per_m", vista: "obo", larghezzaObo: 80 },
    { id: "c", tipo: "compensatore", x: 680, y: 430, codiceOBO: "5218926", descrizione: "172 AR Giunto di dilatazione", unita: "per_compensatore", vista: "obo", larghezzaObo: 120 },
  ],
});

export function progettoProva(): IngressoRelazione {
  const e = esempio();
  e.edificio = { ...e.edificio, nomeProgetto: "Polo scientifico – edificio DA", L: 110, W: 58, H: 16 };
  e.modello = { corpi: [
    { id: "c1", nome: "Corpo centrale", impronta: [[0, 0], [80, 0], [80, 30], [0, 30]], quotaBase: 0, altezzaGronda: 16, tipoTetto: "piano", altezzaColmo: 16 },
    { id: "c2", nome: "Ala est", impronta: [[80, 0], [110, 0], [110, 30], [80, 30]], quotaBase: 0, altezzaGronda: 12, tipoTetto: "piano", altezzaColmo: 12 },
    { id: "c3", nome: "Ala sud", impronta: [[0, -28], [28, -28], [28, 0], [0, 0]], quotaBase: 0, altezzaGronda: 8, tipoTetto: "piano", altezzaColmo: 8 },
  ] };
  const aste: IngressoRelazione["aste"] = []; let k = 0;
  for (let x = 0; x <= 80; x += 16) for (const y of [0, 15, 30]) aste.push({ id: `a${k++}`, x, y, z: 16, altezza: y === 15 ? 6 : 4, diametro: 0.016, codiceOBO: y === 15 ? "5408940" : "5402864" });
  for (let x = 80; x <= 110; x += 15) for (const y of [0, 30]) aste.push({ id: `a${k++}`, x, y, z: 12, altezza: 2.5, diametro: 0.016, codiceOBO: "5401986" });
  for (const [x, y] of [[0, -28], [28, -28], [0, -14], [28, -14]] as const) aste.push({ id: `a${k++}`, x, y, z: 8, altezza: 4.5, diametro: 0.016, codiceOBO: "5402866" });
  e.aste = aste;
  const cal = (id: string, x: number, y: number, z: number) => ({ id, tipo: "calata" as const, punti: [[x, y, z], [x, y, 0]] as [number, number, number][], materiale: "Alluminio", sezione: "50", codiceOBO: "5021296" });
  e.conduttori = [
    { id: "k1", tipo: "captazione", punti: [[0, 0, 16], [80, 0, 16], [80, 30, 16], [0, 30, 16], [0, 0, 16]], materiale: "Alluminio", sezione: "50", codiceOBO: "5021296" },
    { id: "k2", tipo: "captazione", punti: [[80, 0, 12], [110, 0, 12], [110, 30, 12], [80, 30, 12]], materiale: "Alluminio", sezione: "50", codiceOBO: "5021296" },
    { id: "k3", tipo: "captazione", punti: [[0, 0, 8], [0, -28, 8], [28, -28, 8], [28, 0, 8]], materiale: "Alluminio", sezione: "50", codiceOBO: "5021296" },
    cal("d1", 0, 0, 16), cal("d2", 20, 30, 16), cal("d3", 40, 0, 16), cal("d4", 60, 30, 16), cal("d5", 80, 0, 16), cal("d6", 110, 0, 12), cal("d7", 110, 30, 12), cal("d8", 0, -28, 8), cal("d9", 28, -28, 8), cal("d10", 0, 30, 16),
  ];
  e.picchetti = Array.from({ length: 10 }, () => ({ lunghezza: 1.5 }));
  const ufficio: Zona = { id: "z1", nome: "Laboratori e uffici", oreAnno: 3000, rt: 1e-3, rp: 0.5, rfId: "ordinario", categoria: "normale", misureContatto: 1, esterna: false, esposti: false, LD: 0.1, impiantiCritici: false, serviziCritici: false, linee: null, wm1: null, wm2: null, ks3: 1, oreApparecchi: 8760 };
  const esterno: Zona = { id: "z2", nome: "Aree esterne di pertinenza", oreAnno: 500, rt: 1e-2, rp: 1, rfId: "ordinario", categoria: "normale", misureContatto: 1, esterna: true, esposti: true, LD: 0.01, impiantiCritici: false, serviziCritici: false, linee: null, wm1: null, wm2: null, ks3: 1, oreApparecchi: 0 };
  e.rischio = { struttura: { L: 110, W: 58, H: 16, NG: 2.04, CD: 0.5, k: 2, Uw: 2.5, PS: 1, PTWS: 1, danniMateriali: true, linee: [
    { nome: "Energia BT", lunghezza: 1000, posa: 0.3, ambiente: 0.5, tipo: 1, schermata: false, connessione: "interrata-ns", schermatura: "no", adiacente: null },
    { nome: "Telecomunicazioni", lunghezza: 800, posa: 0.5, ambiente: 0.5, tipo: 1, schermata: true, connessione: "interrata-ns", schermatura: "no", adiacente: null },
  ] }, zone: [ufficio, esterno] } as unknown as IngressoRelazione["rischio"];
  e.particolari = [...e.particolari, { id: "OBO-TIP-PROVA", nome: "Asta su treppiede e tondo su tetto piano", componenti: [], disegno: TIPOLOGICO_PROVA }, { id: "OBO-TIP-PROVA-OBO", nome: "Asta su treppiede e tondo su tetto piano – disegni OBO", componenti: [], disegno: TIPOLOGICO_PROVA_OBO }];
  e.righe = [
    ...e.righe.filter((r) => r.codice),
    { id: "r4", codice: "5218700", descrizione: "165 MBG-8-10 – supporto conduttore tetto piano", categoria: "supporti", unita: "pz", quantita: 260, provenienza: "Captazione · particolare OBO-TIP-PROVA", materiale: "", sezione: "" },
    { id: "r5", codice: "5336457", descrizione: "233 A VA – giunto di sezionamento", categoria: "connessioni", unita: "pz", quantita: 10, provenienza: "Calate", materiale: "", sezione: "" },
    { id: "r7", codice: "5408902", descrizione: "isFang 3B-250-A – treppiede", categoria: "captazione", unita: "pz", quantita: 18, provenienza: "Captazione · particolare OBO-TIP-PROVA", materiale: "", sezione: "" },
    { id: "r9", codice: "5402864", descrizione: "101 3B-4000 – asta di captazione (tipologico con disegni OBO)", categoria: "captazione", unita: "pz", quantita: 1, provenienza: "Captazione · particolare OBO-TIP-PROVA-OBO", materiale: "", sezione: "" },
    { id: "r8", codice: "5218926", descrizione: "172 AR – giunto di dilatazione", categoria: "connessioni", unita: "pz", quantita: 12, provenienza: "Captazione · particolare OBO-TIP-PROVA", materiale: "", sezione: "" },
    { id: "r6", codice: "5311519", descrizione: "249 8-10 ALU – connettore Quick", categoria: "connessioni", unita: "pz", quantita: 44, provenienza: "Captazione · particolare OBO-TIP-PROVA", materiale: "", sezione: "" },
  ] as IngressoRelazione["righe"];
  e.dati = {
    ...e.dati, titoloOpera: "Polo scientifico universitario – edificio DA", destinazione: "attività didattiche, laboratori e uffici", provincia: "Torino",
    parapetto: "si-collegato", strutturaMetallica: "si-collegato", armature: "si", calateEsistenti: "in-getto", calateNumero: 31, calateInterasse: 15,
    terraEsistente: "anello", terraCollegataAltri: true, spdEsistenti: "si", impiantiCopertura: "unità di trattamento aria, canali e pannelli fotovoltaici", altezzaImpianti: 2.2,
    fissaggioAste: "treppiede", ventoKmh: 150, margineSicurezza: 1,
    corpi: { c1: { altezzaDaProteggere: 2.2, nota: "UTA e canali sul lato nord", metallica: false }, c2: { altezzaDaProteggere: 1, nota: "", metallica: true }, c3: { altezzaDaProteggere: 1.5, nota: "pannelli fotovoltaici", metallica: false } },
    tipoIntervento: "integrazione", valutazioneEconomica: true,
    impresaNome: "Elettro Prova S.r.l.", impresaResponsabile: "Mario Bianchi", impresaSede: "Via dell'Industria 1, 10095 Grugliasco (TO)", impresaPiva: "01234567890", impresaCciaa: "CCIAA di Torino n. TO-000000",
    luogoDiLavoro: true, ambienteSevero: false, dataMessaEsercizio: "2027-03-01",
  };
  return e;
}

/** Prezzi inventati per la prova (in CI il listino vero non c'è). */
export const LISTINO_PROVA: VoceListino[] = [
  { codice: "5402864", ean: "", descrizione: "101 3B-4000 Asta captazione", prezzo: 831.73, prezzoPubblico: 831.73, moltiplicatore: 1, unita: "PCE", confezione: 1, famigliaSconto: "0225", stato: 3, variazione: "20260101" },
  { codice: "5021296", ean: "", descrizione: "RD 8-ALU-T 75 Conduttore rotondo", prezzo: 525.43, prezzoPubblico: 525.43, moltiplicatore: 100, unita: "LM", confezione: 75, famigliaSconto: "0225", stato: 3, variazione: "20260101" },
  { codice: "5218700", ean: "", descrizione: "165 MBG-8-10 Supporto conduttore tetto", prezzo: 683.81, prezzoPubblico: 683.81, moltiplicatore: 100, unita: "PCE", confezione: 25, famigliaSconto: "0225", stato: 3, variazione: "20260101" },
  { codice: "5311519", ean: "", descrizione: "249 8-10 ALU Connettore Quick", prezzo: 940.77, prezzoPubblico: 940.77, moltiplicatore: 100, unita: "PCE", confezione: 50, famigliaSconto: "0225", stato: 3, variazione: "20260101" },
  { codice: "5336457", ean: "", descrizione: "233 A VA Morsetto sezionamento", prezzo: 1515.53, prezzoPubblico: 1515.53, moltiplicatore: 100, unita: "PCE", confezione: 10, famigliaSconto: "0225", stato: 3, variazione: "20260101" },
];
export const OFFERTA_PROVA: ImpostazioniOfferta = { scontoPercento: 45, scontiFamiglia: { "0225": 50 }, prezziManuali: {}, arrotondaConfezioni: true, destinatario: "Elettro Prova S.r.l.", riferimento: "Vs. richiesta del 12 novembre 2026", validitaGiorni: 30, note: "Consegna franco cantiere per ordini superiori a 1.000 € netti." };
