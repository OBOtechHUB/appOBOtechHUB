;;; ==========================================================================
;;; LPS.lsp - Progettazione LPS (protezione contro i fulmini)
;;; Compatibile: ZWCAD 2025 e AutoCAD (completo; LT dalla 2024 senza solidi 3D)
;;;
;;; Uso automatico (pacchetto CAD del sito): apri il DXF del pacchetto e trascina LPS.lsp nel disegno:
;;; il programma trova il .lpsdati nella stessa cartella e, con una conferma, costruisce tutto (LPS-AUTO).
;;;
;;; Comandi
;;;   LPS            elenco dei comandi
;;;   LPS-AUTO       costruisce il disegno dal .lpsdati della cartella del disegno, senza domande,
;;;                  inserisce la distinta e salva il DWG
;;;   LPS-IMPORTA    disegna in 3D il progetto esportato dal sito (file .lpsdati)
;;;   LPS-SFERA      disegna la sfera rotolante di un livello in un punto
;;;   LPS-ESPORTA    esporta i contorni dell'edificio verso il sito (edificio_da_CAD.json)
;;;   LPS-DISTINTA   distinta dei componenti disegnati (codici OBO, pezzi e metri) + CSV
;;;   LPS-BLOCCHI    imposta la cartella dei blocchi OBO (file <codice>.dwg)
;;;   LPS-SEPARAZIONE  verifica la distanza di separazione s = ki kc / km l tra due punti
;;;   LPS-PENETRAZIONE penetrazione della sfera rotolante tra due punti di captazione (prospetti e sezioni)
;;;   LPS-NUMERA     numera le calate (C1, C2...) cliccando nell'ordine
;;;   LPS-TABELLA    inserisce la distinta dei materiali come tabella in un punto del disegno
;;;
;;; Il file .lpsdati ha un record LISP per riga, con coordinate in metri:
;;; il comando converte nelle unita' del disegno (INSUNITS).
;;; ==========================================================================

(setq *LPS-VERSIONE* "3.1")
(if vl-load-com (vl-load-com))

;;; --------------------------------------------------------------------------
;;; Impostazioni
;;; --------------------------------------------------------------------------

;; coefficiente ki per livello (CEI EN IEC 62305-3:2026-10, Tab. 11) - da allineare a separazione.ts
(setq *LPS-KI* '(("I" . 0.08) ("II" . 0.06) ("III" . 0.04) ("IV" . 0.04)))

;; raggi della sfera rotolante per livello (m) - da allineare a parametriLPL.json
(setq *LPS-RAGGI* '(("I" . 20.0) ("II" . 30.0) ("III" . 45.0) ("IV" . 60.0)))

;; lunghezza di un elemento di picchetto componibile (m)
(if (not *LPS-ELEMENTO-PICCHETTO*) (setq *LPS-ELEMENTO-PICCHETTO* 1.5))

;; unita' in cui sono disegnati i blocchi OBO (1000 = millimetri, 1 = metri)
(if (not *LPS-UNITA-BLOCCHI*) (setq *LPS-UNITA-BLOCCHI* 1000.0))

;; grandezza dei simboli 2D (1.0 = come in una tavola 1:100; 2.0 per 1:200)
(if (not *LPS-SCALA-SIMBOLI*) (setq *LPS-SCALA-SIMBOLI* 1.0))

;; Standard layer LPS OBO (uguale al DXF del sito): chiave, nome, colore ACI (stampa CTB), tipo linea
(setq *LPS-LAYER*
  '(("EDIFICIO" "LPS-EDIF-CONT" 8 "Continuous")
    ("COLMO" "LPS-EDIF-COLM" 9 "LPS_TRATTEGGIO")
    ("ASTE" "LPS-CAPT-ASTA" 6 "Continuous")
    ("CAPTAZIONE" "LPS-CAPT-COND" 1 "Continuous")
    ("CALATA" "LPS-CALA" 30 "LPS_TRATTEGGIO")
    ("CALATANUM" "LPS-CALA-NUM" 30 "Continuous")
    ("TERRA" "LPS-TERR-ANEL" 3 "LPS_TRATTOPUNTO")
    ("DISPERSORI" "LPS-TERR-DISP" 3 "Continuous")
    ("SUPPORTI" "LPS-SUPP" 4 "Continuous")
    ("MORSETTI" "LPS-MORS" 5 "Continuous")
    ("COMPENSATORI" "LPS-COMP" 5 "Continuous")
    ("PARTICOLARI" "LPS-PART" 2 "Continuous")
    ("TESTI" "LPS-TEST" 7 "Continuous")
    ("LEGENDA" "LPS-LEGE" 7 "Continuous")
    ("CARTIGLIO" "LPS-CART" 7 "Continuous")
    ("QUOTE" "LPS-QUOT" 9 "Continuous")
    ("AVVISI" "LPS-AVVISI" 1 "Continuous")
    ("SFERA2D" "LPS-SFERA" 150 "LPS_TRATTEGGIO")
    ("ESPOSTO" "LPS-3D-ESPO" 1 "Continuous")
    ("SFERA" "LPS-3D-SFER" 150 "Continuous")))

;; tipi linea: tratti in metri a scala 1:100 (positivo tratto, negativo spazio, 0 punto)
(setq *LPS-TIPI-LINEA*
  '(("LPS_TRATTEGGIO" "Tratteggio __ __ __" (0.6 -0.3))
    ("LPS_TRATTOPUNTO" "Tratto punto __ . __ ." (1.0 -0.25 0.0 -0.25))))

;; simboli 2D (metri a scala 1:100): (cerchio cx cy r) (linea x1 y1 x2 y2) (poli chiusa (x y)...) (pieno (x y)...)
(setq *LPS-SIMBOLI*
  '(("ASTA" "Asta di captazione" ((cerchio 0 0 0.3) (cerchio 0 0 0.1) (linea -0.45 0 0.45 0) (linea 0 -0.45 0 0.45)))
    ("SUPPORTO" "Supporto conduttore" ((poli T (-0.09 -0.09) (0.09 -0.09) (0.09 0.09) (-0.09 0.09))))
    ("MORSETTO" "Morsetto / connessione" ((pieno (0 -0.14) (0.14 0) (0 0.14) (-0.14 0))))
    ("COMPENSATORE" "Compensatore di dilatazione" ((poli nil (-0.25 0) (-0.12 0) (-0.12 0.18) (0.12 0.18) (0.12 0) (0.25 0))))
    ("PICCHETTO" "Dispersore a picchetto / pozzetto" ((poli T (-0.3 -0.3) (0.3 -0.3) (0.3 0.3) (-0.3 0.3)) (cerchio 0 0 0.12) (linea -0.3 -0.3 0.3 0.3) (linea -0.3 0.3 0.3 -0.3)))
    ("CALATA" "Calata (punto di discesa)" ((cerchio 0 0 0.25) (pieno (-0.12 0.06) (0.12 0.06) (0 -0.14))))))

;;; --------------------------------------------------------------------------
;;; Utilita'
;;; --------------------------------------------------------------------------

(defun lps:msg (s) (princ (strcat "\n" s)) (princ))

;; T se il CAD sa creare solidi 3D (AutoCAD LT no)
(defun lps:solidi-p (/ p)
  (setq p (getvar "PRODUCT"))
  (not (and p (wcmatch (strcase p) "*LT*"))))

;; fattore metri -> unita' del disegno
(defun lps:fattore (/ u k)
  (setq u (getvar "INSUNITS"))
  (cond
    ((= u 6) 1.0)
    ((= u 4) 1000.0)
    ((= u 5) 100.0)
    ((= u 14) 10.0)
    (T
     (initget "Metri Millimetri Centimetri")
     (setq k (getkword "\nUnita' del disegno [Metri/Millimetri/Centimetri] <Metri>: "))
     (cond ((= k "Millimetri") 1000.0) ((= k "Centimetri") 100.0) (T 1.0)))))

