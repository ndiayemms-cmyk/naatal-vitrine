const L = window.L;

function fonds() {
  const plan = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>',
  });
  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Imagerie &copy; Esri, Maxar, Earthstar Geographics et la communauté des utilisateurs SIG",
    },
  );
  return { plan, satellite };
}

function nouvelleCarte(element, options) {
  const carte = L.map(element, { attributionControl: true, ...options });
  carte.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  const { plan, satellite } = fonds();
  plan.addTo(carte);
  L.control.layers({ Plan: plan, Satellite: satellite }, undefined, { position: "topright" }).addTo(carte);
  return carte;
}

function repere(type, libelle) {
  return L.divIcon({
    className: `pt-repere pt-repere-${type}`,
    html: `<span class="pt-repere-tete" aria-hidden="true"></span><span class="pt-visuellement-cache">${libelle}</span>`,
    iconSize: [30, 40],
    iconAnchor: [15, 38],
  });
}

function cercle(centre, rayon) {
  return L.circle(centre, {
    radius: rayon,
    className: "pt-zone",
    weight: 2,
    fillOpacity: 0.12,
  });
}

// Choix du point de référence : toucher la carte, déplacer le repère, ou le placer depuis l'extérieur
// (position du téléphone, résultat de recherche).
export class SelecteurTerrain {
  constructor(element, rayon, quandChange) {
    this.rayon = rayon;
    this.quandChange = quandChange;
    this.carte = nouvelleCarte(element, { center: [14.6928, -17.4467], zoom: 12 });
    this.carte.on("click", (e) => this.placer(e.latlng.lat, e.latlng.lng, { centrer: false }));
  }

  placer(lat, lng, { centrer = true, precision } = {}) {
    const point = [lat, lng];
    if (!this.repere) {
      this.repere = L.marker(point, { icon: repere("terrain", "Ton terrain"), draggable: true, keyboard: true });
      this.repere.on("dragend", () => {
        const p = this.repere.getLatLng();
        this.placer(p.lat, p.lng, { centrer: false });
      });
      this.repere.addTo(this.carte);
      this.zone = cercle(point, this.rayon).addTo(this.carte);
    } else {
      this.repere.setLatLng(point);
      this.zone.setLatLng(point);
    }
    if (centrer) this.carte.setView(point, 17);
    this.quandChange({ lat, lng, precision });
  }

  redimensionner() {
    this.carte.invalidateSize();
  }
}

// Carte du résultat : le terrain, son périmètre, la position de la photo et la ligne qui les relie.
export function carteResultat(element, terrain, photo, rayon) {
  const carte = nouvelleCarte(element, { zoomControl: true, scrollWheelZoom: false });
  const a = [terrain.lat, terrain.lng];
  const b = [photo.lat, photo.lng];
  cercle(a, rayon).addTo(carte);
  L.polyline([a, b], { className: "pt-liaison", weight: 2, dashArray: "6 6" }).addTo(carte);
  L.marker(a, { icon: repere("terrain", "Le terrain"), keyboard: false }).addTo(carte);
  L.marker(b, { icon: repere("photo", "Lieu de la photo"), keyboard: false }).addTo(carte);
  carte.fitBounds(L.latLng(a).toBounds(rayon * 2).extend(b).pad(0.2), { maxZoom: 18 });
  return carte;
}
