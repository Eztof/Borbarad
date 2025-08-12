// Element-Helpers + kleine UI-State-Schalter
export const $ = (sel) => /** @type {HTMLElement} */(document.querySelector(sel));
export const $$ = (sel) => /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll(sel));

export function show(sel) { $(sel).classList.remove("hidden"); }
export function hide(sel) { $(sel).classList.add("hidden"); }

export function setText(sel, text) { $(sel).textContent = text; }
export function setImg(sel, url) {
  const img = /** @type {HTMLImageElement} */($(sel));
  img.src = url; 
}

export function formToJSON(form) {
  const obj = {};
  new FormData(form).forEach((v, k) => obj[k] = v);
  return obj;
}

/** Setzt Formularfelder für Helden */
export function setHeroForm(hero) {
  $("#hero-id").value = hero?.id ?? "";
  $("#hero-name").value = hero?.name ?? "";
  $("#hero-species").value = hero?.species ?? "";
  $("#hero-profession").value = hero?.profession ?? "";
  $("#hero-level").value = hero?.level ?? 1;
  $("#hero-attrs").value = hero?.attrs ? JSON.stringify(hero.attrs, null, 2) : "";
  if (hero?.portrait_url) {
    setImg("#hero-portrait-preview", hero.portrait_url);
    $("#hero-portrait-preview").classList.remove("hidden");
  } else {
    $("#hero-portrait-preview").classList.add("hidden");
    $("#hero-portrait-preview").removeAttribute("src");
  }
}
