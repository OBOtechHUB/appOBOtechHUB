import type { DatiEdificio } from "@/lib/progettoStore";
import type { RigaComputo, RisultatiModuli } from "./tipi";
export type StatoModulo = "completo" | "dati mancanti" | "da fare";
export function avanzamento(d: DatiEdificio, r: RisultatiModuli, righe: RigaComputo[], mancanti: string[]) {
  const edificioCompleto = Boolean(d.nomeProgetto.trim() && d.comune.trim() && d.L > 0 && d.W > 0 && d.H > 0 && d.densita > 0);
  const edificioIniziato = Boolean(d.nomeProgetto || d.comune || d.L || d.W || d.H || d.densita);
  const moduli: { nome: string; stato: StatoModulo }[] = [
    { nome: "Dati edificio", stato: edificioCompleto ? "completo" : edificioIniziato ? "dati mancanti" : "da fare" },
    { nome: "Analisi rischio", stato: r.rischio ? "completo" : "da fare" },
    { nome: "Captazione", stato: r.captazione ? "completo" : "da fare" },
    { nome: "Calate", stato: r.calate ? "completo" : "da fare" },
    { nome: "Terra", stato: r.terra ? "completo" : "da fare" },
    { nome: "SPD", stato: r.spd ? "completo" : "da fare" },
    { nome: "Computo materiali", stato: !righe.length ? "da fare" : mancanti.length || righe.some((riga) => !riga.codice) ? "dati mancanti" : "completo" },
  ];
  const completi = moduli.filter((m) => m.stato === "completo").length;
  return { moduli, completi, percento: Math.round(completi / moduli.length * 100) };
}