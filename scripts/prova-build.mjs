// Prova della build PRIMA della pubblicazione (pubblica.yml e prova-ramo.yml).
// Serve la cartella dist sotto il percorso dell'app, apre le pagine principali in Chromium e si ferma
// se ci sono errori JavaScript o file della build mancanti. Le chiamate esterne (Supabase, mappe…) sono bloccate:
// si controlla solo che il codice pubblicato si avvii.
// Uso: PW_DIR=<cartella con node_modules/playwright> VITE_BASE=/appOBOtechHUB/ node scripts/prova-build.mjs
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";

const DIST = resolve("dist");
const BASE = (process.env.VITE_BASE || "/").replace(/\/?$/, "/");
const req = createRequire(join(resolve(process.env.PW_DIR || "."), "x.js"));
const { chromium } = req("playwright");

const TIPI = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".wasm": "application/wasm", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const server = createServer((rq, rs) => {
  let p = decodeURIComponent(new URL(rq.url, "http://x").pathname);
  if (!p.startsWith(BASE)) { rs.writeHead(404); rs.end(); return; }
  let f = join(DIST, p.slice(BASE.length));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  // rotte dell'app (come GitHub Pages con 404.html): pagina principale
  if (!existsSync(f)) { if (extname(p)) { rs.writeHead(404); rs.end(); return; } f = join(DIST, "index.html"); }
  rs.writeHead(200, { "content-type": TIPI[extname(f)] || "application/octet-stream" }); rs.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGINE = `http://127.0.0.1:${server.address().port}`;
const PAGINE = ["", "dati-edificio", "edificio-3d", "rischio", "calate", "computo-materiali", "antenne", "palo", "vento", "download-cad", "progetti"];
const problemi = [];
const b = await chromium.launch();
for (const pg of PAGINE) {
  const ctx = await b.newContext({ serviceWorkers: "block" });
  const p = await ctx.newPage();
  const errori = [];
  await p.route("**/*", (r) => (r.request().url().startsWith(ORIGINE) ? r.continue() : r.abort()));
  p.on("pageerror", (e) => errori.push("errore JavaScript: " + e.message));
  p.on("response", (r) => { if (r.url().startsWith(ORIGINE) && r.status() === 404 && !/favicon|version\.json|novita\.json/.test(r.url())) errori.push("file mancante: " + r.url().slice(ORIGINE.length)); });
  try {
    await p.goto(`${ORIGINE}${BASE}${pg}?nofx`, { waitUntil: "load", timeout: 45000 });
    await p.waitForSelector("#root > *", { timeout: 20000 });
    await p.waitForTimeout(1500);
  } catch (e) { errori.push("la pagina non si apre: " + e.message.split("\n")[0]); }
  const veri = [...new Set(errori)].filter((e) => !/Failed to fetch|NetworkError|ERR_FAILED|net::|Load failed|supabase/i.test(e));
  if (veri.length) problemi.push(`/${pg}: ${veri.slice(0, 4).join(" · ")}`); else console.log(`ok  /${pg}`);
  await ctx.close();
}
await b.close(); server.close();
if (problemi.length) { console.error(`\n${problemi.length} pagine con problemi: la pubblicazione si ferma.\n- ` + problemi.join("\n- ")); process.exit(1); }
console.log("\nBuild provata: tutte le pagine si avviano.");
