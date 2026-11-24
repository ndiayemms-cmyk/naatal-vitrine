import { badgeVerification } from "./badge.js";
import { carteResultat, SelecteurTerrain } from "./carte.js";
import { CONFIG } from "./config.js";
import { el } from "./dom.js";
import { chercherLieu, formaterCoordonnees, formaterMoment, villeDe } from "./geo.js";
import { panneauPartage } from "./partage.js";
import { appliquerCharte, liensApplication } from "./charte.js";
import { adressesPhotos, BRANCHEE, creerDemande, lireSuivi, suivreArrivees } from "./supabase.js";

const CLE_SUIVI = "naatal-photo-test";
const PHOTOS_MAX = 3;

const $ = (id) => document.getElementById(id);
const etat = { terrain: null, ville: null, demande: null, photosAffichees: 0, arreterSuivi: null, jeton: 0 };

function memoriser(id) {
  try {
    localStorage.setItem(CLE_SUIVI, id);
  } catch {
    // Sans stockage local, l'adresse de suivi affichée suffit pour revenir.
  }
}

function retrouver() {
  try {
    return localStorage.getItem(CLE_SUIVI);
  } catch {
    return null;
  }
}

function oublier() {
  try {
    localStorage.removeItem(CLE_SUIVI);
  } catch {
    // Rien à effacer si le stockage est indisponible.
  }
}

function adresseSuivi(id) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("suivi", id);
  return url.href;
}

function lienCapture(slug) {
  return new URL(`capture.html?d=${slug}`, location.href).href;
}

function montrerEtape(numero) {
  document.querySelectorAll(".pt-etape").forEach((section) => {
    section.hidden = section.dataset.etape !== String(numero);
  });
  document.querySelectorAll(".pt-progression li").forEach((li) => {
    const n = Number(li.dataset.etape);
    li.dataset.statut = n < numero ? "fait" : n === numero ? "en-cours" : "a-venir";
    if (n === numero) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
  });
  const titre = document.querySelector(`.pt-etape[data-etape="${numero}"] h2`);
  titre?.focus({ preventScroll: true });
  if (numero === 1) etat.selecteur.redimensionner();
}

function signaler(id, message) {
  const zone = $(id);
  zone.textContent = message ?? "";
  zone.hidden = !message;
}

function messagePosition(erreur) {
  if (erreur.code === 1) {
    return "Tu as refusé l'accès à ta position. Sur iPhone : Réglages, Confidentialité et sécurité, Service de localisation, puis Safari. Sur Android : touche le cadenas à gauche de l'adresse, puis Autorisations, Position. Tu peux aussi toucher la carte.";
  }
  if (erreur.code === 3) return "La position met trop de temps à arriver. Réessaie près d'une fenêtre, ou touche la carte.";
  return "Ta position n'est pas disponible pour le moment. Touche la carte ou cherche une adresse.";
}

async function quandTerrainChange({ lat, lng, precision }) {
  etat.terrain = { lat, lng };
  etat.ville = null;
  const jeton = ++etat.jeton;
  $("pt-point").hidden = false;
  $("pt-coords").textContent = formaterCoordonnees(lat, lng)
    + (precision ? ` (précision ± ${Math.round(precision)} m)` : "");
  $("pt-ville").textContent = "Recherche de la ville…";
  $("pt-creer").disabled = !BRANCHEE;
  try {
    const ville = await villeDe(lat, lng);
    if (jeton !== etat.jeton) return;
    etat.ville = ville;
    $("pt-ville").textContent = ville ?? "Lieu sans nom de ville";
  } catch {
    if (jeton === etat.jeton) $("pt-ville").textContent = "Ville non trouvée (la vérification fonctionne quand même)";
  }
}

