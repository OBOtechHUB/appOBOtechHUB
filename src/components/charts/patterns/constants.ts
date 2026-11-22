// @ts-nocheck -- componente del registro Bklit UI (codice esterno, non adattato alle regole strette del progetto)
export const PatternOrientation = {
  horizontal: "horizontal",
  vertical: "vertical",
  diagonal: "diagonal",
  diagonalRightToLeft: "diagonalRightToLeft",
} as const;

export type PatternOrientationType =
  (typeof PatternOrientation)[keyof typeof PatternOrientation];
