import { el } from "./dom.js?v=mwvfmjzd";

const PICTOS = {
  whatsapp:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.2 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.4 1 2.5.1.2 1.8 2.7 4.3 3.8 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1 .1-1.2l-.4-.4Z"/></svg>',
  partager:
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
  copier:
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
};

function picto(nom) {
  const conteneur = document.createElement("span");
  conteneur.className = "pt-picto";
  conteneur.innerHTML = PICTOS[nom];
  return conteneur;
}

async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    const zone = el("textarea", { readonly: true, classe: "pt-visuellement-cache" }, texte);
    document.body.append(zone);
    zone.select();
    const reussi = document.execCommand("copy");
    zone.remove();
    return reussi;
  }
}

// Panneau d'envoi du lien de capture : WhatsApp, partage natif du téléphone, copie.
export function panneauPartage(lien, quandEnvoye) {
  const message = `Salut ! Tu peux m'envoyer une photo avec Naatal ? Ouvre ce lien et prends la photo, c'est rapide et il n'y a rien à installer : ${lien}`;
  const confirmation = el("p", { classe: "pt-confirmation", role: "status", "aria-live": "polite" });

  const whatsapp = el(
    "a",
    {
      classe: "pt-bouton pt-bouton-whatsapp",
      href: `https://wa.me/?text=${encodeURIComponent(message)}`,
      target: "_blank",
      rel: "noopener",
      onclick: () => quandEnvoye(),
    },
    picto("whatsapp"),
    "Envoyer sur WhatsApp",
  );

  const partager =
    typeof navigator.share === "function"
      ? el(
          "button",
          {
            type: "button",
            classe: "pt-bouton pt-bouton-second",
            onclick: async () => {
              try {
                await navigator.share({ title: "Photo Naatal", text: message });
                quandEnvoye();
              } catch {
                // Partage annulé par la personne : rien à signaler.
              }
            },
          },
          picto("partager"),
          "Partager",
        )
      : null;

  const boutonCopier = el(
    "button",
    {
      type: "button",
      classe: "pt-bouton pt-bouton-second",
      onclick: async () => {
        const reussi = await copier(lien);
        confirmation.textContent = reussi
          ? "Lien copié. Colle-le dans la conversation de ton choix."
          : "La copie n'a pas fonctionné : sélectionne le lien ci-dessus et copie-le à la main.";
        confirmation.dataset.etat = reussi ? "ok" : "ko";
        if (reussi) quandEnvoye({ attendre: true });
      },
    },
    picto("copier"),
    "Copier le lien",
  );

  return el(
    "div",
    { classe: "pt-partage" },
    el("p", { classe: "pt-lien" }, el("code", {}, lien)),
    el("div", { classe: "pt-partage-boutons" }, whatsapp, partager, boutonCopier),
    confirmation,
  );
}
