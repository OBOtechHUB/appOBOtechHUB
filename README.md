# Progettazione LPS

App web per la progettazione di impianti di protezione contro i fulmini secondo **CEI EN IEC 62305:2024**:
calcoli di captazione (sfera rotolante, maglia), impianto di terra, computo materiali, particolari OBO ed
esportazione verso ZWCAD/AutoCAD (`public/cad/LPS.lsp`).

## Architettura
- **Frontend**: React + Vite + TanStack Router, solo browser (nessun server). Pubblicato su GitHub Pages da
  `.github/workflows/pubblica.yml` a ogni commit su `main` (prima esegue i test).
- **Dati e accesso**: Supabase (email e password). Le tabelle sono protette da RLS: ogni utente vede solo i propri dati.
- **Schede PDF dei particolari OBO**: bucket privato `particolari` di Supabase Storage, leggibile solo dagli utenti collegati
  (non sono nel repository: sono proprietà intellettuale OBO).

## Configurazione (una volta)
1. Supabase → SQL Editor: incolla `supabase/setup.sql` e premi **Run**.
2. Supabase → Authentication → URL Configuration: *Site URL* e *Redirect URLs* = indirizzo GitHub Pages dell'app.
3. Supabase → Storage → bucket `particolari`: carica i PDF `OBO-TBS-…pdf`.
4. GitHub → Settings → Secrets and variables → Actions → **Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. GitHub → Settings → Pages → Source: **GitHub Actions**.

## Lavoro in locale
```
cp .env.example .env   # inserisci URL e chiave di Supabase
bun install
bun run dev            # http://localhost:5173
bun run test
```
