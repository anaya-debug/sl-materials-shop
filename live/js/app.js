import { CONFIG } from './config.js?v=202611121208';
import { PROJECTS, MIX_CODES, OFFLOADS, CONSISTENCY, STONE_SIZES, QUOTE_PROJECT_TYPES, ADD_ONS } from './catalogue.js?v=202611121208';
import * as L from './logic.js?v=202611121208';
import { orderFromShop } from './orders.js?v=202611121208';
import { submitOrder } from './backend.js?v=202611121208';
import { tx, isNl, locale, setLang, applyStatic } from './i18n.js?v=202611121208';

const P = CONFIG.pricing;
const C = CONFIG.contact;
const VOL = CONFIG.volume;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tbd = (label) => `<span class="tbd">[${esc(label)}]</span>`;
const money = (n) => L.formatEUR(n, locale());
const orTbd = (v, label, fmt = (x) => esc(x)) => (v == null ? tbd(label) : fmt(v));
const num = (n, d) => n.toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const m3 = (n) => num(n, 1) + ' m³';
// A catalogue field in the current language (falls back to English).
const nlf = (item, field) => (isNl() && item?.nl?.[field] != null ? item.nl[field] : item?.[field]);

// Links that have a Dutch version on the main site.
const mainSite = () => (isNl() ? C.mainSite.replace(/\/en$/, '/') : C.mainSite);
const termsUrl = () => (isNl() ? C.termsUrl.replace('/en/', '/') : C.termsUrl);

// ---------- Static page ----------

function fillSlots() {
  const slots = {
    fromPrice: orTbd(P.fromPricePerM3, tx('from price', 'vanafprijs'), (v) => money(L.withVat(v, P.vatPct))),
    fromPriceEx: orTbd(P.fromPricePerM3, tx('from price', 'vanafprijs'), (v) => money(v)),
    quoteTime: orTbd(CONFIG.responseTimes.quote, tx('response time', 'reactietijd'), (v) => esc(tx(v, CONFIG.responseTimes.quoteNl))),
    tradeTerms: orTbd(C.tradePaymentTerms, tx('payment terms', 'betaaltermijn')),
    radius: orTbd(CONFIG.delivery.radiusKm, tx('radius', 'straal')),
  };
  const tradeSubject = tx('Trade enquiry', 'Zakelijke aanvraag');
  const tradeBody = tx(
    'Hello SL Materials,\n\nWe would like a price for the following job:\n\nCompany name:\nSite location / postcode:\nMix or strength class:\nVolume (m³):\nDates:\nOffloading (chute, pump, other):\n\nPhone number:\n',
    'Beste SL Materials,\n\nWij ontvangen graag een prijs voor de volgende klus:\n\nBedrijfsnaam:\nLocatie / postcode:\nMengsel of sterkteklasse:\nHoeveelheid (m³):\nData:\nLoswijze (goot, pomp, anders):\n\nTelefoonnummer:\n');
  const hrefs = { ...C, mainSite: mainSite(), salesMail: 'mailto:' + C.salesEmail,
    tradeMail: `mailto:${C.salesEmail}?subject=${encodeURIComponent(tradeSubject)}&body=${encodeURIComponent(tradeBody)}` };
  document.querySelectorAll('[data-slot]').forEach((el) => { el.innerHTML = slots[el.dataset.slot] ?? ''; });
  document.querySelectorAll('[data-text]').forEach((el) => { el.textContent = C[el.dataset.text] ?? ''; });
  document.querySelectorAll('[data-href]').forEach((el) => { el.href = hrefs[el.dataset.href] ?? '#'; });
}

function setupMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('main-nav');
  const setMenu = (open) => { nav.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
}

// ---------- State ----------

const fresh = (tab = 'buy') => ({
  tab, step: 1, mode: 'project', project: null, code: null, addOns: [],
  volume: VOL.default, showCalc: false, len: '', wid: '', dep: '100',
  customer: 'private', postcode: '', offload: null, barrowOk: false, slump: 'S3', stone: 'std', fibres: false,
  showSlumpHelp: false, showStoneHelp: false,
  day: null, time: 'am', name: '', phone: '', email: '', notes: '', terms: false,
  done: false, quoteSent: false, callbackSent: false,
});

let s = fresh();

// Delivery days in the current language. After the cut-off, tomorrow is no longer offered.
function getDays(loc = locale()) {
  const now = new Date();
  const list = L.nextDeliveryDays(now, CONFIG.delivery.daysShown + 1, loc);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const tKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const late = L.pastCutoff(now, CONFIG.delivery.nextDayCutoff);
  return list.filter((d) => !(late && d.key === tKey)).slice(0, CONFIG.delivery.daysShown);
}

// Private customers see prices incl. BTW (Dutch consumer rules); business customers see them excl. BTW.
const isPrivate = () => s.customer !== 'business';
const VATP = P.vatPct;
const pm = (n) => money(isPrivate() ? L.withVat(n, VATP) : n);
const vatLabel = () => (isPrivate() ? tx('incl. BTW', 'incl. btw') : tx('excl. BTW', 'excl. btw'));

// The step checks come from logic.js in English; these are the Dutch versions.
const HINTS_NL = {
  'Choose a project or a mix code.': 'Kies een toepassing of een mengselcode.',
  'Next: delivery and volume.': 'Volgende: levering en hoeveelheid.',
  'Enter a postcode in our delivery area.': 'Vul een postcode in ons leveringsgebied in.',
  'Choose an offloading method.': 'Kies hoe het beton gelost wordt.',
  "S1 and S2 can't be pumped. Choose S3 or S4.": 'S1 en S2 zijn niet verpompbaar. Kies S3 of S4.',
  'Confirm you can unload within 30 minutes.': 'Bevestig dat je binnen 30 minuten kunt lossen.',
  'Next: date and your details.': 'Volgende: datum en je gegevens.',
  'Pick a delivery date.': 'Kies een leverdatum.',
  'Fill in your name, phone and email.': 'Vul je naam, telefoonnummer en e-mail in.',
  'Please accept the terms.': 'Ga akkoord met de voorwaarden.',
  'Next: check and confirm.': 'Volgende: controleren en bevestigen.',
  'Nothing is charged until a planner confirms.': 'Er wordt niets afgeschreven tot een planner bevestigt.',
};
const hintText = (h) => (isNl() ? HINTS_NL[h] ?? h : h);

