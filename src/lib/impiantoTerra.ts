import type { PropostaTerra } from "@/calcoli/terra/proponiTerra";
import type { ConduttoreCAD, PicchettoCAD } from "@/calcoli/cad/esportaCAD";
import type { Punto2, Conduttore } from "@/calcoli/edificio/tipi";
import { estesoSchema, terraSchema, type StatoEsteso } from "./statoProgetto";

export type ConfigurazioneTerra = Omit<NonNullable<StatoEsteso["terra"]>, "distinta">;
export const terraDefault: ConfigurazioneTerra = { tipo: "B", distanzaAnello: 1, profondita: 0.7, lunghezzaPicchetto: 3, latoMagliaFondazione: 20, picchettiSuAnello: false, l1: null };

export function piediCalate(s: StatoEsteso): Punto2[] {
  return s.conduttori.filter((c) => c.tipo === "calata").flatMap((c) => {
    const piede = c.punti.reduce<typeof c.punti[number] | undefined>((min, p) => !min || p[2] < min[2] ? p : min, undefined);
    return piede ? [[piede[0], piede[1]] as Punto2] : [];
  });
}

/** Adapter only: no domain calculations, preserves all non-grounding project data. */
export function accettaTerra(s: StatoEsteso, p: PropostaTerra, config: ConfigurazioneTerra): StatoEsteso {
  const terra = terraSchema.parse({ ...config, distinta: p.distinta });
  const conduttori: Conduttore[] = p.conduttori.map((v) => ({ id: crypto.randomUUID(), tipo: "terra", sottotipo: v.tipo as Conduttore["sottotipo"], punti: v.punti, materiale: v.materiale ?? "", sezione: v.sezione == null ? "" : String(v.sezione), codiceOBO: v.codiceOBO ?? "", origine: "proposta-terra" }));
  return estesoSchema.parse({ ...s, conduttori: [...s.conduttori.filter((c) => c.tipo !== "terra"), ...conduttori], picchetti: p.picchetti.map((v) => ({ id: v.id || crypto.randomUUID(), x: v.x, y: v.y, z: v.z ?? 0, lunghezza: v.lunghezza, ...(v.diametro === undefined ? {} : { diametro: v.diametro }), codiceOBO: v.codiceOBO ?? "" })), terra });
}

export function rimuoviTerra(s: StatoEsteso): StatoEsteso {
  return { ...s, conduttori: s.conduttori.filter((c) => c.tipo !== "terra"), picchetti: [], terra: null };
}

export function datiTerraCAD(s: StatoEsteso): { conduttori: ConduttoreCAD[]; picchetti: PicchettoCAD[] } {
  return { conduttori: s.conduttori.map((v) => ({ tipo: v.sottotipo ?? v.tipo, punti: v.punti, materiale: v.materiale, ...(Number(v.sezione) ? { sezione: Number(v.sezione) } : {}), codiceOBO: v.codiceOBO })), picchetti: s.picchetti.map((v) => ({ ...v })) };
}