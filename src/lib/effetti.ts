/**
 * Effetti dello stile futuristico (come comune/futuro.js di OBO Hub): comparsa allo scorrimento, luce delle
 * schede che segue il puntatore, barra di avanzamento della pagina. Non cambia dati; spento con
 * "riduci movimento", nei test automatici (salvo ?fx) e con ?nofx.
 */
const SCHEDE = "main .rounded-lg.border, main .rounded-xl.border, main section.panel, main li.agente";
const COMPARSA = SCHEDE + ", main h2, main table";

export function avviaEffetti(): () => void {
  if (typeof window === "undefined" || !("IntersectionObserver" in window) || !("MutationObserver" in window)) return () => {};
  const q = window.location.search;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || /[?&]nofx\b/.test(q) || (navigator.webdriver && !/[?&]fx\b/.test(q))) return () => {};
  const osserva = new IntersectionObserver((voci) => { for (const v of voci) if (v.isIntersecting) { v.target.classList.add("fx-vis"); osserva.unobserve(v.target); } }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
  const prepara = () => {
    const vh = window.innerHeight;
    document.querySelectorAll<HTMLElement>(SCHEDE).forEach((el) => el.classList.add("fx-scheda"));
    document.querySelectorAll<HTMLElement>(COMPARSA).forEach((el, i) => {
      if (el.dataset["fx"]) return; el.dataset["fx"] = "1";
      if (el.getBoundingClientRect().top < vh * 0.92) return; // già visibile: niente lampeggio
      el.style.setProperty("--fx-ritardo", `${(i % 6) * 60}ms`); el.classList.add("fx-in"); osserva.observe(el);
    });
  };
  const barra = document.createElement("div"); barra.id = "fx-progresso"; barra.setAttribute("aria-hidden", "true"); document.body.appendChild(barra);
  const avanzamento = () => { const h = document.documentElement.scrollHeight - window.innerHeight; barra.style.setProperty("--fx-p", h > 40 ? String(Math.min(1, window.scrollY / h)) : "0"); };
  let attesa: ReturnType<typeof setTimeout> | undefined;
  const mo = new MutationObserver(() => { clearTimeout(attesa); attesa = setTimeout(() => { prepara(); avanzamento(); }, 150); });
  mo.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("scroll", avanzamento, { passive: true }); window.addEventListener("resize", avanzamento);
  prepara(); avanzamento();
  return () => { mo.disconnect(); osserva.disconnect(); barra.remove(); window.removeEventListener("scroll", avanzamento); window.removeEventListener("resize", avanzamento); };
}
