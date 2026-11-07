<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep domain calculations pure under `src/calcoli/` and coefficient/catalog data under `src/dati/`; page components stay in `src/pages/` with TanStack route wrappers so calculation tests do not depend on UI.
- Persist building and material state through the existing external-store pattern with separate version-compatible localStorage keys; validate restored material data to prevent invalid takeoff inputs.
- Material calculations consume explicit optional module-result contracts; absent modules remain missing rather than inferred from building geometry, to avoid presenting unperformed engineering as completed.
- Load SheetJS and jsPDF dynamically in import/export actions and prepare downloadable blobs before the final download click, keeping SSR safe and browser download activation reliable.
- Use owner-RLS authenticated server functions for projects; bind autosave jobs to captured project identity and keep active Cloud snapshots out of shared localStorage to prevent cross-session data mixing.
- Load Three, Leaflet and import engines only after hydration; run pure rolling-sphere calculations in a cancellable browser worker and clearly distinguish height-map limitations from full LPS compliance.
- Serve IFC WASM from public/wasm by URL in browser import actions, never import binaries from source, to keep the server deployment bundle compatible.
- Persist personal catalogs and construction details in owner-scoped Cloud libraries; keep their project snapshot copies versioned for reproducible exports.
- Grounding UI uses a dedicated section and state/CAD adapters in `src/lib/impiantoTerra.ts`; optional grounding snapshot fields default safely for older projects, keeping the protected engineering engines unchanged.
- Open OBO detail sheets through the shared SchedaParticolare dialog and RiferimentoParticolare trigger, reusing schedeParticolari PDF resolution and posizioni labels so tables keep their current proposal state.
