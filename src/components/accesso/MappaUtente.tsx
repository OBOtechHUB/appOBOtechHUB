import { useState } from "react";
import { db, type Profilo } from "@/lib/accesso";

export interface PersonaMappa { name: string; is_admin: boolean; is_visitor: boolean }

/** Ruolo e persona collegata nella Mappa carichi (OBO Hub). Non tocca progetti né dati della Mappa. */
export function MappaUtente({ p, persone, abilitata, onCambio, onNuovaPersona }: {
  p: Profilo; persone: PersonaMappa[]; abilitata: boolean;
  onCambio: (msg: string) => void; onNuovaPersona: (nome: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const ruolo = p.mappa_ruolo ?? "guest";
  const persona = p.mappa_persona ?? "";
  async function salva(valori: Partial<Pick<Profilo, "mappa_ruolo" | "mappa_persona">>) {
    setBusy(true);
    const { error } = await db().from("accessi_profili").update(valori).eq("utente", p.utente);
    setBusy(false);
    onCambio(error ? (/mappa_/.test(error.message) ? "Esegui prima mappa-carichi/database/3-accesso-obo-hub.sql su Supabase." : error.message) : "Mappa carichi aggiornata: vale dal prossimo ingresso nella Mappa.");
  }
  if (!abilitata) return <span className="text-xs text-muted-foreground">non abilitata</span>;
  const nomi = persone.filter((x) => !x.is_visitor).map((x) => x.name);
  return <div className="flex min-w-[170px] flex-col gap-1">
    <select aria-label="Ruolo nella Mappa carichi" className="rounded border px-2 py-1 text-xs" disabled={busy} value={ruolo} onChange={(e) => void salva({ mappa_ruolo: e.target.value as "admin" | "guest" | "visitor" })}>
      <option value="admin">Admin (gestisce tutto)</option>
      <option value="guest">Guest (i propri progetti)</option>
      <option value="visitor">Visitatore (sola lettura)</option>
    </select>
    {ruolo !== "visitor" && <select aria-label="Persona nella Mappa carichi" className="rounded border px-2 py-1 text-xs" disabled={busy} value={nomi.includes(persona) ? persona : ""}
      onChange={async (e) => {
        if (e.target.value === "__nuova") {
          const nome = window.prompt("Nome e cognome della nuova persona nella Mappa", p.nome || "");
          if (!nome?.trim()) return;
          await onNuovaPersona(nome.trim()); await salva({ mappa_persona: nome.trim() }); return;
        }
        await salva({ mappa_persona: e.target.value });
      }}>
      <option value="">{persona && !nomi.includes(persona) ? `${persona} (non trovata)` : "— scegli la persona —"}</option>
      {nomi.map((n) => <option key={n} value={n}>{n}</option>)}
      <option value="__nuova">+ Nuova persona…</option>
    </select>}
  </div>;
}
