/**
 * Assistente di progetto: sequenza dei passi dall'edificio al dossier, con lo stato di ciascuno
 * ricavato dai dati del progetto. Logica pura (nessun accesso a stato o interfaccia).
 */

export type StatoPasso = "completo" | "in corso" | "da fare" | "in arrivo" | "facoltativo";

export interface RiassuntoProgetto {
  edificio: { nome: string; comune: string; L: number; W: number; H: number; lpl: string | null; densita: number };
  corpi: number;
  aste: number;
  conduttoriCaptazione: number;
  calate: number;
  terraAccettata: boolean;
  conduttoriTerra: number;
  picchetti: number;
  componentiPosizionati: number;
  rischioValutato?: boolean;
  calateCalcolate?: boolean;
  spdScelti?: boolean;
  righeComputo: number;
  mancantiComputo: number;
  verifiche: number;
  verificaScaduta: boolean;
}

export type Destinazione = "/rischio" | "/calate" | "/spd" | "/dati-edificio" | "/edificio-3d" | "/resistenza-terra" | "/particolari" | "/computo-materiali" | "/download-cad" | "/verifiche";

export interface Passo {
  id: string;
  titolo: string;
  descrizione: string;
  stato: StatoPasso;
  motivo: string;
  to: Destinazione | null;
  /** passo che conta nel completamento del progetto */
  obbligatorio: boolean;
}

