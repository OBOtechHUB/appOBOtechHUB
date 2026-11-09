/**
 * Schemi disegnati per l'app (non riproduzioni della norma): illustrano i concetti con il riferimento
 * alla figura della CEI EN IEC 62305 da consultare. Colori dai token del tema, leggibili in chiaro e scuro.
 */
const stileTesto = { fontSize: 11, fill: "currentColor" } as const;

function Riquadro({ titolo, rif, children }: { titolo: string; rif: string; children: React.ReactNode }) {
  return <figure className="rounded-lg border-[0.8px] border-bordo-scheda bg-background p-3">
    <figcaption className="mb-2 text-sm font-semibold">{titolo}</figcaption>
    {children}
    <p className="mt-2 text-xs text-muted-foreground">Schema semplificato, non in scala · {rif}</p>
  </figure>;
}

/** Aree di raccolta: AD (struttura), AM (vicino alla struttura), AL (linea), AI (vicino alla linea), ADJ. */
export function SchemaAreeRaccolta({ rM, rI }: { rM?: number; rI?: number }) {
  return <Riquadro titolo="Aree di raccolta dei fulmini" rif="CEI EN IEC 62305-2:2024, Allegato A (Fig. A.1 e A.5)">
    <svg viewBox="0 0 540 230" className="h-auto w-full text-foreground" role="img" aria-label="Aree di raccolta AD, AM, AL, AI e ADJ">
      {/* AM */}
      <rect x="20" y="20" width="230" height="190" rx="70" className="fill-primary/5 stroke-primary" strokeDasharray="5 4" />
      <text x="34" y="40" style={stileTesto}>AM: fulmini vicino alla struttura{rM ? ` (rM ≈ ${Math.round(rM)} m)` : ""}</text>
      {/* AD */}
      <rect x="75" y="75" width="120" height="80" rx="30" className="fill-primary/20 stroke-primary" />
      <rect x="110" y="98" width="50" height="34" className="fill-muted-foreground/60" />
      <text x="88" y="92" style={stileTesto}>AD (3·H)</text>
      <text x="113" y="150" style={stileTesto}>struttura</text>
      {/* AI e AL */}
      <rect x="195" y="88" width="235" height="54" className="fill-accent/15 stroke-accent" strokeDasharray="5 4" />
      <rect x="195" y="105" width="235" height="20" className="fill-accent/40" />
      <line x1="160" y1="115" x2="440" y2="115" stroke="currentColor" strokeWidth="2" />
      <text x="262" y="102" style={stileTesto}>AI: vicino alla linea{rI ? ` (rI ≈ ${Math.round(rI)} m)` : ""}</text>
      <text x="270" y="120" style={stileTesto}>AL = 40 · LL</text>
      <text x="230" y="160" style={stileTesto}>linea lunga LL fino al primo nodo</text>
      {/* ADJ */}
      <rect x="440" y="95" width="60" height="40" rx="12" className="fill-primary/20 stroke-primary" />
      <rect x="455" y="104" width="30" height="22" className="fill-muted-foreground/60" />
      <text x="440" y="150" style={stileTesto}>ADJ</text>
      <text x="436" y="164" style={stileTesto}>adiacente</text>
    </svg>
  </Riquadro>;
}

/** Esempio di suddivisione in zone ZS e componenti di rischio che riguardano ciascuna. */
export function SchemaZone() {
  return <Riquadro titolo="Suddivisione della struttura in zone di rischio" rif="CEI EN IEC 62305-2:2024, 8.3 (Fig. 2)">
    <svg viewBox="0 0 560 250" className="h-auto w-full text-foreground" role="img" aria-label="Esempio di zone: esterno, interno, compartimento, terrazza">
      <line x1="10" y1="200" x2="510" y2="200" stroke="currentColor" />
      {/* edificio */}
      <rect x="150" y="70" width="220" height="130" className="fill-muted stroke-foreground" />
      <line x1="270" y1="70" x2="270" y2="200" stroke="currentColor" strokeWidth="3" />
      <text x="158" y="140" style={stileTesto}>ZS2 interno</text>
      <text x="158" y="157" style={{ ...stileTesto, fontSize: 10 }}>uffici</text><text x="158" y="171" style={{ ...stileTesto, fontSize: 10 }}>RB RC RM RU RV</text>
      <text x="278" y="140" style={stileTesto}>ZS3 compartimento</text>
      <text x="278" y="157" style={{ ...stileTesto, fontSize: 10 }}>archivio REI 120</text><text x="278" y="171" style={{ ...stileTesto, fontSize: 10 }}>rf e rp propri</text>
      {/* terrazza */}
      <rect x="150" y="50" width="120" height="20" className="fill-primary/25 stroke-primary" />
      <text x="156" y="44" style={stileTesto}>ZS4 terrazza · RAD (persone esposte)</text>
      {/* esterno */}
      <rect x="40" y="170" width="110" height="30" className="fill-accent/20" />
      <rect x="370" y="170" width="110" height="30" className="fill-accent/20" />
      <text x="44" y="190" style={stileTesto}>ZS1 esterno ≤ 3 m</text>
      <text x="374" y="190" style={stileTesto}>ZS1 esterno</text><text x="44" y="216" style={{ ...stileTesto, fontSize: 10 }}>RAT: tensioni di contatto e di passo vicino alle calate</text>
      {/* calate */}
      <line x1="150" y1="50" x2="150" y2="200" stroke="currentColor" strokeWidth="2" strokeDasharray="2 3" />
      <line x1="370" y1="70" x2="370" y2="200" stroke="currentColor" strokeWidth="2" strokeDasharray="2 3" />
      <text x="378" y="88" style={{ ...stileTesto, fontSize: 10 }}>calata</text>
      {/* linea */}
      <line x1="480" y1="182" x2="555" y2="182" stroke="currentColor" strokeWidth="2" />
      <text x="384" y="232" style={{ ...stileTesto, fontSize: 10 }}>linea entrante → zone che alimenta</text>
    </svg>
    <p className="mt-2 text-xs text-muted-foreground">Le zone si separano per tipo di pavimento, compartimenti antincendio, schermature, impianti interni, misure di protezione o perdite diverse. Ogni zona va confrontata da sola con RT.</p>
  </Riquadro>;
}
