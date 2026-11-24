/**
 * Destinazioni d'uso ammesse in Progettazione LPS (documento "destinazione d'uso" di Marco, 24/11/2026):
 * abitativa (residenziale), ricettiva (alberghi, B&B, agriturismi, case vacanza) e uso promiscuo delle due.
 * I testi della relazione sono scritti da noi; i valori di perdita e affollamento restano quelli della pagina Rischio.
 */
export interface Destinazione { id: string; nome: string; testo: string; obbligo: string }
export const DESTINAZIONI: Destinazione[] = [
  {
    id: "abitativa", nome: "Abitativa (residenziale)",
    testo: "Gli occupanti conoscono gli ambienti e le vie di esodo e la presenza è di norma continuativa nell'arco della giornata (fino a 8.760 ore/anno, ridotte in base all'affollamento medio); il rischio di panico in caso di emergenza è considerato basso. Le perdite tipiche sono quelle della categoria civile/residenziale della valutazione del rischio.",
    obbligo: "Per il residenziale privato la valutazione è obbligatoria ai sensi del D.Lgs. 81/2008 solo se nella struttura operano lavoratori (per esempio portiere, addetti alle pulizie o alla manutenzione del verde).",
  },
  {
    id: "ricettiva", nome: "Ricettiva (alberghi, B&B, agriturismi, case vacanza)",
    testo: "Gli ospiti non conoscono l'edificio e le vie di esodo e vi pernottano: la presenza di pubblico aumenta le conseguenze di un incendio o di un'emergenza e quindi le perdite da considerare, in particolare con rischio d'incendio medio o alto. Oltre al rischio per le persone conviene valutare anche le perdite economiche dovute all'interruzione dell'attività e, per gli edifici vincolati, quelle di patrimonio culturale.",
    obbligo: "Trattandosi di luogo di lavoro (attività imprenditoriale, presenza di personale anche saltuaria), la valutazione è obbligatoria ai sensi dell'art. 84 del D.Lgs. 81/2008.",
  },
  {
    id: "promiscua", nome: "Uso promiscuo (abitativa + ricettiva, es. B&B in abitazione)",
    testo: "L'immobile comprende una parte abitativa e una parte ricettiva: la struttura è suddivisa in zone (Z1 abitativa, Z2 ricettiva), ciascuna con i propri valori di affollamento, tempo di presenza e perdite; in alternativa si applicano a tutto l'edificio, a favore di sicurezza, i parametri della destinazione più gravosa (ricettiva).",
    obbligo: "La parte ricettiva è luogo di lavoro: la valutazione è obbligatoria ai sensi dell'art. 84 del D.Lgs. 81/2008.",
  },
];
export const destinazioneDi = (id: string) => DESTINAZIONI.find((d) => d.id === id) ?? null;
/** Data ISO (aaaa-mm-gg) in formato italiano gg/mm/aaaa; altri testi restano come sono. */
export const dataIt = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s);
