> [!IMPORTANT]
> Questo progetto NON è più collegato a Lovable. È un'app solo browser (Vite + TanStack Router)
> pubblicata su GitHub Pages da `.github/workflows/pubblica.yml`; dati e accesso su Supabase (RLS).
> Non esistono funzioni server: ogni accesso ai dati passa dal client Supabase ed è protetto dalle regole RLS.
> I percorsi dei file in `public/` vanno costruiti con `risorsa()` di `src/lib/base.ts` (l'app vive sotto `/Lighting/`).

- Keep domain calculations pure under `src/calcoli/` and coefficient/catalog data under `src/dati/`; page components stay in `src/pages/` with TanStack route wrappers so calculation tests do not depend on UI.
- Persist building and material state through the existing external-store pattern with separate version-compatible localStorage keys; validate restored material data to prevent invalid takeoff inputs.
- Material calculations consume explicit optional module-result contracts; absent modules remain missing rather than inferred from building geometry, to avoid presenting unperformed engineering as completed.
- Load SheetJS and jsPDF dynamically in import/export actions and prepare downloadable blobs before the final download click, keeping SSR safe and browser download activation reliable.
- Use owner-RLS Supabase client calls for projects (src/lib/progetti.functions.ts); bind autosave jobs to captured project identity and keep active Cloud snapshots out of shared localStorage to prevent cross-session data mixing.
- Load Three, Leaflet and import engines only after hydration; run pure rolling-sphere calculations in a cancellable browser worker and clearly distinguish height-map limitations from full LPS compliance.
- Serve IFC WASM from public/wasm by URL in browser import actions, never import binaries from source, to keep the server deployment bundle compatible.
- Persist personal catalogs and construction details in owner-scoped Cloud libraries; keep their project snapshot copies versioned for reproducible exports.
- Grounding UI uses a dedicated section and state/CAD adapters in `src/lib/impiantoTerra.ts`; optional grounding snapshot fields default safely for older projects, keeping the protected engineering engines unchanged.
- Open OBO detail sheets through the shared SchedaParticolare dialog and RiferimentoParticolare trigger, reusing schedeParticolari PDF resolution and posizioni labels so tables keep their current proposal state.
- Every change users will notice gets a new entry at the top of `public/novita.json` (id `AAAA-MM-GG-lps-N`, data, titolo, voci, titolo_en, voci_en), in plain Italian for colleagues: it is shown in the "Aggiorna app" bar, in the one-time "Novità" box and on https://obotechhub.github.io/novita.html, where the text to send to users is generated. Internal-only changes (tests, refactoring) get no entry.
- After every change, also update the project recap `claude/recap-obo-hub.md` in the claude.ai Project "OBOtechHUB" (what the apps do, what changed, what is pending): the owner asked for it to be always current.
