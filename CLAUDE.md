# Progettazione LPS – istruzioni per Claude (leggere prima di ogni modifica)

App di progettazione della protezione contro i fulmini (CEI EN IEC 62305:2026-10 e Guida CEI 81-29) di OBO Hub. Vite + React + TanStack Router, solo browser, dati su Supabase (RLS). Proprietario: Marco Lo Vetere (OBO Italia). Rispondere sempre in **italiano**, in modo semplice. Vedi anche `AGENTS.md` (convenzioni del codice).

## Regole che non si discutono (Marco)
- **Non cancellare mai nulla**: né dati, né accessi, né registri, né storici, né revisioni. Si integra, non si toglie. Negli SQL niente `delete`/`drop`/`truncate` su dati degli utenti.
- L'admin non modifica né cancella i progetti degli utenti.
- **Mai chiavi segrete** (`sb_secret…`) né password nel repository; solo la chiave pubblica.
- **Mai nel repository**: PDF delle norme (stanno solo nel progetto claude.ai e nello scratchpad), PDF/DWG OBO riservati, dati dei clienti. Non copiare testo o figure delle norme: solo valori, verifiche e riferimenti, con parole nostre. Il certificato TNE NG/NSG non si riproduce. Niente video o foto di terzi. I disegni 2D OBO si possono copiare.
- "Integra sempre su app": ogni calcolo o foglio fatto a parte va messo anche nell'app.

## Come si lavora e si pubblica
- Lavorare su un **ramo**, push, attendere il controllo `prova-ramo.yml` (test, tipi, build, prova della build nel browser): `gh run list -R OBOtechHUB/appOBOtechHUB -b <ramo>`. Solo se è verde: `git checkout main && git merge --ff-only <ramo> && git push`.
- `pubblica.yml` (su main) ripete test, controllo dei tipi, build e `scripts/prova-build.mjs` (apre le pagine principali della build in Chromium con le chiamate esterne bloccate): se qualcosa fallisce non pubblica.
- Test in locale: `bun test` sui file di `src/calcoli/…` (alcuni usano librerie disponibili solo in CI).
- Percorsi dei file di `public/` sempre con `risorsa()` di `src/lib/base.ts`.

## Database (Supabase, progetto `qzfosidvjsyivaibnadf`)
- Le modifiche sono file `supabase/<nome>.sql` che **Marco esegue a mano** nel SQL Editor: mandargli sempre il file, idempotente, con controllo finale. Numerarli nel recap (oggi fino a SQL 20).
- Provare ogni SQL su Postgres locale **con `set role authenticated`** e l'utente simulato, non da superutente (guasto del 25/11: policy con subquery su una tabella revocata agli utenti; risolto con funzione security definer).

## Versioni CAD e istruzioni
- Ad ogni modifica di `public/cad/LPS.lsp` o delle istruzioni: aggiornare `src/calcoli/cad/versioni.ts` (`LSP_VERSIONE`, `ISTRUZIONI` rev/data), rigenerare i documenti e copiarli in `public/istruzioni/`. LPS.lsp è in latin-1.

## Specifiche di calcolo
- Ad ogni modifica che cambia i risultati di un progetto già salvato (regole di calcolo, valori di norma, codici in distinta): aggiungere una voce in fondo a `src/calcoli/progetto/specifiche.ts`. All'apertura di un progetto più vecchio l'app chiede se ricalcolarlo (`AvvisoSpecifiche.tsx`). I codici OBO vanno prima controllati sul catalogo obo.it (`prodotti/dati/prodotti.json` del repo hub).

## Novità e recap
- Nuova voce in cima a `public/novita.json` (id `AAAA-MM-GG-lps-N`) solo per modifiche che gli utenti notano. **Niente novità per modifiche solo grafiche** (eventualmente in `grafica_non_mostrata`) né per Amministrazione, visitatori o funzioni solo admin.
- Dopo ogni modifica aggiornare il recap `claude/recap-obo-hub.md` nel progetto claude.ai "OBOtechHUB".