function derive() {
  const isProject = s.mode === 'project';
  const proj = PROJECTS.find((p) => p.id === s.project);
  const code = MIX_CODES.find((c) => c.code === s.code);
  const hasMix = isProject ? !!proj : !!code;
  const choose = tx('Choose a mix', 'Kies een mengsel');
  const mixLabel = isProject ? (proj ? (nlf(proj, 'mix') || tx('Planner to advise', 'Advies van de planner')) : choose) : (code ? nlf(code, 'code') : choose);
  const addOns = s.addOns.filter((id) => isProject || !ADD_ONS.find((a) => a.id === id)?.projectOnly);
  const pc = L.checkPostcode(s.postcode, CONFIG.delivery.postcodeRanges);
  const calc = L.calcVolume(s.len, s.wid, s.dep, VOL);
  const days = getDays();
  const dayObj = days.find((d) => d.key === s.day);
  const timeText = { am: tx('morning', 'ochtend'), pm: tx('afternoon', 'middag'), any: tx('any time', 'geen voorkeur') }[s.time];
  const price = L.priceOrder({ volume: s.volume, stone: s.stone, fibres: s.fibres, offload: s.offload, saturday: !!dayObj?.saturday, addOns, consistency: s.slump }, P);
  const pumpOk = L.canPump(s.slump, CONFIG.pumpableConsistency);
  const check = L.checkStep(s.step, s, { hasMix, inArea: pc.inArea, dayChosen: !!dayObj, pumpOk });
  return {
    isProject, proj, code, hasMix, mixLabel, addOns, pc, calc, days, dayObj, price, check, pumpOk,
    mixWhy: proj ? (proj.mix ? nlf(proj, 'why') + tx(' The planner double-checks it.', ' De planner controleert het nog.') : tx('A planner will recommend the right mix when they call.', 'Een planner adviseert het juiste mengsel als hij belt.')) : '',
    mixSource: isProject ? (proj ? nlf(proj, 'label') : '') : tx('Chosen by mix code', 'Gekozen op mengselcode'),
    slotLabel: dayObj ? `${dayObj.dow} ${dayObj.dm}, ${timeText}` : tx('not chosen', 'niet gekozen'),
    stoneLabel: STONE_SIZES.find((x) => x.id === s.stone).label,
    offloadLabel: nlf(OFFLOADS.find((o) => o.id === s.offload), 'label') ?? '',
    addOnLabels: addOns.map((id) => nlf(ADD_ONS.find((a) => a.id === id), 'label')),
  };
}

// ---------- Small view helpers ----------

const pressBtn = (cls, key, value, on, inner, extra = '') =>
  `<button type="button" class="${cls}" data-set="${key}" data-value="${esc(value)}" data-key="${key}:${esc(value)}" aria-pressed="${on}" ${extra}>${inner}</button>`;
const opt = (key, value, on, title, sub, cls = '') =>
  pressBtn(`opt ${cls}`, key, value, on, `<span class="opt-title">${esc(title)}</span>${sub ? `<span class="opt-sub">${sub}</span>` : ''}`);
const field = (id, label, attrs, value = '') =>
  `<div class="field"><label class="label" for="${id}">${label}</label><input id="${id}" class="input" data-key="${id}" ${attrs} value="${esc(value)}"></div>`;
const perM3 = (n) => `+${pm(n)} ${tx('per m³', 'per m³')}`;

// ---------- Buy online ----------

function step1(d) {
  const grid = d.isProject
    ? `<div class="opts">${PROJECTS.map((p) => opt('project', p.id, s.project === p.id, nlf(p, 'label'), esc(nlf(p, 'sub')))).join('')}</div>`
    : `<div class="opts">${MIX_CODES.map((c) => pressBtn('opt', 'code', c.code, s.code === c.code, `<span class="opt-code">${esc(nlf(c, 'code'))}</span><span class="opt-sub">${esc(nlf(c, 'use'))}</span>`)).join('')}</div>
       <p class="hint">${tx('Need an exposure class or special mix? Add it in the notes on step 3, or', 'Een milieuklasse of speciaal mengsel nodig? Zet het in de opmerkingen bij stap 3, of')} <a href="#quote-tool" data-act="to-quote">${tx('ask for a quote', 'vraag een offerte aan')}</a>.</p>`;
  const addOns = ADD_ONS.filter((a) => d.isProject || !a.projectOnly);
  return `
    <div class="row-between">
      <h3 class="step-title" id="step-title" tabindex="-1">${tx('Select your concrete', 'Kies je beton')}</h3>
      <div class="seg-group" role="group" aria-label="${tx('Choose by', 'Kies op')}">
        ${pressBtn('seg', 'mode', 'project', d.isProject, tx('By use', 'Op toepassing'))}
        ${pressBtn('seg', 'mode', 'code', !d.isProject, tx('By mix code', 'Op mengselcode'))}
      </div>
    </div>
    ${grid}
    ${d.isProject && d.proj ? `<div class="note-green" role="status">${tx('Recommended mix', 'Aanbevolen mengsel')}: <strong>${esc(d.mixLabel)}</strong>. ${esc(d.mixWhy)}</div>` : ''}
    <div class="field-group" role="group" aria-labelledby="addon-l">
      <span class="label" id="addon-l">${tx('Extras', 'Toevoegingen')}</span>
      ${addOns.map((a) => `<label class="check"><input type="checkbox" data-field="addOn:${a.id}" data-key="addOn:${a.id}" ${s.addOns.includes(a.id) ? 'checked' : ''}>
        <span><strong>${esc(nlf(a, 'label'))}</strong> (${perM3(P.addOnsPerM3[a.id])}). ${esc(nlf(a, 'sub'))}.</span></label>`).join('')}
    </div>`;
}

function pcMsg(d) {
  if (d.pc.entered && d.pc.valid && d.pc.inArea) return `<span class="msg msg-ok">✓ ${tx('We deliver to this postcode', 'We leveren op deze postcode')}</span>`;
  if (d.pc.valid && !d.pc.inArea) return `<span class="msg msg-bad">${tx('Outside our usual delivery area. Please call', 'Buiten ons gebruikelijke leveringsgebied. Bel ons op')} <a href="${C.orderPhoneHref}">${esc(C.orderPhone)}</a>.</span>`;
  if (d.pc.badFormat) return `<span class="msg msg-bad">${tx('Enter a Dutch postcode, for example 1013 AB.', 'Vul een Nederlandse postcode in, bijvoorbeeld 1013 AB.')}</span>`;
  return '';
}

