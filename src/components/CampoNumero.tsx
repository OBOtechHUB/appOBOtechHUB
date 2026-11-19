/**
 * Campo numerico che accetta la virgola e gli stati intermedi ("0," "1,2") senza perdere i caratteri:
 * il testo resta come scritto, il valore numerico si comunica solo quando è valido.
 */
import { useEffect, useState, type InputHTMLAttributes } from "react";

const testoDi = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));
export function analizzaNumero(t: string): number | null | undefined {
  const s = t.trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  if (!/^\d*\.?\d*$/.test(s) || s === ".") return undefined;
  const v = Number(s); return Number.isFinite(v) ? v : undefined;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & { valore: number | null | undefined; onValore: (v: number | null) => void; min?: number; max?: number };
export function CampoNumero({ valore, onValore, min, max, inputMode = "decimal", ...resto }: Props) {
  const [testo, setTesto] = useState(testoDi(valore));
  // se il valore cambia da fuori (altro campo, sincronizzazione) si aggiorna il testo
  useEffect(() => { if (analizzaNumero(testo) !== (valore ?? null)) setTesto(testoDi(valore)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [valore]);
  return <input {...resto} inputMode={inputMode} value={testo} onChange={(e) => {
    const t = e.target.value; const v = analizzaNumero(t);
    if (v === undefined) return; // carattere non valido: ignorato
    setTesto(t);
    if (v === null || ((min == null || v >= min) && (max == null || v <= max))) onValore(v);
  }} />;
}
