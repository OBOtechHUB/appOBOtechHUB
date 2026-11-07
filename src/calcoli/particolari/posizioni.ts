/**
 * Collegamento particolari costruttivi ↔ progetto.
 *
 * Dai componenti posizionati (supporti, morsetti, compensatori, picchetti, aste) ricava
 * quale particolare OBO (TBS) li descrive, usando il codice articolo OBO.
 * Logica pura: nessun accesso a stato, DOM o rete.
 */

export type OriginePosizione = "progetto" | "proposta-captazione" | "proposta-terra";

export interface ComponentePosizionato {
  tipo?: string | undefined;
  x: number;
  y: number;
  z?: number | undefined;
  codiceOBO?: string | null | undefined;
}

export interface ParticolareCatalogo {
  id: string;
  nome: string;
  categoria: string;
  componenti: { codiceOBO: string | null }[];
}

export interface VoceConRiferimento { riferimento?: string | undefined }

/** Gruppo di componenti di un progetto o di una proposta. */
export interface SorgentePosizioni {
  origine: OriginePosizione;
  supporti?: ComponentePosizionato[] | undefined;
  morsetti?: ComponentePosizionato[] | undefined;
  compensatori?: ComponentePosizionato[] | undefined;
  picchetti?: ComponentePosizionato[] | undefined;
  aste?: ComponentePosizionato[] | undefined;
  /** Distinte che indicano i particolari scelti (campo riferimento = id particolare). */
  distinte?: (VoceConRiferimento[] | null | undefined)[] | undefined;
}

export interface MarcatoreParticolare {
  idParticolare: string;
  nomeParticolare: string;
  categoria: string;
  codiceOBO: string;
  tipoComponente: string;
  x: number;
  y: number;
  z: number;
  /** numero di componenti raggruppati in questo punto */
  quantita: number;
  origine: OriginePosizione;
}

export interface RisultatoPosizioni {
  marcatori: MarcatoreParticolare[];
  /** particolari usati, con il numero di punti, ordinati per id */
  usati: { idParticolare: string; nome: string; punti: number; origini: OriginePosizione[] }[];
  /** codici OBO presenti nel progetto ma non descritti da alcun particolare */
  senzaParticolare: { codiceOBO: string; tipoComponente: string; quantita: number }[];
}

const TOLLERANZA = 0.05; // m

/** Indice codice OBO → particolari che lo contengono (ordine del catalogo). */
export function indicePerCodice(catalogo: ParticolareCatalogo[]): Map<string, ParticolareCatalogo[]> {
  const m = new Map<string, ParticolareCatalogo[]>();
  for (const p of catalogo) {
    for (const c of p.componenti) {
      if (!c.codiceOBO) continue;
      const l = m.get(c.codiceOBO) ?? [];
      if (!l.includes(p)) l.push(p);
      m.set(c.codiceOBO, l);
    }
  }
  return m;
}

/** Sceglie il particolare: preferisce quelli citati nelle distinte, poi il primo del catalogo. */
export function scegliParticolare(candidati: ParticolareCatalogo[], preferiti: Set<string>): ParticolareCatalogo | undefined {
  return candidati.find((p) => preferiti.has(p.id)) ?? candidati[0];
}

export function posizioniParticolari(catalogo: ParticolareCatalogo[], sorgenti: SorgentePosizioni[]): RisultatoPosizioni {
  const indice = indicePerCodice(catalogo);
  const marcatori: MarcatoreParticolare[] = [];
  const senza = new Map<string, { codiceOBO: string; tipoComponente: string; quantita: number }>();

  for (const s of sorgenti) {
    const preferiti = new Set<string>();
    for (const d of s.distinte ?? []) for (const v of d ?? []) if (v.riferimento) preferiti.add(v.riferimento);

    const gruppi: [string, ComponentePosizionato[] | undefined][] = [
      ["supporto", s.supporti], ["morsetto", s.morsetti], ["compensatore", s.compensatori],
      ["picchetto", s.picchetti], ["asta", s.aste],
    ];
    for (const [tipoDefault, lista] of gruppi) {
      for (const c of lista ?? []) {
        const codice = (c.codiceOBO ?? "").trim();
        if (!codice || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
        const tipo = c.tipo || tipoDefault;
        const p = scegliParticolare(indice.get(codice) ?? [], preferiti);
        if (!p) {
          const k = `${codice}|${tipo}`;
          const v = senza.get(k) ?? { codiceOBO: codice, tipoComponente: tipo, quantita: 0 };
          v.quantita++;
          senza.set(k, v);
          continue;
        }
        const z = Number.isFinite(c.z) ? (c.z as number) : 0;
        const vicino = marcatori.find((m) => m.idParticolare === p.id && m.origine === s.origine &&
          Math.abs(m.x - c.x) <= TOLLERANZA && Math.abs(m.y - c.y) <= TOLLERANZA && Math.abs(m.z - z) <= TOLLERANZA);
        if (vicino) { vicino.quantita++; continue; }
        marcatori.push({ idParticolare: p.id, nomeParticolare: p.nome, categoria: p.categoria, codiceOBO: codice, tipoComponente: tipo, x: c.x, y: c.y, z, quantita: 1, origine: s.origine });
      }
    }
  }

  const usatiMap = new Map<string, { idParticolare: string; nome: string; punti: number; origini: OriginePosizione[] }>();
  for (const m of marcatori) {
    const u = usatiMap.get(m.idParticolare) ?? { idParticolare: m.idParticolare, nome: m.nomeParticolare, punti: 0, origini: [] };
    u.punti++;
    if (!u.origini.includes(m.origine)) u.origini.push(m.origine);
    usatiMap.set(m.idParticolare, u);
  }
  return {
    marcatori,
    usati: [...usatiMap.values()].sort((a, b) => a.idParticolare.localeCompare(b.idParticolare)),
    senzaParticolare: [...senza.values()].sort((a, b) => a.codiceOBO.localeCompare(b.codiceOBO)),
  };
}

/** Prefisso breve per le etichette: "OBO-TBS-200-T5.04" → "T5.04". */
export function etichettaParticolare(id: string): string {
  const m = /T\d+\.\d+\w*$/.exec(id);
  return m ? m[0] : id;
}
