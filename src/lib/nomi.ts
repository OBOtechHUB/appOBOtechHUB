/**
 * Nomi delle persone in tutta l'app: COGNOME tutto maiuscolo, Nome con solo l'iniziale maiuscola
 * ("marco lo vetere" → "Marco LO VETERE"). Cambia solo come il nome si vede: i dati salvati restano com'erano.
 * Il cognome si riconosce: 1) dall'email nella forma cognome.nome@…; 2) dalle parole già tutte maiuscole;
 * 3) altrimenti la prima parola è il nome e il resto il cognome. Stessa regola di OBO Hub (comune/nomi.js).
 */
const base = (w: string) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const cap = (w: string) => w.toLocaleLowerCase("it-IT").replace(/(^|[-'’])([^-'’])/g, (_m, a: string, b: string) => a + b.toLocaleUpperCase("it-IT"));
const up = (w: string) => w.toLocaleUpperCase("it-IT");
const maiuscola = (w: string) => w.length > 1 && /\p{L}/u.test(w) && w === up(w) && w !== w.toLocaleLowerCase("it-IT");

const TITOLO = /^(ing|arch|geom|dott|dott\.?ssa|dr|p\.?\s?i|per\.?\s?ind|avv|prof|sig|sig\.?ra|ing\.?\s?jr)\.?$/i;
export function formattaNome(s: string | null | undefined, email?: string | null): string {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  if (!t || t.includes("@")) return t;
  // titoli davanti al nome (Ing., Arch., Geom., Dott., P.I.…) restano come sono scritti
  const tutte = t.split(" ");
  let ti = 0; while (ti < tutte.length - 1 && TITOLO.test(tutte[ti]!)) ti++;
  if (ti) return `${tutte.slice(0, ti).join(" ")} ${formattaNome(tutte.slice(ti).join(" "), email)}`;
  const p = tutte, n = p.length;
  if (n === 1) return cap(p[0]!);
  let cog: { da: number; a: number } | null = null;
  const em = String(email ?? "").split("@")[0] ?? "";
  if (em.indexOf(".") > 0) {
    const c = base(em.split(".")[0]!);
    for (let k = 1; k < n && !cog; k++) if (base(p.slice(k).join("")) === c) cog = { da: k, a: n };
    for (let k = n - 1; k >= 1 && !cog; k--) if (base(p.slice(0, k).join("")) === c) cog = { da: 0, a: k };
  }
  if (!cog) {
    const mm = p.map(maiuscola), quante = mm.filter(Boolean).length;
    if (quante > 0 && quante < n) {
      let k = 0; while (k < n && mm[k]) k++;
      if (k > 0 && mm.slice(k).every((x) => !x)) cog = { da: 0, a: k };
      let j = n; while (j > 0 && mm[j - 1]) j--;
      if (!cog && j < n && mm.slice(0, j).every((x) => !x)) cog = { da: j, a: n };
    }
  }
  const c = cog ?? { da: 1, a: n };
  return p.map((w, i) => (i >= c.da && i < c.a ? up(w) : cap(w))).join(" ");
}

/** Solo il nome proprio (per i saluti). */
export function soloNome(s: string | null | undefined, email?: string | null): string {
  const f = formattaNome(s, email);
  if (!f || f.includes("@")) return f;
  const p = f.split(" "), r = p.filter((w) => !maiuscola(w) || w.length === 1);
  return (r.length ? r : p.slice(0, 1).map(cap)).join(" ");
}
