// Copia in public/wasm i file WebAssembly delle librerie che li caricano per URL (lettore DWG LibreDWG).
// Si esegue prima della build: i file non stanno nel repository.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
const sorgente = "node_modules/@mlightcad/libredwg-web/wasm";
const dest = "public/wasm";
mkdirSync(dest, { recursive: true });
if (!existsSync(sorgente)) console.warn("copia-wasm: libredwg-web non installato, salto");
else for (const f of readdirSync(sorgente)) if (f.endsWith(".wasm")) { copyFileSync(join(sorgente, f), join(dest, f)); console.log("copia-wasm:", f); }

// web-ifc: il .wasm deve essere della stessa versione della libreria installata (importazione IFC)
const ifc = "node_modules/web-ifc/web-ifc.wasm";
if (existsSync(ifc)) { copyFileSync(ifc, join(dest, "web-ifc.wasm")); console.log("copia-wasm: web-ifc.wasm"); }
