import { CONFIG } from "./config.js?v=mwvfkfj5";

// Nominatim n'accepte qu'une requête par seconde et interdit la recherche à chaque frappe : les appels sont
// mis en file, espacés, et leurs réponses gardées pour la session. Le navigateur ne laisse pas choisir
// l'User-Agent ; le site est identifié par son en-tête Referer et, si renseigné, par l'adresse de contact.
const NOMINATIM = "https://nominatim.openstreetmap.org";
const INTERVALLE_MS = 1100;

let dernierAppel = 0;
let file = Promise.resolve();
const cache = new Map();

function enFile(appel) {
  const suite = file.then(async () => {
    const attente = dernierAppel + INTERVALLE_MS - Date.now();
    if (attente > 0) await new Promise((r) => setTimeout(r, attente));
    dernierAppel = Date.now();
    return appel();
  });
  file = suite.catch(() => undefined);
  return suite;
}

function lireCache(cle) {
  if (cache.has(cle)) return cache.get(cle);
  try {
    const brut = sessionStorage.getItem(`nominatim:${cle}`);
    if (brut !== null) {
      const valeur = JSON.parse(brut);
      cache.set(cle, valeur);
      return valeur;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function ecrireCache(cle, valeur) {
  cache.set(cle, valeur);
  try {
    sessionStorage.setItem(`nominatim:${cle}`, JSON.stringify(valeur));
  } catch {
    // Navigation privée ou stockage plein : le cache en mémoire suffit.
  }
}

async function nominatim(chemin, parametres) {
  const url = new URL(chemin, NOMINATIM);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("accept-language", "fr");
  if (CONFIG.nominatimEmail) url.searchParams.set("email", CONFIG.nominatimEmail);
  for (const [cle, valeur] of Object.entries(parametres)) url.searchParams.set(cle, String(valeur));
  const reponse = await enFile(() => fetch(url, { headers: { Accept: "application/json" } }));
  if (!reponse.ok) throw new Error(`Nominatim ${reponse.status}`);
  return reponse.json();
}

// OpenStreetMap nomme souvent les communes du Sénégal par leur échelon administratif
// (« Département de Guédiawaye », « Commune de Grand Yoff ») : seul le nom du lieu est gardé.
const ECHELON = /^(département|commune d'arrondissement|communauté rurale|commune|arrondissement|région|quartier)\s+(de\s+la\s+|de\s+l'|de\s+|du\s+|des\s+|d')/i;

export async function villeDe(lat, lng) {
  const cle = `ville:${lat.toFixed(3)},${lng.toFixed(3)}`;
  const connue = lireCache(cle);
  if (connue !== undefined) return connue;
  const reponse = await nominatim("/reverse", { lat, lon: lng, zoom: 14 });
  const a = reponse.address ?? {};
  const brut = a.city || a.town || a.village || a.suburb || a.city_district || a.municipality || a.county || a.state;
  const ville = brut ? brut.replace(ECHELON, "") : null;
  ecrireCache(cle, ville);
  return ville;
}

export async function chercherLieu(texte) {
  const cle = `s:${texte.trim().toLowerCase()}`;
  const connu = lireCache(cle);
  if (connu !== undefined) return connu;
  const reponse = await nominatim("/search", { q: texte.trim(), limit: 5 });
  const lieux = reponse.map((l) => ({ libelle: l.display_name, lat: Number(l.lat), lng: Number(l.lon) }));
  ecrireCache(cle, lieux);
  return lieux;
}

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function formaterDistance(metres) {
  if (metres < 1000) return `${Math.round(metres)} m`;
  if (metres < 100000) return `${nombre.format(Math.round(metres / 100) / 10)} km`;
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(metres / 1000))} km`;
}

export function formaterCoordonnees(lat, lng, decimales = 5) {
  return `${lat.toFixed(decimales)}, ${lng.toFixed(decimales)}`;
}

function heure(date) {
  return `${String(date.getHours()).padStart(2, "0")}h${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formaterMoment(date) {
  const jour = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ecart = Math.round((jour(new Date()) - jour(date)) / 86400000);
  if (ecart === 0) return `aujourd'hui à ${heure(date)}`;
  if (ecart === 1) return `hier à ${heure(date)}`;
  const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(date);
  return `le ${dateCourte} à ${heure(date)}`;
}

export function formaterHorodatage(date) {
  const jour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .format(date);
  const temps = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
  return `${jour} · ${temps}`;
}
