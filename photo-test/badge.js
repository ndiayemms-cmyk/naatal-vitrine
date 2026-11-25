import { el } from "./dom.js?v=mwvfmjzd";
import { formaterDistance, formaterMoment } from "./geo.js?v=mwvfmjzd";

const PRECISION_FAIBLE_M = 100;
const DERIVE_SIGNALEE_S = 120;

// Badge de vérification d'une photo. L'heure affichée est celle du serveur à la réception ; l'heure du
// téléphone n'apparaît que si elle s'en écarte nettement.
export function badgeVerification(photo) {
  const recue = new Date(photo.created_at_server);
  const prise = new Date(photo.captured_at_device);
  const lieu = photo.city ? ` à ${photo.city}` : "";
  const distance = formaterDistance(photo.distance_m);
  const dansZone = photo.status === "verified";
  const secours = photo.capture_mode === "secours";

  let niveau;
  let message;
  if (!dansZone) {
    niveau = "ko";
    message = `Hors zone : photo prise${lieu}, à ${distance} du terrain.`;
  } else if (secours) {
    niveau = "attention";
    message = `Photo prise${lieu}, à ${distance} du terrain, ${formaterMoment(recue)}, mais hors caméra Naatal.`;
  } else {
    niveau = "ok";
    message = `Photo prise${lieu}, à ${distance} du terrain, ${formaterMoment(recue)}.`;
  }

  const details = [`Précision ± ${Math.round(photo.accuracy_m)} m`];
  if (photo.accuracy_m > PRECISION_FAIBLE_M) details.push("Signal GPS faible");
  if (Math.abs(recue - prise) / 1000 > DERIVE_SIGNALEE_S) {
    details.push(`Heure indiquée par le téléphone : ${formaterMoment(prise)}`);
  }
  if (secours) details.push("Envoyée en mode secours, depuis l'appareil photo du téléphone");

  return el(
    "div",
    { classe: `pt-badge pt-badge-${niveau}`, role: "status" },
    el("span", { classe: "pt-badge-pastille", "aria-hidden": "true" }),
    el("div", {}, el("p", { classe: "pt-badge-message" }, message), el("p", { classe: "pt-badge-details" }, details.join(" · "))),
  );
}
