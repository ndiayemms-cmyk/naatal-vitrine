import { CONFIG } from "./config.js?v=mwwruvvp";
import { el } from "./dom.js?v=mwwruvvp";

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

// La maison du logo, d'une seule couleur (celle du texte du bouton) pour rester lisible sur le fond doré.
function maison() {
  const icone = document.createElement("span");
  icone.className = "pt-bouton-maison";
  icone.setAttribute("aria-hidden", "true");
  icone.innerHTML =
    '<svg viewBox="13 -8 390 400"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M34 178 209 40l175 138" stroke-width="38"/><path d="M92 152v194h234V152" stroke-width="38"/>' +
    '<path d="M92 218l38-36 38 34 40-34 38 34 40-34 38 34" stroke-width="30"/>' +
    '<path d="m112 282 36-34 36 32 38-34 36 32 40-38" stroke-width="30" opacity=".55"/></g></svg>';
  return icone;
}

// Liens vers l'application : l'inscription Naatal toujours, les magasins d'applications seulement si
// leurs adresses sont renseignées dans la configuration.
export function liensApplication(conteneur, lireCode) {
  const inscription = el(
    "a",
    { classe: "pt-bouton pt-bouton-principal pt-bouton-naatal", href: CONFIG.lienApp },
    maison(),
    "Commencer avec Naatal",
  );
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
