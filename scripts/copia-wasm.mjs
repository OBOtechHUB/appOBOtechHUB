// Copia in public/wasm i file WebAssembly delle librerie che li caricano per URL (lettore DWG LibreDWG).
// Si esegue prima della build: i file non stanno nel repository.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
const sorgente = "node_modules/@mlightcad/libredwg-web/wasm";
const dest = "public/wasm";
if (!existsSync(sorgente)) { console.warn("copia-wasm: libredwg-web non installato, salto"); process.exit(0); }
mkdirSync(dest, { recursive: true });
for (const f of readdirSync(sorgente)) if (f.endsWith(".wasm")) { copyFileSync(join(sorgente, f), join(dest, f)); console.log("copia-wasm:", f); }
