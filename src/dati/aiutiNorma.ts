/**
 * Aiuti "?" nei punti di scelta. Chiave = etichetta del campo (in italiano, come scritta nella pagina).
 * Testi sintetici scritti con parole nostre (non estratti della norma), con il riferimento per approfondire.
 * Riferimenti confrontati con la CEI EN IEC 62305 edizione 2024 (parti 1–4).
 * daVerificare: true solo dove il contenuto dipende da altre norme o da dati del produttore.
 */
export interface Aiuto { it: string; en: string; rif: string; daVerificare?: boolean }

const RISCHIO = "CEI EN IEC 62305-2:2024";
const LPS = "CEI EN IEC 62305-3:2024";

export const AIUTI: Record<string, Aiuto> = {
  // ----- Dati edificio -----
  "Tipo di copertura": {
    it: "Indica come è fatto il tetto. Serve a scegliere supporti e posa dei conduttori di captazione e a valutare se la copertura metallica può fare da captatore naturale, in base allo spessore minimo della lamiera.",
    en: "Describes the roof. It drives the choice of supports and conductor installation, and whether a metal roof can act as a natural air-termination, based on minimum sheet thickness.",
    rif: `${LPS}, 5.2.5 e Tab. 3`,
  },
  "Materiale della struttura": {
    it: "Il materiale incide sulle calate naturali (ferri d'armatura continui nel cemento armato), sulla distanza di separazione (km) e, nell'analisi del rischio, sulla probabilità PS di scariche pericolose senza LPS.",
    en: "The material affects natural down conductors (continuous reinforcement in concrete), the separation distance (km) and, in the risk assessment, the probability PS of dangerous sparking without an LPS.",
    rif: `${LPS}, 5.3.5 e 6.3; ${RISCHIO}, Tab. B.4`,
  },
  "Posizione della struttura": {
    it: "Coefficiente di posizione CD: tiene conto degli oggetti entro 3 volte l'altezza. Circondata da oggetti più alti = 0,25; da oggetti di pari altezza o più bassi = 0,5; isolata = 1; isolata in cima a una collina = 2.",
    en: "Location factor CD: accounts for objects within 3 times the height. Surrounded by taller objects = 0.25; by objects of the same height or lower = 0.5; isolated = 1; isolated on a hilltop = 2.",
    rif: `${RISCHIO}, A.2.3 e Tab. A.1`,
  },
  "Densità di fulminazione al suolo (fulmini/km²·anno)": {
    it: "NG: fulmini a terra per km² all'anno nel luogo della struttura, dalla mappa ufficiale. Dal 2024 il calcolo usa i punti di impatto NSG = k · NG: se il fornitore dei dati non indica k si usa k = 2.",
    en: "NG: ground flashes per km² per year at the site, from the official map. Since 2024 the calculation uses ground strike points NSG = k · NG: if the data provider gives no k, use k = 2.",
    rif: `${RISCHIO}, A.1`,
  },
  // ----- Analisi del rischio -----
  "Coefficiente k (NSG = k · NG)": {
    it: "Trasforma la densità dei fulmini NG nella densità dei punti di impatto NSG (un fulmine può toccare terra in più punti). Usa il k del fornitore dei dati di fulminazione; se non c'è, 2.",
    en: "Converts flash density NG into ground strike point density NSG (one flash can strike the ground at several points). Use the k from the lightning data provider; if none, 2.",
    rif: `${RISCHIO}, A.1`,
  },
  "Tensione di tenuta Uw degli impianti (kV)": {
    it: "La tensione di tenuta più bassa degli apparecchi collegati. Più è bassa, più è ampia l'area attorno a struttura e linee in cui un fulmine vicino causa danni (rM = 350/Uw, rI = 2000/Uw^1,8). Tipico 2,5 kV per la rete 230/400 V, 1,5 kV per i segnali.",
    en: "The lowest withstand voltage of the connected equipment. The lower it is, the wider the area around the structure and lines where a nearby flash causes damage (rM = 350/Uw, rI = 2000/Uw^1.8). Typically 2.5 kV for 230/400 V mains, 1.5 kV for signal ports.",
    rif: `${RISCHIO}, A.3 e A.5`,
  },
  "Categoria della struttura (perdite LF, LO)": {
    it: "Le perdite tipiche dipendono da quanto è critica la struttura: molto elevata (esplosione, sale operatorie), elevata (degenze, carceri, sale controllo, musei), normale (aperte al pubblico: scuole, uffici, alberghi, negozi), bassa (proprietà privata). Si usa il valore più alto dell'intervallo, salvo uno studio specifico.",
    en: "Typical losses depend on how critical the structure is: very high (explosion, operating theatres), high (wards, prisons, control rooms, museums), normal (open to the public: schools, offices, hotels, shops), low (private property). Use the highest value of the range unless a specific study says otherwise.",
    rif: `${RISCHIO}, Allegato C, Tab. C.2`,
  },
  "Pavimento esterno/interno (rt)": {
    it: "rt riduce il pericolo per tensioni di contatto e di passo in base alla resistenza del pavimento: asfalto, linoleum e legno isolano più di terreno o cemento. Uno strato isolante di 5 cm (es. asfalto) di solito basta a rendere il pericolo trascurabile.",
    en: "rt reduces the touch and step voltage hazard depending on floor resistance: asphalt, linoleum and wood insulate better than soil or concrete. A 5 cm insulating layer (e.g. asphalt) usually makes the hazard negligible.",
    rif: `${RISCHIO}, Tab. B.2`,
  },
  "Rischio d'incendio o di esplosione (rf)": {
    it: "rf dipende dal carico d'incendio specifico (alto > 800 MJ/m², ordinario 400–800, basso < 400) o dalla zona con atmosfera esplosiva (0/20, 1/21, 2/22). Con rischio di esplosione entrano anche i danni materiali da guasto degli impianti.",
    en: "rf depends on the specific fire load (high > 800 MJ/m², ordinary 400–800, low < 400) or on the explosive atmosphere zone (0/20, 1/21, 2/22). With explosion risk, material damage from system failure is also included.",
    rif: `${RISCHIO}, Tab. B.6`,
  },
  "Protezione antincendio (rp)": {
    it: "rp riduce le conseguenze di un incendio: estintori, idranti, allarme manuale, compartimentazione o vie di fuga (0,5); impianto automatico di spegnimento o allarme con intervento entro 10 minuti (0,2). Vale solo se il committente ne è informato; con batterie al litio o zone esplosive si usa 1.",
    en: "rp reduces fire consequences: extinguishers, hydrants, manual alarm, compartments or protected escape routes (0.5); automatic extinguishing or alarm with response within 10 minutes (0.2). Only valid if the owner is informed; with lithium batteries or explosive zones use 1.",
    rif: `${RISCHIO}, Tab. B.5`,
  },
  "Tipo di struttura senza LPS (PS)": {
    it: "Senza LPS, una struttura in cemento armato continuo o metallica interconnessa ha metà probabilità di scariche pericolose rispetto a legno e muratura. Con un LPS conforme alla 62305-3 vale 1 e conta solo la classe dell'LPS.",
    en: "Without an LPS, a structure in continuous reinforced concrete or interconnected metal has half the probability of dangerous sparking compared with wood and masonry. With an LPS to 62305-3 it is 1 and only the LPS class counts.",
    rif: `${RISCHIO}, B.4 e Tab. B.4`,
  },
  "Misure contro tensioni di contatto e passo (PAM)": {
    it: "PAM: cartelli ammonitori (0,1), isolamento delle calate o equipotenzializzazione del suolo (0,01), LPS naturale con struttura metallica o c.a. interconnesso (0,001), limitazioni di accesso (0). Più misure insieme si moltiplicano. Efficaci solo con un LPS.",
    en: "PAM: warning notices (0.1), down conductor insulation or ground equipotentialisation (0.01), natural LPS with interconnected metal or concrete frame (0.001), access restrictions (0). Several measures multiply. Only effective with an LPS.",
    rif: `${RISCHIO}, Tab. B.1`,
  },
  "Presenza di persone (ore/anno, PP = ore/8760)": {
    it: "Ore all'anno in cui ci sono persone nella struttura. Se non si conosce si lascia 8760 (sempre presenti), che è il caso più cautelativo.",
    en: "Hours per year when people are in the structure. If unknown leave 8760 (always present), the most conservative case.",
    rif: `${RISCHIO}, B.11`,
  },
  "Posa (CI)": {
    it: "CI: le linee aeree raccolgono più fulmini delle interrate (0,3 dal 2024); una linea interrata dentro un dispersore magliato quasi non conta (0,01).",
    en: "CI: overhead lines collect more flashes than buried ones (0.3 since 2024); a line buried within a meshed earth electrode barely counts (0.01).",
    rif: `${RISCHIO}, Tab. A.2`,
  },
  "Ambiente (CE)": {
    it: "CE: tiene conto dell'ambiente attorno alla linea. In zona urbana con edifici oltre 20 m la linea è molto più schermata che in zona rurale.",
    en: "CE: accounts for the environment around the line. In urban areas with buildings over 20 m the line is much more shielded than in rural areas.",
    rif: `${RISCHIO}, Tab. A.4`,
  },
  "Tipo (CT)": {
    it: "CT: una linea di bassa tensione, telecom o dati arriva direttamente (1); con un trasformatore AT/BT a avvolgimenti separati a monte si riduce (0,2).",
    en: "CT: a low-voltage, telecom or data line arrives directly (1); with an HV/LV transformer with separate windings upstream it is reduced (0.2).",
    rif: `${RISCHIO}, Tab. A.3`,
  },
  "Schermatura (PLD)": {
    it: "Una linea con schermo collegato alla stessa barra equipotenziale delle apparecchiature trasporta meno sovratensione: più bassa la resistenza dello schermo e più alta la tenuta Uw, più bassa la probabilità di guasto PLD.",
    en: "A line whose shield is bonded to the same equipotential bar as the equipment carries less surge: the lower the shield resistance and the higher the withstand Uw, the lower the failure probability PLD.",
    rif: `${RISCHIO}, Tab. B.9 e B.11`,
  },
  "LPS (PLPS)": {
    it: "PLPS è la probabilità di danno materiale in base alla classe dell'LPS: IV 0,2 · III 0,1 · II 0,05 · I 0,02; con struttura metallica o c.a. come calate naturali si scende a 0,01 e 0,001.",
    en: "PLPS is the probability of physical damage depending on the LPS class: IV 0.2 · III 0.1 · II 0.05 · I 0.02; with a metal or concrete frame as natural down conductors it drops to 0.01 and 0.001.",
    rif: `${RISCHIO}, Tab. B.3`,
  },
  "SPD coordinati (PEB, PSPD)": {
    it: "PEB: SPD di collegamento equipotenziale all'ingresso delle linee (riducono incendi e folgorazioni). PSPD: sistema coordinato di SPD (riduce i guasti degli impianti e la frequenza del danno F). Livello III-IV 0,05 · II 0,02 · I 0,01.",
    en: "PEB: equipotential bonding SPDs at line entry (reduce fire and electric shock). PSPD: coordinated SPD system (reduces system failures and the damage frequency F). Level III-IV 0.05 · II 0.02 · I 0.01.",
    rif: `${RISCHIO}, Tab. B.7, B.8 e B.13`,
  },
  // ----- Captazione -----
  "LPL": {
    it: "Il livello di protezione nasce dall'analisi del rischio. Determina raggio della sfera rotolante (I 20 m, II 30 m, III 45 m, IV 60 m), lato della maglia (5, 10, 15, 20 m, aumentabile fino al 25 % se il perimetro non cresce) e passo delle calate (10, 10, 15, 20 m).",
    en: "The protection level comes from the risk assessment. It sets the rolling sphere radius (I 20 m, II 30 m, III 45 m, IV 60 m), mesh size (5, 10, 15, 20 m, up to 25 % larger if the perimeter does not increase) and down conductor spacing (10, 10, 15, 20 m).",
    rif: `${LPS}, Tab. 2 e Tab. 5; CEI EN IEC 62305-1:2024, Tab. 4`,
  },
  "Strategia proposta": {
    it: "Maglia: per coperture piane o inclinate (oltre 1/10 di pendenza servono conduttori sul colmo). Aste: per impianti sul tetto e punti sporgenti. Mista: maglia sulla copertura e aste dove la sfera rotolante tocca impianti o parti alte. Sotto i 60 m i fulmini laterali si possono trascurare.",
    en: "Mesh: for flat or pitched roofs (above a 1/10 slope conductors are needed on the ridge). Rods: for rooftop equipment and protruding points. Mixed: mesh on the roof and rods where the rolling sphere touches equipment or high parts. Below 60 m side flashes can be neglected.",
    rif: `${LPS}, 5.2.2 e 5.2.2.4`,
  },
  "Quota conduttore sopra la copertura (m)": {
    it: "Altezza dei conduttori sopra il tetto. Su coperture infiammabili i conduttori vanno distanziati; sui tetti metallici non infiammabili possono essere posati a contatto.",
    en: "Height of the conductors above the roof. On flammable roofs conductors must be kept at a distance; on non-flammable metal roofs they can be laid in contact.",
    rif: `${LPS}, 5.2.4`,
  },
  "Percorso sfera": {
    it: "Passo con cui la sfera rotolante viene fatta scorrere sul modello: più fine = verifica più precisa ma più lenta.",
    en: "Step used to roll the sphere over the model: finer = more precise but slower check.",
    rif: `${LPS}, 5.2.2.2 e Allegato D`,
  },
  // ----- Calate -----
  "Calcolo di kc": {
    it: "kc ripartisce la corrente tra le calate. Metodo semplificato: 1 (una calata, solo LPS isolato), 0,66 (due), 0,44 (tre o più), se le resistenze dei dispersori non differiscono più di 2 volte, altrimenti 1. Il metodo dettagliato usa numero di calate, distanza tra loro e altezza degli anelli.",
    en: "kc shares the current among down conductors. Simplified method: 1 (one conductor, isolated LPS only), 0.66 (two), 0.44 (three or more), if electrode resistances differ by less than a factor 2, otherwise 1. The detailed method uses the number of conductors, their spacing and ring heights.",
    rif: `${LPS}, 6.3, Tab. 13 e Allegato B`,
  },
  "km aria": {
    it: "km dipende dal materiale isolante tra captazione/calata e parti metalliche: aria 1; calcestruzzo, mattoni, legno 0,5; distanziatori isolanti FRP, PE o PVC lunghi almeno 0,5 m 0,7. Con più materiali in serie si usa il valore più basso. s = ki · kc / km · l.",
    en: "km depends on the insulating material between air-termination/down conductor and metal parts: air 1; concrete, bricks, wood 0.5; FRP, PE or PVC insulating spacers at least 0.5 m long 0.7. With several materials in series use the lowest. s = ki · kc / km · l.",
    rif: `${LPS}, 6.3, Tab. 11 e 12`,
  },
  "Perimetro dell'edificio (m)": {
    it: "Il numero minimo di calate si ottiene dal perimetro diviso per il passo del livello di protezione (10, 10, 15, 20 m), con almeno due calate e possibilmente una per spigolo.",
    en: "The minimum number of down conductors is the perimeter divided by the spacing for the protection level (10, 10, 15, 20 m), with at least two and preferably one at each corner.",
    rif: `${LPS}, 5.3.3 e Tab. 5`,
  },
  "Parete delle calate": {
    it: "Come sono posate le calate sulla parete: a vista, sotto intonaco o sotto cappotto. Vanno il più possibile dritte e verticali; su pareti infiammabili servono distanze o protezioni adeguate.",
    en: "How down conductors are installed on the wall: exposed, under plaster or under insulation. They should be as straight and vertical as possible; on flammable walls proper distances or protection are needed.",
    rif: `${LPS}, 5.3.4`,
  },
  // ----- Terra -----
  "Tipo di dispersore": {
    it: "Tipo A: picchetti o conduttori radiali a ogni calata (lunghezza minima l1). Tipo B: anello esterno a contatto con il terreno per almeno l'80 % della lunghezza, oppure dispersore di fondazione ad anello chiuso. Oltre 3000 Ω·m è consigliato il tipo B.",
    en: "Type A: rods or radial conductors at each down conductor (minimum length l1). Type B: external ring in contact with soil for at least 80 % of its length, or a closed-ring foundation electrode. Above 3000 Ω·m type B is recommended.",
    rif: `${LPS}, 5.4.2`,
  },
  "Lunghezza minima l1 (m)": {
    it: "l1 dipende dalla classe dell'LPS e dalla resistività: classi III-IV 5 m; classe I sale da 5 m (500 Ω·m) a 80 m (3000 Ω·m); classe II da 5 m (circa 800 Ω·m) a circa 48 m. Picchetti verticali 0,5·l1; anello: raggio equivalente ≥ l1. Si può ignorare se il tipo A ha meno di 10 Ω.",
    en: "l1 depends on the LPS class and soil resistivity: classes III-IV 5 m; class I rises from 5 m (500 Ω·m) to 80 m (3000 Ω·m); class II from 5 m (about 800 Ω·m) to about 48 m. Vertical rods 0.5·l1; ring: equivalent radius ≥ l1. May be ignored if type A is below 10 Ω.",
    rif: `${LPS}, 5.4.2.2, 5.4.2.3 e Fig. 5`,
  },
  "Resistività ρ (Ω·m)": {
    it: "Meglio un valore misurato alla profondità dei dispersori (metodo Wenner). I valori tipici per tipo di terreno sono solo indicativi: la resistività cambia con umidità e stagione.",
    en: "A value measured at electrode depth (Wenner method) is best. Typical values by soil type are only indicative: resistivity changes with moisture and season.",
    rif: `${LPS}, Fig. 5 Nota 2; CEI EN 50522`,
  },
  "Profondità (m)": {
    it: "Anello (tipo B) preferibilmente ad almeno 0,5 m di profondità e a circa 1 m dai muri; picchetti (tipo A) ad almeno 0,5 m. Dove il terreno gela o si secca, ai picchetti si aggiungono 0,5 m.",
    en: "Ring (type B) preferably at least 0.5 m deep and about 1 m from the walls; rods (type A) at least 0.5 m deep. Where soil freezes or dries out, add 0.5 m to the rods.",
    rif: `${LPS}, 5.4.3`,
  },
  // ----- SPD -----
  "Sistema di distribuzione": {
    it: "TT, TN-C, TN-S o IT: cambia lo schema di collegamento degli SPD (es. 3+1 nel TT) e la tensione Uc minima.",
    en: "TT, TN-C, TN-S or IT: changes the SPD connection scheme (e.g. 3+1 in TT) and the minimum Uc.",
    rif: "CEI EN IEC 62305-4:2024, Allegato C; CEI EN 61643-12; CEI 64-8/5-534", daVerificare: true,
  },
  "Categoria di tenuta degli apparecchi": {
    it: "Tensione di tenuta Uw degli apparecchi da proteggere (categoria I–IV). Il livello di protezione Up dell'SPD deve stare sotto Uw con margine per la lunghezza dei collegamenti (indicativamente Up ≤ 0,8 · Uw).",
    en: "Impulse withstand voltage Uw of the equipment to protect (category I–IV). The SPD protection level Up must be below Uw with a margin for connection length (about Up ≤ 0.8 · Uw).",
    rif: "CEI EN IEC 62305-4:2024, Allegato C; CEI EN 61643-12", daVerificare: true,
  },
  "Servizi metallici entranti (energia, acqua, gas, telecom…)": {
    it: "Regola semplificata: metà della corrente di fulmine va nell'impianto di terra e l'altra metà si divide tra i servizi entranti e poi tra i loro conduttori. Più servizi = meno corrente per servizio e per conduttore.",
    en: "Simplified rule: half of the lightning current goes into the earthing system and the other half is shared among incoming services and then their conductors. More services = less current per service and per conductor.",
    rif: "CEI EN IEC 62305-1:2024, E.2",
  },
  "Sottoquadri a più di 10 m": {
    it: "Oltre circa 10 m di cavo dall'SPD d'ingresso la protezione degli apparecchi può non bastare (oscillazioni della tensione): si aggiunge un SPD di tipo 2 nel sottoquadro.",
    en: "Beyond about 10 m of cable from the entrance SPD, equipment protection may not be enough (voltage oscillation): add a type 2 SPD in the sub-board.",
    rif: "CEI EN IEC 62305-4:2024, Allegato C; CEI EN 61643-12", daVerificare: true,
  },
  // ----- Aggiunte: altri punti di scelta -----
  "Lunghezza (m)": {
    it: "Lunghezza della linea dalla struttura al primo nodo (cabina, armadio, derivazione). Se non si conosce si usa 1000 m, valore cautelativo indicato dalla norma per la somma delle linee di energia e per le linee di telecomunicazione.",
    en: "Line length from the structure to the first node (substation, cabinet, branch). If unknown use 1000 m, the conservative value given by the standard for power lines combined and for telecom lines.",
    rif: `${RISCHIO}, 8.2 e A.4`,
  },
  "Altezza h (m)": {
    it: "Per il kc dettagliato: distanza verticale tra gli anelli che collegano le calate (o altezza della struttura se non ci sono anelli intermedi). La formula vale per strutture con almeno 4 calate e h, c tra 3 e 20 m.",
    en: "For the detailed kc: vertical distance between the rings interconnecting the down conductors (or structure height without intermediate rings). The formula applies to structures with at least 4 down conductors and h, c between 3 and 20 m.",
    rif: `${LPS}, Allegato B, Fig. B.2 e B.3`,
  },
  "km materiale solido (tipico 0.5)": {
    it: "Calcestruzzo, mattoni o legno tra conduttore e parte metallica: 0,5. Per altri isolanti il valore lo dà il produttore; distanziatori in FRP, PE o PVC lunghi almeno 0,5 m: 0,7.",
    en: "Concrete, bricks or wood between conductor and metal part: 0.5. For other insulators the manufacturer gives the value; FRP, PE or PVC spacers at least 0.5 m long: 0.7.",
    rif: `${LPS}, Tab. 12`,
  },
  "Distanza dal muro (m)": {
    it: "Il dispersore ad anello va posato preferibilmente a circa 1 m dai muri perimetrali, così lavora meglio e si riducono le tensioni di passo vicino all'edificio.",
    en: "The ring electrode should preferably be laid about 1 m from the outer walls, so it works better and step voltages near the building are reduced.",
    rif: `${LPS}, 5.4.3`,
  },
  "Lunghezza picchetto (m)": {
    it: "Per il dispersore di tipo A ogni picchetto verticale deve essere lungo almeno 0,5·l1; dove il terreno gela o si secca si aggiungono 0,5 m, perché la parte superiore non conta.",
    en: "For a type A electrode each vertical rod must be at least 0.5·l1 long; where soil freezes or dries out add 0.5 m, as the top part does not count.",
    rif: `${LPS}, 5.4.2.2 e 5.4.3`,
  },
  "Lato maglia fondazione (m)": {
    it: "Lato della maglia del dispersore di fondazione. Con maglie fitte (dell'ordine di 1 m) la corrente nelle linee collegate in punti diversi è trascurabile; più la maglia è fitta, migliore l'equipotenzialità.",
    en: "Mesh size of the foundation electrode. With dense meshes (about 1 m) the current in lines bonded at different points is negligible; the denser the mesh, the better the equipotentiality.",
    rif: `${LPS}, 5.4.2.3; CEI EN IEC 62305-1:2024, E.2.5`, daVerificare: true,
  },
  "Profondità di posa (m)": {
    it: "Profondità del conduttore interrato o della testa del picchetto: almeno 0,5 m, per stabilizzare la resistenza rispetto a gelo e siccità.",
    en: "Depth of the buried conductor or rod top: at least 0.5 m, to stabilise resistance against frost and drought.",
    rif: `${LPS}, 5.4.3`,
  },
  "Resistenza di terra misurata (Ω)": {
    it: "Se supera 10 Ω bisogna controllare che i dispersori rispettino la lunghezza minima l1 della Fig. 5 (in terreno roccioso il limite dei 10 Ω non si applica). Una variazione forte rispetto alle misure precedenti va indagata.",
    en: "Above 10 Ω check that the electrodes meet the minimum length l1 of Fig. 5 (in rocky soil the 10 Ω limit does not apply). A large change from previous measurements must be investigated.",
    rif: `${LPS}, D.7 e Fig. 5`,
  },
  "Continuità: valore massimo (Ω)": {
    it: "Per le calate naturali nei ferri d'armatura la resistenza complessiva tra captazione e barra equipotenziale non deve superare 0,2 Ω, misurata con strumento a quattro morsetti e circa 10 A.",
    en: "For natural down conductors in reinforcement, the overall resistance between air-termination and equipotential bar must not exceed 0.2 Ω, measured with a four-wire instrument and about 10 A.",
    rif: `${LPS}, 5.3.5 e D.5.3.5.2`,
  },
  "Alimentazione": {
    it: "Monofase o trifase cambia il numero di conduttori che si dividono la corrente di fulmine (es. 3 fasi + N = 4): più conduttori, meno corrente per polo dell'SPD.",
    en: "Single or three phase changes the number of conductors sharing the lightning current (e.g. 3 phases + N = 4): more conductors, less current per SPD pole.",
    rif: "CEI EN IEC 62305-1:2024, E.2.3",
  },
  "Apparecchi sensibili da proteggere": {
    it: "Apparecchi lontani dal quadro o con bassa tensione di tenuta richiedono un SPD di tipo 3 vicino (entro pochi metri), coordinato con quelli a monte.",
    en: "Equipment far from the board or with low withstand voltage needs a type 3 SPD close by (within a few metres), coordinated with the upstream ones.",
    rif: "CEI EN IEC 62305-4:2024, Allegato C", daVerificare: true,
  },
  "Coefficiente di utilizzo η (0–1)": {
    it: "Più dispersori vicini si disturbano a vicenda: la resistenza totale è più alta del semplice parallelo. η tiene conto di questo effetto; picchetti distanti almeno il doppio della loro lunghezza hanno η vicino a 1.",
    en: "Electrodes close together interfere with each other: the total resistance is higher than a simple parallel. η accounts for this; rods spaced at least twice their length have η close to 1.",
    rif: "Metodo di calcolo dell'app (non fissato dalla CEI EN IEC 62305); si veda CEI EN 50522", daVerificare: true,
  },
  // ----- Verifiche -----
  "Visiva ogni (anni)": {
    it: "Dal 2024 l'intervallo non dipende più dalla classe dell'LPS: esame a vista ogni anno; in condizioni climatiche severe ogni 6 mesi. Se non si fa l'esame a vista annuale, la verifica completa va fatta ogni 2 anni.",
    en: "Since 2024 the interval no longer depends on the LPS class: visual inspection every year; in severe climates every 6 months. Without an annual visual inspection, the full inspection is due every 2 years.",
    rif: `${LPS}, 7 e D.7.2.2`,
  },
  "Completa ogni (anni)": {
    it: "Verifica completa con prove elettriche (continuità, resistenza di terra) ogni 3 anni, oltre che dopo modifiche importanti della struttura o dopo un fulmine noto o sospetto.",
    en: "Full inspection with electrical tests (continuity, earth resistance) every 3 years, and also after major changes to the structure or after a known or suspected lightning strike.",
    rif: `${LPS}, 7 e D.7.2.2`,
  },
  "Completa, sistemi critici (anni)": {
    it: "Ogni anno per strutture a rischio di esplosione, con impianti sensibili, uffici, edifici commerciali o luoghi con molte persone (accettabile anche ogni 14–15 mesi per seguire le variazioni stagionali della resistenza di terra).",
    en: "Every year for structures with explosion risk, sensitive systems, offices, commercial buildings or crowded places (14–15 months is also acceptable to track seasonal earth resistance changes).",
    rif: `${LPS}, D.7.2.2`,
  },
};
