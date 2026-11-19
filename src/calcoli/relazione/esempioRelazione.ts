/** Progetto di esempio per le prove della relazione tecnica. */
import { datiRelazioneVuoti, type IngressoRelazione } from "./relazioneTecnica";
import type { Zona } from "@/calcoli/rischio/rischioR1";

const zona: Zona = { id: "z1", nome: "Struttura", oreAnno: 8760, rt: 1e-2, rp: 0.5, rfId: "ordinario", categoria: "normale", misureContatto: 1, esterna: true, esposti: false, LD: 0.1, impiantiCritici: false, serviziCritici: false, linee: null, wm1: null, wm2: null, ks3: 1, oreApparecchi: 8760 };

export function esempio(): IngressoRelazione {
  return {
    edificio: { nomeProgetto: "Nuovo polo scientifico", comune: "Grugliasco", indirizzo: "Via Prova 1", lat: 45.067102, lon: 7.596693, L: 80, W: 30, H: 16, copertura: "Piana", materiale: "Cemento armato", impiantiTetto: true, posizioneId: "isolata", densita: 2.04, lplProgetto: "IV" },
    codice: "CRM-123",
    revisioni: [{ rev: "A", data: "2026-11-19T10:00:00Z", autore: "Marco", descrizione: "Prima emissione" }],
    lplDisegno: "IV",
    modello: { corpi: [{ id: "c1", nome: "Blocco 1", impronta: [[0, 0], [80, 0], [80, 30], [0, 30]], quotaBase: 0, altezzaGronda: 16, tipoTetto: "piano", altezzaColmo: 16 }] },
    aste: [{ id: "a1", x: 0, y: 0, z: 16, altezza: 4, diametro: 0.016, codiceOBO: "5402864" }, { id: "a2", x: 15, y: 0, z: 16, altezza: 4, diametro: 0.016, codiceOBO: "5402864" }, { id: "a3", x: 30, y: 0, z: 16, altezza: 2.5, diametro: 0.016, codiceOBO: "5401986" }],
    conduttori: [
      { id: "k1", tipo: "captazione", punti: [[0, 0, 16], [80, 0, 16]], materiale: "Alluminio", sezione: "50", codiceOBO: "5021296" },
      { id: "k2", tipo: "calata", punti: [[0, 0, 16], [0, 0, 0]], materiale: "Alluminio", sezione: "50", codiceOBO: "5021296" },
      { id: "k3", tipo: "calata", punti: [[80, 30, 16], [80, 30, 0]], materiale: "Alluminio", sezione: "50", codiceOBO: "5021296" },
    ],
    picchetti: [{ lunghezza: 1.5 }, { lunghezza: 1.5 }],
    terra: { tipo: "A", distanzaAnello: 1, profondita: 0.5, lunghezzaPicchetto: 1.5, l1: 5 },
    separazione: { ki: null, kmSolido: null, punti: [{ id: "p1", descrizione: "Unità trattamento aria", l: 10, d: 0.5, materiale: "aria" }] },
    rischio: { struttura: { L: 80, W: 30, H: 16, NG: 2.04, CD: 1, k: 2, Uw: 2.5, PS: 1, PTWS: 1, danniMateriali: true, linee: [{ nome: "Energia", lunghezza: 1000, posa: 0.3, ambiente: 0.5, tipo: 1, schermata: false, connessione: "interrata-ns", schermatura: "no", adiacente: null }] }, zone: [zona] },
    risultati: { captazione: { lunghezzaConduttori: 80, giunzioni: 2, incroci: 0, descrizione: "Aste perimetrali collegate da tondo Ø 8 mm" } },
    righe: [
      { id: "r1", codice: "5402864", descrizione: "101 3B-4000 – asta di captazione per treppiede", categoria: "captazione", unita: "pz", quantita: 2, provenienza: "Proposta accettata – OBO-TBS-250-T2.01", materiale: "", sezione: "" },
      { id: "r2", codice: "5021296", descrizione: "RD 8-ALU-T 75 – conduttore tondo", categoria: "conduttori", unita: "m", quantita: 120, provenienza: "Captazione · particolare T1.01", materiale: "", sezione: "" },
      { id: "r3", codice: "", descrizione: "Riga senza codice <&>", categoria: "accessori", unita: "pz", quantita: 1, provenienza: "Inserimento manuale", materiale: "", sezione: "" },
    ],
    mancanti: [],
    particolari: [
      { id: "OBO-TBS-250-T2.01", nome: "Asta su putrella", componenti: [{ codiceOBO: "5402864", descrizione: "101 3B-4000", quantita: 1, unitaQuantita: "per_asta" }] },
      { id: "OBO-TBS-250-T1.01", nome: "Giunzioni conduttore tondo", componenti: [{ codiceOBO: "5021296", descrizione: "RD 8", quantita: 1, unitaQuantita: "per_m" }] },
    ],
    dati: { ...datiRelazioneVuoti, committente: "SINELEC S.p.A.", indirizzoCommittente: "Via Tazio Nuvolari 9", cittaCommittente: "10028 Trofarello (TO)", provincia: "Torino", destinazione: "attività didattiche e laboratori" },
    data: new Date("2026-11-19T12:00:00Z"),
  };
}

