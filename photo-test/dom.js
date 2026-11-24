export function el(balise, attributs = {}, ...enfants) {
  const noeud = document.createElement(balise);
  for (const [nom, valeur] of Object.entries(attributs)) {
    if (valeur === false || valeur == null) continue;
    if (nom.startsWith("on")) noeud.addEventListener(nom.slice(2), valeur);
    else if (nom === "classe") noeud.className = valeur;
    else noeud.setAttribute(nom, valeur === true ? "" : valeur);
  }
  for (const enfant of enfants.flat()) {
    if (enfant == null || enfant === false) continue;
    noeud.append(enfant instanceof Node ? enfant : String(enfant));
  }
  return noeud;
}