export function passiAssistente(p: RiassuntoProgetto): Passo[] {
  const e = p.edificio;
  const geometria = e.L > 0 && e.W > 0 && e.H > 0;
  const edificioCompleto = geometria && Boolean(e.lpl) && Boolean(e.nome.trim()) && Boolean(e.comune.trim());
  const captazione = p.aste + p.conduttoriCaptazione > 0;
  return [
    {
      id: "edificio", titolo: "Dati dell'edificio", descrizione: "Nome, comune, dimensioni, densità di fulminazione e livello di protezione (LPL).",
      stato: edificioCompleto ? "completo" : geometria || e.nome || e.comune ? "in corso" : "da fare",
      motivo: edificioCompleto ? `LPL ${e.lpl} · ${e.L}×${e.W}×${e.H} m` : !geometria ? "Mancano le dimensioni dell'edificio." : !e.lpl ? "Scegli il livello di protezione LPL." : "Mancano nome del progetto o comune.",
      to: "/dati-edificio", obbligatorio: true,
    },
    {
      id: "rischio", titolo: "Analisi del rischio", descrizione: "Valutazione R1–R4 secondo CEI EN IEC 62305-2 per stabilire se e come proteggere.",
      stato: p.rischioValutato ? "completo" : "da fare", motivo: p.rischioValutato ? "Rischio R1 valutato e LPL impostato" : "Calcola R1 e il livello di protezione minimo.", to: "/rischio", obbligatorio: false,
    },
    {
      id: "modello", titolo: "Modello 3D", descrizione: "Corpi dell'edificio, coperture e superfici (manuale, DXF, IFC, mappa).",
      stato: p.corpi > 0 ? "completo" : "da fare", motivo: p.corpi > 0 ? `${p.corpi} corpi nel modello` : "Crea o importa l'edificio in Edificio 3D.",
      to: "/edificio-3d", obbligatorio: true,
    },
    {
      id: "captazione", titolo: "Captazione", descrizione: "Proposta automatica di aste e maglia, verifica con sfera rotolante e metodo della maglia.",
      stato: captazione ? "completo" : p.corpi > 0 ? "da fare" : "da fare",
      motivo: captazione ? `${p.aste} aste · ${p.conduttoriCaptazione} conduttori` : "Usa “Proponi captazione” in Edificio 3D e accetta la proposta.",
      to: "/edificio-3d", obbligatorio: true,
    },
    {
      id: "calate", titolo: "Calate e distanza di sicurezza", descrizione: "Numero e posizione delle calate; distanza di separazione s.",
      stato: p.calateCalcolate ? "completo" : p.calate > 0 ? "in corso" : "da fare",
      motivo: p.calateCalcolate ? "Calate e distanza di separazione verificate" : p.calate > 0 ? `${p.calate} calate nel progetto: verifica la distanza di separazione` : "Calcola numero di calate e distanza di separazione.",
      to: "/calate", obbligatorio: true,
    },
    {
      id: "terra", titolo: "Impianto di terra", descrizione: "Dispersore di tipo A, B o di fondazione.",
      stato: p.terraAccettata ? "completo" : p.conduttoriTerra + p.picchetti > 0 ? "in corso" : "da fare",
      motivo: p.terraAccettata ? `${p.conduttoriTerra} conduttori · ${p.picchetti} picchetti` : "Proponi e accetta l'impianto di terra in Edificio 3D.",
      to: "/edificio-3d", obbligatorio: true,
    },
    {
      id: "resistenza", titolo: "Resistenza di terra", descrizione: "Stima della resistenza del dispersore e resistività del terreno (Wenner).",
      stato: "facoltativo", motivo: p.terraAccettata ? "Consigliato: stima la resistenza dell'impianto accettato." : "Disponibile dopo l'impianto di terra.",
      to: "/resistenza-terra", obbligatorio: false,
    },
    {
      id: "spd", titolo: "Scelta SPD", descrizione: "Coordinamento degli SPD secondo CEI EN IEC 62305-4.",
      stato: p.spdScelti ? "completo" : "da fare", motivo: p.spdScelti ? "SPD scelti e salvati nel computo" : "Scegli gli SPD per la linea di alimentazione.", to: "/spd", obbligatorio: false,
    },
    {
      id: "particolari", titolo: "Particolari costruttivi", descrizione: "Abbinamento dei componenti ai particolari OBO, schede PDF e DWG.",
      stato: p.componentiPosizionati > 0 ? "completo" : "da fare",
      motivo: p.componentiPosizionati > 0 ? `${p.componentiPosizionati} componenti posizionati` : "I componenti arrivano con le proposte di captazione e terra.",
      to: "/particolari", obbligatorio: false,
    },
    {
      id: "computo", titolo: "Computo materiali e relazione", descrizione: "Quantità, codici OBO, esportazione Excel e relazione PDF.",
      stato: p.righeComputo === 0 ? "da fare" : p.mancantiComputo > 0 ? "in corso" : "completo",
      motivo: p.righeComputo === 0 ? "Nessuna voce di computo." : p.mancantiComputo > 0 ? `${p.mancantiComputo} dati mancanti nel computo` : `${p.righeComputo} voci complete`,
      to: "/computo-materiali", obbligatorio: true,
    },
    {
      id: "cad", titolo: "Disegno CAD", descrizione: "Esportazione per ZWCAD/AutoCAD con LPS.lsp.",
      stato: captazione ? "facoltativo" : "da fare", motivo: captazione ? "Scarica LPS.lsp e il file .lpsdati da Edificio 3D." : "Disponibile dopo la captazione.",
      to: "/download-cad", obbligatorio: false,
    },
    {
      id: "verifiche", titolo: "Verifiche e dossier", descrizione: "Piano delle verifiche periodiche, registro e dossier tecnico PDF.",
      stato: p.verifiche === 0 ? "da fare" : p.verificaScaduta ? "in corso" : "completo",
      motivo: p.verifiche === 0 ? "Registra la prima verifica (iniziale) dell'impianto." : p.verificaScaduta ? "Una verifica è scaduta." : `${p.verifiche} verifiche registrate`,
      to: "/verifiche", obbligatorio: false,
    },
  ];
}

/** Primo passo da fare, nell'ordine; ignora i passi "in arrivo" e "facoltativo". */
export function prossimoPasso(passi: Passo[]): Passo | null {
  return passi.find((x) => x.stato === "da fare" || x.stato === "in corso") ?? null;
}

export function completamento(passi: Passo[]): { completi: number; totale: number; percento: number } {
  const obbligatori = passi.filter((x) => x.obbligatorio);
  const completi = obbligatori.filter((x) => x.stato === "completo").length;
  return { completi, totale: obbligatori.length, percento: obbligatori.length ? Math.round((completi / obbligatori.length) * 100) : 0 };
}
