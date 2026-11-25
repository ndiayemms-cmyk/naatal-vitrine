// Comportements de la landing Naatal en version HTML : barre de navigation au défilement, thème clair ou
// sombre, teinte, menu des cas d'usage, et carrousel des démonstrations (lecture automatique, enchaînement,
// glisser, onglets). La liste des films de chaque page est dans le bloc #films-donnees.
(function () {
  "use strict";

  var vitrine = document.querySelector(".decouvrir");
  var parametres = new URLSearchParams(location.search);
  var vert = parametres.get("teinte") === "vert";
  if (vert) vitrine.classList.remove("teinte-or");
  if (parametres.get("teinte") === "or") vitrine.classList.add("teinte-or");

  // La teinte verte, choisie par l'adresse, suit le visiteur d'une page à l'autre de la vitrine.
  if (vert) {
    document.querySelectorAll('a[href$=".html"], a[href*=".html#"]').forEach(function (lien) {
      var adresse = lien.getAttribute("href");
      var ancre = adresse.indexOf("#");
      lien.setAttribute(
        "href",
        ancre < 0 ? adresse + "?teinte=vert" : adresse.slice(0, ancre) + "?teinte=vert" + adresse.slice(ancre),
      );
    });
  }

  var entete = document.querySelector(".d-entete");
  function majEntete() {
    if (window.scrollY > 4) entete.setAttribute("data-pleine", "");
    else entete.removeAttribute("data-pleine");
  }
  majEntete();
  window.addEventListener("scroll", majEntete, { passive: true });

  var boutonTheme = document.querySelector(".d-entete .bouton-icone");
  function themeAffiche() {
    var choisi = document.documentElement.dataset.theme;
    if (choisi === "dark" || choisi === "light") return choisi;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function majBoutonTheme() {
    var sombre = themeAffiche() === "dark";
    boutonTheme.setAttribute("aria-pressed", String(sombre));
    boutonTheme.setAttribute("aria-label", sombre ? "Passer en mode clair" : "Passer en mode sombre");
  }
  if (boutonTheme) {
    majBoutonTheme();
    boutonTheme.addEventListener("click", function () {
      var theme = themeAffiche() === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      try {
        localStorage.setItem("naatal-theme", theme);
      } catch (e) {}
      majBoutonTheme();
    });
  }

  // Menu « Cas d'usage » : il s'ouvre au clic et se ferme par Échap, par un clic ailleurs ou au choix d'un lien.
  document.querySelectorAll(".d-cas-menu").forEach(function (menu) {
    var declencheur = menu.querySelector(".d-cas-declencheur");
    var panneau = menu.querySelector(".d-cas-panneau");
    function ouvrir(ouvert) {
      declencheur.setAttribute("aria-expanded", String(ouvert));
      panneau.hidden = !ouvert;
    }
    declencheur.addEventListener("click", function () {
      ouvrir(panneau.hidden);
    });
    document.addEventListener("mousedown", function (e) {
      if (!panneau.hidden && !menu.contains(e.target)) ouvrir(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panneau.hidden) ouvrir(false);
    });
    panneau.querySelectorAll("a").forEach(function (lien) {
      lien.addEventListener("click", function () {
        ouvrir(false);
      });
    });
  });

  var donnees = document.getElementById("films-donnees");
  var cadre = document.querySelector(".d-films");
  if (!donnees || !cadre) return;
  var FILMS = JSON.parse(donnees.textContent);
  var NOMBRE = FILMS.length;
  var piste = cadre.querySelector(".d-films-piste");
  var onglets = cadre.querySelectorAll(".d-films-onglets button");
  var barreOnglets = cadre.querySelector(".d-films-onglets");
  var resume = cadre.querySelector(".d-films-resume");
  var lienFilm = cadre.querySelector(".d-films-lien");
  var diapos = piste.querySelectorAll(".d-films-diapo:not(.d-films-gabarit)");

  var courant = 0;
  var places = [];
  var visible = false;
  var autonome = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var video = null;
  var commande = null;
  var minuteurAttente = 0;

  function place(rang) {
    var ecart = (rang - courant + NOMBRE) % NOMBRE;
    return ecart > NOMBRE / 2 ? ecart - NOMBRE : ecart;
  }

  var ICONE_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>';
  var ICONE_LECTURE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';

  function majCommande() {
    if (!commande || !video) return;
    var enLecture = !video.paused;
    commande.className = enLecture ? "d-films-commande lecture" : "d-films-commande";
    commande.innerHTML = enLecture ? ICONE_PAUSE : ICONE_LECTURE;
    commande.setAttribute("aria-label", enLecture ? "Mettre la démonstration en pause" : "Lire la démonstration");
  }

  // Un emplacement encore vide reste quelques secondes à l'écran, puis le carrousel passe au film suivant.
  function lireSiPossible() {
    window.clearTimeout(minuteurAttente);
    if (FILMS[courant].disponible === false) {
      if (visible && autonome && NOMBRE > 1) {
        minuteurAttente = window.setTimeout(function () {
          aller(courant + 1, true);
        }, 6000);
      }
      return;
    }
    if (!video) return;
    if (visible && autonome) video.play().catch(majCommande);
    else video.pause();
  }

  function rendre(premierRendu, enchainement) {
    video = null;
    commande = null;
    FILMS.forEach(function (film, i) {
      var diapo = diapos[i];
      var position = place(i);
      var precedente = places[i] === undefined ? position : places[i];
      diapo.style.setProperty("--place", String(position));
      diapo.classList.toggle("active", position === 0);
      diapo.classList.toggle("hors-champ", Math.abs(position) > 1);
      diapo.classList.toggle("sans-transition", Math.abs(position - precedente) > 1);
      diapo.setAttribute("aria-hidden", String(position !== 0));
      places[i] = position;
      if (film.disponible === false) return;
      var image = diapo.querySelector(".d-films-image");
      image.classList.toggle("vertical", Boolean(film.vertical));
      if (position === 0) {
        image.innerHTML =
          '<video muted playsinline preload="metadata" src="demonstrations/' + film.fichier + '.webm" poster="demonstrations/' + film.fichier + '.webp"></video>' +
          '<button type="button" class="d-films-commande"></button>';
        video = image.querySelector("video");
        video.setAttribute("aria-label", "Démonstration " + (i + 1) + " sur " + NOMBRE + " : " + film.titre + ". " + film.resume);
        commande = image.querySelector("button");
        var lecteur = video;
        lecteur.addEventListener("play", majCommande);
        lecteur.addEventListener("pause", majCommande);
        lecteur.addEventListener("timeupdate", function () {
          var barre = onglets[courant] && onglets[courant].querySelector(".d-films-progres");
          if (barre && lecteur.duration) barre.style.transform = "scaleX(" + lecteur.currentTime / lecteur.duration + ")";
        });
        lecteur.addEventListener("ended", function () {
          aller(courant + 1);
        });
        commande.addEventListener("click", function () {
          if (lecteur.paused) {
            autonome = true;
            lecteur.play().catch(majCommande);
          } else {
            autonome = false;
            lecteur.pause();
          }
        });
        majCommande();
      } else if (!image.querySelector("img")) {
        image.innerHTML = '<img src="demonstrations/' + film.fichier + '.webp" alt="" loading="lazy" draggable="false">';
      }
    });
    onglets.forEach(function (bouton, i) {
      bouton.setAttribute("aria-pressed", String(i === courant));
      var barre = bouton.querySelector(".d-films-progres");
      if (barre) barre.style.transform = "scaleX(0)";
    });
    resume.textContent = FILMS[courant].resume;
    if (lienFilm) {
      var lienCourant = FILMS[courant].lien;
      lienFilm.hidden = !lienCourant;
      if (lienCourant) {
        lienFilm.textContent = lienCourant.texte;
        lienFilm.setAttribute("href", lienCourant.adresse);
      }
    }
    var actif = onglets[courant];
    if (!premierRendu && actif) {
      barreOnglets.scrollTo({ left: actif.offsetLeft - (barreOnglets.clientWidth - actif.clientWidth) / 2, behavior: "smooth" });
    }
    if (!premierRendu && !enchainement) autonome = true;
    lireSiPossible();
  }

  function aller(rang, enchainement) {
    courant = ((rang % NOMBRE) + NOMBRE) % NOMBRE;
    rendre(false, enchainement);
  }

  onglets.forEach(function (bouton, i) {
    bouton.addEventListener("click", function () {
      aller(i);
    });
  });
  barreOnglets.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") aller(courant + 1);
    else if (e.key === "ArrowLeft") aller(courant - 1);
    else return;
    e.preventDefault();
  });
  diapos.forEach(function (diapo, i) {
    diapo.addEventListener("click", function () {
      if (place(i) !== 0 && !glisseFaite) aller(i);
    });
  });

  var geste = null;
  var glisseFaite = false;
  piste.addEventListener("pointerdown", function (e) {
    if (e.button !== 0 || e.target.closest("button")) return;
    geste = { depart: e.clientX, ecart: 0, instant: performance.now() };
    glisseFaite = false;
  });
  piste.addEventListener("pointermove", function (e) {
    if (!geste) return;
    geste.ecart = e.clientX - geste.depart;
    if (!glisseFaite && Math.abs(geste.ecart) > 6) {
      glisseFaite = true;
      piste.setPointerCapture(e.pointerId);
      piste.classList.add("en-glisse");
    }
    if (glisseFaite) piste.style.setProperty("--glisse", geste.ecart + "px");
  });
  function finirGlisse() {
    if (!geste) return;
    var g = geste;
    geste = null;
    piste.classList.remove("en-glisse");
    piste.style.setProperty("--glisse", "0px");
    var vitesse = Math.abs(g.ecart) / Math.max(1, performance.now() - g.instant);
    if (Math.abs(g.ecart) > piste.clientWidth * 0.12 || (Math.abs(g.ecart) > 30 && vitesse > 0.5)) {
      aller(courant + (g.ecart < 0 ? 1 : -1));
    }
  }
  piste.addEventListener("pointerup", finirGlisse);
  piste.addEventListener("pointercancel", finirGlisse);
  piste.addEventListener("dragstart", function (e) {
    e.preventDefault();
  });
  var molette = { cumul: 0, bloqueJusqua: 0 };
  piste.addEventListener(
    "wheel",
    function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      var maintenant = performance.now();
      if (maintenant < molette.bloqueJusqua) return;
      molette.cumul += e.deltaX;
      if (Math.abs(molette.cumul) > 60) {
        aller(courant + (molette.cumul > 0 ? 1 : -1));
        molette.cumul = 0;
        molette.bloqueJusqua = maintenant + 700;
      }
    },
    { passive: true },
  );

  new IntersectionObserver(
    function (entrees) {
      visible = entrees[0].isIntersecting;
      lireSiPossible();
    },
    { threshold: 0.35 },
  ).observe(cadre);

  rendre(true);
})();
