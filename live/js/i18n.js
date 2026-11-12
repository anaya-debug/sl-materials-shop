// Dutch / English switch for the shop.
// Static page text carries its Dutch version in data-nl attributes; the order tool
// uses tx('English', 'Nederlands'). The choice is remembered in this browser.

const KEY = 'sl-shop-lang';
export const LANGS = ['nl', 'en'];

function initial() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(fromUrl)) return fromUrl;
  try { const saved = localStorage.getItem(KEY); if (LANGS.includes(saved)) return saved; } catch { /* storage blocked */ }
  // Dutch for Dutch browsers, English for everyone else.
  return (navigator.language || '').toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

let lang = initial();
export const getLang = () => lang;
export const isNl = () => lang === 'nl';
export const locale = () => (lang === 'nl' ? 'nl-NL' : 'en-GB');
export const tx = (en, nl) => (lang === 'nl' ? nl : en);

export function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* storage blocked */ }
}

// Swap every element that carries a Dutch version. The English original is kept the first time.
const ATTRS = ['aria-label', 'alt', 'placeholder', 'content'];
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-nl]').forEach((el) => {
    if (el.dataset.en == null) el.dataset.en = el.innerHTML;
    el.innerHTML = lang === 'nl' ? el.dataset.nl : el.dataset.en;
  });
  for (const a of ATTRS) {
    const nlAttr = `data-nl-${a}`;
    root.querySelectorAll(`[${nlAttr}]`).forEach((el) => {
      const enAttr = `data-en-${a}`;
      if (!el.hasAttribute(enAttr)) el.setAttribute(enAttr, el.getAttribute(a) ?? '');
      el.setAttribute(a, lang === 'nl' ? el.getAttribute(nlAttr) : el.getAttribute(enAttr));
    });
  }
  root.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}
