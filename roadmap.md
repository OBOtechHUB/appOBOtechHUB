# Computo materiali
- [x] Schede PDF: dialog condiviso da Particolari, distinte captazione/terra e computo; 124/124 test, tipi senza errori, PDF locale e fallback verificati nel browser.
- [x] Impianto di terra nella pagina 3D: stato compatibile, proposta/verifica, accettazione/rimozione, viewer, CAD e computo; 116/116 test, tipi senza errori, browser desktop/mobile e file .lpsdati verificati.
- [x] Catalogo modificabile con importazione Excel/CSV.
- [x] Regole pure, test e collegamento ai risultati dei moduli disponibili.
- [x] Computo modificabile ed esportazioni Excel/PDF.
- [x] Avanzamento sulla home e verifica dei percorsi reali.

# Portale e strumenti 3D
- [x] Pagine pubbliche e header/footer comuni con norme e avvisi richiesti; percorsi browser verificati.
- [x] Lovable Cloud: email/password, Google, recupero password e profilo utente implementati.
- [x] Progetti privati, RLS, CRUD, import/export JSON e autosalvataggio ogni 5 secondi implementati; test di identità e modifiche concorrenti passati.
- [x] Dati normativi riservati, libreria personale Cloud e banner per utenti non loggati.
- [x] Edificio 3D: corpi, viewer, misura, attributi superfici e sincronizzazione geometria/AD; desktop e telefono verificati.
- [x] Import manuale, DXF, OBJ/GLTF/GLB/IFC, KML, CAD JSON e mappa OSM/PCN/Overpass implementati; verificati manuale, DXF, OBJ, KML, CAD JSON e disegno su mappa.
- [x] Captatori, worker sfera rotolante su corpi senza mesh, confronto LPL, animazione, suggerimento aste e test; 20×20 m al passo 0,25 m verificato.
- [x] Comando 13: motore v2 con superfici 3D importate, metodo della maglia automatico e verifica combinata (sfera O maglia); mappa a tre colori, contorni ed elenco maglie non conformi, tooltip maglia, riepilogo per livello e capitolo PDF aggiornato; 28/28 test captazione, capannone 60×40 m LPL II verificato nel browser.
- [x] Export CAD DXF R2010 e JSON nella struttura richiesta; tetti, pareti e download verificati. Elementi di moduli assenti restano vuoti.
- [x] Particolari: dati esempio, varianti da definire, editor JSON, selezione per tratto/superficie e integrazione nel computo.
- [x] Comando 14: proposta automatica di captazione (maglia/calate/aste/supporti/connettori OBO, verifica combinata, anteprima arancione tratteggiata, Accetta/Annulla), export .lpsdati latin-1/CRLF, LPS.lsp in public/cad con pagina Download CAD e istruzioni, import edificio_da_CAD.json; 76/76 test, flusso 20×20 m verificato nel browser (proposta adeguata, export e download LPS.lsp OK).
- [x] Verifica combinata nell'interfaccia: pendenzaMassimaMaglia in parametriLPL.json e store personale (locale + libreria Cloud, colonna parametri), editor in Dati normativi con tabella LPL, mesh importate passate al motore con triangoliDaGeometria; 83/83 test, typecheck pulito, Edificio 3D verificato nel browser (tabella combinata, legenda a tre colori, nota pendenza).
- [x] Proposta automatica nel Web Worker: messaggio "proponi" aggiunto al worker (gli altri messaggi invariati), hook useSferaRotolante.proponi, altezza aste di default 1,5 m; flusso 20×20 m verificato nel browser (proposta, Accetta, tetto protetto dalla maglia, "Captazione adeguata").
- [ ] Verifica autenticata di registrazione/accesso, progetti, profilo e librerie: bloccata dall'assenza del primo account confermato.
- [ ] Primo collaudo di LPS.lsp in ZWCAD 2025 reale: la sequenza dei comandi nativi (-INSERT, EXTRUDE, CYLINDER, SPHERE) è quella standard ma non verificabile nell'emulatore.
- [ ] Verifica con file reali IFC/GLTF e servizi PCN/Overpass: richiede file di progetto e risposte disponibili dei servizi esterni.

## Limiti dichiarati
- Sfera: mappa di altezze delle superfici superiori, niente aggetti; delle mesh importate è valutata la superficie superiore (pareti verticali e solai interni esclusi). Falde approssimate lungo Y, area in proiezione orizzontale.
- Maglia 5 m è una costruzione geometrica da validare, non un modulo normativo completo di captazione.
- Supporti/morsetti/picchetti CAD senza coordinate e risultati dei moduli non eseguiti non sono inventati.