export function paginaHead(titolo: string, descrizione: string) {
  return { meta: [{ title: `${titolo} – Progettazione LPS` }, { name: "description", content: descrizione }, { property: "og:title", content: `${titolo} – Progettazione LPS` }, { property: "og:description", content: descrizione }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] };
}