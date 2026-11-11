/**
 * Aiuti "?" nei punti di scelta. Chiave = etichetta del campo (in italiano, come scritta nella pagina).
 * Testi sintetici scritti con parole nostre (non estratti della norma), con il riferimento per approfondire.
 * daVerificare: true finché i riferimenti e i valori non sono confrontati con il testo dell'edizione 2024.
 */
export interface Aiuto { it: string; en: string; rif: string; daVerificare?: boolean }

export const AIUTI: Record<string, Aiuto> = {
  // ----- Dati edificio -----
  "Tipo di copertura": {
    it: "Indica come è fatto il tetto. Serve a scegliere supporti e posa dei conduttori di captazione e a valutare se la copertura metallica può fare da captatore naturale (spessori minimi della lamiera).",
    en: "Describes the roof. It drives the choice of supports and conductor installation, and whether a metal roof can act as a natural air-termination (minimum sheet thickness).",
    rif: "CEI EN IEC 62305-3, 5.2.5 e Tab. 3", daVerificare: true,
  },
  "Materiale della struttura": {
    it: "Il materiale incide sulle calate naturali (ferri d'armatura continui nel cemento armato), sulla distanza di separazione (km) e sul rischio d'incendio.",
    en: "The material affects natural down conductors (continuous reinforcement in concrete), the separation distance (km) and the fire risk.",
    rif: "CEI EN IEC 62305-3, 5.3.5 e 6.3", daVerificare: true,
  },
  "Posizione della struttura": {
    it: "Fattore di posizione CD: tiene conto degli oggetti vicini. Struttura circondata da oggetti più alti = 0,25; da oggetti di pari altezza o più bassi = 0,5; isolata = 1; isolata in cima a una collina = 2.",
    en: "Location factor CD: accounts for nearby objects. Surrounded by taller objects = 0.25; by objects of the same height or lower = 0.5; isolated = 1; isolated on a hilltop = 2.",
    rif: "CEI EN IEC 62305-2, Allegato A, Tab. A.1", daVerificare: true,
  },
  "Densità di fulminazione al suolo (fulmini/km²·anno)": {
    it: "NG: numero di fulmini a terra per km² all'anno nel luogo della struttura. Va preso dalle mappe ufficiali di fulminazione (in Italia la mappa NG di riferimento per comune).",
    en: "NG: number of ground flashes per km² per year at the structure's location. Take it from official lightning density maps (in Italy, the reference NG map by municipality).",
    rif: "CEI EN IEC 62305-2, Allegato A", daVerificare: true,
  },
  // ----- Analisi del rischio -----
  "Destinazione d'uso (LF)": {
    it: "LF è la percentuale tipica di vittime per danno fisico (incendio) in base all'uso: più alta dove la gente è numerosa o fatica a evacuare (ospedali, scuole, alberghi).",
    en: "LF is the typical percentage of victims from physical damage (fire) depending on use: higher where many people are present or evacuation is difficult (hospitals, schools, hotels).",
    rif: "CEI EN IEC 62305-2, Allegato C, Tab. C.2", daVerificare: true,
  },
  "Pavimento esterno/interno (rt)": {
    it: "rt riduce il rischio di folgorazione per tensioni di contatto e di passo in base alla resistenza del pavimento: asfalto, legno e linoleum isolano più di terreno o cemento.",
    en: "rt reduces the touch and step voltage risk depending on the floor resistance: asphalt, wood and linoleum insulate better than soil or concrete.",
    rif: "CEI EN IEC 62305-2, Tab. C.3", daVerificare: true,
  },
  "Rischio d'incendio (rf)": {
    it: "rf dipende dal carico d'incendio specifico: esplosione, alto (> 800 MJ/m²), ordinario (400–800), basso (< 400), nessuno. Con rischio di esplosione servono valutazioni dedicate.",
    en: "rf depends on the specific fire load: explosion, high (> 800 MJ/m²), ordinary (400–800), low (< 400), none. Explosion risk needs a dedicated assessment.",
    rif: "CEI EN IEC 62305-2, Tab. C.5", daVerificare: true,
  },
  "Protezione antincendio (rp)": {
    it: "rp riduce le conseguenze di un incendio: estintori, idranti, allarmi manuali (0,5) o impianti automatici di spegnimento/allarme e vigili del fuoco rapidi (0,2).",
    en: "rp reduces fire consequences: extinguishers, hydrants, manual alarms (0.5) or automatic extinguishing/alarm systems and fast fire brigade (0.2).",
    rif: "CEI EN IEC 62305-2, Tab. C.4", daVerificare: true,
  },
  "Pericolo particolare (hz)": {
    it: "hz aumenta il rischio quando il panico o la difficoltà di evacuazione aggravano il danno (es. molte persone, persone non autonome).",
    en: "hz increases the risk when panic or difficult evacuation worsen the damage (e.g. many people, non-autonomous people).",
    rif: "CEI EN IEC 62305-2, Tab. C.6", daVerificare: true,
  },
  "Misure contro tensioni di contatto e passo": {
    it: "Misure che riducono PTA: avvisi, isolamento delle calate (es. PVC ≥ 3 mm), equipotenzializzazione del suolo, barriere. Si sceglie la più efficace presente.",
    en: "Measures that reduce PTA: warning notices, down conductor insulation (e.g. PVC ≥ 3 mm), ground equipotentialisation, barriers. Choose the most effective one present.",
    rif: "CEI EN IEC 62305-2, Tab. B.1", daVerificare: true,
  },
  "Posa (CI)": {
    it: "CI: le linee aeree raccolgono più fulmini delle interrate; una linea interrata in un dispersore magliato quasi non conta.",
    en: "CI: overhead lines collect more flashes than buried ones; a line buried in a meshed earth electrode barely counts.",
    rif: "CEI EN IEC 62305-2, Tab. A.2", daVerificare: true,
  },
  "Ambiente (CE)": {
    it: "CE: tiene conto dell'ambiente attorno alla linea. In zona urbana con edifici alti la linea è più schermata che in zona rurale.",
    en: "CE: accounts for the environment around the line. In urban areas with tall buildings the line is more shielded than in rural areas.",
    rif: "CEI EN IEC 62305-2, Tab. A.4", daVerificare: true,
  },
  "Tipo (CT)": {
    it: "CT: una linea di bassa tensione o telecom arriva direttamente; con un trasformatore MT/BT a monte il fattore si riduce.",
    en: "CT: a low-voltage or telecom line arrives directly; with an MV/LV transformer upstream the factor is reduced.",
    rif: "CEI EN IEC 62305-2, Tab. A.3", daVerificare: true,
  },
  "LPS (PB)": {
    it: "PB è la probabilità di danno fisico in base al livello dell'LPS: più alto il livello (I è il più severo), più bassa la probabilità.",
    en: "PB is the probability of physical damage depending on the LPS class: the higher the class (I is the most severe), the lower the probability.",
    rif: "CEI EN IEC 62305-2, Tab. B.2", daVerificare: true,
  },
  "SPD coordinati (PEB, PSPD)": {
    it: "Un sistema di SPD coordinati riduce la probabilità che le sovratensioni entrino dalle linee. Il livello va scelto coerente con l'LPL.",
    en: "A coordinated SPD system reduces the probability of surges entering through the lines. The level should match the LPL.",
    rif: "CEI EN IEC 62305-2, Tab. B.3 e B.7", daVerificare: true,
  },
  // ----- Captazione -----
  "LPL": {
    it: "Il livello di protezione nasce dall'analisi del rischio. Determina raggio della sfera rotolante (I 20 m, II 30 m, III 45 m, IV 60 m), lato massimo della maglia (5, 10, 15, 20 m) e passo delle calate (10, 10, 15, 20 m).",
    en: "The protection level comes from the risk assessment. It sets the rolling sphere radius (I 20 m, II 30 m, III 45 m, IV 60 m), maximum mesh size (5, 10, 15, 20 m) and down conductor spacing (10, 10, 15, 20 m).",
    rif: "CEI EN IEC 62305-3, Tab. 2 e Tab. 4", daVerificare: true,
  },
  "Strategia proposta": {
    it: "Maglia: per coperture piane estese. Aste: per proteggere impianti sul tetto e punti sporgenti. Mista: maglia sulla copertura e aste dove la sfera rotolante tocca impianti o parti alte.",
    en: "Mesh: for large flat roofs. Rods: to protect rooftop equipment and protruding points. Mixed: mesh on the roof and rods where the rolling sphere touches equipment or high parts.",
    rif: "CEI EN IEC 62305-3, 5.2.2", daVerificare: true,
  },
  "Quota conduttore sopra la copertura (m)": {
    it: "Altezza dei conduttori sopra il tetto. Su coperture infiammabili i conduttori vanno distanziati; sui tetti metallici non infiammabili possono essere posati a contatto.",
    en: "Height of the conductors above the roof. On flammable roofs conductors must be kept at a distance; on non-flammable metal roofs they can be laid in contact.",
    rif: "CEI EN IEC 62305-3, 5.2.4", daVerificare: true,
  },
  "Percorso sfera": {
    it: "Passo con cui la sfera rotolante viene fatta scorrere sul modello: più fine = verifica più precisa ma più lenta.",
    en: "Step used to roll the sphere over the model: finer = more precise but slower check.",
    rif: "CEI EN IEC 62305-3, Allegato A", daVerificare: true,
  },
  // ----- Calate -----
  "Calcolo di kc": {
    it: "kc ripartisce la corrente tra le calate. Il metodo semplificato usa 1 (una calata), 0,66 (due), 0,44 (tre o più, con anello). Il metodo dettagliato tiene conto di numero di calate, anelli e distanze.",
    en: "kc shares the current among down conductors. The simplified method uses 1 (one conductor), 0.66 (two), 0.44 (three or more, with ring). The detailed method considers number of conductors, rings and distances.",
    rif: "CEI EN IEC 62305-3, 6.3 e Allegato C", daVerificare: true,
  },
  "km aria": {
    it: "km dipende dal materiale isolante tra captazione/calata e parti metalliche: aria = 1, materiale solido (muratura, calcestruzzo) = 0,5. La distanza s si calcola con s = ki · kc / km · l.",
    en: "km depends on the insulating material between air-termination/down conductor and metal parts: air = 1, solid material (masonry, concrete) = 0.5. The distance is s = ki · kc / km · l.",
    rif: "CEI EN IEC 62305-3, 6.3, Tab. 10–12", daVerificare: true,
  },
  "Perimetro dell'edificio (m)": {
    it: "Il numero minimo di calate si ottiene dal perimetro diviso per il passo tipico del livello di protezione, con almeno due calate.",
    en: "The minimum number of down conductors is the perimeter divided by the typical spacing for the protection level, with at least two.",
    rif: "CEI EN IEC 62305-3, 5.3.3, Tab. 4", daVerificare: true,
  },
  "Parete delle calate": {
    it: "Come sono posate le calate sulla parete: a vista, sotto intonaco o sotto cappotto. Su pareti infiammabili servono distanze o protezioni adeguate.",
    en: "How down conductors are installed on the wall: exposed, under plaster or under insulation. On flammable walls proper distances or protection are needed.",
    rif: "CEI EN IEC 62305-3, 5.3.4", daVerificare: true,
  },
  // ----- Terra -----
  "Tipo di dispersore": {
    it: "Tipo A: picchetti o conduttori radiali collegati a ogni calata (lunghezza minima l1). Tipo B: anello perimetrale interrato per almeno l'80% della lunghezza. Fondazione: ferri o conduttori annegati nelle fondazioni.",
    en: "Type A: rods or radial conductors at each down conductor (minimum length l1). Type B: buried ring for at least 80% of its length. Foundation: bars or conductors embedded in the foundations.",
    rif: "CEI EN IEC 62305-3, 5.4.2", daVerificare: true,
  },
  "Lunghezza minima l1 (m)": {
    it: "l1 dipende dal livello di protezione e dalla resistività del terreno: per LPL III-IV vale 5 m; per I-II cresce con la resistività. I picchetti verticali possono essere lunghi 0,5·l1.",
    en: "l1 depends on the protection level and soil resistivity: for LPL III-IV it is 5 m; for I-II it grows with resistivity. Vertical rods can be 0.5·l1 long.",
    rif: "CEI EN IEC 62305-3, 5.4.2.1, Fig. 3", daVerificare: true,
  },
  "Resistività ρ (Ω·m)": {
    it: "Meglio un valore misurato (metodo Wenner). I valori tipici per tipo di terreno sono solo indicativi: la resistività cambia con umidità e stagione.",
    en: "A measured value (Wenner method) is best. Typical values by soil type are only indicative: resistivity changes with moisture and season.",
    rif: "CEI EN IEC 62305-3, 5.4; CEI EN 50522", daVerificare: true,
  },
  "Profondità (m)": {
    it: "Profondità di posa del dispersore: di norma almeno 0,5 m e a circa 1 m dalle pareti, per ridurre gli effetti di gelo e corrosione.",
    en: "Installation depth of the earth electrode: usually at least 0.5 m and about 1 m from the walls, to reduce frost and corrosion effects.",
    rif: "CEI EN IEC 62305-3, 5.4.3", daVerificare: true,
  },
  // ----- SPD -----
  "Sistema di distribuzione": {
    it: "TT, TN-C, TN-S o IT: cambia lo schema di collegamento degli SPD (es. 3+1 nel TT) e la tensione Uc minima.",
    en: "TT, TN-C, TN-S or IT: changes the SPD connection scheme (e.g. 3+1 in TT) and the minimum Uc.",
    rif: "CEI EN IEC 62305-4; CEI EN 61643-12", daVerificare: true,
  },
  "Categoria di tenuta degli apparecchi": {
    it: "Tensione di tenuta Uw degli apparecchi da proteggere (categoria I–IV). Il livello di protezione Up dell'SPD deve stare sotto Uw con margine (indicativamente Up ≤ 0,8 · Uw).",
    en: "Impulse withstand voltage Uw of the equipment to protect (category I–IV). The SPD protection level Up must be below Uw with a margin (about Up ≤ 0.8 · Uw).",
    rif: "CEI EN IEC 62305-4, Allegato D; CEI EN 61643-12", daVerificare: true,
  },
  "Servizi metallici entranti (energia, acqua, gas, telecom…)": {
    it: "Metodo semplificato: circa metà della corrente di fulmine va nell'impianto di terra e il resto si divide tra i servizi entranti. Più servizi = meno corrente per servizio e per conduttore.",
    en: "Simplified method: about half of the lightning current goes into the earthing system and the rest is shared among incoming services. More services = less current per service and per conductor.",
    rif: "CEI EN IEC 62305-1, Allegato E", daVerificare: true,
  },
  "Sottoquadri a più di 10 m": {
    it: "Oltre circa 10 m di cavo dall'SPD d'ingresso la protezione degli apparecchi può non bastare: si aggiunge un SPD di tipo 2 nel sottoquadro.",
    en: "Beyond about 10 m of cable from the entrance SPD, equipment protection may not be enough: add a type 2 SPD in the sub-board.",
    rif: "CEI EN IEC 62305-4; CEI EN 61643-12", daVerificare: true,
  },
  // ----- Verifiche -----
  "Visiva ogni (anni)": {
    it: "Intervallo tra due verifiche visive in base al livello di protezione (indicativamente 1 anno per I-II, 2 anni per III-IV).",
    en: "Interval between two visual inspections by protection level (about 1 year for I-II, 2 years for III-IV).",
    rif: "CEI EN IEC 62305-3, Allegato E, Tab. E.2", daVerificare: true,
  },
  "Completa ogni (anni)": {
    it: "Intervallo tra due verifiche complete, con misure di continuità e di resistenza di terra (indicativamente 2 anni per I-II, 4 anni per III-IV).",
    en: "Interval between two full inspections, with continuity and earth resistance measurements (about 2 years for I-II, 4 years for III-IV).",
    rif: "CEI EN IEC 62305-3, Allegato E, Tab. E.2", daVerificare: true,
  },
  "Completa, sistemi critici (anni)": {
    it: "Per strutture con rischio di esplosione o servizi essenziali la verifica completa è più frequente (indicativamente ogni anno).",
    en: "For structures with explosion risk or essential services the full inspection is more frequent (about every year).",
    rif: "CEI EN IEC 62305-3, Allegato E, Tab. E.2", daVerificare: true,
  },
};
