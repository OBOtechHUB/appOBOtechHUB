/** CSV per Excel (separatore ";", BOM per gli accenti) e download immediato. */
export function scaricaCsv(nome: string, intestazione: string[], righe: (string | number | null | undefined)[][]): void {
  const q = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const testo = [intestazione, ...righe].map((r) => r.map(q).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + testo], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const oggiFile = () => new Date().toLocaleDateString("sv-SE");
export const dataOra = (d: string) => new Date(d).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "medium" });