;; nome del layer per una chiave di *LPS-LAYER*, creato se manca
(defun lps:layer (chiave / d nome)
  (setq d (assoc chiave *LPS-LAYER*))
  (setq nome (if d (cadr d) (strcat "LPS-" chiave)))
  (if (not (tblsearch "LAYER" nome))
    (entmake
      (list '(0 . "LAYER") '(100 . "AcDbSymbolTableRecord") '(100 . "AcDbLayerTableRecord")
            (cons 2 nome) '(70 . 0) (cons 62 (if d (caddr d) 7))
            (cons 6 (lps:tipo-linea (if d (cadddr d) "Continuous"))))))
  nome)

;; crea il tipo linea dello standard se manca (tratti scalati alle unita' del disegno); restituisce il nome
(defun lps:tipo-linea (nome / d schema f l)
  (cond
    ((= (strcase nome) "CONTINUOUS") "Continuous")
    ((tblsearch "LTYPE" nome) nome)
    ((setq d (assoc nome *LPS-TIPI-LINEA*))
     (setq f (if *LPS-F* *LPS-F* 1.0) schema (mapcar '(lambda (v) (* v f *LPS-SCALA-SIMBOLI*)) (caddr d)))
     (setq l (list '(0 . "LTYPE") '(100 . "AcDbSymbolTableRecord") '(100 . "AcDbLinetypeTableRecord")
                   (cons 2 nome) '(70 . 0) (cons 3 (cadr d)) '(72 . 65) (cons 73 (length schema))
                   (cons 40 (apply '+ (mapcar 'abs schema)))))
     (foreach v schema (setq l (append l (list (cons 49 v) '(74 . 0)))))
     (if (entmake l) nome "Continuous"))
    (T "Continuous")))

;; layer per livello di protezione (es. LPS_ESPOSTO_III)
(defun lps:layer-lpl (chiave lpl / nome d)
  (setq d (assoc chiave *LPS-LAYER*))
  (setq nome (strcat (if d (cadr d) (strcat "LPS-" chiave)) "-" lpl))
  (if (not (tblsearch "LAYER" nome))
    (entmake
      (list '(0 . "LAYER") '(100 . "AcDbSymbolTableRecord") '(100 . "AcDbLayerTableRecord")
            (cons 2 nome) '(70 . 0) (cons 62 (if d (caddr d) 7)) '(6 . "Continuous"))))
  nome)

;; punto di progetto (m) -> punto del disegno
(defun lps:p (x y z)
  (list (+ (car *LPS-ORIGINE*) (* x *LPS-F*))
        (+ (cadr *LPS-ORIGINE*) (* y *LPS-F*))
        (+ (caddr *LPS-ORIGINE*) (* z *LPS-F*))))

;; distanza 3D tra punti in metri (lista x y z)
(defun lps:dist3 (a b)
  (sqrt (+ (expt (- (car b) (car a)) 2) (expt (- (cadr b) (cadr a)) 2) (expt (- (caddr b) (caddr a)) 2))))

(defun lps:num (v) (if (numberp v) (float v) 0.0))

;; xdata "LPS": codice, tipo, quantita' (pezzi o metri), unita'
(defun lps:xdata (ent codice tipo qta unita)
  (if (not (tblsearch "APPID" "LPS")) (regapp "LPS"))
  (if (and ent (entget ent))
    (entmod
      (append (entget ent)
              (list (list -3 (list "LPS"
                                   (cons 1000 (if (= codice "") "SENZA_CODICE" codice))
                                   (cons 1000 tipo)
                                   (cons 1040 qta)
                                   (cons 1000 unita)))))))
  ent)

;;; --------------------------------------------------------------------------
;;; Primitive di disegno (entmake: funzionano anche in AutoCAD LT)
;;; --------------------------------------------------------------------------

(defun lps:linea (p1 p2 lay)
  (entmake (list '(0 . "LINE") (cons 8 lay) (cons 10 p1) (cons 11 p2)))
  (entlast))

(defun lps:faccia (p1 p2 p3 p4 lay)
  (entmake (list '(0 . "3DFACE") (cons 8 lay) (cons 10 p1) (cons 11 p2) (cons 12 p3) (cons 13 p4)))
  (entlast))

(defun lps:testo (p h s lay)
  (entmake (list '(0 . "TEXT") (cons 8 lay) (cons 10 p) (cons 40 h) (cons 1 s)))
  (entlast))

;; polilinea 3D da lista di punti del disegno
(defun lps:poli3d (punti chiusa lay)
  (entmake (list '(0 . "POLYLINE") (cons 8 lay) '(66 . 1) '(10 0.0 0.0 0.0)
                 (cons 70 (if chiusa 9 8))))
  (foreach p punti
    (entmake (list '(0 . "VERTEX") (cons 8 lay) (cons 10 p) '(70 . 32))))
  (entmake (list '(0 . "SEQEND") (cons 8 lay)))
  (entlast))

;; cerchio orizzontale (normale Z)
(defun lps:cerchio (c r lay)
  (entmake (list '(0 . "CIRCLE") (cons 8 lay) (cons 10 c) (cons 40 r)))
  (entlast))

;; polilinea chiusa 2D (contorno) a quota z
(defun lps:contorno (punti2 z lay / l)
  (setq l (list '(0 . "LWPOLYLINE") '(100 . "AcDbEntity") (cons 8 lay) '(100 . "AcDbPolyline")
                (cons 90 (length punti2)) '(70 . 1) (cons 38 z)))
  (foreach p punti2 (setq l (append l (list (cons 10 p)))))
  (entmake l)
  (entlast))

;; esegue un comando con OSMODE spento, UCS mondo, eco spento
(defun lps:comando (args / os)
  (setq os (getvar "OSMODE"))
  (setvar "OSMODE" 0)
  (apply 'command args)
  (setvar "OSMODE" os)
  (entlast))

;;; --------------------------------------------------------------------------
;;; Blocchi OBO
;;; --------------------------------------------------------------------------

;; nome blocco dal codice articolo: "OBO_5218700"
(defun lps:nome-blocco (codice / s i c)
  (setq s "" i 1)
  (while (<= i (strlen codice))
    (setq c (substr codice i 1))
    (if (wcmatch c "#,@") (setq s (strcat s c)))
    (setq i (1+ i)))
  (strcat "OBO_" s))

;; punto di un simbolo (metri a 1:100) nelle unita' del disegno
(defun lps:sp (q k) (list (* (car q) k) (* (cadr q) k) 0.0))

;; tipo di simbolo dello standard per un componente
(defun lps:tipo-simbolo (tipo chiave)
  (cond
    ((wcmatch (strcase (if tipo tipo "")) "*COMPENS*") "COMPENSATORE")
    ((= chiave "SUPPORTI") "SUPPORTO")
    ((= chiave "MORSETTI") "MORSETTO")
    ((= chiave "COMPENSATORI") "COMPENSATORE")
    ((= chiave "ASTE") "ASTA")
    ((= chiave "DISPERSORI") "PICCHETTO")
    ((= chiave "CALATA") "CALATA")
    (T "SUPPORTO")))

;; blocco simbolo dello standard (OBO_<codice> o LPS_<TIPO>) con attributi CODICE, DESCRIZIONE, TIPO,
;; disegnato nelle unita' del disegno alla grandezza di una tavola 1:100: sostituibile col blocco ufficiale OBO
(defun lps:simbolo (nome sim codice / d k descr)
  (if (not (tblsearch "BLOCK" nome))
    (progn
      (setq d (assoc sim *LPS-SIMBOLI*) k (* *LPS-F* *LPS-SCALA-SIMBOLI*)
            descr (cond ((cadr (assoc codice *LPS-VOCI*))) ((cadr d)) (T sim)))
      (entmake (list '(0 . "BLOCK") (cons 2 nome) '(70 . 2) '(10 0.0 0.0 0.0)))
      (foreach g (caddr d)
        (cond
          ((eq (car g) 'cerchio) (entmake (list '(0 . "CIRCLE") '(8 . "0") (cons 10 (lps:sp (cdr g) k)) (cons 40 (* (nth 3 g) k)))))
          ((eq (car g) 'linea) (entmake (list '(0 . "LINE") '(8 . "0") (cons 10 (lps:sp (cdr g) k)) (cons 11 (lps:sp (cdddr g) k)))))
          ((eq (car g) 'poli)
           (entmake (list '(0 . "POLYLINE") '(8 . "0") '(66 . 1) '(10 0.0 0.0 0.0) (cons 70 (if (cadr g) 1 0))))
           (foreach q (cddr g) (entmake (list '(0 . "VERTEX") '(8 . "0") (cons 10 (lps:sp q k)))))
           (entmake '((0 . "SEQEND") (8 . "0"))))
          ((eq (car g) 'pieno)
           (entmake (list '(0 . "SOLID") '(8 . "0")
                          (cons 10 (lps:sp (nth 1 g) k)) (cons 11 (lps:sp (nth 2 g) k))
                          (cons 12 (lps:sp (if (nth 4 g) (nth 4 g) (nth 3 g)) k)) (cons 13 (lps:sp (nth 3 g) k)))))))
      (foreach a (list (list "CODICE" codice) (list "DESCRIZIONE" descr) (list "TIPO" (cadr d)))
        (entmake (list '(0 . "ATTDEF") '(8 . "0") '(10 0.0 0.0 0.0) (cons 40 (* 0.25 k))
                       (cons 1 (cadr a)) (cons 3 (car a)) (cons 2 (car a)) '(70 . 1))))
      (entmake '((0 . "ENDBLK")))))
  nome)

;; inserisce il blocco del componente; restituisce l'entita'
(defun lps:inserisci (codice tipo pt rot lay / nome file sc def chiave)
  (setq chiave (cond ((= lay (lps:layer "SUPPORTI")) "SUPPORTI") ((= lay (lps:layer "MORSETTI")) "MORSETTI")
                     ((= lay (lps:layer "ASTE")) "ASTE") ((= lay (lps:layer "DISPERSORI")) "DISPERSORI")
                     ((= lay (lps:layer "CALATANUM")) "CALATA") (T "SUPPORTI")))
  (if (= (lps:tipo-simbolo tipo chiave) "COMPENSATORE") (setq lay (lps:layer "COMPENSATORI")))
  (setq nome (if (= codice "") (strcat "LPS_" (lps:tipo-simbolo tipo chiave)) (lps:nome-blocco codice))
        sc (/ *LPS-F* *LPS-UNITA-BLOCCHI*))
  (cond
    ((and (/= codice "") (tblsearch "BLOCK" nome)) (setq def nome))
    ((and (/= codice "") *LPS-CARTELLA-BLOCCHI*
          (setq file (findfile (strcat *LPS-CARTELLA-BLOCCHI* "\\" nome ".dwg"))))
     (setq def (strcat nome "=" file)))
    ((and (/= codice "") *LPS-CARTELLA-BLOCCHI*
          (setq file (findfile (strcat *LPS-CARTELLA-BLOCCHI* "\\" codice ".dwg"))))
     (setq def (strcat nome "=" file)))
    ;; blocco ufficiale non disponibile: simbolo dello standard con lo stesso nome e gli attributi
    (T (setq def (lps:simbolo nome (lps:tipo-simbolo tipo chiave) codice) sc 1.0)))
  (setvar "CLAYER" lay)
  (lps:comando (list "_.-INSERT" def pt sc sc rot))
  (if (and (/= codice "") (not (tblsearch "BLOCK" nome)))
    (setq *LPS-MANCANTI* (if (member codice *LPS-MANCANTI*) *LPS-MANCANTI* (cons codice *LPS-MANCANTI*))))
  ;; i simboli 2D aggiunti ad aste, picchetti e calate non si contano in distinta (lo e' gia' l'oggetto 3D)
  (if *LPS-SOLO-SIMBOLO* (entlast) (lps:xdata (entlast) codice tipo 1.0 "pz")))

;; inserisce solo il simbolo 2D, senza dati per la distinta
(defun lps:simbolo-2d (codice tipo pt lay / r)
  (setq *LPS-SOLO-SIMBOLO* T r (lps:inserisci codice tipo pt 0.0 lay) *LPS-SOLO-SIMBOLO* nil)
  r)

;;; --------------------------------------------------------------------------
;;; Lettura del file .lpsdati
;;; --------------------------------------------------------------------------

(defun lps:leggi (file / f riga dati r)
  (setq f (open file "r"))
  (if (not f) (progn (lps:msg (strcat "Impossibile aprire " file)) (exit)))
  (while (setq riga (read-line f))
    (if (and (> (strlen riga) 1) (= (substr riga 1 1) "("))
      (progn
        (setq r (vl-catch-all-apply 'read (list riga)))
        (if (and r (not (vl-catch-all-error-p r)) (listp r))
          (setq dati (cons r dati))
          (lps:msg (strcat "Riga ignorata: " (substr riga 1 60)))))))
  (close f)
  (reverse dati))

;;; --------------------------------------------------------------------------
;;; Disegno dei record
;;; --------------------------------------------------------------------------

;; (CORPO "id" "nome" quotaBase gronda "tipo" colmo ((x y) ...))
(defun lps:corpo (r / id base gronda tipo colmo pts lay pd n i a b ent minx maxx miny maxy)
  (setq id (nth 1 r) base (lps:num (nth 3 r)) gronda (lps:num (nth 4 r))
        tipo (nth 5 r) colmo (nth 6 r) pts (nth 7 r)
        lay (lps:layer "EDIFICIO"))
  (setq pd (mapcar '(lambda (p) (lps:p (car p) (cadr p) 0.0)) pts))
  (foreach p pts (lps:estendi (car p) (cadr p)))
  (if *LPS-SOLIDI*
    (progn
      (setq ent (lps:contorno (mapcar '(lambda (p) (list (car p) (cadr p))) pd)
                              (+ (caddr *LPS-ORIGINE*) (* base *LPS-F*)) lay))
      (lps:comando (list "_.EXTRUDE" ent "" (* gronda *LPS-F*))))
    (progn
      ;; pareti come 3DFACE e contorno della copertura
      (setq n (length pts) i 0)
      (while (< i n)
        (setq a (nth i pts) b (nth (rem (1+ i) n) pts))
        (lps:faccia (lps:p (car a) (cadr a) base) (lps:p (car b) (cadr b) base)
                    (lps:p (car b) (cadr b) (+ base gronda)) (lps:p (car a) (cadr a) (+ base gronda)) lay)
        (setq i (1+ i)))
      (lps:poli3d (mapcar '(lambda (p) (lps:p (car p) (cadr p) (+ base gronda))) pts) T lay)))
  ;; tetto a falde: linea di colmo sul lato lungo del rettangolo circoscritto
  (if (and (= tipo "falde") (numberp colmo))
    (progn
      (setq minx (apply 'min (mapcar 'car pts)) maxx (apply 'max (mapcar 'car pts))
            miny (apply 'min (mapcar 'cadr pts)) maxy (apply 'max (mapcar 'cadr pts)))
      (if (>= (- maxx minx) (- maxy miny))
        (lps:linea (lps:p minx (/ (+ miny maxy) 2.0) (+ base colmo))
                   (lps:p maxx (/ (+ miny maxy) 2.0) (+ base colmo)) (lps:layer "COLMO"))
        (lps:linea (lps:p (/ (+ minx maxx) 2.0) miny (+ base colmo))
                   (lps:p (/ (+ minx maxx) 2.0) maxy (+ base colmo)) (lps:layer "COLMO")))))
  (lps:testo (lps:p (car (car pts)) (cadr (car pts)) (+ base gronda)) (* 0.3 *LPS-F*) id (lps:layer "TESTI"))
  (setq *LPS-CONTA-CORPI* (1+ *LPS-CONTA-CORPI*)))

;; (ASTA "id" x y zBase altezza diametro "codice" "origine")
(defun lps:asta (r / id x y zb h d cod lay base punta ent)
  (setq id (nth 1 r) x (nth 2 r) y (nth 3 r) zb (lps:num (nth 4 r)) h (lps:num (nth 5 r))
        d (lps:num (nth 6 r)) cod (nth 7 r) lay (lps:layer "ASTE"))
  (if (<= d 0.0) (setq d 0.016))
  (setq base (lps:p x y zb) punta (lps:p x y (+ zb h)))
  (if *LPS-SOLIDI*
    (progn
      (setvar "CLAYER" lay)
      (setq ent (lps:comando (list "_.CYLINDER" base (* (/ d 2.0) *LPS-F*) (* h *LPS-F*)))))
    (progn
      (setq ent (lps:linea base punta lay))
      (lps:cerchio base (* (/ d 2.0) *LPS-F*) lay)))
  (lps:xdata ent cod "asta" 1.0 "pz")
  (lps:simbolo-2d cod "asta" base (lps:layer "ASTE"))
  (lps:testo punta (* 0.2 *LPS-F*) (if (= cod "") id (strcat id " " cod)) (lps:layer "TESTI"))
  (setq *LPS-CONTA-ASTE* (1+ *LPS-CONTA-ASTE*)))

;; (CONDUTTORE "tipo" "materiale" sezione "codice" ((x y z) ...))
(defun lps:conduttore (r / tipo cod pts chiave lay ent l prec)
  (setq tipo (nth 1 r) cod (nth 4 r) pts (nth 5 r))
  (setq chiave (cond ((= tipo "calata") "CALATA")
                     ((member tipo '("terra" "anello" "dispersore" "uscita")) "TERRA")
                     (T "CAPTAZIONE")))
  (setq lay (lps:layer chiave))
  (setq ent (lps:poli3d (mapcar '(lambda (p) (lps:p (car p) (cadr p) (caddr p))) pts) nil lay))
  ;; lunghezza in metri
  (setq l 0.0 prec nil)
  (foreach p pts
    (if prec (setq l (+ l (lps:dist3 prec p))))
    (setq prec p))
  ;; l'uscita dal terreno e' un'asta: si conta a pezzi
  (if (= tipo "uscita")
    (lps:xdata ent cod tipo 1.0 "pz")
    (lps:xdata ent cod tipo l "m"))
  (setq *LPS-CONTA-COND* (1+ *LPS-CONTA-COND*)))

;; (SUPPORTO "tipo" x y z rot "codice") e (MORSETTO ...)
(defun lps:componente (r chiave)
  (lps:inserisci (nth 6 r) (nth 1 r) (lps:p (nth 2 r) (nth 3 r) (nth 4 r)) (lps:num (nth 5 r)) (lps:layer chiave))
  (setq *LPS-CONTA-COMP* (1+ *LPS-CONTA-COMP*)))

;; (PICCHETTO "id" x y zTesta lunghezza diametro "codice")
(defun lps:picchetto (r / x y zt l d cod lay ent)
  (setq x (nth 2 r) y (nth 3 r) zt (lps:num (nth 4 r)) l (lps:num (nth 5 r))
        d (lps:num (nth 6 r)) cod (nth 7 r) lay (lps:layer "TERRA"))
  (if (<= d 0.0) (setq d 0.02))
  (if *LPS-SOLIDI*
    (progn
      (setvar "CLAYER" lay)
      (setq ent (lps:comando (list "_.CYLINDER" (lps:p x y (- zt l)) (* (/ d 2.0) *LPS-F*) (* l *LPS-F*)))))
    (setq ent (lps:linea (lps:p x y zt) (lps:p x y (- zt l)) lay)))
  ;; picchetto componibile: numero di elementi da *LPS-ELEMENTO-PICCHETTO* m
  (lps:xdata ent cod "picchetto" (float (fix (+ 0.999 (/ l *LPS-ELEMENTO-PICCHETTO*)))) "pz")
  (lps:simbolo-2d cod "picchetto" (lps:p x y zt) (lps:layer "DISPERSORI"))
  (setq *LPS-CONTA-COMP* (1+ *LPS-CONTA-COMP*)))

;; (ESPOSTA "LPL" x0 x1 y z passo): rettangolo rosso appena sopra la copertura
(defun lps:esposta (r / lpl x0 x1 y z s h lay)
  (setq lpl (nth 1 r) x0 (nth 2 r) x1 (nth 3 r) y (nth 4 r) z (+ (nth 5 r) 0.02) s (nth 6 r) h (/ s 2.0))
  (setq lay (lps:layer-lpl "ESPOSTO" lpl))
  (lps:faccia (lps:p (- x0 h) (- y h) z) (lps:p (+ x1 h) (- y h) z)
              (lps:p (+ x1 h) (+ y h) z) (lps:p (- x0 h) (+ y h) z) lay))

;; (PARETE "LPL" x y nx ny zDa zA larghezza): parte di parete esposta
(defun lps:parete (r / lpl x y nx ny za zb w tx ty lay)
  (setq lpl (nth 1 r) x (nth 2 r) y (nth 3 r) nx (nth 4 r) ny (nth 5 r)
        za (nth 6 r) zb (nth 7 r) w (/ (nth 8 r) 2.0))
  (setq tx (- ny) ty nx
        x (+ x (* nx 0.02)) y (+ y (* ny 0.02))
        lay (lps:layer-lpl "ESPOSTO" lpl))
  (lps:faccia (lps:p (- x (* tx w)) (- y (* ty w)) za) (lps:p (+ x (* tx w)) (+ y (* ty w)) za)
              (lps:p (+ x (* tx w)) (+ y (* ty w)) zb) (lps:p (- x (* tx w)) (- y (* ty w)) zb) lay))

;; estensione del progetto in metri (per posizionare legenda e cartiglio)
(defun lps:estendi (x y)
  (if (numberp x)
    (setq *LPS-EST* (if *LPS-EST*
                      (list (min (car *LPS-EST*) x) (min (cadr *LPS-EST*) y) (max (caddr *LPS-EST*) x) (max (cadddr *LPS-EST*) y))
                      (list x y x y)))))

;; testo allineato (orizzontale: 0 sinistra 1 centro 2 destra; verticale 2 = medio)
(defun lps:testo-all (p h s lay oriz vert)
  (entmake (list '(0 . "TEXT") (cons 8 lay) (cons 10 p) (cons 11 p) (cons 40 h) (cons 1 s) (cons 72 oriz) (cons 73 vert)))
  (entlast))

;; (RICHIAMO "P01" x y z): cerchio con numero e linea di richiamo verso il punto
(defun lps:richiamo (r / s x y z c p lay)
  (setq s (* *LPS-F* *LPS-SCALA-SIMBOLI*) x (nth 2 r) y (nth 3 r) z (lps:num (nth 4 r)) lay (lps:layer "PARTICOLARI"))
  (setq p (lps:p x y z) c (list (+ (car p) (* 1.1 s)) (+ (cadr p) (* 1.1 s)) (caddr p)))
  (lps:linea p (list (+ (car p) (* 0.78 s)) (+ (cadr p) (* 0.78 s)) (caddr p)) lay)
  (lps:cerchio c (* 0.45 s) lay)
  (lps:testo-all c (* 0.25 s) (nth 1 r) lay 1 2))

;; (CALATA_NUM "C1" x y z)
(defun lps:calata-num (r / s p)
  (setq s (* *LPS-F* *LPS-SCALA-SIMBOLI*) p (lps:p (nth 2 r) (nth 3 r) (lps:num (nth 4 r))))
  (lps:simbolo-2d "" "calata" p (lps:layer "CALATANUM"))
  (lps:testo-all (list (+ (car p) (* 0.6 s)) (+ (cadr p) (* 0.6 s)) (caddr p)) (* 0.3 s) (nth 1 r) (lps:layer "CALATANUM") 0 2))

;; legenda, particolari e cartiglio a destra del progetto (z = 0)
(defun lps:legenda (/ s h x0 y lay v q pr)
  (if *LPS-EST*
    (progn
      (setq s (* *LPS-F* *LPS-SCALA-SIMBOLI*) h (* 0.25 s) lay (lps:layer "LEGENDA")
            x0 (+ (car (lps:p (caddr *LPS-EST*) 0.0 0.0)) (* 6.0 s))
            y (cadr (lps:p 0.0 (cadddr *LPS-EST*) 0.0)))
      (lps:testo (list x0 y 0.0) (* 1.6 h) "LEGENDA" lay) (setq y (- y (* 0.9 s)))
      (foreach v (list (list "CAPTAZIONE" "Conduttore di captazione") (list "CALATA" "Calata") (list "TERRA" "Conduttore di terra / anello"))
        (lps:linea (list x0 (+ y (* 0.1 s)) 0.0) (list (+ x0 (* 1.4 s)) (+ y (* 0.1 s)) 0.0) (lps:layer (car v)))
        (lps:testo (list (+ x0 (* 1.8 s)) y 0.0) h (cadr v) lay) (setq y (- y (* 0.55 s))))
      (setq y (- y (* 0.3 s)))
      (lps:testo (list x0 y 0.0) (* 0.8 h) "CODICE OBO   DESCRIZIONE   QUANTITA'" lay) (setq y (- y (* 0.55 s)))
      (foreach v *LPS-VOCI*
        (setq q (caddr v))
        (lps:testo (list x0 y 0.0) h (strcat (car v) "   " (cadr v) "   " (if (= (cadddr v) "m") (rtos q 2 1) (rtos q 2 0)) " " (cadddr v)) lay)
        (setq y (- y (* 0.55 s))))
      (if *LPS-PART*
        (progn
          (setq y (- y (* 0.4 s)))
          (lps:testo (list x0 y 0.0) (* 1.4 h) "PARTICOLARI COSTRUTTIVI" (lps:layer "PARTICOLARI")) (setq y (- y (* 0.8 s)))
          (foreach v (reverse *LPS-PART*)
            (lps:testo (list x0 y 0.0) h (strcat (car v) "  " (cadr v) " (" (itoa (fix (lps:num (caddr v)))) " punti)") lay)
            (setq y (- y (* 0.55 s))))))
      ;; cartiglio
      (setq pr *LPS-PROGETTO* lay (lps:layer "CARTIGLIO") y (- y (* 1.0 s)))
      (lps:poli3d (list (list (- x0 (* 0.3 s)) (+ y (* 0.5 s)) 0.0) (list (+ x0 (* 17.0 s)) (+ y (* 0.5 s)) 0.0)
                        (list (+ x0 (* 17.0 s)) (- y (* 5.2 s)) 0.0) (list (- x0 (* 0.3 s)) (- y (* 5.2 s)) 0.0)) T lay)
      (lps:testo (list x0 (- y (* 0.3 s)) 0.0) (* 1.3 h) "IMPIANTO DI PROTEZIONE CONTRO I FULMINI (LPS)" lay)
      (setq y (- y (* 1.1 s)))
      (foreach v (list (list "PROGETTO" (if pr (nth 2 pr) "")) (list "COMUNE" (if pr (nth 3 pr) "")) (list "CODICE" (if pr (nth 1 pr) ""))
                       (list "LIVELLO DI PROTEZIONE" (if pr (strcat "LPL " (nth 4 pr)) "")) (list "SCALA SIMBOLI" (strcat "1:" (rtos (* 100 *LPS-SCALA-SIMBOLI*) 2 0))))
        (lps:testo (list x0 (- y (* 0.4 s)) 0.0) (* 0.8 h) (car v) lay)
        (lps:testo (list (+ x0 (* 5.5 s)) (- y (* 0.4 s)) 0.0) h (cadr v) lay)
        (setq y (- y (* 0.75 s))))
      (lps:testo (list x0 (- y (* 0.3 s)) 0.0) (* 0.7 h) "CEI EN IEC 62305 - Progettazione LPS (OBO Italia)" lay))))

;;; --------------------------------------------------------------------------
;;; Gestione errori e variabili di sistema
;;; --------------------------------------------------------------------------

(defun lps:salva-var ()
  (setq *LPS-VAR* (mapcar '(lambda (v) (cons v (getvar v))) '("OSMODE" "CMDECHO" "CLAYER" "ATTREQ")))
  (setvar "CMDECHO" 0)
  (setvar "ATTREQ" 0))

(defun lps:ripristina-var ()
  (foreach v *LPS-VAR* (setvar (car v) (cdr v)))
  (setq *LPS-VAR* nil))

(defun lps:errore (msg)
  (if *LPS-VAR* (lps:ripristina-var))
  (if (not (member msg '("Function cancelled" "quit / exit abort" "console break")))
    (lps:msg (strcat "LPS errore: " msg)))
  (setq *error* *LPS-ERRORE-PREC*)
  (princ))

(defun lps:inizio ()
  (setq *LPS-ERRORE-PREC* *error* *error* lps:errore)
  (lps:salva-var)
  (if (/= (getvar "WORLDUCS") 1) (command "_.UCS" "_W")))

(defun lps:fine ()
  (lps:ripristina-var)
  (setq *error* *LPS-ERRORE-PREC*))

;;; --------------------------------------------------------------------------
;;; Comandi
;;; --------------------------------------------------------------------------

(defun c:LPS ()
  (lps:msg (strcat "Progettazione LPS " *LPS-VERSIONE* " - comandi:"))
  (lps:msg "  LPS-AUTO      costruisce tutto dal .lpsdati accanto al disegno (pacchetto CAD)")
  (lps:msg "  LPS-IMPORTA   disegna il progetto esportato dal sito (.lpsdati)")
  (lps:msg "  LPS-SFERA     disegna la sfera rotolante di un livello")
  (lps:msg "  LPS-ESPORTA   esporta i contorni dell'edificio verso il sito")
  (lps:msg "  LPS-DISTINTA  distinta dei componenti (codici, pezzi, metri) + CSV")
  (lps:msg "  LPS-BLOCCHI   cartella dei blocchi OBO")
  (lps:msg "  LPS-SEPARAZIONE   verifica la distanza di separazione tra due punti (s = ki kc / km l)")
  (lps:msg "  LPS-PENETRAZIONE  penetrazione della sfera rotolante tra due punti (prospetti e sezioni)")
  (lps:msg "  LPS-NUMERA    numera le calate C1, C2... cliccando nell'ordine")
  (lps:msg "  LPS-TABELLA   inserisce la distinta dei materiali come tabella")
  (lps:msg "  Standard OBO: layer LPS-*, blocchi OBO_<codice> con attributi CODICE/DESCRIZIONE/TIPO.")
  (lps:msg "  Simboli per tavole 1:200: (setq *LPS-SCALA-SIMBOLI* 2.0) prima di LPS-IMPORTA.")
  (princ))

(defun c:LPS-BLOCCHI (/ f)
  (setq f (getfiled "Scegli un qualsiasi blocco nella cartella dei blocchi OBO" "" "dwg" 0))
  (if f
    (progn
      (setq *LPS-CARTELLA-BLOCCHI* (vl-filename-directory f))
      (vl-catch-all-apply 'setenv (list "LPS_BLOCCHI" *LPS-CARTELLA-BLOCCHI*))
      (lps:msg (strcat "Cartella blocchi: " *LPS-CARTELLA-BLOCCHI*))))
  (princ))

;; cartella dei blocchi: variabile, ambiente LPS_BLOCCHI, sottocartella "blocchi" accanto al disegno
(defun lps:cartella-blocchi (/ o d)
  (if (not *LPS-CARTELLA-BLOCCHI*)
    (progn
      (setq o (vl-catch-all-apply 'getenv (list "LPS_BLOCCHI")))
      (if (and o (not (vl-catch-all-error-p o)) (/= o "")) (setq *LPS-CARTELLA-BLOCCHI* o))))
  (setq d (strcat (getvar "DWGPREFIX") "blocchi"))
  (if (and (not *LPS-CARTELLA-BLOCCHI*) (vl-file-directory-p d)) (setq *LPS-CARTELLA-BLOCCHI* d))
  *LPS-CARTELLA-BLOCCHI*)

;; disegna il contenuto di un file .lpsdati; auto = T: origine dal record ORIGINE, nessuna domanda
(defun lps:importa (file auto / dati o tipo n orig)
  (setq dati (lps:leggi file))
  (if (not (assoc 'LPSDATI dati))
    (progn (lps:msg "Il file non e' un file .lpsdati valido.") nil)
    (progn
      ;; il DXF del pacchetto e' in metri: se il disegno non dichiara l'unita' non si chiede nulla
      (if (and auto (= (getvar "INSUNITS") 0)) (setvar "INSUNITS" 6))
      (setq *LPS-F* (lps:fattore)
            *LPS-SOLIDI* (lps:solidi-p)
            *LPS-MANCANTI* nil *LPS-VOCI* nil *LPS-PART* nil *LPS-EST* nil *LPS-PROGETTO* nil
            *LPS-CONTA-CORPI* 0 *LPS-CONTA-ASTE* 0 *LPS-CONTA-COND* 0 *LPS-CONTA-COMP* 0)
      (if auto
        (setq orig (assoc 'ORIGINE dati)
              *LPS-ORIGINE* (if orig
                              (list (* (lps:num (nth 1 orig)) *LPS-F*) (* (lps:num (nth 2 orig)) *LPS-F*) (* (lps:num (nth 3 orig)) *LPS-F*))
                              '(0.0 0.0 0.0)))
        (progn
          (setq o (getpoint "\nPunto di inserimento dell'origine di progetto <0,0,0>: "))
          (setq *LPS-ORIGINE* (if o (if (caddr o) o (list (car o) (cadr o) 0.0)) '(0.0 0.0 0.0)))))
      (if (not *LPS-SOLIDI*)
        (lps:msg "AutoCAD LT: aste e corpi disegnati come linee e facce (senza solidi 3D)."))
      (setq n 0)
      (foreach r dati
        (setq tipo (car r))
        (cond
          ((eq tipo 'CORPO) (lps:corpo r))
          ((eq tipo 'ASTA) (lps:asta r))
          ((eq tipo 'CONDUTTORE) (lps:conduttore r))
          ((eq tipo 'SUPPORTO) (lps:componente r "SUPPORTI"))
          ((eq tipo 'MORSETTO) (lps:componente r "MORSETTI"))
          ((eq tipo 'PICCHETTO) (lps:picchetto r))
          ((eq tipo 'ESPOSTA) (lps:esposta r))
          ((eq tipo 'PARETE) (lps:parete r))
          ((eq tipo 'PROGETTO) (setq *LPS-PROGETTO* r))
          ((eq tipo 'VOCE) (setq *LPS-VOCI* (append *LPS-VOCI* (list (list (nth 1 r) (nth 2 r) (lps:num (nth 3 r)) (nth 4 r))))))
          ((eq tipo 'PARTICOLARE) (setq *LPS-PART* (cons (list (nth 1 r) (nth 2 r) (nth 3 r)) *LPS-PART*)))
          ((eq tipo 'RICHIAMO) (lps:richiamo r))
          ((eq tipo 'CALATA_NUM) (lps:calata-num r)))
        (setq n (1+ n)))
      (lps:legenda)
      (lps:msg (strcat "Disegnati: " (itoa *LPS-CONTA-CORPI*) " corpi, "
                       (itoa *LPS-CONTA-ASTE*) " aste, " (itoa *LPS-CONTA-COND*) " conduttori, "
                       (itoa *LPS-CONTA-COMP*) " componenti."))
      (if *LPS-MANCANTI*
        (progn
          (lps:msg "Blocchi OBO ufficiali non trovati (usati i simboli standard con lo stesso nome e gli attributi): ")
          (foreach c *LPS-MANCANTI* (princ (strcat c " ")))
          (lps:msg "Per i blocchi ufficiali: sottocartella \"blocchi\" accanto al disegno oppure comando LPS-BLOCCHI.")))
      T)))

(defun c:LPS-IMPORTA (/ file)
  (lps:inizio)
  (lps:cartella-blocchi)
  (setq file (getfiled "File di progetto LPS" "" "lpsdati" 0))
  (if file (lps:importa file nil))
  (lps:fine)
  (if file (command "_.ZOOM" "_E"))
  (princ))

;; primo file .lpsdati nella cartella del disegno (nil se il disegno non e' salvato o non c'e')
(defun lps:file-progetto (/ d l)
  (setq d (getvar "DWGPREFIX"))
  (if (and (= (getvar "DWGTITLED") 1) d (setq l (vl-directory-files d "*.lpsdati" 1)))
    (strcat d (car l))))

;; T se nel disegno ci sono gia' componenti LPS (progetto gia' costruito)
(defun lps:gia-costruito () (if (ssget "_X" '((-3 ("LPS")))) T nil))

;; salva una copia DWG accanto al disegno senza sovrascrivere file esistenti
(defun lps:salva-dwg (/ base nome i doc r)
  (setq base (strcat (getvar "DWGPREFIX") (vl-filename-base (getvar "DWGNAME"))) nome (strcat base ".dwg") i 1)
  (while (findfile nome) (setq i (1+ i) nome (strcat base "_" (itoa i) ".dwg")))
  (setq doc (vl-catch-all-apply 'vla-get-ActiveDocument (list (vlax-get-acad-object))))
  (setq r (if (vl-catch-all-error-p doc) doc (vl-catch-all-apply 'vla-SaveAs (list doc nome))))
  (if (vl-catch-all-error-p r)
    (progn (lps:msg "Salvataggio DWG non riuscito: salva il disegno con Salva con nome.") nil)
    (progn (lps:msg (strcat "Disegno salvato: " nome)) nome)))

;; tabella della distinta calcolata dai componenti disegnati, sotto il modello 3D
;; tabella della distinta con l'angolo in alto a sinistra in (x0 y), s = grandezza (unita' disegno per 1 m a 1:100)
(defun lps:tabella-a (tab x0 y s / h lay q descr)
  (setq h (* 0.25 s) lay (lps:layer "LEGENDA"))
  (lps:testo (list x0 y 0.0) (* 1.6 h) "DISTINTA MATERIALI DAL DISEGNO (codici OBO)" lay)
  (setq y (- y (* 0.9 s)))
  (lps:testo (list x0 y 0.0) (* 0.8 h) "CODICE" lay)
  (lps:testo (list (+ x0 (* 3.0 s)) y 0.0) (* 0.8 h) "DESCRIZIONE" lay)
  (lps:testo (list (+ x0 (* 15.0 s)) y 0.0) (* 0.8 h) "QUANTITA'" lay)
  (lps:linea (list x0 (- y (* 0.2 s)) 0.0) (list (+ x0 (* 18.0 s)) (- y (* 0.2 s)) 0.0) lay)
  (setq y (- y (* 0.6 s)))
  (foreach v tab
    (setq q (caddr v) descr (cadr (assoc (car v) *LPS-VOCI*)))
    (lps:testo (list x0 y 0.0) h (car v) lay)
    (lps:testo (list (+ x0 (* 3.0 s)) y 0.0) h (if descr descr (cadr v)) lay)
    (lps:testo (list (+ x0 (* 15.0 s)) y 0.0) h (if (= (cadddr v) "m") (strcat (rtos q 2 1) " m") (strcat (rtos q 2 0) " pz")) lay)
    (setq y (- y (* 0.5 s)))))

(defun lps:tabella-distinta (tab / s)
  (if (and tab *LPS-EST*)
    (progn
      (setq s (* *LPS-F* *LPS-SCALA-SIMBOLI*))
      (lps:tabella-a tab
                     (car (lps:p (car *LPS-EST*) 0.0 0.0))
                     (- (cadr (lps:p 0.0 (cadr *LPS-EST*) 0.0)) (* 4.0 s))
                     s))))

(defun c:LPS-AUTO (/ file tab)
  (setq file (lps:file-progetto))
  (cond
    ((not file) (lps:msg "Nessun file .lpsdati nella cartella del disegno: apri il DXF del pacchetto CAD o usa LPS-IMPORTA."))
    ((lps:gia-costruito) (lps:msg "Il progetto LPS e' gia' disegnato in questo file (componenti LPS presenti)."))
    (T
     (lps:inizio)
     (lps:cartella-blocchi)
     (lps:msg (strcat "LPS-AUTO: costruzione da " file))
     (if (lps:importa file T)
       (progn
         (setq tab (lps:distinta-tab))
         (lps:tabella-distinta tab)
         (lps:distinta-csv tab)))
     (lps:fine)
     (command "_.ZOOM" "_E")
     (lps:salva-dwg)))
  (princ))

(defun c:LPS-SFERA (/ lpl r c f lay i a n pts)
  (lps:inizio)
  (setq f (lps:fattore))
  (initget "I II III IV")
  (setq lpl (getkword "\nLivello di protezione [I/II/III/IV] <III>: "))
  (if (not lpl) (setq lpl "III"))
  (setq r (* (cdr (assoc lpl *LPS-RAGGI*)) f))
  (setq c (getpoint (strcat "\nCentro della sfera (r = " (rtos (/ r f) 2 1) " m): ")))
  (if c
    (progn
      (if (not (caddr c)) (setq c (list (car c) (cadr c) 0.0)))
      (setq lay (lps:layer-lpl "SFERA" lpl))
      (if (lps:solidi-p)
        (progn (setvar "CLAYER" lay) (lps:comando (list "_.SPHERE" c r)))
        (progn
          ;; tre cerchi ortogonali come polilinee 3D (72 lati)
          (lps:cerchio c r lay)
          (setq n 72)
          (foreach piano '(0 1)
            (setq pts nil i 0)
            (while (< i n)
              (setq a (/ (* 2.0 pi i) n))
              (setq pts (cons (if (= piano 0)
                                (list (+ (car c) (* r (cos a))) (cadr c) (+ (caddr c) (* r (sin a))))
                                (list (car c) (+ (cadr c) (* r (cos a))) (+ (caddr c) (* r (sin a)))))
                              pts))
              (setq i (1+ i)))
            (lps:poli3d (reverse pts) T lay))))))
  (lps:fine)
  (princ))

;; numero in JSON
(defun lps:jnum (v) (rtos v 2 4))

;; stringa in JSON (toglie virgolette e barre)
(defun lps:jstr (s / o i c)
  (setq o "" i 1)
  (while (<= i (strlen s))
    (setq c (substr s i 1))
    (setq o (strcat o (cond ((= c "\"") "'") ((= c "\\") "/") (T c))))
    (setq i (1+ i)))
  (strcat "\"" o "\""))

(defun c:LPS-ESPORTA (/ f ss i e d pts base h n file fh corpi testo)
  (lps:inizio)
  (setq f (lps:fattore))
  (lps:msg "Seleziona i contorni chiusi dei corpi di fabbrica (polilinee).")
  (lps:msg "Quota = elevazione della polilinea; altezza = spessore, se impostato.")
  (setq ss (ssget '((0 . "LWPOLYLINE") (-4 . "&") (70 . 1))))
  (if (not ss) (progn (lps:fine) (exit)))
  (setq i 0 corpi nil)
  (while (< i (sslength ss))
    (setq e (ssname ss i) d (entget e) pts nil)
    (foreach g d (if (= (car g) 10) (setq pts (cons (list (/ (cadr g) f) (/ (caddr g) f)) pts))))
    (setq pts (reverse pts))
    (setq base (/ (lps:num (cdr (assoc 38 d))) f))
    (setq h (/ (lps:num (cdr (assoc 39 d))) f))
    (if (<= h 0.0)
      (progn
        (initget 7)
        (setq h (getreal (strcat "\nAltezza in gronda del corpo " (itoa (1+ i)) " (m): ")))))
    (setq corpi
      (cons (strcat "{\"id\":" (lps:jstr (strcat "CAD" (itoa (1+ i))))
                    ",\"nome\":" (lps:jstr (strcat "Corpo " (itoa (1+ i))))
                    ",\"impronta\":["
                    (lps:unisci (mapcar '(lambda (p) (strcat "[" (lps:jnum (car p)) "," (lps:jnum (cadr p)) "]")) pts) ",")
                    "],\"quotaBase\":" (lps:jnum base)
                    ",\"altezzaGronda\":" (lps:jnum h)
                    ",\"tipoTetto\":\"piano\"}")
            corpi))
    (setq i (1+ i)))
  (setq testo (strcat "{\"versione\":\"1\",\"unita\":\"m\",\"corpi\":[" (lps:unisci (reverse corpi) ",") "]}"))
  (setq file (getfiled "Salva l'edificio per il sito" "edificio_da_CAD" "json" 1))
  (if file
    (progn
      (setq fh (open file "w"))
      (write-line testo fh)
      (close fh)
      (lps:msg (strcat "Esportati " (itoa (sslength ss)) " corpi in " file))))
  (lps:fine)
  (princ))

;; unisce stringhe con un separatore
(defun lps:unisci (l sep / o)
  (setq o "")
  (foreach s l (setq o (if (= o "") s (strcat o sep s))))
  o)

;; distinta dai componenti disegnati (xdata LPS): lista (codice tipo quantita unita) ordinata per codice
(defun lps:distinta-tab (/ ss i e x cod tipo q u voce tab)
  (setq ss (ssget "_X" '((-3 ("LPS")))))
  (if ss
    (progn
      (setq i 0 tab nil)
      (while (< i (sslength ss))
        (setq e (ssname ss i)
              x (cdr (car (cdr (assoc -3 (entget e '("LPS")))))))
        ;; x = ((1000 . codice) (1000 . tipo) (1040 . qta) (1000 . unita))
        (setq cod (cdr (nth 0 x)) tipo (cdr (nth 1 x)) q (cdr (nth 2 x)) u (cdr (nth 3 x)))
        (setq voce (assoc cod tab))
        (if voce
          (setq tab (subst (list cod
                                 (if (wcmatch (cadr voce) (strcat "*" tipo "*")) (cadr voce) (strcat (cadr voce) "/" tipo))
                                 (+ (caddr voce) q) u)
                           voce tab))
          (setq tab (cons (list cod tipo q u) tab)))
        (setq i (1+ i)))
      (vl-sort tab '(lambda (a b) (< (car a) (car b)))))))

;; CSV della distinta accanto al disegno
(defun lps:distinta-csv (tab / file fh)
  (if tab
    (progn
      (setq file (strcat (getvar "DWGPREFIX") (vl-filename-base (getvar "DWGNAME")) "_distinta_LPS.csv"))
      (setq fh (open file "w"))
      (if fh
        (progn
          (write-line "Codice;Tipo;Quantita;Unita" fh)
          (foreach v tab
            (write-line (strcat (car v) ";" (cadr v) ";"
                                (vl-string-subst "," "." (rtos (caddr v) 2 2)) ";" (cadddr v)) fh))
          (close fh)
          (lps:msg (strcat "Distinta salvata in " file)))))))

(defun c:LPS-DISTINTA (/ tab)
  (setq tab (lps:distinta-tab))
  (if (not tab) (progn (lps:msg "Nessun componente LPS nel disegno.") (exit)))
  (lps:msg "Codice          Tipo            Quantita'")
  (foreach v tab
    (lps:msg (strcat (car v) "  " (cadr v) "  "
                     (if (= (cadddr v) "m") (strcat (rtos (caddr v) 2 1) " m")
                         (strcat (rtos (caddr v) 2 0) " pz")))))
  (lps:distinta-csv tab)
  (princ))

;;; --------------------------------------------------------------------------
;;; Verifiche sul disegno
;;; --------------------------------------------------------------------------

;; livello di protezione chiesto all'utente (predefinito III)
(defun lps:chiedi-lpl (/ lpl)
  (initget "I II III IV")
  (setq lpl (getkword "\nLivello di protezione [I/II/III/IV] <III>: "))
  (if lpl lpl "III"))

;; numero con la virgola (2 decimali)
(defun lps:num2 (v / s)
  (setq s (rtos v 2 2))
  (if (vl-string-search "." s) (vl-string-subst "," "." s) s))

;; distanza di separazione: s = ki * kc / km * l, confrontata con la distanza misurata tra due punti
(defun c:LPS-SEPARAZIONE (/ f lpl ki n kc mat km a b l0 l sep d ok lay h m testo)
  (lps:inizio)
  (setq f (lps:fattore) lpl (lps:chiedi-lpl) ki (cdr (assoc lpl *LPS-KI*)))
  (initget 6)
  (setq n (getint "\nNumero di calate dell'LPS <4>: "))
  (if (not n) (setq n 4))
  (setq kc (cond ((= n 1) 1.0) ((= n 2) 0.66) (T 0.44)))
  (initget "Aria Solido Distanziatore")
  (setq mat (getkword "\nMateriale tra conduttore e parte metallica [Aria/Solido/Distanziatore] <Aria>: "))
  (setq km (cond ((= mat "Solido") 0.5) ((= mat "Distanziatore") 0.7) (T 1.0)))
  (setq a (getpoint "\nPunto del conduttore LPS (captazione o calata): "))
  (if a (setq b (getpoint a "\nPunto della parte metallica o dell'impianto da separare: ")))
  (if (and a b)
    (progn
      (setq l0 (if (and (caddr a) (> (caddr a) 0.0)) (/ (caddr a) f) 10.0))
      (initget 6)
      (setq l (getreal (strcat "\nLunghezza l lungo il conduttore fino al collegamento equipotenziale piu' vicino, in metri <" (lps:num2 l0) ">: ")))
      (if (not l) (setq l l0))
      (setq sep (/ (* ki kc l) km) d (/ (distance a b) f) ok (>= d sep))
      (setq lay (lps:layer (if ok "QUOTE" "AVVISI")) h (* 0.25 f *LPS-SCALA-SIMBOLI*))
      (lps:linea a b lay)
      (setq m (list (/ (+ (car a) (car b)) 2.0) (/ (+ (cadr a) (cadr b)) 2.0) (/ (+ (if (caddr a) (caddr a) 0.0) (if (caddr b) (caddr b) 0.0)) 2.0)))
      (setq testo (strcat "s = " (lps:num2 sep) " m - d = " (lps:num2 d) " m - " (if ok "VERIFICATA" "NON VERIFICATA")))
      (lps:testo-all m h testo lay 1 0)
      (lps:testo-all (list (car m) (- (cadr m) (* 1.4 h)) (caddr m)) (* 0.7 h)
                     (strcat "LPL " lpl ": ki " (rtos ki 2 2) " kc " (rtos kc 2 2) " km " (rtos km 2 1) " l " (lps:num2 l) " m") lay 1 0)
      (lps:msg (strcat "Distanza di separazione s = ki kc / km l = " (rtos ki 2 2) " x " (rtos kc 2 2) " / " (rtos km 2 1) " x " (lps:num2 l) " = " (lps:num2 sep) " m"))
      (lps:msg (strcat "Distanza misurata d = " (lps:num2 d) " m: " (if ok "VERIFICATA (d >= s)" "NON VERIFICATA: allontanare o collegare la parte metallica")))))
  (lps:fine)
  (princ))

;; penetrazione della sfera tra due punti di captazione nel piano XY corrente (prospetti e sezioni: Y = quota)
(defun c:LPS-PENETRAZIONE (/ f lpl r a b d meta hh nx ny c sx dx a1 a2 p lay h fondo)
  (lps:inizio)
  (setq f (lps:fattore) lpl (lps:chiedi-lpl) r (* (cdr (assoc lpl *LPS-RAGGI*)) f))
  (setq a (getpoint (strcat "\nPrimo punto di captazione (punta d'asta o conduttore), sfera R = " (rtos (/ r f) 2 0) " m: ")))
  (if a (setq b (getpoint a "\nSecondo punto di captazione: ")))
  (if (and a b)
    (progn
      (setq d (distance (list (car a) (cadr a)) (list (car b) (cadr b))) lay (lps:layer "SFERA2D") h (* 0.25 f *LPS-SCALA-SIMBOLI*))
      (if (>= d (* 2.0 r))
        (lps:msg (strcat "Distanza " (lps:num2 (/ d f)) " m oltre il diametro della sfera (" (lps:num2 (/ (* 2.0 r) f)) " m): la sfera tocca la superficie tra i due punti."))
        (progn
          (setq meta (/ d 2.0) hh (sqrt (- (* r r) (* meta meta))))
          ;; centro della sfera sopra la congiungente
          (setq nx (/ (- (cadr a) (cadr b)) d) ny (/ (- (car b) (car a)) d))
          (if (< ny 0.0) (setq nx (- nx) ny (- ny)))
          (setq c (list (+ (/ (+ (car a) (car b)) 2.0) (* nx hh)) (+ (/ (+ (cadr a) (cadr b)) 2.0) (* ny hh)) 0.0))
          (if (< (car a) (car b)) (setq sx a dx b) (setq sx b dx a))
          (setq a1 (angle c sx) a2 (angle c dx) p (- r hh))
          (entmake (list '(0 . "ARC") (cons 8 lay) (cons 10 c) (cons 40 r) (cons 50 a1) (cons 51 a2)))
          (setq fondo (list (- (car c) (* nx r)) (- (cadr c) (* ny r)) 0.0))
          (lps:testo-all (list (car fondo) (- (cadr fondo) (* 1.6 h)) 0.0) h (strcat "p = " (lps:num2 (/ p f)) " m (R = " (rtos (/ r f) 2 0) " m, d = " (lps:num2 (/ d f)) " m)") lay 1 0)
          (lps:msg (strcat "Penetrazione della sfera tra i due punti: p = R - radq(R^2 - (d/2)^2) = " (lps:num2 (/ p f)) " m"))
          (lps:msg "Le parti da proteggere devono stare sotto l'arco disegnato (altezza delle punte meno la penetrazione).")))))
  (lps:fine)
  (princ))

;; numerazione delle calate: si clicca dove scrivere C1, C2... nell'ordine voluto
(defun c:LPS-NUMERA (/ pref n p h lay)
  (setq pref (getstring "\nPrefisso <C>: "))
  (if (= pref "") (setq pref "C"))
  (initget 6)
  (setq n (getint "\nPrimo numero <1>: "))
  (if (not n) (setq n 1))
  (setq h (* 0.3 (lps:fattore) *LPS-SCALA-SIMBOLI*) lay (lps:layer "CALATANUM"))
  (while (setq p (getpoint (strcat "\nPosizione di " pref (itoa n) " (Invio per finire): ")))
    (lps:testo-all p h (strcat pref (itoa n)) lay 1 2)
    (setq n (1+ n)))
  (princ))

;; distinta dei componenti disegnati inserita come tabella in un punto
(defun c:LPS-TABELLA (/ tab p)
  (setq tab (lps:distinta-tab))
  (if (not tab)
    (lps:msg "Nessun componente LPS nel disegno.")
    (if (setq p (getpoint "\nAngolo in alto a sinistra della tabella: "))
      (lps:tabella-a tab (car p) (cadr p) (* (lps:fattore) *LPS-SCALA-SIMBOLI*))))
  (princ))

(lps:msg (strcat "Progettazione LPS " *LPS-VERSIONE* " caricato. Digita LPS per l'elenco dei comandi."))
;; avvio automatico: disegno del pacchetto CAD (c'e' un .lpsdati accanto) non ancora costruito
(if (and (lps:file-progetto) (not (lps:gia-costruito)))
  (progn
    (initget "Si No")
    (if (/= (getkword (strcat "\nCostruire il disegno LPS da " (vl-filename-base (lps:file-progetto)) ".lpsdati? [Si/No] <Si>: ")) "No")
      (c:LPS-AUTO))))
(princ)
