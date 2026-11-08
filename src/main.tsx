import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";
import { avviaInstallazione } from "./lib/installazione";
import { avviaTema } from "./lib/tema";

avviaInstallazione();
avviaTema();

// GitHub Pages: 404.html reindirizza qui con ?p=<percorso>; ripristina l'indirizzo originale.
const p = new URLSearchParams(window.location.search).get("p");
if (p) window.history.replaceState(null, "", import.meta.env.BASE_URL.replace(/\/$/, "") + p);

// App installabile (PWA): il service worker vive nella cartella di pubblicazione.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined);
  });
}

const router = getRouter();
const radice = document.getElementById("root");
if (!radice) throw new Error("Elemento #root mancante");
createRoot(radice).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
