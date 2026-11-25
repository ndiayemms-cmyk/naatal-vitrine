import { CameraNaatal, composerPhoto } from "./camera.js?v=mwwrz6e2";
import { appliquerCharte, liensApplication } from "./charte.js?v=mwwrz6e2";
import { el } from "./dom.js?v=mwwrz6e2";
import { formaterCoordonnees, formaterHorodatage, villeDe } from "./geo.js?v=mwwrz6e2";
import { BRANCHEE, envoyerPhoto, lireCapture } from "./supabase.js?v=mwwrz6e2";

const PRECISION_FAIBLE_M = 100;
const DEPLACEMENT_NOUVELLE_VILLE_M = 150;

const $ = (id) => document.getElementById(id);
const slug = (new URLSearchParams(location.search).get("d") || location.hash.slice(1)).trim().toLowerCase();
const etat = { demande: null, position: null, ville: null, villeLue: null, surveillance: null, camera: null, photo: null, mesure: null, horloge: null };

const AIDE_POSITION = [
  "Sur iPhone : Réglages, Confidentialité et sécurité, Service de localisation activé, puis Safari : « Lorsque l'app est active ». Recharge ensuite la page.",
  "Sur Android : touche le cadenas à gauche de l'adresse, puis Autorisations, Position : Autoriser. Vérifie aussi que la localisation du téléphone est activée.",
];

function montrer(id) {
  document.querySelectorAll(".pt-ecran").forEach((ecran) => {
    ecran.hidden = ecran.id !== id;
  });
  document.body.classList.toggle("pt-plein-ecran", id === "c-camera");
  $(id).querySelector("h1, h2")?.focus({ preventScroll: true });
}

function erreur(titre, texte, aide = []) {
  arreterTout();
  $("c-erreur-titre").textContent = titre;
  $("c-erreur-texte").textContent = texte;
  $("c-erreur-aide").replaceChildren(...aide.map((ligne) => el("li", {}, ligne)));
  $("c-erreur-aide").hidden = aide.length === 0;
  montrer("c-erreur");
}

