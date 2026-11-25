import { CONFIG } from "./config.js?v=mwvde0dd";
import { el } from "./dom.js?v=mwvde0dd";

export function appliquerCharte() {
  const racine = document.documentElement.style;
  if (CONFIG.couleurPrincipale) racine.setProperty("--pt-principale", CONFIG.couleurPrincipale);
  if (CONFIG.couleurAccent) racine.setProperty("--pt-accent", CONFIG.couleurAccent);
  document.querySelectorAll("img[data-logo]").forEach((image) => {
    image.src = CONFIG.logo;
  });
  if (new URLSearchParams(location.search).get("teinte") === "vert") {
    document.querySelector(".decouvrir")?.classList.remove("teinte-or");
  }
}

// Liens vers l'application : l'inscription Naatal toujours, les magasins d'applications seulement si
// leurs adresses sont renseignées dans la configuration.
export function liensApplication(conteneur, lireCode) {
  const inscription = el("a", { classe: "pt-bouton pt-bouton-principal", href: CONFIG.lienApp }, "Ouvrir Naatal");
  inscription.addEventListener("click", () => {
    const code = lireCode?.();
    if (!code) return;
    const url = new URL(CONFIG.lienApp, location.href);
    url.searchParams.set("code", code);
    inscription.href = url.href;
  });
  const magasins = [
    CONFIG.lienAppStore && el("a", { classe: "pt-bouton pt-bouton-second", href: CONFIG.lienAppStore, rel: "noopener" }, "App Store"),
    CONFIG.lienGooglePlay && el("a", { classe: "pt-bouton pt-bouton-second", href: CONFIG.lienGooglePlay, rel: "noopener" }, "Google Play"),
  ];
  conteneur.replaceChildren(inscription, ...magasins.filter(Boolean));
}
