/** Profili IPE (EN 10365): spessore dell'ala tf in mm, per scegliere il morsetto delle aste fissate a putrella. */
export const IPE: Record<string, number> = {
  "IPE 80": 5.2, "IPE 100": 5.7, "IPE 120": 6.3, "IPE 140": 6.9, "IPE 160": 7.4, "IPE 180": 8.0, "IPE 200": 8.5, "IPE 220": 9.2,
  "IPE 240": 9.8, "IPE 270": 10.2, "IPE 300": 10.7, "IPE 330": 11.5, "IPE 360": 12.7, "IPE 400": 13.5, "IPE 450": 14.6,
  "IPE 500": 16.0, "IPE 550": 17.2, "IPE 600": 19.0,
};
/** Spessore dell'ala: quello scritto, altrimenti quello del profilo IPE scelto. */
export const spessorePutrella = (profilo: string | undefined, spessore: number | null | undefined): number | null => spessore ?? (profilo ? IPE[profilo] ?? null : null);