function utiliserMaPosition() {
  const bouton = $("pt-ma-position");
  if (!navigator.geolocation) {
    signaler("pt-erreur-1", "Ce navigateur ne donne pas accès à la position. Touche la carte pour placer ton terrain.");
    return;
  }
  bouton.disabled = true;
  bouton.textContent = "Recherche de ta position…";
  signaler("pt-erreur-1");
  navigator.geolocation.getCurrentPosition(
    (p) => {
      bouton.disabled = false;
      bouton.textContent = "Utiliser ma position";
      etat.selecteur.placer(p.coords.latitude, p.coords.longitude, { precision: p.coords.accuracy });
    },
    (erreur) => {
      bouton.disabled = false;
      bouton.textContent = "Utiliser ma position";
      signaler("pt-erreur-1", messagePosition(erreur));
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  );
}

async function rechercher(evenement) {
  evenement.preventDefault();
  const texte = $("pt-adresse").value.trim();
  const liste = $("pt-resultats");
  if (texte.length < 3) return;
  liste.hidden = false;
  liste.replaceChildren(el("li", { classe: "pt-resultats-etat" }, "Recherche…"));
  try {
    const lieux = await chercherLieu(texte);
    if (lieux.length === 0) {
      liste.replaceChildren(el("li", { classe: "pt-resultats-etat" }, "Aucun lieu trouvé. Essaie avec le nom du quartier et de la ville."));
      return;
    }
    liste.replaceChildren(
      ...lieux.map((lieu) =>
        el("li", {}, el("button", {
          type: "button",
          onclick: () => {
            liste.hidden = true;
            etat.selecteur.placer(lieu.lat, lieu.lng);
          },
        }, lieu.libelle)),
      ),
    );
  } catch {
    liste.replaceChildren(el("li", { classe: "pt-resultats-etat" }, "La recherche ne répond pas. Réessaie dans un instant, ou touche la carte."));
  }
}

function afficherPartage() {
  const { slug, expires_at: expiration } = etat.demande;
  const lien = lienCapture(slug);
  $("pt-partage").replaceChildren(panneauPartage(lien, ({ attendre } = {}) => {
    if (!attendre) setTimeout(() => passerEnAttente(), 400);
  }));
  $("pt-partage-rappel").replaceChildren(panneauPartage(lien, () => undefined));
  $("pt-moi-meme").href = lien;
  $("pt-expiration").textContent = formaterMoment(new Date(expiration));
  const suivi = adresseSuivi(etat.demande.id);
  $("pt-suivi").href = suivi;
  $("pt-suivi").textContent = suivi;
}

async function creerLien() {
  if (!etat.terrain) return;
  const bouton = $("pt-creer");
  bouton.disabled = true;
  bouton.textContent = "Création du lien…";
  signaler("pt-erreur-1");
  try {
    const demande = await creerDemande({ ...etat.terrain, ville: etat.ville, prenom: $("pt-prenom").value.trim() });
    etat.demande = { ...demande, ref_lat: etat.terrain.lat, ref_lng: etat.terrain.lng, photos: [], photo_count: 0 };
    memoriser(demande.id);
    history.replaceState(null, "", adresseSuivi(demande.id));
    afficherPartage();
    montrerEtape(2);
  } catch (erreur) {
    signaler("pt-erreur-1", erreur.message);
  } finally {
    bouton.disabled = false;
    bouton.textContent = "Créer mon lien Naatal";
  }
}

function passerEnAttente() {
  if (etat.demande.photo_count > 0) {
    montrerEtape(4);
  } else {
    montrerEtape(3);
  }
  suivre();
}

function suivre() {
  if (etat.arreterSuivi || etat.demande.expired || etat.demande.photo_count >= PHOTOS_MAX) return;
  etat.arreterSuivi = suivreArrivees(etat.demande.id, rafraichir);
}

function arreterSuivi() {
  etat.arreterSuivi?.();
  etat.arreterSuivi = null;
}

async function rafraichir() {
  try {
    const demande = await lireSuivi(etat.demande.id);
    if (!demande) {
      montrerExpiration();
      return;
    }
    etat.demande = demande;
    if (demande.expired) {
      montrerExpiration();
      return;
    }
    if (demande.photos.length !== etat.photosAffichees) await afficherPhotos();
    if (demande.photo_count >= PHOTOS_MAX) arreterSuivi();
  } catch {
    // La relecture suivante réessaiera ; le canal temps réel reste ouvert.
  }
}

async function afficherPhotos() {
  const { photos, rayon_m: rayon } = etat.demande;
  const adresses = await adressesPhotos(photos.map((p) => p.storage_path));
  const fil = $("pt-fil");
  fil.replaceChildren();
  photos.forEach((photo, index) => {
    const nouvelle = index >= etat.photosAffichees;
    const carte = el("div", { classe: "pt-carte pt-carte-resultat", "aria-label": "Carte : le terrain, son périmètre et le lieu de la photo" });
    fil.append(
      el(
        "article",
        { classe: `pt-photo${nouvelle ? " pt-photo-nouvelle" : ""}` },
        el("h3", {}, `Photo ${index + 1} sur ${PHOTOS_MAX}`),
        el("img", {
          src: adresses[photo.storage_path] ?? "",
          alt: `Photo prise ${photo.city ? `à ${photo.city}` : ""} ${formaterMoment(new Date(photo.captured_at_device))}, avec son bandeau horodaté Naatal`,
          loading: "lazy",
        }),
        badgeVerification(photo),
        carte,
      ),
    );
    carteResultat(carte, { lat: etat.demande.ref_lat, lng: etat.demande.ref_lng }, photo, rayon);
  });
  etat.photosAffichees = photos.length;

  const restantes = PHOTOS_MAX - photos.length;
  $("pt-encore").textContent = restantes > 0
    ? `Ton proche peut encore envoyer ${restantes === 1 ? "1 photo" : `${restantes} photos`} avec le même lien. Elles s'afficheront ici.`
    : "Les 3 photos prévues pour ce lien sont arrivées.";
  $("pt-code").textContent = etat.demande.claim_code;
  $("pt-code-expiration").textContent = formaterMoment(new Date(etat.demande.expires_at));
  if (photos.length > 0 && document.querySelector('.pt-etape[data-etape="4"]').hidden) montrerEtape(4);
}

function montrerExpiration() {
  arreterSuivi();
  oublier();
  document.querySelectorAll(".pt-etape").forEach((s) => {
    s.hidden = true;
  });
  $("pt-expire").hidden = false;
}

function recommencer() {
  arreterSuivi();
  oublier();
  etat.demande = null;
  etat.photosAffichees = 0;
  history.replaceState(null, "", location.pathname);
  $("pt-expire").hidden = true;
  $("pt-fil").replaceChildren();
  montrerEtape(1);
}

async function reprendre(id) {
  try {
    const demande = await lireSuivi(id);
    if (!demande || demande.expired) {
      montrerExpiration();
      return;
    }
    etat.demande = demande;
    memoriser(id);
    afficherPartage();
    if (demande.photos.length > 0) {
      await afficherPhotos();
      montrerEtape(4);
    } else {
      montrerEtape(3);
    }
    suivre();
  } catch (erreur) {
    montrerEtape(1);
    signaler("pt-erreur-1", `Ton test précédent n'a pas pu être rechargé. ${erreur.message}`);
  }
}

function demarrer() {
  appliquerCharte();
  liensApplication($("pt-liens-app"), () => etat.demande?.claim_code);
  document.querySelectorAll("[data-rayon]").forEach((n) => {
    n.textContent = `${CONFIG.rayonVerificationM} m`;
  });

  etat.selecteur = new SelecteurTerrain($("pt-carte-terrain"), CONFIG.rayonVerificationM, quandTerrainChange);
  $("pt-ma-position").addEventListener("click", utiliserMaPosition);
  $("pt-recherche").addEventListener("submit", rechercher);
  $("pt-creer").addEventListener("click", creerLien);
  $("pt-attendre").addEventListener("click", passerEnAttente);
  $("pt-recommencer").addEventListener("click", recommencer);

  if (!BRANCHEE) {
    $("pt-non-branchee").hidden = false;
    montrerEtape(1);
    return;
  }
  const id = new URLSearchParams(location.search).get("suivi") || retrouver();
  if (id && /^[0-9a-f-]{36}$/i.test(id)) reprendre(id);
  else montrerEtape(1);
}

demarrer();
