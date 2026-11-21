/** Relazione di calcolo degli staffaggi (Word in stile OBO): dati, ipotesi, verifiche per tratta, distinta. Logica pura. */
import { OBO, type Blocco, type Documento } from "@/lib/docx";
import type { RisultatoTratta } from "./calcolo";
import type { RigaDistinta } from "./componenti";
import { FINITURE, SERIE_PASSERELLE, TIPOLOGIE, type ProgettoStaffaggi } from "./tipi";

const fmt = (v: number, d = 2) => v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });

export function relazioneStaffaggi(pr: ProgettoStaffaggi, risultati: RisultatoTratta[], distinta: RigaDistinta[], data = new Date()): Documento {
  const b: Blocco[] = [];
  b.push({ tipo: "fascia", colore: OBO.arancio, altezza: 1400, righe: [
    { testo: [{ t: "RELAZIONE DI CALCOLO", carattere: "condensato" }], dimensione: 30, colore: "FFFFFF" },
    { testo: "Sistemi di staffaggio per passerelle portacavi", dimensione: 14, colore: "FFFFFF" },
  ] });
  b.push({ tipo: "par", testo: "" });
  b.push({ tipo: "tabella", intestazione: ["Dato", "Valore"], larghezze: [30, 70], righe: [
    ["Progetto", pr.nome || "-"], ["Numero CRM", pr.codice || "-"], ["Cliente", pr.cliente || "-"], ["Comune", pr.comune || "-"],
    ["Progettista", pr.progettista || "-"], ["Data", data.toLocaleDateString("it-IT")], ["Tratte", String(pr.tratte.length)],
  ] });
  b.push({ tipo: "titolo", livello: 1, testo: "Ipotesi di calcolo" });
  b.push({ tipo: "elenco", voci: [
    "Carico per supporto = (carico dei cavi + peso proprio della passerella) × interasse dei supporti, più gli eventuali carichi aggiuntivi; g = 9,81 m/s².",
    "Traversi e profilati verificati con le tabelle dei carichi ammessi OBO dei profilati MS (carico concentrato e distribuito in funzione della luce) e, dove disponibili, con i valori statici del profilo: tensione ammessa 160 N/mm², freccia limite L/200.",
    "Mensole verificate con il carico ammesso OBO del tipo AW (carico applicato a metà sporgenza).",
    "Montanti compressi verificati con il carico critico euleriano (asse debole, libera inflessione 2·h, coefficiente di sicurezza 2,5); montanti con mensole verificati a pressoflessione.",
    "Fissaggi alla struttura: sono indicate le forze sugli ancoranti, da confrontare con il carico ammesso dell'ancorante scelto per il supporto reale (calcestruzzo, acciaio, legno).",
    "Il peso proprio delle passerelle è quello OBO quando disponibile; altrimenti è stimato e segnalato.",
  ] });
  pr.tratte.forEach((t, i) => {
    const r = risultati[i]!;
    b.push({ tipo: "titolo", livello: 1, testo: `${t.nome}` });
    b.push({ tipo: "tabella", intestazione: ["Dato", "Valore"], larghezze: [35, 65], righe: [
      ["Tipologia", TIPOLOGIE[t.tipologia].nome], ["Lunghezza", `${fmt(t.lunghezza, 1)} m`], ["Interasse supporti", `${fmt(t.interasse)} m`],
      ["Numero supporti", String(r.supporti)], ["Profilato", `${t.profilato} - ${FINITURE[t.finitura]}`],
      ["Carico per supporto", `${fmt(r.Ftotale)} kN`],
      ["Esito", r.esito === "ok" ? "Verificato" : r.esito === "ko" ? "NON verificato" : "Verificato, fissaggi da completare"],
    ] });
    b.push({ tipo: "titolo", livello: 2, testo: "Piani di passerelle" });
    b.push({ tipo: "tabella", intestazione: ["Piano", "Passerella", "Cavi (kg/m)", "Peso proprio (kg/m)", "Carico (kN/m)", "Su supporto (kN)"], righe: r.carichi.map((c, k) => [
      String(c.piano), `${SERIE_PASSERELLE[t.piani[k]!.serie].nome} ${c.larghezza}x${t.piani[k]!.altezza}${t.piani[k]!.coperchio ? " con coperchio" : ""}`,
      fmt(t.piani[k]!.caricoCavi, 1), `${fmt(c.pesoProprio)}${c.pesoStimato ? " (stima)" : ""}`, fmt(c.qTotale), fmt(c.F),
    ]) });
    b.push({ tipo: "titolo", livello: 2, testo: "Verifiche" });
    b.push({ tipo: "tabella", dimensione: 8, larghezze: [26, 24, 10, 10, 8, 8, 14], intestazione: ["Elemento", "Verifica", "Valore", "Ammesso", "Unità", "Esito", "Fonte"], righe: r.verifiche.map((v) => [
      v.elemento, v.grandezza, fmt(v.valore), v.ammesso != null ? fmt(v.ammesso) : "-", v.unita,
      v.esito === "ok" ? [{ t: `OK ${v.sfruttamento != null ? `${Math.round(v.sfruttamento * 100)}%` : ""}`, colore: "2E7D32" }] : v.esito === "ko" ? [{ t: "NO", b: true, colore: "C62828" }] : [{ t: "da verificare", daCompletare: true }],
      v.fonte,
    ]) });
    for (const a of r.avvisi) b.push({ tipo: "par", testo: [{ t: a, i: true }], dimensione: 8 });
    if (t.note) b.push({ tipo: "par", testo: `Note: ${t.note}` });
  });
  b.push({ tipo: "titolo", livello: 1, testo: "Distinta dei materiali" });
  b.push({ tipo: "tabella", dimensione: 8, larghezze: [14, 60, 10, 16], intestazione: ["Codice OBO", "Descrizione", "Q.tà", "Finitura"], righe: distinta.map((d) => [
    d.codice ?? [{ t: "da assegnare", daCompletare: true }], d.descrizione, `${d.quantita} ${d.unita}`, d.finitura,
  ]) });
  b.push({ tipo: "par", testo: [{ t: "Calcoli di supporto alla progettazione – da validare da tecnico abilitato.", i: true }], dimensione: 8, spazioPrima: 200 });
  return { blocchi: b, titolo: `Relazione staffaggi ${pr.nome}`, autore: pr.progettista || "OBO Bettermann", intestazione: `Staffaggi OBO · ${pr.codice ? `${pr.codice} · ` : ""}${pr.nome}` };
}
