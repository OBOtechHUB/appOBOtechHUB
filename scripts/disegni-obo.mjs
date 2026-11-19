// Disegni 2D ufficiali dei prodotti OBO (immagini pubbliche "MZ" di obo-bettermann.com) per i blocchi
// dell'editor dei tipologici: il sito OBO non consente all'app di leggerli direttamente (CORS), quindi
// se ne tiene una copia in public/obo-disegni/<codice>.jpg con l'indice public/obo-disegni/indice.json.
// Solo protezione esterna ed equipotenzialità/terra. Non cancella mai file già scaricati.
// Rispetta robots.txt (solo /out/pictures/), una richiesta per volta con pausa. Uso: node scripts/disegni-obo.mjs
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";

const CATALOGO = process.env.CATALOGO ?? "public/dati/obo-prodotti.json";
const CARTELLA = process.env.CARTELLA ?? "public/obo-disegni";
const CATEGORIE = ["external-lightning-protection", "equipotential-bonding-and-earthing"];
const PAUSA_MS = Number(process.env.PAUSA_MS ?? 1200);
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));

/** Larghezza e altezza di un JPEG (marcatore SOF) o PNG. */
export function dimensioni(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  return null;
}

async function esiste(p) { try { await stat(p); return true; } catch { return false; } }

async function main() {
  const cat = JSON.parse(await readFile(CATALOGO, "utf8"));
  await mkdir(CARTELLA, { recursive: true });
  const fileIndice = `${CARTELLA}/indice.json`;
  const indice = (await esiste(fileIndice)) ? JSON.parse(await readFile(fileIndice, "utf8")) : { nota: "", disegni: {}, codici: {} };
  indice.nota = "Disegni 2D pubblici dei prodotti OBO (obo-bettermann.com), copia per l'editor dei tipologici. disegni: file → dimensioni; codici: codice articolo → file.";
  let nuovi = 0, errori = 0;
  for (const p of cat.catalogo) {
    if (!p.disegno2d || !(p.categorie ?? []).some((c) => CATEGORIE.includes(c))) continue;
    const url = String(p.disegno2d);
    if (!/^https:\/\/www\.obo-bettermann\.com\/out\/pictures\//.test(url)) continue;
    const file = `${p.codice}.jpg`, percorso = `${CARTELLA}/${file}`;
    if (!(await esiste(percorso))) {
      await attesa(PAUSA_MS);
      try {
        const r = await fetch(url, { headers: { "User-Agent": "LPS-disegni/1.0 (progettazione LPS, uso tecnico)" } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const b = Buffer.from(await r.arrayBuffer());
        if (b.length < 500 || b.length > 3_000_000) throw new Error(`dimensione ${b.length}`);
        await writeFile(percorso, b); nuovi++;
      } catch (e) { console.warn(`  ${p.codice}: ${e.message}`); errori++; continue; }
    }
    if (!indice.disegni[file]) { const d = dimensioni(await readFile(percorso)); if (d) indice.disegni[file] = d; }
    for (const c of [p.codice, ...(p.varianti ?? []).map((v) => v.codice)]) if (c && !indice.codici[c]) indice.codici[c] = file;
  }
  await writeFile(fileIndice, JSON.stringify(indice, null, 1));
  console.log(`Disegni nuovi: ${nuovi}, errori: ${errori}, totale: ${Object.keys(indice.disegni).length}, codici: ${Object.keys(indice.codici).length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
