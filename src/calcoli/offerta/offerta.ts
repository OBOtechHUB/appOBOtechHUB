/**
 * Offerta economica dal computo materiali e dal listino OBO (METEL).
 * Prezzo di listino unitario = prezzo / moltiplicatore; sconto per famiglia di sconto o globale; prezzo manuale
 * per riga; quantità arrotondate al multiplo di confezione se richiesto. Logica pura.
 */
import type { Documento, Blocco, Testo } from "@/lib/docx";
import type { VoceListino } from "@/lib/listinoMetel";
import { prezzoUnitario } from "@/lib/listinoMetel";
import { PIEDE_OBO, dataLunga, euro, it, oDc, p, tab, testataObo, h2, el } from "@/calcoli/documenti/stileObo";

export interface ImpostazioniOfferta {
  scontoPercento: number;
  scontiFamiglia: Record<string, number>;
  prezziManuali: Record<string, number>;
  arrotondaConfezioni: boolean;
  destinatario: string; riferimento: string; validitaGiorni: number; note: string;
}
export const offertaVuota: ImpostazioniOfferta = { scontoPercento: 0, scontiFamiglia: {}, prezziManuali: {}, arrotondaConfezioni: true, destinatario: "", riferimento: "", validitaGiorni: 30, note: "" };

export interface RigaIn { codice: string; descrizione: string; quantita: number; unita: string; prezzo?: number | undefined }
export interface RigaOfferta {
  codice: string; descrizione: string; unita: string;
  quantitaProgetto: number; quantita: number; confezione: number;
  listino: number | null; sconto: number; netto: number | null; totale: number | null;
  famiglia: string; fonte: "listino" | "manuale" | "computo" | "mancante";
}

const arr2 = (v: number) => Math.round(v * 100) / 100;

/** Righe dell'offerta: le righe del computo con lo stesso codice si sommano. */
export function righeOfferta(righe: RigaIn[], listino: Map<string, VoceListino>, o: ImpostazioniOfferta): RigaOfferta[] {
  const per = new Map<string, RigaIn & { n: number }>();
  for (const r of righe) {
    if (!(r.quantita > 0)) continue;
    const k = r.codice.trim() || `—${r.descrizione}`;
    const g = per.get(k); if (g) g.quantita += r.quantita; else per.set(k, { ...r, codice: r.codice.trim(), n: 1 });
  }
  return [...per.values()].map((r) => {
    const v = r.codice ? listino.get(r.codice) : undefined;
    const confezione = v && o.arrotondaConfezioni ? Math.max(1, v.confezione) : 1;
    const qProg = r.unita === "m" ? Math.ceil(r.quantita) : Math.ceil(r.quantita - 1e-9);
    const quantita = confezione > 1 ? Math.ceil(qProg / confezione) * confezione : qProg;
    const manuale = r.codice ? o.prezziManuali[r.codice] : undefined;
    const famiglia = v?.famigliaSconto ?? "";
    const sconto = Math.min(100, Math.max(0, famiglia && o.scontiFamiglia[famiglia] != null ? o.scontiFamiglia[famiglia]! : o.scontoPercento));
    let listinoU: number | null = null, netto: number | null = null, fonte: RigaOfferta["fonte"] = "mancante";
    if (manuale != null && manuale >= 0) { listinoU = v ? prezzoUnitario(v) : null; netto = manuale; fonte = "manuale"; }
    else if (v) { listinoU = prezzoUnitario(v); netto = listinoU * (1 - sconto / 100); fonte = "listino"; }
    else if (r.prezzo != null) { listinoU = r.prezzo; netto = r.prezzo * (1 - sconto / 100); fonte = "computo"; }
    return {
      codice: r.codice, descrizione: v?.descrizione || r.descrizione, unita: r.unita, quantitaProgetto: r.quantita, quantita, confezione,
      listino: listinoU, sconto: fonte === "manuale" ? 0 : sconto, netto: netto == null ? null : Math.round(netto * 10000) / 10000,
      totale: netto == null ? null : arr2(netto * quantita), famiglia, fonte,
    };
  });
}

export interface Totali { listino: number; netto: number; mancanti: number; sconto: number }
export function totaliOfferta(righe: RigaOfferta[]): Totali {
  let listino = 0, netto = 0, mancanti = 0;
  for (const r of righe) { if (r.totale == null) { mancanti++; continue; } netto += r.totale; listino += (r.listino ?? r.netto ?? 0) * r.quantita; }
  return { listino: arr2(listino), netto: arr2(netto), mancanti, sconto: listino > 0 ? arr2((1 - netto / listino) * 100) : 0 };
}