function distanceM(a, b) {
  const r = 6371008.8;
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

// La ville n'est redemandée que si la personne s'est déplacée : Nominatim limite le nombre d'appels.
async function majVille(position) {
  if (etat.villeLue && distanceM(etat.villeLue, position) < DEPLACEMENT_NOUVELLE_VILLE_M) return;
  etat.villeLue = { lat: position.lat, lng: position.lng };
  try {
    etat.ville = await villeDe(position.lat, position.lng);
  } catch {
    etat.ville = null;
  }
  afficherSurimpression();
}

function afficherSurimpression() {
  const p = etat.position;
  $("c-heure").textContent = formaterHorodatage(new Date());
  if (!p) {
    $("c-lieu").textContent = "Recherche du signal GPS…";
    $("c-coordonnees").textContent = "";
    $("c-declencheur").disabled = true;
    return;
  }
  $("c-lieu").textContent = etat.ville ?? "Ville en cours de recherche";
  $("c-coordonnees").textContent = `${formaterCoordonnees(p.lat, p.lng, 4)} · ± ${Math.round(p.precision)} m`
    + (p.precision > PRECISION_FAIBLE_M ? " · signal GPS faible" : "");
  $("c-declencheur").disabled = false;
}

function surveillerPosition() {
  return new Promise((resolu, rejete) => {
    let premiere = true;
    etat.surveillance = navigator.geolocation.watchPosition(
      (p) => {
        etat.position = { lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy };
        afficherSurimpression();
        majVille(etat.position);
        if (premiere) {
          premiere = false;
          resolu();
        }
      },
      (e) => {
        if (premiere) rejete(e);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  });
}

function arreterTout() {
  if (etat.surveillance != null) navigator.geolocation.clearWatch(etat.surveillance);
  etat.surveillance = null;
  etat.camera?.arreter();
  clearInterval(etat.horloge);
}

async function ouvrirCamera() {
  const bouton = $("c-ouvrir");
  bouton.disabled = true;
  bouton.textContent = "Ouverture…";
  arreterTout();
  try {
    if (!navigator.geolocation) {
      erreur("Position indisponible", "Ce navigateur ne donne pas accès à la position : la photo ne pourrait pas être vérifiée.");
      return;
    }
    const positionPrete = surveillerPosition();
    positionPrete.catch(() => undefined);
    if (!CameraNaatal.disponible()) {
      montrer("c-secours");
      return;
    }
    etat.camera ??= new CameraNaatal($("c-video"));
    try {
      await etat.camera.demarrer();
    } catch (e) {
      $("c-secours-raison").textContent = e?.name === "NotAllowedError"
        ? "L'accès à la caméra a été refusé. Tu peux l'autoriser dans les réglages du navigateur puis recharger la page, ou utiliser l'appareil photo du téléphone ci-dessous."
        : "La caméra n'a pas pu s'ouvrir dans le navigateur. Tu peux utiliser l'appareil photo du téléphone ci-dessous.";
      montrer("c-secours");
      return;
    }
    $("c-changer").hidden = !etat.camera.plusieursCameras;
    montrer("c-camera");
    afficherSurimpression();
    etat.horloge = setInterval(afficherSurimpression, 1000);
    await positionPrete;
  } catch (e) {
    if (e?.code === 1) {
      erreur("Position refusée", "Naatal a besoin de ta position pour montrer où la photo est prise. Autorise-la, puis recharge la page.", AIDE_POSITION);
    } else if (e?.code) {
      erreur("Position introuvable", "Le téléphone n'arrive pas à trouver ta position. Active la localisation, approche-toi d'une fenêtre ou sors, puis recharge la page.");
    } else {
      erreur("Un problème est survenu", "La caméra Naatal n'a pas pu démarrer. Recharge la page pour réessayer.");
    }
  } finally {
    bouton.disabled = false;
    bouton.textContent = "Ouvrir la caméra Naatal";
  }
}

function preparerApercu(image, mesure) {
  etat.photo = image;
  etat.mesure = mesure;
  const apercu = $("c-apercu-image");
  URL.revokeObjectURL(apercu.src);
  apercu.src = URL.createObjectURL(image);
  $("c-apercu-precision").textContent = `Position enregistrée à ± ${Math.round(mesure.precision)} m`
    + (mesure.precision > PRECISION_FAIBLE_M ? ". Signal GPS faible : la distance au terrain sera moins sûre." : ".");
  $("c-envoi-etat").textContent = "";
  montrer("c-apercu");
}

async function declencher() {
  if (!etat.position) return;
  const mesure = { ...etat.position, ville: etat.ville, priseLe: new Date(), mode: "camera" };
  $("c-declencheur").disabled = true;
  $("c-flash").classList.remove("pt-flash-actif");
  void $("c-flash").offsetWidth;
  $("c-flash").classList.add("pt-flash-actif");
  try {
    const image = await etat.camera.capturer(mesure);
    etat.camera.arreter();
    clearInterval(etat.horloge);
    preparerApercu(image, mesure);
  } catch {
    $("c-declencheur").disabled = false;
  }
}

function positionActuelle() {
  return new Promise((resolu, rejete) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolu({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }),
      rejete,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    ),
  );
}

// Mode secours : la position est lue au moment de la prise de vue, jamais dans les données EXIF
// (iOS les retire des photos transmises de cette façon).
async function photoSecours(evenement) {
  const fichier = evenement.target.files?.[0];
  evenement.target.value = "";
  if (!fichier) return;
  $("c-secours-etat").textContent = "Lecture de ta position…";
  try {
    const position = await positionActuelle();
    const mesure = { ...position, ville: null, priseLe: new Date(), mode: "secours" };
    try {
      mesure.ville = await villeDe(position.lat, position.lng);
    } catch {
      mesure.ville = null;
    }
    const bitmap = await createImageBitmap(fichier, { imageOrientation: "from-image" });
    const image = await composerPhoto(bitmap, bitmap.width, bitmap.height, mesure);
    bitmap.close();
    $("c-secours-etat").textContent = "";
    preparerApercu(image, mesure);
  } catch (e) {
    if (e?.code === 1) {
      erreur("Position refusée", "Naatal a besoin de ta position pour montrer où la photo est prise. Autorise-la, puis recharge la page.", AIDE_POSITION);
    } else {
      $("c-secours-etat").textContent = "La photo n'a pas pu être préparée. Réessaie.";
    }
  }
}

async function envoyer() {
  const bouton = $("c-envoyer");
  bouton.disabled = true;
  $("c-reprendre").disabled = true;
  $("c-envoi-etat").textContent = "Envoi en cours… Sur un réseau faible, cela peut prendre une minute.";
  try {
    const resultat = await envoyerPhoto(slug, etat.photo, etat.mesure);
    etat.demande.photo_count = resultat.photo_count;
    arreterTout();
    const restantes = etat.demande.photo_max - resultat.photo_count;
    $("c-autre").hidden = restantes <= 0;
    $("c-autre").textContent = restantes === 1 ? "Prendre une dernière photo" : `Prendre une autre photo (encore ${restantes})`;
    montrer("c-envoyee");
  } catch (e) {
    if (["demande_expiree", "photos_max", "demande_introuvable", "depot_refuse"].includes(e.code)) {
      erreur("Envoi impossible", e.message);
      return;
    }
    $("c-envoi-etat").textContent = `${e.message} Ta photo est toujours là : touche « Envoyer » pour réessayer.`;
  } finally {
    bouton.disabled = false;
    $("c-reprendre").disabled = false;
  }
}

async function reprendre() {
  etat.photo = null;
  if (etat.mesure?.mode === "secours") {
    montrer("c-secours");
    return;
  }
  await ouvrirCamera();
}

async function demarrer() {
  appliquerCharte();
  liensApplication($("c-liens-app"));
  $("c-ouvrir").addEventListener("click", ouvrirCamera);
  $("c-declencheur").addEventListener("click", declencher);
  $("c-changer").addEventListener("click", () => etat.camera.changer());
  $("c-fermer").addEventListener("click", () => {
    arreterTout();
    montrer("c-accueil");
  });
  $("c-fichier").addEventListener("change", photoSecours);
  $("c-envoyer").addEventListener("click", envoyer);
  $("c-reprendre").addEventListener("click", reprendre);
  $("c-autre").addEventListener("click", ouvrirCamera);

  if (!BRANCHEE) {
    erreur("Page test pas encore reliée", "Cette page n'est pas encore reliée à son serveur. Réessaie plus tard.");
    return;
  }
  if (!/^[a-z0-9]{4,12}$/.test(slug)) {
    erreur("Lien incomplet", "Ce lien Naatal semble coupé. Demande à ton proche de te le renvoyer en entier.");
    return;
  }
  montrer("c-chargement");
  try {
    const demande = await lireCapture(slug);
    if (!demande) {
      erreur("Lien introuvable", "Ce lien Naatal n'existe pas ou a déjà été supprimé. Demande à ton proche de t'en envoyer un nouveau.");
      return;
    }
    if (demande.expired) {
      erreur("Lien expiré", "Ce lien n'était valable que 24 heures. Demande à ton proche de t'en envoyer un nouveau.");
      return;
    }
    if (demande.photo_count >= demande.photo_max) {
      erreur("C'est déjà fait", "Les 3 photos prévues pour ce lien ont déjà été envoyées. Merci !");
      return;
    }
    etat.demande = demande;
    $("c-demandeur").textContent = demande.requester_name || "Ton proche";
    montrer("c-accueil");
  } catch (e) {
    erreur("Connexion difficile", `${e.message} Recharge la page quand le réseau revient.`);
  }
}

demarrer();
