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

## Controllo degli accessi (amministratore, richieste, Authenticator)
1. Supabase → Authentication → Users → **Add user**: email dell'amministratore e password (≥ 6 caratteri), "Auto confirm".
2. Supabase → SQL Editor: incolla `supabase/accessi.sql` e premi **Run** (crea tabelle, regole e primo amministratore).
   Poi incolla ed esegui anche `supabase/admin-progetti.sql`: l'amministratore legge tutti i progetti (senza poterli modificare) e i progetti eliminati dagli utenti finiscono in un archivio.
3. Supabase → Authentication → Sign In / Providers → Email: **disattiva "Allow new users to sign up"** (gli account li crea solo l'amministratore).
4. Supabase → Edge Functions → **Deploy a new function** → "Via editor":
   - `richiesta-accesso`: incolla `supabase/functions/richiesta-accesso/index.ts`; in *Details* disattiva **Verify JWT** (è pubblica).
   - `gestione-accessi`: incolla `supabase/functions/gestione-accessi/index.ts` (Verify JWT attivo).
5. Supabase → Edge Functions → **Secrets**: `RESEND_API_KEY` = chiave di resend.com (account creato con l'email dell'amministratore).
6. Accedi all'app, cambia la password, collega Microsoft Authenticator, poi in **Admin → Impostazioni** imposta la password iniziale comune.
