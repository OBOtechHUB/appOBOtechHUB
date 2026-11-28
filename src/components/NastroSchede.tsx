/**
 * Schede che scorrono di lato (come Torrette e Zavorra WRR di OBO Hub): una scheda colorata per passo, barra dei passi
 * in alto e barra fissa in basso con Indietro, l'esito del calcolo e Avanti. Dentro la scheda aperta si scorre in verticale;
 * le schede chiuse si vedono di lato e non allungano la pagina.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface Scheda { id: string; nome: string; titolo: string; aiuto?: string; contenuto: ReactNode }

export function NastroSchede({ schede, esito }: { schede: Scheda[]; esito?: ReactNode }) {
  const [passo, setPasso] = useState(0);
  const nastro = useRef<HTMLDivElement>(null), passi = useRef<HTMLOListElement>(null), daNastro = useRef(false), fermo = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const primo = useRef(true);
  useEffect(() => {
    const n = nastro.current, c = n?.children[passo] as HTMLElement | undefined;
    if (!n || !c) return;
    if (daNastro.current) { daNastro.current = false; return; }
    const ridotto = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    n.scrollTo({ left: c.offsetLeft - (n.clientWidth - c.offsetWidth) / 2, behavior: ridotto || primo.current ? "auto" : "smooth" });
    if (!primo.current) { const t = passi.current?.getBoundingClientRect().top ?? 0; if (t < 0) passi.current?.scrollIntoView({ block: "start", behavior: ridotto ? "auto" : "smooth" }); }
    primo.current = false;
  }, [passo]);
  const alScorrere = () => {
    clearTimeout(fermo.current);
    fermo.current = setTimeout(() => {
      const n = nastro.current; if (!n) return;
      const centro = n.scrollLeft + n.clientWidth / 2; let meglio = 0, d = Infinity;
      Array.from(n.children).forEach((c, i) => { const el = c as HTMLElement, x = Math.abs(el.offsetLeft + el.offsetWidth / 2 - centro); if (x < d) { d = x; meglio = i; } });
      if (meglio !== passo) { daNastro.current = true; setPasso(meglio); }
    }, 90);
  };
  const ultimo = passo === schede.length - 1;
  return (
    <div className="nastro-schede">
      <ol ref={passi} className="ns-passi" aria-label="Passi">
        {schede.map((s, i) => <li key={s.id} className={i === passo ? "ora" : i < passo ? "fatto" : ""}>
          <button type="button" onClick={() => setPasso(i)} aria-current={i === passo ? "step" : undefined}><span>{i + 1}</span><em>{s.nome}</em></button>
        </li>)}
      </ol>
      <div ref={nastro} className="ns-nastro" onScroll={alScorrere}>
        {schede.map((s, i) => (
          <section key={s.id} className={`ns-carta c${i % 6}${i === passo ? " ora" : ""}`} aria-label={s.titolo} onClickCapture={(e) => { if (i !== passo) { e.preventDefault(); e.stopPropagation(); setPasso(i); } }}>
            <p className="ns-n">Passo {i + 1} di {schede.length}</p>
            <h2 className="ns-titolo">{s.titolo}</h2>
            {s.aiuto && <p className="ns-aiuto">{s.aiuto}</p>}
            <div aria-hidden={i !== passo ? true : undefined}>{s.contenuto}</div>
          </section>
        ))}
      </div>
      <div className="ns-piede"><div className="ns-piede-riga">
        <button type="button" className="ns-btn" disabled={passo === 0} onClick={() => setPasso(passo - 1)}>← Indietro</button>
        <span className="ns-esito" aria-live="polite">{esito}</span>
        <button type="button" className="ns-btn primario" onClick={() => setPasso(ultimo ? 0 : passo + 1)}>{ultimo ? "Torna all'inizio" : <>Avanti<span className="ns-dove">: {schede[passo + 1]!.nome}</span> →</>}</button>
      </div></div>
    </div>
  );
}
