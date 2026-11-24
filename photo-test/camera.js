import { CONFIG } from "./config.js?v=mwvas9ex";
import { formaterCoordonnees, formaterHorodatage } from "./geo.js?v=mwvas9ex";

const COTE_MAX_PX = 1600;
const QUALITE_JPEG = 0.8;
const POIDS_MAX_OCTETS = 5 * 1024 * 1024;

// Caméra intégrée au navigateur : jamais de choix dans la galerie, la photo est prise en direct.
export class CameraNaatal {
  constructor(video) {
    this.video = video;
    this.flux = null;
    this.cameras = [];
    this.indexCamera = -1;
  }

  static disponible() {
    return Boolean(navigator.mediaDevices?.getUserMedia);
  }

  async demarrer() {
    await this.ouvrir({ facingMode: { ideal: "environment" } });
    const appareils = await navigator.mediaDevices.enumerateDevices();
    this.cameras = appareils.filter((a) => a.kind === "videoinput");
    const piste = this.flux.getVideoTracks()[0];
    const actuel = piste?.getSettings().deviceId;
    this.indexCamera = Math.max(0, this.cameras.findIndex((c) => c.deviceId === actuel));
  }

  async ouvrir(contrainte) {
    this.arreter();
    this.flux = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...contrainte, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    this.video.srcObject = this.flux;
    await this.video.play();
  }

  get plusieursCameras() {
    return this.cameras.length > 1;
  }

  async changer() {
    if (!this.plusieursCameras) return;
    this.indexCamera = (this.indexCamera + 1) % this.cameras.length;
    await this.ouvrir({ deviceId: { exact: this.cameras[this.indexCamera].deviceId } });
  }

  capturer(infos) {
    return composerPhoto(this.video, this.video.videoWidth, this.video.videoHeight, infos);
  }

  arreter() {
    this.flux?.getTracks().forEach((piste) => piste.stop());
    this.flux = null;
  }
}

let logo;
function chargerLogo() {
  logo ??= new Promise((resolu) => {
    const image = new Image();
    image.onload = () => resolu(image);
    image.onerror = () => resolu(null);
    image.src = CONFIG.logo;
  });
  return logo;
}

function blobDe(toile, qualite) {
  return new Promise((resolu, rejete) =>
    toile.toBlob((b) => (b ? resolu(b) : rejete(new Error("Export JPEG impossible"))), "image/jpeg", qualite),
  );
}

// Redimensionne l'image, incruste le bandeau horodaté (logo, date, heure, ville, coordonnées) et
// l'exporte en JPEG. Sert aussi au mode secours, à partir d'une image fournie par le téléphone.
export async function composerPhoto(source, largeurSource, hauteurSource, infos) {
  const echelle = Math.min(1, COTE_MAX_PX / Math.max(largeurSource, hauteurSource));
  const largeur = Math.round(largeurSource * echelle);
  const hauteur = Math.round(hauteurSource * echelle);
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext("2d");
  ctx.drawImage(source, 0, 0, largeur, hauteur);

  const unite = Math.max(largeur, hauteur) / 100;
  const bandeau = Math.round(unite * 11);
  ctx.fillStyle = "rgba(3, 22, 28, 0.78)";
  ctx.fillRect(0, hauteur - bandeau, largeur, bandeau);
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(0, hauteur - bandeau, largeur, Math.max(2, Math.round(unite * 0.25)));

  const marge = Math.round(unite * 1.6);
  const tailleLogo = Math.round(bandeau * 0.62);
  const image = await chargerLogo();
  if (image) ctx.drawImage(image, marge, hauteur - bandeau + (bandeau - tailleLogo) / 2, tailleLogo, tailleLogo);

  const x = marge + (image ? tailleLogo + marge * 0.7 : 0);
  const police = '"Montserrat", "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(unite * 2.7)}px ${police}`;
  ctx.fillText(`Naatal · ${formaterHorodatage(infos.priseLe)}`, x, hauteur - bandeau * 0.64, largeur - x - marge);
  ctx.fillStyle = "#e2c25a";
  ctx.font = `500 ${Math.round(unite * 2.2)}px ${police}`;
  const ligne = [
    infos.ville,
    formaterCoordonnees(infos.lat, infos.lng),
    `± ${Math.round(infos.precision)} m`,
  ].filter(Boolean).join(" · ");
  ctx.fillText(ligne, x, hauteur - bandeau * 0.3, largeur - x - marge);

  let qualite = QUALITE_JPEG;
  let jpeg = await blobDe(toile, qualite);
  while (jpeg.size > POIDS_MAX_OCTETS && qualite > 0.4) {
    qualite -= 0.15;
    jpeg = await blobDe(toile, qualite);
  }
  return jpeg;
}
