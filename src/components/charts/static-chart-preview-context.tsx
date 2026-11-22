// @ts-nocheck -- componente del registro Bklit UI (codice esterno, non adattato alle regole strette del progetto)
"use client";

import { createContext, type ReactNode, useContext } from "react";

const StaticChartPreviewContext = createContext(false);

/** Disables cartesian reveal clip-path for static docs previews. */
export function StaticChartPreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <StaticChartPreviewContext.Provider value={true}>
      {children}
    </StaticChartPreviewContext.Provider>
  );
}

export function useStaticChartPreview() {
  return useContext(StaticChartPreviewContext);
}
