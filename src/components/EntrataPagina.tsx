/**
 * Entrata morbida delle pagine (Motion): dissolvenza breve a ogni cambio di pagina.
 * Solo opacità, così gli elementi fissi (barre, finestre) restano al loro posto;
 * con "riduci movimento" del sistema l'animazione è spenta.
 */
import type { ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";

export function EntrataPagina({ chiave, children }: { chiave: string; children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div key={chiave} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: "easeOut" }}>
        {children}
      </motion.div>
    </MotionConfig>
  );
}
