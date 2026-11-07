// Catalogo prodotti OBO per l'app LPS: legge le pagine pubbliche delle categorie indicate
// (protezione esterna, protezione da sovratensioni, equipotenzialità e messa a terra) e salva
// public/dati/obo-prodotti.json con dati tecnici, varianti e collegamenti a foto, disegni 2D,
// schede tecniche e file 3D (che restano sul sito OBO: qui si salvano solo gli indirizzi).
// Rispetta robots.txt, una richiesta per volta con pausa. Uso: node scripts/catalogo-obo.mjs
import { writeFile, mkdir } from "node:fs/promises";

const BASE = "https://www.obo-bettermann.com";
const LINGUA = "en-xi";
const RADICI = ["external-lightning-protection", "surge-protection", "equipotential-bonding-and-earthing"];
const PAUSA_MS = Number(process.env.PAUSA_MS ?? 1200);
const MAX_PAGINE = Number(process.env.MAX_PAGINE ?? 5000);
const USCITA = process.env.USCITA ?? "public/dati/obo-prodotti.json";

const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
let richieste = 0;
async function scarica(percorso) {
  if (richieste >= MAX_PAGINE) throw new Error("Limite di pagine raggiunto");
  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    richieste++;
    await attesa(PAUSA_MS);
    try {
      const r = await fetch(BASE + percorso, { headers: { "User-Agent": "LPS-catalogo/1.0 (progettazione LPS, uso tecnico)", "Accept-Language": "en" } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      console.warn(`  ${percorso}: ${e.message} (tentativo ${tentativo})`);
      await attesa(3000 * tentativo);
    }
  }
  return null;
}

// ---------- funzioni di lettura (pure, testabili) ----------
export const testo = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();
const senzaQuery = (u) => u.replace(/\\+$/, "").split("?")[0];
const unici = (a) => [...new Set(a)];

/** Link alle sottocategorie sotto un prefisso, es. /en-xi/products/surge-protection/… */
export function linkCategorie(html, prefisso) {
  const re = new RegExp(`href="(?:${BASE.replace(/\./g, "\\.")})?(${prefisso.replace(/[-/]/g, (c) => "\\" + c)}/[a-z0-9-]+(?:/[a-z0-9-]+)*)"`, "g");
  return unici([...html.matchAll(re)].map((m) => m[1]));
}

/** Link alle pagine prodotto (terminano con il codice a 7 cifre). */
export function linkProdotti(html) {
  return unici([...html.matchAll(/href="(?:https:\/\/www\.obo-bettermann\.com)?(\/[a-z]{2}-[a-z]{2}\/products\/[a-z0-9-]+-(\d{7})\.html)"/g)].map((m) => m[1]));
}

function sezione(html, id) {
  const i = html.indexOf(`id="${id}"`);
  if (i < 0) return "";
  const resto = html.slice(i + id.length + 5);
  const j = resto.search(/id="product-[a-z-]+"/);
  return j > 0 ? html.slice(i, i + id.length + 5 + j) : html.slice(i, i + 200000);
}

/** Dati di una pagina prodotto. */
export function leggiProdotto(html, url) {
  const codice = (/-(\d{7})\.html$/.exec(url) ?? [])[1] ?? null;
  const nome = testo((/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html) ?? [])[1] ?? "");
  const descr = sezione(html, "product-description");
  const datiTecnici = {};
  for (const m of descr.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g)) {
    const k = testo(m[1]), v = testo(m[2]);
    if (k && v && !(k in datiTecnici)) datiTecnici[k] = v;
  }
  const master = unici([...html.matchAll(/https:\/\/www\.obo-bettermann\.com\/out\/pictures\/master\/product\/(\d+)\/([^"'\s<>]+)/g)].map((m) => senzaQuery(m[0])));
  const foto = master.filter((u) => /\/product\/1\//.test(u) && codice && u.includes(codice));
  const disegni = master.filter((u) => /\/product\/[2-9]\//.test(u) && codice && u.includes(codice) && /\.(jpe?g|png|gif|svg)$/i.test(u));
  const stp = master.filter((u) => /\.(stp|step)$/i.test(u));
  const rfa = master.filter((u) => /\.rfa$/i.test(u));
  const cad = master.filter((u) => /\.(dwg|dxf)$/i.test(u));
  const schede = unici([...html.matchAll(/(?:https:\/\/www\.obo-bettermann\.com)?(\/datasheet\/[a-z]{2}-[a-z]{2}\/(\d{7})\/[^"'\s<>\\]+\.pdf)/g)].map((m) => BASE + senzaQuery(m[1])))
    .map((url) => ({ codice: (/\/(\d{7})\//.exec(url) ?? [])[1], url }));
  const documenti = unici([...html.matchAll(/https:\/\/www\.obo-bettermann\.com\/out\/media\/[^"'\s<>]+\.pdf/g)].map((m) => senzaQuery(m[0]))).filter((u) => codice && u.includes(codice));
  const varianti = leggiVarianti(sezione(html, "product-variants"));
  for (const v of varianti) v.scheda = schede.find((s) => s.codice === v.codice)?.url ?? null;
  return {
    codice, nome, url: BASE + url,
    datiTecnici,
    foto: foto[0] ?? null,
    disegno2d: disegni[0] ?? null,
    scheda: schede.find((s) => s.codice === codice)?.url ?? null,
    documenti,
    file3d: { stp: stp.find((u) => codice && u.includes(codice)) ?? stp[0] ?? null, rfa: rfa[0] ?? null, cad: cad.filter((u) => codice && u.includes(codice)) },
    varianti,
  };
}

/** Righe della tabella varianti: testo delle colonne e codice articolo. */
export function leggiVarianti(sez) {
  if (!sez) return [];
  const intestazioni = [];
  const righe = [];
  const blocchi = sez.split(/<div class="row flex w-full/).slice(1);
  for (const b of blocchi) {
    const celle = [...b.matchAll(/<div class="[^"]*text-sm[^"]*"[^>]*>([^<]*)<\/div>/g)].map((m) => testo(m[1])).filter(Boolean);
    const codice = celle.find((c) => /^\d{7}$/.test(c));
    if (codice) righe.push({ codice, tipo: celle[0] ?? "", valori: celle.filter((c) => c !== codice) });
    else if (!righe.length && celle.length) intestazioni.push(...celle);
  }
  const visti = new Set();
  return righe.filter((r) => !visti.has(r.codice) && visti.add(r.codice)).map((r) => ({ ...r, colonne: intestazioni.length ? intestazioni : undefined }));
}

// ---------- giro completo ----------
async function principale() {
  const prodotti = new Map(); // url → categorie
  for (const radice of RADICI) {
    const prefisso = `/${LINGUA}/products/${radice}`;
    const coda = [prefisso];
    const viste = new Set(coda);
    while (coda.length) {
      const pagina = coda.shift();
      const html = await scarica(pagina);
      if (!html) continue;
      const percorso = pagina.slice(`/${LINGUA}/products/`.length).split("/");
      for (const c of linkCategorie(html, prefisso)) if (!viste.has(c)) { viste.add(c); coda.push(c); }
      for (const p of linkProdotti(html)) if (!prodotti.has(p)) prodotti.set(p, percorso);
      console.log(`categoria ${pagina} · prodotti trovati finora ${prodotti.size}`);
    }
  }
  const catalogo = [];
  let n = 0;
  for (const [url, categorie] of prodotti) {
    n++;
    const html = await scarica(url);
    if (!html) continue;
    const p = leggiProdotto(html, url);
    catalogo.push({ ...p, categorie });
    if (n % 20 === 0) console.log(`prodotti letti ${n}/${prodotti.size}`);
  }
  catalogo.sort((a, b) => (a.categorie.join("/") + a.nome).localeCompare(b.categorie.join("/") + b.nome));
  const varianti = catalogo.reduce((t, p) => t + Math.max(1, p.varianti.length), 0);
  await mkdir(USCITA.replace(/\/[^/]+$/, ""), { recursive: true });
  await writeFile(USCITA, JSON.stringify({ fonte: `${BASE}/${LINGUA}/products`, categorie: RADICI, aggiornato: new Date().toISOString().slice(0, 10), prodotti: catalogo.length, articoli: varianti, catalogo }, null, 1));
  console.log(`Salvati ${catalogo.length} prodotti (${varianti} articoli) in ${USCITA} con ${richieste} richieste.`);
}

if (import.meta.url === `file://${process.argv[1]}`) principale().catch((e) => { console.error(e); process.exit(1); });
