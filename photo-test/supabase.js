import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { CONFIG } from "./config.js?v=mwws4u6y";

export const BRANCHEE = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseCleAnonyme);

const base = BRANCHEE
  ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseCleAnonyme, { auth: { persistSession: false } })
  : null;

const MESSAGES = {
  limite_demandes: "Tu as déjà créé 3 liens cette heure-ci. Réessaie un peu plus tard.",
  position_invalide: "La position reçue n'est pas valable. Reprends la position et réessaie.",
  demande_introuvable: "Ce lien Naatal n'existe pas ou a déjà été supprimé.",
  demande_expiree: "Ce lien a expiré : il n'était valable que 24 heures.",
  photos_max: "Les 3 photos prévues pour ce lien ont déjà été envoyées.",
  photo_absente: "La photo n'est pas arrivée jusqu'au serveur. Réessaie l'envoi.",
  heure_invalide: "L'heure de ton téléphone semble déréglée. Corrige-la puis reprends la photo.",
};

export class ErreurNaatal extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function traduire(erreur) {
  const texte = erreur?.message ?? "";
  const code = Object.keys(MESSAGES).find((c) => texte.includes(c));
  if (code) return new ErreurNaatal(code, MESSAGES[code]);
  // Refus du stockage : la règle de dépôt n'accepte plus de photo pour ce lien.
  if (/row-level security|unauthorized/i.test(texte)) {
    return new ErreurNaatal("depot_refuse", "Ce lien n'accepte plus de photo : il a expiré ou ses 3 photos sont déjà arrivées.");
  }
  if (!navigator.onLine) return new ErreurNaatal("hors_ligne", "Pas de connexion. Vérifie le réseau et réessaie.");
  return new ErreurNaatal("inattendue", "Le serveur n'a pas répondu comme prévu. Réessaie dans un instant.");
}

function exigerBase() {
  if (!base) throw new ErreurNaatal("non_branchee", "La page test n'est pas encore reliée à son serveur.");
  return base;
}

async function appeler(fonction, parametres) {
  const { data, error } = await exigerBase().rpc(fonction, parametres);
  if (error) throw traduire(error);
  return data;
}

export function creerDemande({ lat, lng, ville, prenom }) {
  return appeler("test_creer_demande", { p_lat: lat, p_lng: lng, p_label: ville ?? null, p_nom: prenom || null });
}

export function lireSuivi(id) {
  return appeler("test_lire_suivi", { p_id: id });
}

export function lireCapture(slug) {
  return appeler("test_lire_capture", { p_slug: slug });
}

async function avecReprises(action, essais = 4) {
  let derniere;
  for (let essai = 0; essai < essais; essai += 1) {
    try {
      return await action();
    } catch (erreur) {
      derniere = erreur;
      if (erreur instanceof ErreurNaatal && !["hors_ligne", "inattendue", "photo_absente"].includes(erreur.code)) {
        throw erreur;
      }
      await new Promise((r) => setTimeout(r, 1500 * 2 ** essai));
    }
  }
  throw derniere;
}

// Le chemin est fixé avant le premier essai : si l'enregistrement échoue après le dépôt du fichier, la
// reprise retrouve le même fichier et le serveur ne compte pas deux fois la même photo.
export async function envoyerPhoto(slug, image, mesure) {
  const chemin = `${slug}/${crypto.randomUUID()}.jpg`;
  const stockage = exigerBase().storage.from("test-photos");
  let deposee = false;
  return avecReprises(async () => {
    if (!deposee) {
      const { error } = await stockage.upload(chemin, image, { contentType: "image/jpeg", upsert: false });
      if (error && !/exists|duplicate/i.test(error.message)) throw traduire(error);
      deposee = true;
    }
    return appeler("test_ajouter_photo", {
      p_slug: slug,
      p_chemin: chemin,
      p_lat: mesure.lat,
      p_lng: mesure.lng,
      p_precision_m: mesure.precision,
      p_prise_le: mesure.priseLe.toISOString(),
      p_ville: mesure.ville ?? null,
      p_mode: mesure.mode,
    });
  });
}

export async function adressesPhotos(chemins) {
  if (chemins.length === 0) return {};
  const { data, error } = await exigerBase().storage.from("test-photos").createSignedUrls(chemins, 900);
  if (error) throw traduire(error);
  return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}

// Diffusion en direct, doublée d'une relecture périodique : un réseau qui coupe le canal temps réel ne doit
// pas laisser le visiteur devant un écran d'attente figé.
export function suivreArrivees(id, quandArrivee) {
  const canal = exigerBase()
    .channel(`photo-test:${id}`)
    .on("broadcast", { event: "photo" }, () => quandArrivee())
    .subscribe();
  const relecture = setInterval(quandArrivee, 15000);
  return () => {
    clearInterval(relecture);
    base.removeChannel(canal);
  };
}