function calcOut(d) {
  const c = d.calc;
  return `<span>${tx('Calculated', 'Berekend')}: <strong>${num(c.raw, 2)} m³</strong></span><span>+ ${VOL.wastagePct}% ${tx('wastage', 'verlies')}: <strong>${num(c.withWaste, 2)} m³</strong></span><span>${tx('Recommended', 'Advies')}: <strong>${m3(c.recommended)}</strong></span>
    ${c.tooBig ? `<span class="msg msg-bad" style="flex-basis:100%">${tx('Over', 'Meer dan')} ${VOL.max} m³. <a href="#quote-tool" data-act="to-quote">${tx('Request a quote', 'Vraag een offerte aan')}</a> ${tx('for larger pours.', 'voor grotere storten.')}</span>` : ''}`;
}

function offloadNote() {
  const mins = CONFIG.freeUnloadMinutes;
  if (s.offload === 'barrow') {
    const loads = L.barrowLoads(s.volume);
    const big = s.volume > CONFIG.barrowWarnM3;
    const waiting = P.waiting?.perBlock == null ? tbd(tx('waiting-time rate', 'wachttijdtarief')) : `${pm(P.waiting.perBlock)} ${vatLabel()} ${tx('per', 'per')} ${P.waiting.blockMinutes} ${tx('minutes', 'minuten')}`;
    const head = big
      ? `<strong>${tx(`${m3(s.volume)} is a lot to move by wheelbarrow.`, `${m3(s.volume)} is veel om met kruiwagens te verplaatsen.`)}</strong>`
      : `<strong>${tx('Concrete is heavy.', 'Beton is zwaar.')}</strong>`;
    const body = tx(
      `${m3(s.volume)} is about ${loads} wheelbarrow loads${big ? ', so you will need a large team. For this much, a pump is usually the better choice' : ''}. The truck can wait up to ${mins} minutes to unload; after that, waiting time is charged at ${waiting}.`,
      `${m3(s.volume)} is ongeveer ${loads} kruiwagens${big ? ', dus je hebt een groot team nodig. Voor deze hoeveelheid is een pomp meestal de betere keuze' : ''}. De truck kan maximaal ${mins} minuten wachten om te lossen; daarna rekenen we wachttijd: ${waiting}.`);
    const terms = `<a href="${termsUrl()}" target="_blank" rel="noopener">${tx('waiting-time charges', 'wachttijdkosten')}</a>`;
    return `<div class="note-warn${big ? ' strong' : ''}" role="status"><p>${head} ${body}</p>
      <label class="check"><input type="checkbox" data-field="barrowOk" data-key="barrowOk" ${s.barrowOk ? 'checked' : ''}>
        <span>${tx(`I'll have enough people and wheelbarrows to unload within ${mins} minutes, and I accept ${terms} after that.`,
                   `Ik zorg voor genoeg mensen en kruiwagens om binnen ${mins} minuten te lossen, en ik ga akkoord met ${terms} daarna.`)}</span></label>
    </div>`;
  }
  if (s.offload === 'pumpsl') {
    return `<div class="note-green" role="status">${tx('<strong>We\'ll arrange the pump.</strong> Pump hire is charged separately from the concrete. A planner will be in touch with the price before anything is booked.',
      '<strong>Wij regelen de pomp.</strong> De pomphuur wordt apart van het beton berekend. Een planner neemt contact met je op over de prijs voordat er iets wordt geboekt.')}</div>`;
  }
  if (s.offload === 'pumpown') {
    return `<div class="note-green" role="status">${tx('Pumping needs a fluid mix, so choose S3 or S4 below. Your pump should be set up when the truck arrives.',
      'Om te pompen is een vloeibaar mengsel nodig, dus kies hieronder S3 of S4. Zorg dat je pomp klaarstaat als de truck aankomt.')}</div>`;
  }
  return '';
}

function step2(d) {
  const stoneSub = (x) => (P.stoneAddPerM3[x.id] ? perM3(P.stoneAddPerM3[x.id]) : esc(nlf(x, 'sub')));
  const slumpSub = (x) => {
    const add = P.consistencyAddPerM3?.[x.id];
    return esc(nlf(x, 'sub')) + (add ? ` · ${perM3(add)}` : '');
  };
  return `
    <h3 class="sr-only" id="step-title" tabindex="-1">${tx('Delivery and volume', 'Levering en hoeveelheid')}</h3>
    <div class="chosen"><span><strong>${esc(d.mixLabel)}</strong>${d.mixSource ? ' · ' + esc(d.mixSource) : ''}</span><button type="button" class="link-btn" data-act="goto1" data-key="goto1" style="padding:8px 10px">${tx('Change', 'Wijzig')}</button></div>

    <div class="field pc-field">
      <label class="label" for="pc">${tx('Delivery postcode', 'Postcode afleveradres')}</label>
      <input id="pc" class="input" data-field="postcode" data-key="pc" placeholder="${tx('e.g. 1013 AB', 'bijv. 1013 AB')}" autocomplete="postal-code" autocapitalize="characters" maxlength="7" value="${esc(s.postcode)}" aria-describedby="pc-msg">
      <div id="pc-msg" aria-live="polite">${pcMsg(d)}</div>
    </div>

    <div class="field-group">
      <div class="volume-head"><label class="label" for="vol">${tx('Volume', 'Hoeveelheid')}</label><span class="volume-value" id="vol-label">${m3(s.volume)}</span></div>
      <div class="stepper">
        <button type="button" class="round-btn" data-act="vol-down" data-key="vol-down" aria-label="${tx('Decrease volume', 'Minder')}">−</button>
        <input id="vol" type="range" data-field="volume" data-key="vol" min="${VOL.min}" max="${VOL.max}" step="${VOL.step}" value="${s.volume}" aria-valuetext="${m3(s.volume)}">
        <button type="button" class="round-btn" data-act="vol-up" data-key="vol-up" aria-label="${tx('Increase volume', 'Meer')}">+</button>
      </div>
      <div class="range-ends" aria-hidden="true"><span>${VOL.min} m³</span><span>${VOL.max} m³</span></div>
      <button type="button" class="link-btn" style="align-self:flex-start" data-toggle="showCalc" data-key="t-calc" aria-expanded="${s.showCalc}" aria-controls="calc">${tx("Don't know your volume? Enter your dimensions", 'Weet je de hoeveelheid niet? Vul je afmetingen in')}</button>
      ${s.showCalc ? `
      <div class="calc" id="calc">
        <div class="calc-fields">
          ${field('len', tx('Length (m)', 'Lengte (m)'), 'data-field="len" inputmode="decimal"', s.len)}
          ${field('wid', tx('Width (m)', 'Breedte (m)'), 'data-field="wid" inputmode="decimal"', s.wid)}
          ${field('dep', tx('Depth (mm)', 'Dikte (mm)'), 'data-field="dep" inputmode="numeric"', s.dep)}
        </div>
        <div class="calc-out" id="calc-out" aria-live="polite">${calcOut(d)}</div>
        <button type="button" class="btn btn-dark btn-sm" style="align-self:flex-start" data-act="use-calc" data-key="use-calc" id="use-calc" ${!d.calc.ok || d.calc.tooBig ? 'disabled' : ''}>${tx('Use this volume', 'Gebruik deze hoeveelheid')}</button>
      </div>` : ''}
    </div>

    <div class="field-group" role="group" aria-labelledby="off-l">
      <span class="label" id="off-l">${tx('Offloading method', 'Loswijze')}</span>
      <div class="opts opts-4">${OFFLOADS.map((o) => opt('offload', o.id, s.offload === o.id, nlf(o, 'label'), esc(nlf(o, 'sub')))).join('')}</div>
      <div id="off-note">${offloadNote()}</div>
      <p class="hint">${tx(`Every delivery includes up to ${CONFIG.freeUnloadMinutes} minutes to unload. The truck must be able to reach the site and the ground must take its weight. Narrow street or canal-side? Choose a pump or tell us in the notes.`,
        `Bij elke levering is tot ${CONFIG.freeUnloadMinutes} minuten lostijd inbegrepen. De truck moet de stortplek kunnen bereiken en de ondergrond moet het gewicht kunnen dragen. Smalle straat of aan de gracht? Kies een pomp of zet het in de opmerkingen.`)}</p>
    </div>

    <div class="field-group" role="group" aria-labelledby="sl-l">
      <div style="display:flex;align-items:center;gap:10px"><span class="label" id="sl-l">${tx('Consistency', 'Consistentie')}</span><button type="button" class="link-btn" style="font-weight:400;font-size:14px" data-toggle="showSlumpHelp" data-key="t-slump" aria-expanded="${s.showSlumpHelp}">${tx("What's this?", 'Wat is dit?')}</button></div>
      <div class="opts opts-2 opts-4">${CONSISTENCY.map((x) => {
        const blocked = L.isPump(s.offload) && !L.canPump(x.id, CONFIG.pumpableConsistency);
        return blocked
          ? pressBtn('opt', 'slump', x.id, false, `<span class="opt-title">${esc(nlf(x, 'label'))}</span><span class="opt-sub">${tx("Can't be pumped", 'Niet verpompbaar')}</span>`, 'disabled')
          : opt('slump', x.id, s.slump === x.id, nlf(x, 'label'), slumpSub(x));
      }).join('')}</div>
      ${s.showSlumpHelp ? `<div class="help">${tx('Consistency is how stiff or runny the fresh concrete is. S1 holds its shape and suits kerbs and slopes. S3 flows well and is right for most foundations, floors and paths. S4 is highly fluid, for pumping and tightly reinforced work. Not sure? Leave it on S3; the planner checks it when they call.',
        'Consistentie is hoe stijf of vloeibaar het verse beton is. S1 houdt zijn vorm en is geschikt voor banden en hellingen. S3 vloeit goed en past bij de meeste funderingen, vloeren en paden. S4 is hoog vloeibaar, voor pompen en werk met veel wapening. Twijfel je? Laat het op S3 staan; de planner controleert het als hij belt.')}</div>` : ''}
    </div>

    <div class="field-group" role="group" aria-labelledby="st-l">
      <div style="display:flex;align-items:center;gap:10px"><span class="label" id="st-l">${tx('Stone size', 'Korrelgrootte grind')}</span><button type="button" class="link-btn" style="font-weight:400;font-size:14px" data-toggle="showStoneHelp" data-key="t-stone" aria-expanded="${s.showStoneHelp}">${tx("What's this?", 'Wat is dit?')}</button></div>
      <div class="opts opts-3">${STONE_SIZES.map((x) => opt('stone', x.id, s.stone === x.id, x.label, stoneSub(x))).join('')}</div>
      ${s.showStoneHelp ? `<div class="help">${tx('The gravel in the mix. Standard 4–32 mm is the most economical and suits most jobs. Smaller stone is easier to work by hand, finishes smoother and fills tight spaces, but needs a little more cement.',
        'Het grind in het mengsel. Standaard 4–32 mm is het voordeligst en past bij de meeste klussen. Fijner grind is makkelijker met de hand te verwerken, wordt gladder en vult krappe ruimtes, maar heeft iets meer cement nodig.')}</div>` : ''}
    </div>

    <label class="check"><input type="checkbox" data-field="fibres" data-key="fibres" ${s.fibres ? 'checked' : ''}>
      <span><strong>${tx('Add fibres', 'Vezels toevoegen')}</strong> (${orTbd(P.fibresPerM3, tx('fibre price', 'vezelprijs'), pm)} ${tx('per m³', 'per m³')} ${vatLabel()}). ${tx('Helps limit shrinkage cracks, useful over underfloor heating.', 'Beperkt krimpscheuren, handig boven vloerverwarming.')}</span></label>`;
}

function step3(d) {
  const dayBtn = (x) => pressBtn('opt opt-day', 'day', x.key, s.day === x.key,
    `<span class="dow">${esc(x.dow)}</span><span class="dm">${esc(x.dm)}</span><span class="extra">${x.saturday ? tx('+ surcharge', '+ toeslag') : ''}</span>`,
    `aria-label="${esc(x.dow + ' ' + x.dm)}${x.saturday ? tx(', Saturday surcharge applies', ', zaterdagtoeslag') : ''}"`);
  return `
    <h3 class="sr-only" id="step-title" tabindex="-1">${tx('Date and your details', 'Datum en je gegevens')}</h3>
    <div class="field-group" role="group" aria-labelledby="day-l">
      <span class="label" id="day-l">${tx('Preferred delivery date', 'Gewenste leverdatum')}</span>
      <div class="opts opts-days">${d.days.map(dayBtn).join('')}</div>
      <p class="hint">${tx('Next-day delivery for orders placed before', 'Levering de volgende dag bij bestelling vóór')} ${orTbd(CONFIG.delivery.nextDayCutoff, tx('cut-off time', 'besteltijd'))}${tx(', subject to availability.', ', zolang er plek is.')}</p>
    </div>
    <div class="field-group">
      <span class="label" id="time-l">${tx('Preferred time', 'Gewenst tijdstip')}</span>
      <div class="seg-group full" role="group" aria-labelledby="time-l">
        ${pressBtn('seg', 'time', 'am', s.time === 'am', tx('Morning 7–12', 'Ochtend 7–12'))}
        ${pressBtn('seg', 'time', 'pm', s.time === 'pm', tx('Afternoon 12–16', 'Middag 12–16'))}
        ${pressBtn('seg', 'time', 'any', s.time === 'any', tx('No preference', 'Geen voorkeur'))}
      </div>
    </div>
    <div class="fields fields-3">
      ${field('nm', tx('Full name *', 'Volledige naam *'), 'data-field="name" autocomplete="name" required', s.name)}
      ${field('ph', tx('Phone number *', 'Telefoonnummer *'), 'data-field="phone" type="tel" autocomplete="tel" required', s.phone)}
      ${field('em', tx('Email *', 'E-mail *'), 'data-field="email" type="email" autocomplete="email" required', s.email)}
    </div>
    <div class="field">
      <label class="label" for="nt">${tx('Notes for the planner', 'Opmerkingen voor de planner')}</label>
      <textarea id="nt" class="input" rows="3" data-field="notes" data-key="nt" placeholder="${tx('Site access, parking, exposure class, anything we should know', 'Bereikbaarheid, parkeren, milieuklasse, alles wat we moeten weten')}">${esc(s.notes)}</textarea>
    </div>
    <label class="check"><input type="checkbox" data-field="terms" data-key="terms" ${s.terms ? 'checked' : ''}>
      <span>${tx(`I agree to the <a href="${termsUrl()}" target="_blank" rel="noopener">terms and conditions</a>, waiting-time policy and site safety requirements.`,
        `Ik ga akkoord met de <a href="${termsUrl()}" target="_blank" rel="noopener">algemene voorwaarden</a>, de wachttijdregeling en de veiligheidseisen op de bouwplaats.`)}</span></label>`;
}

function step4(d) {
  const concrete = [d.mixLabel, s.slump, d.stoneLabel, ...d.addOnLabels, s.fibres ? tx('fibres', 'vezels') : ''].filter(Boolean).map(esc).join(' · ');
  return `
    <h3 class="step-title" id="step-title" tabindex="-1">${tx('Check and confirm', 'Controleren en bevestigen')}</h3>
    <dl class="review">
      <dt>${tx('Concrete', 'Beton')}</dt><dd>${concrete}</dd>
      <dt>${tx('Volume', 'Hoeveelheid')}</dt><dd>${m3(s.volume)}</dd>
      <dt>${tx('Delivery', 'Levering')}</dt><dd>${esc(d.pc.formatted)} · ${esc(d.offloadLabel)}</dd>
      <dt>${tx('Slot', 'Levermoment')}</dt><dd>${esc(d.slotLabel)}</dd>
      <dt>${tx('Contact', 'Contact')}</dt><dd>${esc(s.name)} · ${esc(s.phone)}</dd>
    </dl>
    <div class="hold">
      <strong style="font-size:16px">${tx("You only pay for what's confirmed", 'Je betaalt alleen wat is bevestigd')}</strong>
      <span style="line-height:1.55;color:#333">${tx(`We place a temporary hold on your card to reserve the slot. A planner calls to confirm, then we charge only the final agreed amount. The hold includes a ${P.contingencyPct}% allowance for small changes on site or extra waiting time. Anything not used is released within 24 hours of delivery.`,
        `We reserveren het bedrag tijdelijk op je pas om het levermoment vast te houden. Een planner belt om te bevestigen; daarna schrijven we alleen het afgesproken bedrag af. De reservering bevat ${P.contingencyPct}% extra voor kleine wijzigingen op de bouwplaats of extra wachttijd. Wat niet wordt gebruikt, komt binnen 24 uur na levering vrij.`)}</span>
      <div class="hold-table">
        <span>${tx('Order total, incl. BTW', 'Totaal bestelling, incl. btw')}</span><span class="num">${money(d.price.totalIncl)}</span>
        <span>${P.contingencyPct}% ${tx('allowance', 'marge')}</span><span class="num">${money(d.price.contingency)}</span>
        <strong>${tx('Amount held', 'Gereserveerd bedrag')}</strong><strong class="num">${money(d.price.hold)}</strong>
      </div>
    </div>
    <div class="pay-slot">${tbd(tx('Payment field: iDEAL or card, through Stripe', 'Betaalveld: iDEAL of pas, via Stripe'))}</div>`;
}

function stepbar(d) {
  const nextLabel = s.step === 4 ? tx('Confirm and hold card', 'Bevestigen en reserveren') : tx('Continue', 'Verder');
  return `
    ${s.step > 1 ? `<button type="button" class="btn btn-outline back" data-act="back" data-key="back">${tx('Back', 'Terug')}</button>` : ''}
    <span class="step-hint" id="step-hint" aria-live="polite">${s.step === 1 && d.check.ok ? `${esc(d.mixLabel)} ${tx('selected', 'gekozen')}. ` : ''}${esc(hintText(d.check.hint))}${s.sendError ? `<strong class="send-error">${tx(`Sorry, your request did not go through. Please try again, or call ${esc(CONFIG.contact.orderPhone)}.`, `Sorry, je aanvraag is niet verstuurd. Probeer het opnieuw of bel ${esc(CONFIG.contact.orderPhone)}.`)}</strong>` : ''}</span>
    <span class="mini-total" aria-hidden="true"><span>${tx('Estimate', 'Schatting')} ${vatLabel()}</span><strong>${pm(d.price.total)}</strong></span>
    <button type="button" class="btn btn-green next ${s.step === 1 ? 'solo' : ''}" data-act="next" data-key="next" aria-describedby="step-hint" ${d.check.ok ? '' : 'disabled'}>${nextLabel}</button>`;
}

function summary(d) {
  const show = (l, fallback) => {
    if (l.state === 'none') return '—';
    if (l.state === 'included') return tx('Included', 'Inbegrepen');
    if (l.state === 'onConfirm') return tx('On confirmation', 'Bij bevestiging');
    if (l.state === 'tbd') return tbd(fallback);
    return pm(l.amount);
  };
  const line = Object.fromEntries(d.price.lines.map((l) => [l.key, l]));
  const pl = P.partLoad;
  const tr = d.price.trucks;
  const trucks = (n) => tx(`${n} truck${n > 1 ? 's' : ''}`, `${n} ${n > 1 ? 'trucks' : 'truck'}`);
  const plLabel = line.partLoad.state === 'priced'
    ? tx(`Part load (${num(line.partLoad.shortM3, 1)} m³ short of ${tr > 1 ? tr + ' × ' : ''}${pl.underM3} m³)`,
         `Kleine vracht (${num(line.partLoad.shortM3, 1)} m³ minder dan ${tr > 1 ? tr + ' × ' : ''}${pl.underM3} m³)`)
    : tx(`Part load (under ${orTbd(pl.underM3, 'x')} m³ per truck)`, `Kleine vracht (onder ${orTbd(pl.underM3, 'x')} m³ per truck)`);
  // Saturday has no line of its own: it shows on the delivery line only when a Saturday is picked.
  const sat = line.saturday.state !== 'none';
  const deliveryLabel = `${tx('Delivery', 'Levering')} (${trucks(tr)}${sat ? tx(', Saturday', ', zaterdag') : ''})`;
  const toAgree = tx('rule to agree', 'nog af te spreken');
  const deliveryValue = !sat ? show(line.delivery, toAgree)
    : line.saturday.state === 'priced' && line.delivery.state === 'priced' ? pm(line.delivery.amount + line.saturday.amount)
    : `${show(line.delivery, toAgree)} ${tbd(tx('+ surcharge', '+ toeslag'))}`;
  const rows = [
    [`${esc(d.mixLabel)} · ${m3(s.volume)}`, show(line.concrete)],
    [tx('Stone size', 'Korrelgrootte'), show(line.stone)],
    [tx('Extras', 'Toevoegingen'), show(line.extras)],
    [tx('Fibres', 'Vezels'), show(line.fibres, tx('fibre price', 'vezelprijs'))],
    [tx('Pump', 'Pomp'), show(line.pump)],
    [plLabel, show(line.partLoad, tx('to agree', 'af te spreken'))],
    [deliveryLabel, deliveryValue],
  ];
  const totalLabel = tx('Estimated total, incl. BTW', 'Geschat totaal, incl. btw');
  const totals = isPrivate()
    ? `<div class="total-row"><span>${totalLabel}</span><strong>${money(d.price.totalIncl)}</strong></div>
       <p class="small-grey">${tx(`Includes ${money(d.price.vat)} BTW (${VATP}%).`, `Inclusief ${money(d.price.vat)} btw (${VATP}%).`)}</p>`
    : `<dl class="price-lines vat-lines"><dt>${tx('Subtotal excl. BTW', 'Subtotaal excl. btw')}</dt><dd>${money(d.price.total)}</dd><dt>${tx('BTW', 'Btw')} ${VATP}%</dt><dd>${money(d.price.vat)}</dd></dl>
       <div class="total-row"><span>${totalLabel}</span><strong>${money(d.price.totalIncl)}</strong></div>`;
  return `
    <div class="sum-head"><h3>${tx('Your price', 'Je prijs')}</h3>
      <div class="seg-group cust-toggle" role="group" aria-label="${tx('Show prices for', 'Toon prijzen voor')}">
        ${pressBtn('seg', 'customer', 'private', isPrivate(), tx('Private', 'Particulier'))}
        ${pressBtn('seg', 'customer', 'business', !isPrivate(), tx('Business', 'Zakelijk'))}
      </div></div>
    <p class="small-grey" style="margin-top:-4px">${tx('Prices', 'Prijzen')} ${vatLabel()}.</p>
    <dl class="price-lines">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    ${totals}
    ${tr > 1 ? `<p class="small-grey">${tx(`${m3(s.volume)} goes as ${tr} trucks of ${m3(d.price.perTruck)}.`, `${m3(s.volume)} komt in ${tr} trucks van ${m3(d.price.perTruck)}.`)}</p>` : ''}
    <p class="small-grey">${tx('Delivered from our Zaandam plant. Preview prices: fibres, part-load and delivery charges are suggestions for the team to agree.',
      'Geleverd vanuit onze fabriek in Zaandam. Previewprijzen: vezels, kleine vracht en levering zijn voorstellen die het team nog moet vaststellen.')}</p>
    <div class="help-box"><strong style="font-size:15px">${tx('Need help?', 'Hulp nodig?')}</strong><a href="${C.orderPhoneHref}">${tx('Call', 'Bel')} ${esc(C.orderPhone)}</a><span class="small-grey">${esc(tx(C.hours, C.hoursNl))}</span></div>`;
}

// One reassurance line per step: strong, lasting, certified (James, 9 Nov).
const TRUST = {
  1: ['pour', 'Every mix meets exactly the same certified standards as traditional concrete.', 'Elk mengsel voldoet aan precies dezelfde gecertificeerde normen als traditioneel beton.'],
  2: ['truck', 'Certified for high-rise, tunnels and bridges, so it is more than ready for your job.', 'Gecertificeerd voor hoogbouw, tunnels en bruggen, dus meer dan klaar voor jouw klus.'],
  3: ['engineer', 'Just as strong and built to last. Our technical team checks every order.', 'Net zo sterk en gemaakt om lang mee te gaan. Ons technische team controleert elke bestelling.'],
  4: ['pour', 'No compromise on strength, and 63–80% less CO₂ than reference concrete.', 'Geen concessies aan sterkte, en 63–80% minder CO₂ dan referentiebeton.'],
};
const trustLine = (step) => {
  const [img, en, nl] = TRUST[step];
  return `<p class="trust-line"><img src="img/${img}.jpg" alt="" width="56" height="56" loading="lazy"><span>${tx(en, nl)}</span></p>`;
};

function buyView(d) {
  if (s.done) {
    const first = esc(s.name.trim().split(' ')[0] || tx('there', ''));
    return `<div class="card done" role="status">
      <div class="tick"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></div>
      <h3 id="step-title" tabindex="-1">${tx('Order received', 'Bestelling ontvangen')}</h3>
      <p>${tx(`Thanks, ${first}. A planner will call you to confirm the mix, volume and your ${esc(d.slotLabel)} slot. Only the confirmed amount is charged.`,
        `Bedankt${first ? ', ' + first : ''}. Een planner belt je om het mengsel, de hoeveelheid en je levermoment (${esc(d.slotLabel)}) te bevestigen. We schrijven alleen het bevestigde bedrag af.`)}</p>
      <p style="font-size:15px;color:var(--grey-text)">${esc(d.mixLabel)} · ${m3(s.volume)} · ${tx('estimate', 'schatting')} ${money(d.price.totalIncl)} ${tx('incl. BTW', 'incl. btw')}</p>
      <p class="trust-line" style="text-align:left"><img src="img/truck.jpg" alt="" width="56" height="56" loading="lazy"><span>${tx("You're getting certified concrete, made to the same standards as traditional concrete, from a local Amsterdam business.",
        'Je krijgt gecertificeerd beton, gemaakt volgens dezelfde normen als traditioneel beton, van een lokaal Amsterdams bedrijf.')}</span></p>
      <p class="preview-note">${tx('Test phase: no card was charged. Your request has been sent to our planners.',
        'Testfase: er is niets afgeschreven. Je aanvraag is naar onze planners gestuurd.')}</p>
      <button type="button" class="btn btn-outline btn-sm" data-act="reset" data-key="reset">${tx('Start a new order', 'Nieuwe bestelling')}</button>
    </div>`;
  }
  const labels = [tx('Concrete', 'Beton'), tx('Delivery', 'Levering'), tx('Date & details', 'Datum & gegevens'), tx('Confirm', 'Bevestigen')];
  const body = { 1: step1, 2: step2, 3: step3, 4: step4 }[s.step](d);
  return `<div class="tool-grid">
    <div class="card wizard" id="wizard">
      <div class="row-between">
        <ol class="steps" style="flex:1 1 100%">${labels.map((l, i) => `<li data-on="${s.step >= i + 1}" ${s.step === i + 1 ? 'aria-current="step"' : ''}>${l}</li>`).join('')}</ol>
        <span class="step-count">${tx(`Step ${s.step} of 4`, `Stap ${s.step} van 4`)}</span>
      </div>
      ${body}
      ${trustLine(s.step)}
      <div class="stepbar" id="stepbar">${stepbar(d)}</div>
    </div>
    <aside class="summary on-dark" id="summary" aria-label="${tx('Price summary', 'Prijsoverzicht')}">${summary(d)}</aside>
  </div>`;
}

// ---------- Quote and call ----------

function quoteView() {
  const quoteTime = orTbd(CONFIG.responseTimes.quote, tx('response time', 'reactietijd'), (v) => esc(tx(v, CONFIG.responseTimes.quoteNl)));
  if (s.quoteSent) {
    return `<div class="card form-card" role="status"><h3 class="step-title" id="step-title" tabindex="-1">${tx('Quote request received', 'Offerteaanvraag ontvangen')}</h3>
      <p style="color:#444">${tx('Our team will get back to you within', 'Ons team reageert binnen')} ${quoteTime}.</p>
      <p class="preview-note">${tx('Preview only: nothing was sent.', 'Alleen een preview: er is niets verstuurd.')}</p></div>`;
  }
  return `<form class="card form-card" data-form="quote">
    <h3 class="step-title">${tx('Tell us about your project', 'Vertel ons over je project')}</h3>
    <p class="hint" style="font-size:15px">${tx("For larger pours, special mixes or anything the online tool doesn't cover.", 'Voor grotere storten, speciale mengsels of alles wat het online formulier niet dekt.')}</p>
    <div class="fields fields-2">
      ${field('qn', tx('Full name', 'Volledige naam'), 'name="name" autocomplete="name" required')}
      ${field('qp', tx('Phone number', 'Telefoonnummer'), 'name="phone" type="tel" autocomplete="tel" required')}
      ${field('qe', tx('Email', 'E-mail'), 'name="email" type="email" autocomplete="email" required')}
      ${field('qpc', tx('Site postcode', 'Postcode bouwplaats'), 'name="postcode" autocomplete="postal-code"')}
    </div>
    <div class="field"><label class="label" for="qt">${tx('Project type', 'Soort project')}</label>
      <select id="qt" name="type" class="input"><option value="">${tx('Select project type…', 'Kies een soort project…')}</option>${QUOTE_PROJECT_TYPES.map((t) => `<option value="${esc(t.en)}">${esc(tx(t.en, t.nl))}</option>`).join('')}</select></div>
    <div class="field"><label class="label" for="qd">${tx('Project details', 'Projectdetails')}</label>
      <textarea id="qd" name="details" class="input" rows="4" placeholder="${tx('Mix spec, volume, dates, access', 'Mengsel, hoeveelheid, data, bereikbaarheid')}"></textarea></div>
    <button type="submit" class="btn btn-green" style="align-self:flex-start">${tx('Submit quote request', 'Offerte aanvragen')}</button>
  </form>`;
}

function callView() {
  const form = s.callbackSent
    ? `<div class="card form-card" role="status"><h3 class="step-title" id="step-title" tabindex="-1">${tx("We'll call you back shortly", 'We bellen je zo snel mogelijk terug')}</h3><p class="preview-note">${tx('Preview only: nothing was sent.', 'Alleen een preview: er is niets verstuurd.')}</p></div>`
    : `<form class="card form-card" data-form="callback">
        <h3 class="step-title">${tx('Request a callback', 'Vraag een terugbelverzoek aan')}</h3>
        <p class="hint" style="font-size:15px">${tx('Leave your number and a planner will ring you back within', 'Laat je nummer achter en een planner belt je terug binnen')} ${orTbd(CONFIG.responseTimes.callback, tx('callback time', 'terugbeltijd'))} ${tx('in working hours.', 'tijdens werktijd.')}</p>
        ${field('cn', tx('Name', 'Naam'), 'name="name" autocomplete="name" required')}
        ${field('cp', tx('Phone number', 'Telefoonnummer'), 'name="phone" type="tel" autocomplete="tel" required')}
        <button type="submit" class="btn btn-green" style="align-self:flex-start">${tx('Request callback', 'Terugbellen aanvragen')}</button>
      </form>`;
  return `<div class="panel-pair">
    <div class="dark-panel on-dark photo-panel">
      <h3 class="step-title">${tx('Speak to our planners', 'Spreek onze planners')}</h3>
      <a class="big-phone" href="${C.orderPhoneHref}">${esc(C.orderPhone)}</a>
      <p>${tx('Monday–Friday 7:00–16:00 · Saturday', 'Maandag–vrijdag 7:00–16:00 · Zaterdag')} ${orTbd(C.saturdayHours, tx('hours', 'openingstijden'))} · ${tx('Sunday closed', 'Zondag gesloten')}</p>
      <p>WhatsApp: ${orTbd(C.whatsapp, tx('WhatsApp number', 'WhatsApp-nummer'))}</p>
      <p>${tx('Email', 'E-mail')}: <a href="mailto:${C.orderEmail}" style="color:var(--green)">${esc(C.orderEmail)}</a></p>
    </div>
    ${form}
  </div>`;
}

// ---------- Rendering ----------

const tool = document.getElementById('tool');
const tabs = [...document.querySelectorAll('[data-tab]')];

function render({ focusTitle = false } = {}) {
  const activeKey = document.activeElement?.closest?.('#tool') ? document.activeElement.dataset.key : null;
  const d = derive();
  tabs.forEach((t) => {
    const on = t.dataset.tab === s.tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  tool.setAttribute('aria-labelledby', 'tab-' + s.tab);
  tool.innerHTML = s.tab === 'buy' ? buyView(d) : s.tab === 'quote' ? quoteView() : callView();

  if (focusTitle) {
    const title = document.getElementById('step-title');
    title?.focus({ preventScroll: true });
    const top = (document.getElementById('wizard') || tool).getBoundingClientRect().top;
    if (top < 72) window.scrollBy({ top: top - 88 });
  } else if (activeKey) {
    tool.querySelector(`[data-key="${CSS.escape(activeKey)}"]`)?.focus({ preventScroll: true });
  }
}

// Refresh only what depends on typed values, so inputs keep focus and caret.
function renderLive() {
  const d = derive();
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  set('summary', summary(d));
  set('stepbar', stepbar(d));
  set('pc-msg', pcMsg(d));
  set('vol-label', m3(s.volume));
  set('calc-out', calcOut(d));
  if (document.activeElement?.dataset?.key !== 'barrowOk') set('off-note', offloadNote());
  const vol = document.getElementById('vol');
  if (vol) vol.setAttribute('aria-valuetext', m3(s.volume));
  const use = document.getElementById('use-calc');
  if (use) use.disabled = !d.calc.ok || d.calc.tooBig;
}

// Send the order to the planners (saved in Supabase; they get an alert).
// Planners work in English for now, so the order is saved with the English labels.
function sendToPlanners(d) {
  const at = new Date().toISOString();
  const day = getDays('en-GB').find((x) => x.key === d.dayObj.key) || d.dayObj;
  const mix = d.isProject ? (d.proj.mix || 'Advise') : d.code.code;
  return submitOrder(orderFromShop({
    id: 'web-' + crypto.randomUUID(),
    at,
    slot: { key: day.key, dow: day.dow, dm: day.dm, time: s.time },
    name: s.name.trim(), phone: s.phone.trim(), email: s.email.trim(), notes: s.notes.trim(),
    postcode: d.pc.formatted,
    job: d.isProject ? d.proj.label : 'Chosen by mix code',
    mix,
    volume: s.volume, offload: OFFLOADS.find((o) => o.id === s.offload)?.short, stone: d.stoneLabel, consistency: s.slump, fibres: s.fibres,
    extras: d.addOns.map((id) => ADD_ONS.find((a) => a.id === id).label),
    estimate: d.price.total, hold: d.price.hold,
  }));
}

// ---------- Events ----------

tabs.forEach((t, i) => {
  t.addEventListener('click', () => { s.tab = t.dataset.tab; render(); });
  t.addEventListener('keydown', (e) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    s.tab = next.dataset.tab; render(); next.focus();
  });
});

tool.addEventListener('click', (e) => {
  const el = e.target.closest('[data-set],[data-toggle],[data-act]');
  if (!el || el.disabled) return;
  if (el.dataset.set) {
    s[el.dataset.set] = el.dataset.value;
    if (el.dataset.set === 'offload' && L.isPump(s.offload) && !L.canPump(s.slump, CONFIG.pumpableConsistency)) s.slump = 'S4';
    return render();
  }
  if (el.dataset.toggle) {
    s[el.dataset.toggle] = !s[el.dataset.toggle];
    return render();
  }
  const d = derive();
  switch (el.dataset.act) {
    case 'vol-down': s.volume = L.stepVolume(s.volume, -1, VOL); return render();
    case 'vol-up': s.volume = L.stepVolume(s.volume, 1, VOL); return render();
    case 'use-calc': if (d.calc.ok && !d.calc.tooBig) { s.volume = d.calc.recommended; s.showCalc = false; } return render();
    case 'goto1': s.step = 1; return render({ focusTitle: true });
    case 'back': s.step = Math.max(1, s.step - 1); return render({ focusTitle: true });
    case 'next':
      if (!d.check.ok) return;
      if (s.step < 4) s.step += 1;
      else {
        if (s.sending) return;
        s.sending = true; s.sendError = false; el.disabled = true;
        sendToPlanners(d)
          .then(() => { s.done = true; })
          .catch(() => { s.sendError = true; })
          .finally(() => { s.sending = false; render({ focusTitle: true }); });
        return;
      }
      return render({ focusTitle: true });
    case 'reset': s = fresh('buy'); return render({ focusTitle: true });
    case 'to-quote': e.preventDefault(); s.tab = 'quote'; render(); document.getElementById('tab-quote').focus(); return;
  }
});

function onField(e) {
  const el = e.target;
  const key = el.dataset.field;
  if (!key) return;
  if (key.startsWith('addOn:')) {
    const id = key.slice(6);
    s.addOns = el.checked ? [...new Set([...s.addOns, id])] : s.addOns.filter((x) => x !== id);
    return renderLive();
  }
  if (el.type === 'checkbox') {
    s[key] = el.checked;
    if (key === 'barrowOk') return render();
  } else if (el.type === 'range') {
    s[key] = L.clampVolume(parseFloat(el.value), VOL);
  } else {
    s[key] = el.value;
  }
  renderLive();
}
tool.addEventListener('input', onField);
tool.addEventListener('change', (e) => { if (e.target.type === 'checkbox') onField(e); });

tool.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  if (!form.reportValidity()) return;
  if (form.dataset.form === 'quote') s.quoteSent = true;
  if (form.dataset.form === 'callback') s.callbackSent = true;
  render({ focusTitle: true });
});

// "Get a price" links elsewhere on the page open the Buy online tab.
document.querySelectorAll('a[href="#quote-tool"]').forEach((a) => {
  if (!a.closest('#tool')) a.addEventListener('click', () => { if (s.tab !== 'buy') { s.tab = 'buy'; render(); } });
});

// NL / EN switch in the header.
document.querySelector('.lang-toggle').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lang]');
  if (!b) return;
  setLang(b.dataset.lang);
  applyStatic();
  fillSlots();
  render();
  // Keep focus on the switch (the active button is hidden on phones, so move to the other one).
  const other = document.querySelector(`.lang-toggle [data-lang]:not([data-lang="${b.dataset.lang}"])`);
  (getComputedStyle(b).display === 'none' ? other : b)?.focus();
});

applyStatic();
fillSlots();
setupMenu();
render();
