// Elenco delle librerie usate dall'app con la loro licenza (public/licenze.json), creato a ogni build
// dai package.json in node_modules: la pagina Licenze lo mostra sempre aggiornato.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const out = [];
for (const nome of Object.keys(pkg.dependencies ?? {}).sort()) {
  const f = `node_modules/${nome}/package.json`;
  if (!existsSync(f)) { out.push({ nome, versione: "", licenza: "non rilevata", sito: "" }); continue; }
  const p = JSON.parse(readFileSync(f, "utf8"));
  const lic = typeof p.license === "string" ? p.license : p.license?.type ?? (Array.isArray(p.licenses) ? p.licenses.map((l) => l.type ?? l).join(" OR ") : "non indicata");
  const repo = typeof p.repository === "string" ? p.repository : p.repository?.url ?? "";
  const sito = (p.homepage || repo || `https://www.npmjs.com/package/${nome}`).replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");
  out.push({ nome, versione: p.version ?? "", licenza: lic, sito });
}
writeFileSync("public/licenze.json", JSON.stringify({ creato: new Date().toISOString(), librerie: out }, null, 1));
console.log(`licenze: ${out.length} librerie`);