export interface IngressoOfferta {
  righe: RigaOfferta[]; o: ImpostazioniOfferta; progetto: string; comune: string; codice?: string | undefined; rev?: string | undefined;
  versioneListino?: string | undefined; logo?: Blocco | undefined; data: Date;
}

export function documentoOfferta(x: IngressoOfferta): Documento {
  const t = totaliOfferta(x.righe);
  const scadenza = new Date(x.data.getTime() + x.o.validitaGiorni * 86400000);
  const righe: Testo[][] = x.righe.map((r, i) => [String(i + 1), r.codice || "—", r.descrizione, `${it(r.quantita, 2)} ${r.unita}`, r.listino == null ? "—" : euro(r.listino), r.fonte === "manuale" ? "netto" : r.sconto ? `${it(r.sconto, 2)} %` : "—", r.netto == null ? [{ t: "su richiesta", i: true }] : euro(r.netto), r.totale == null ? "—" : euro(r.totale)]);
  righe.push(["", "", [{ t: "Totale netto", b: true }], "", "", "", "", [{ t: euro(t.netto), b: true }]]);
  const B: Blocco[] = [
    ...testataObo("Offerta materiali", `Impianto di protezione contro i fulmini · ${x.progetto || "progetto"}${x.comune ? ` – ${x.comune}` : ""}`, x.logo),
    tab(["", ""], [
      [[{ t: "Spett.le", b: true }], oDc(x.o.destinatario, "destinatario dell'offerta")],
      [[{ t: "Riferimento", b: true }], x.o.riferimento || `${x.codice ? `Progetto n. ${x.codice}` : "Progetto LPS"}${x.rev ? ` Rev. ${x.rev}` : ""}`],
      [[{ t: "Data", b: true }], dataLunga(x.data)],
      [[{ t: "Validità", b: true }], `${x.o.validitaGiorni} giorni (fino al ${dataLunga(scadenza)})`],
    ], [3.5, 12.5]),
    p("Facendo seguito alla Vostra richiesta, Vi sottoponiamo la nostra migliore offerta per la fornitura dei materiali OBO del sistema di protezione contro i fulmini, secondo il computo del progetto.", { allinea: "giustificato", spazioPrima: 8 }),
    tab(["Pos.", "Codice", "Descrizione", "Q.tà", "Listino", "Sconto", "Netto unit.", "Totale"], righe, [0.9, 1.6, 5.1, 1.6, 1.6, 1.3, 1.7, 2.2], { dimensione: 8, evidenziaRighe: [righe.length - 1] }),
    p([{ t: `Totale a listino ${euro(t.listino)} · sconto medio ${it(t.sconto, 1)} % · ` }, { t: `totale netto ${euro(t.netto)}`, b: true }, { t: " (IVA esclusa)." }], { spazioPrima: 6 }),
    ...(t.mancanti ? [p([{ t: `${t.mancanti} articoli senza prezzo di listino: quotazione su richiesta.`, i: true }], { dimensione: 9 })] : []),
    h2("Condizioni"),
    el(
      `Prezzi netti in euro, IVA esclusa${x.versioneListino ? `, dal listino OBO ${x.versioneListino.split(" · ")[0]}` : ", dal listino OBO in vigore"}.`,
      "Quantità arrotondate alle confezioni di vendita dove indicato; le quantità di progetto comprendono la maggiorazione per sfridi impostata nel computo.",
      "Resa, pagamento e tempi di consegna secondo le condizioni generali di vendita OBO Bettermann e gli accordi in essere.",
      "L'offerta riguarda i soli materiali: installazione, verifiche e documentazione dell'impresa installatrice esclusi.",
    ),
    ...(x.o.note.trim() ? [h2("Note"), p(x.o.note.trim())] : []),
    p("Restando a disposizione per ogni chiarimento, porgiamo distinti saluti.", { spazioPrima: 10 }),
    p([{ t: "OBO Bettermann S.r.l. – Ufficio tecnico", b: true }], { allinea: "destra", spazioPrima: 14 }),
  ];
  return { titolo: `Offerta materiali – ${x.progetto || x.comune || "LPS"}`, intestazione: `Offerta materiali OBO · ${x.progetto || "progetto LPS"}${x.codice ? ` · n. ${x.codice}` : ""}`, piede: PIEDE_OBO, blocchi: B };
}
