import type { ReactNode } from "react";
import { AiutoNorma } from "@/components/AiutoNorma";

/** Campo con etichetta; se per l'etichetta esiste un aiuto della norma compare il "?" accanto. */
export function Campo({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">{etichetta}<AiutoNorma chiave={etichetta} /></span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-input bg-card px-3 py-2.5 text-base text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";
