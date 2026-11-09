import { CONFIG } from './config.js';
import { PROJECTS, MIX_CODES, OFFLOADS, CONSISTENCY, STONE_SIZES, QUOTE_PROJECT_TYPES } from './catalogue.js';
import * as L from './logic.js';
import { addOrder, orderFromShop } from './orders.js';

const P = CONFIG.pricing;
const C = CONFIG.contact;
const VOL = CONFIG.volume;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tbd = (label) => `<span class="tbd">[${esc(label)}]</span>`;
const money = (n) => L.formatEUR(n, CONFIG.locale);
const orTbd = (v, label, fmt = (x) => esc(x)) => (v == null ? tbd(label) : fmt(v));
const m3 = (n) => n.toFixed(1) + ' m³';

// ---------- Static page slots ----------

function fillPage() {
  const slots = {
    fromPrice: orTbd(P.fromPricePerM3, 'from price', (v) => '€' + v),
    quoteTime: orTbd(CONFIG.responseTimes.quote, 'response time'),
    tradeTerms: orTbd(C.tradePaymentTerms, 'payment terms'),
    radius: orTbd(CONFIG.delivery.radiusKm, 'radius'),
  };
  const tradeBody = 'Hello SL Materials,\n\nWe would like a price for the following job:\n\nCompany name:\nSite location / postcode:\nMix or strength class:\nVolume (m³):\nDates:\nOffloading (chute, pump, other):\n\nPhone number:\n';
  const hrefs = { ...C, salesMail: 'mailto:' + C.salesEmail, tradeMail: `mailto:${C.salesEmail}?subject=${encodeURIComponent('Trade enquiry')}&body=${encodeURIComponent(tradeBody)}` };
  document.querySelectorAll('[data-slot]').forEach((el) => { el.innerHTML = slots[el.dataset.slot] ?? ''; });
  document.querySelectorAll('[data-text]').forEach((el) => { el.textContent = C[el.dataset.text] ?? ''; });
  document.querySelectorAll('[data-href]').forEach((el) => { el.href = hrefs[el.dataset.href] ?? '#'; });

  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('main-nav');
  const setMenu = (open) => { nav.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
}

// ---------- State ----------

const fresh = (tab = 'buy') => ({
  tab, step: 1, mode: 'project', project: null, code: null,
  volume: VOL.default, showCalc: false, len: '', wid: '', dep: '100',
  postcode: '', offload: null, barrowOk: false, slump: 'S3', stone: 'std', fibres: false,
  showSlumpHelp: false, showStoneHelp: false,
  day: null, time: 'am', name: '', phone: '', email: '', notes: '', terms: false,
  done: false, quoteSent: false, callbackSent: false,
});

let s = fresh();
// After the cut-off, tomorrow is no longer offered.
const days = (() => {
  const now = new Date();
  const list = L.nextDeliveryDays(now, CONFIG.delivery.daysShown + 1, CONFIG.locale);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const tKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const late = L.pastCutoff(now, CONFIG.delivery.nextDayCutoff);
  return list.filter((d) => !(late && d.key === tKey)).slice(0, CONFIG.delivery.daysShown);
})();
const VAT = 'excl. BTW';

function derive() {
  const isProject = s.mode === 'project';
  const proj = PROJECTS.find((p) => p.id === s.project);
  const hasMix = isProject ? !!proj : !!s.code;
  const mixLabel = isProject ? (proj ? (proj.mix || 'Planner to advise') : 'Choose a mix') : (s.code || 'Choose a mix');
  const pc = L.checkPostcode(s.postcode, CONFIG.delivery.postcodeRanges);
  const calc = L.calcVolume(s.len, s.wid, s.dep, VOL);
  const dayObj = days.find((d) => d.key === s.day);
  const timeText = { am: 'morning', pm: 'afternoon', any: 'any time' }[s.time];
  const price = L.priceOrder({ volume: s.volume, stone: s.stone, fibres: s.fibres, offload: s.offload, saturday: !!dayObj?.saturday }, P);
  const pumpOk = L.canPump(s.slump, CONFIG.pumpableConsistency);
  const check = L.checkStep(s.step, s, { hasMix, inArea: pc.inArea, dayChosen: !!dayObj, pumpOk });
  return {
    isProject, proj, hasMix, mixLabel, pc, calc, dayObj, price, check, pumpOk,
    mixWhy: proj ? (proj.mix ? proj.why + ' The planner double-checks it.' : 'A planner will recommend the right mix when they call.') : '',
    mixSource: isProject ? (proj ? proj.label : '') : 'Chosen by mix code',
    slotLabel: dayObj ? `${dayObj.dow} ${dayObj.dm}, ${timeText}` : 'not chosen',
    stoneLabel: STONE_SIZES.find((x) => x.id === s.stone).label,
    offloadLabel: OFFLOADS.find((o) => o.id === s.offload)?.label ?? '',
  };
}

// ---------- Small view helpers ----------

const pressBtn = (cls, key, value, on, inner, extra = '') =>
  `<button type="button" class="${cls}" data-set="${key}" data-value="${esc(value)}" data-key="${key}:${esc(value)}" aria-pressed="${on}" ${extra}>${inner}</button>`;
const opt = (key, value, on, title, sub, cls = '') =>
  pressBtn(`opt ${cls}`, key, value, on, `<span class="opt-title">${esc(title)}</span>${sub ? `<span class="opt-sub">${sub}</span>` : ''}`);
const field = (id, label, attrs, value = '') =>
  `<div class="field"><label class="label" for="${id}">${label}</label><input id="${id}" class="input" data-key="${id}" ${attrs} value="${esc(value)}"></div>`;

// ---------- Buy online ----------

function step1(d) {
  const grid = d.isProject
    ? `<div class="opts">${PROJECTS.map((p) => opt('project', p.id, s.project === p.id, p.label, esc(p.sub))).join('')}</div>`
    : `<div class="opts">${MIX_CODES.map((c) => pressBtn('opt', 'code', c.code, s.code === c.code, `<span class="opt-code">${c.code}</span><span class="opt-sub">${esc(c.use)}</span>`)).join('')}</div>
       <p class="hint">Need an exposure class or special mix? Add it in the notes on step 3, or <a href="#quote-tool" data-act="to-quote">ask for a quote</a>.</p>`;
  return `
    <div class="row-between">
      <h3 class="step-title" id="step-title" tabindex="-1">Select your concrete</h3>
      <div class="seg-group" role="group" aria-label="Choose by">
        ${pressBtn('seg', 'mode', 'project', d.isProject, 'By project type')}
        ${pressBtn('seg', 'mode', 'code', !d.isProject, 'By mix code')}
      </div>
    </div>
    ${grid}
    ${d.isProject && d.proj ? `<div class="note-green" role="status">Recommended mix: <strong>${esc(d.mixLabel)}</strong>. ${esc(d.mixWhy)}</div>` : ''}`;
}

function pcMsg(d) {
  if (d.pc.entered && d.pc.valid && d.pc.inArea) return `<span class="msg msg-ok">✓ We deliver to this postcode</span>`;
  if (d.pc.valid && !d.pc.inArea) return `<span class="msg msg-bad">Outside our usual delivery area. Please call <a href="${C.orderPhoneHref}">${esc(C.orderPhone)}</a>.</span>`;
  if (d.pc.badFormat) return `<span class="msg msg-bad">Enter a Dutch postcode, for example 1013 AB.</span>`;
  return '';
}

function calcOut(d) {
  const c = d.calc;
  return `<span>Calculated: <strong>${c.raw.toFixed(2)} m³</strong></span><span>+ ${VOL.wastagePct}% wastage: <strong>${c.withWaste.toFixed(2)} m³</strong></span><span>Recommended: <strong>${m3(c.recommended)}</strong></span>
    ${c.tooBig ? `<span class="msg msg-bad" style="flex-basis:100%">Over ${VOL.max} m³. <a href="#quote-tool" data-act="to-quote">Request a quote</a> for larger pours.</span>` : ''}`;
}

function offloadNote(d) {
  const mins = CONFIG.freeUnloadMinutes;
  if (s.offload === 'barrow') {
    const loads = L.barrowLoads(s.volume);
    const big = s.volume > CONFIG.barrowWarnM3;
    const waiting = P.waitingPerHour == null ? tbd('waiting-time rate') : `${money(P.waitingPerHour)} per hour`;
    return `<div class="note-warn${big ? ' strong' : ''}" role="status"><p>
      ${big ? `<strong>${m3(s.volume)} is a lot to move by wheelbarrow.</strong> ` : '<strong>Concrete is heavy.</strong> '}
      ${m3(s.volume)} is about ${loads} wheelbarrow loads${big ? ', so you will need a large team. For this much, a pump is usually the better choice' : ''}.
      The truck can wait up to ${mins} minutes to unload; after that, waiting time is charged at ${waiting}.</p>
      <label class="check"><input type="checkbox" data-field="barrowOk" data-key="barrowOk" ${s.barrowOk ? 'checked' : ''}>
        <span>I'll have enough people and wheelbarrows to unload within ${mins} minutes, and I accept <a href="${C.termsUrl}" target="_blank" rel="noopener">waiting-time charges</a> after that.</span></label>
    </div>`;
  }
  if (s.offload === 'pumpsl') {
    return `<div class="note-green" role="status"><strong>We'll arrange the pump.</strong> Pump hire is charged separately from the concrete. A planner will be in touch with the price before anything is booked.</div>`;
  }
  if (s.offload === 'pumpown') {
    return `<div class="note-green" role="status">Pumping needs a fluid mix, so choose S3 or S4 below. Your pump should be set up when the truck arrives.</div>`;
  }
  return '';
}

function step2(d) {
  const stoneSub = (x) => (P.stoneAddPerM3[x.id] ? `+${money(P.stoneAddPerM3[x.id])} per m³` : esc(x.sub));
  return `
    <h3 class="sr-only" id="step-title" tabindex="-1">Delivery and volume</h3>
    <div class="chosen"><span><strong>${esc(d.mixLabel)}</strong>${d.mixSource ? ' · ' + esc(d.mixSource) : ''}</span><button type="button" class="link-btn" data-act="goto1" data-key="goto1" style="padding:8px 10px">Change</button></div>

    <div class="field pc-field">
      <label class="label" for="pc">Delivery postcode</label>
      <input id="pc" class="input" data-field="postcode" data-key="pc" placeholder="e.g. 1013 AB" autocomplete="postal-code" autocapitalize="characters" maxlength="7" value="${esc(s.postcode)}" aria-describedby="pc-msg">
      <div id="pc-msg" aria-live="polite">${pcMsg(d)}</div>
    </div>

    <div class="field-group">
      <div class="volume-head"><label class="label" for="vol">Volume</label><span class="volume-value" id="vol-label">${m3(s.volume)}</span></div>
      <div class="stepper">
        <button type="button" class="round-btn" data-act="vol-down" data-key="vol-down" aria-label="Decrease volume">−</button>
        <input id="vol" type="range" data-field="volume" data-key="vol" min="${VOL.min}" max="${VOL.max}" step="${VOL.step}" value="${s.volume}" aria-valuetext="${m3(s.volume)}">
        <button type="button" class="round-btn" data-act="vol-up" data-key="vol-up" aria-label="Increase volume">+</button>
      </div>
      <div class="range-ends" aria-hidden="true"><span>${VOL.min} m³</span><span>${VOL.max} m³</span></div>
      <button type="button" class="link-btn" style="align-self:flex-start" data-toggle="showCalc" data-key="t-calc" aria-expanded="${s.showCalc}" aria-controls="calc">Don't know your volume? Enter your dimensions</button>
      ${s.showCalc ? `
      <div class="calc" id="calc">
        <div class="calc-fields">
          ${field('len', 'Length (m)', 'data-field="len" inputmode="decimal"', s.len)}
          ${field('wid', 'Width (m)', 'data-field="wid" inputmode="decimal"', s.wid)}
          ${field('dep', 'Depth (mm)', 'data-field="dep" inputmode="numeric"', s.dep)}
        </div>
        <div class="calc-out" id="calc-out" aria-live="polite">${calcOut(d)}</div>
        <button type="button" class="btn btn-dark btn-sm" style="align-self:flex-start" data-act="use-calc" data-key="use-calc" id="use-calc" ${!d.calc.ok || d.calc.tooBig ? 'disabled' : ''}>Use this volume</button>
      </div>` : ''}
    </div>

    <div class="field-group" role="group" aria-labelledby="off-l">
      <span class="label" id="off-l">Offloading method</span>
      <div class="opts opts-4">${OFFLOADS.map((o) => opt('offload', o.id, s.offload === o.id, o.label, esc(o.sub))).join('')}</div>
      <div id="off-note">${offloadNote(d)}</div>
      <p class="hint">Every delivery includes up to ${CONFIG.freeUnloadMinutes} minutes to unload. The truck must be able to reach the site and the ground must take its weight. Narrow street or canal-side? Choose a pump or tell us in the notes.</p>
    </div>

    <div class="field-group" role="group" aria-labelledby="sl-l">
      <div style="display:flex;align-items:center;gap:10px"><span class="label" id="sl-l">Consistency</span><button type="button" class="link-btn" style="font-weight:400;font-size:14px" data-toggle="showSlumpHelp" data-key="t-slump" aria-expanded="${s.showSlumpHelp}">What's this?</button></div>
      <div class="opts opts-2 opts-4">${CONSISTENCY.map((x) => {
        const blocked = L.isPump(s.offload) && !L.canPump(x.id, CONFIG.pumpableConsistency);
        return blocked
          ? pressBtn('opt', 'slump', x.id, false, `<span class="opt-title">${esc(x.label)}</span><span class="opt-sub">Can't be pumped</span>`, 'disabled')
          : opt('slump', x.id, s.slump === x.id, x.label, esc(x.sub));
      }).join('')}</div>
      ${s.showSlumpHelp ? `<div class="help">Consistency is how stiff or runny the fresh concrete is. S1 holds its shape and suits kerbs and slopes. S3 flows well and is right for most foundations, floors and paths. S4 is very fluid, for pumping and tightly reinforced work. Not sure? Leave it on S3; the planner checks it when they call.</div>` : ''}
    </div>

    <div class="field-group" role="group" aria-labelledby="st-l">
      <div style="display:flex;align-items:center;gap:10px"><span class="label" id="st-l">Stone size</span><button type="button" class="link-btn" style="font-weight:400;font-size:14px" data-toggle="showStoneHelp" data-key="t-stone" aria-expanded="${s.showStoneHelp}">What's this?</button></div>
      <div class="opts opts-3">${STONE_SIZES.map((x) => opt('stone', x.id, s.stone === x.id, x.label, stoneSub(x))).join('')}</div>
      ${s.showStoneHelp ? `<div class="help">The gravel in the mix. Standard 4–32 mm is the most economical and suits most jobs. Smaller stone is easier to work by hand, finishes smoother and fills tight spaces, but needs a little more cement.</div>` : ''}
    </div>

    <label class="check"><input type="checkbox" data-field="fibres" data-key="fibres" ${s.fibres ? 'checked' : ''}>
      <span><strong>Add fibres</strong> (${orTbd(P.fibresPerM3, 'fibre price', money)} per m³). Helps limit shrinkage cracks, useful over underfloor heating.</span></label>`;
}

function step3() {
  const dayBtn = (x) => pressBtn('opt opt-day', 'day', x.key, s.day === x.key,
    `<span class="dow">${esc(x.dow)}</span><span class="dm">${esc(x.dm)}</span><span class="extra">${x.saturday ? '+ surcharge' : ''}</span>`,
    `aria-label="${esc(x.dow + ' ' + x.dm)}${x.saturday ? ', Saturday surcharge applies' : ''}"`);
  return `
    <h3 class="sr-only" id="step-title" tabindex="-1">Date and your details</h3>
    <div class="field-group" role="group" aria-labelledby="day-l">
      <span class="label" id="day-l">Preferred delivery date</span>
      <div class="opts opts-days">${days.map(dayBtn).join('')}</div>
      <p class="hint">Next-day delivery for orders placed before ${orTbd(CONFIG.delivery.nextDayCutoff, 'cut-off time')}, subject to availability.</p>
    </div>
    <div class="field-group">
      <span class="label" id="time-l">Preferred time</span>
      <div class="seg-group full" role="group" aria-labelledby="time-l">
        ${pressBtn('seg', 'time', 'am', s.time === 'am', 'Morning 7–12')}
        ${pressBtn('seg', 'time', 'pm', s.time === 'pm', 'Afternoon 12–16')}
        ${pressBtn('seg', 'time', 'any', s.time === 'any', 'No preference')}
      </div>
    </div>
    <div class="fields fields-3">
      ${field('nm', 'Full name *', 'data-field="name" autocomplete="name" required', s.name)}
      ${field('ph', 'Phone number *', 'data-field="phone" type="tel" autocomplete="tel" required', s.phone)}
      ${field('em', 'Email *', 'data-field="email" type="email" autocomplete="email" required', s.email)}
    </div>
    <div class="field">
      <label class="label" for="nt">Notes for the planner</label>
      <textarea id="nt" class="input" rows="3" data-field="notes" data-key="nt" placeholder="Site access, parking, exposure class, anything we should know">${esc(s.notes)}</textarea>
    </div>
    <label class="check"><input type="checkbox" data-field="terms" data-key="terms" ${s.terms ? 'checked' : ''}>
      <span>I agree to the <a href="${C.termsUrl}" target="_blank" rel="noopener">terms and conditions</a>, waiting-time policy and site safety requirements.</span></label>`;
}

function step4(d) {
  const slump = CONSISTENCY.find((x) => x.id === s.slump).id;
  return `
    <h3 class="step-title" id="step-title" tabindex="-1">Check and confirm</h3>
    <dl class="review">
      <dt>Concrete</dt><dd>${esc(d.mixLabel)} · ${slump} · ${esc(d.stoneLabel)}${s.fibres ? ' · fibres' : ''}</dd>
      <dt>Volume</dt><dd>${m3(s.volume)}</dd>
      <dt>Delivery</dt><dd>${esc(d.pc.formatted)} · ${esc(d.offloadLabel)}</dd>
      <dt>Slot</dt><dd>${esc(d.slotLabel)}</dd>
      <dt>Contact</dt><dd>${esc(s.name)} · ${esc(s.phone)}</dd>
    </dl>
    <div class="hold">
      <strong style="font-size:16px">You only pay for what's confirmed</strong>
      <span style="line-height:1.55;color:#333">We place a temporary hold on your card to reserve the slot. A planner calls to confirm, then we charge only the final agreed amount. The hold includes a ${P.contingencyPct}% allowance for small changes on site or extra waiting time. Anything not used is released within 24 hours of delivery.</span>
      <div class="hold-table">
        <span>Order estimate, ${VAT}</span><span class="num">${money(d.price.total)}</span>
        <span>${P.contingencyPct}% allowance</span><span class="num">${money(d.price.contingency)}</span>
        <strong>Amount held</strong><strong class="num">${money(d.price.hold)}</strong>
      </div>
    </div>
    <div class="pay-slot">${tbd('Payment field: iDEAL or card, through Stripe')}</div>`;
}

function stepbar(d) {
  return `
    ${s.step > 1 ? `<button type="button" class="btn btn-outline back" data-act="back" data-key="back">Back</button>` : ''}
    <span class="step-hint" id="step-hint" aria-live="polite">${s.step === 1 && d.check.ok ? `${esc(d.mixLabel)} selected. ` : ''}${esc(d.check.hint)}</span>
    <span class="mini-total" aria-hidden="true"><span>Estimate ${VAT}</span><strong>${money(d.price.total)}</strong></span>
    <button type="button" class="btn btn-green next ${s.step === 1 ? 'solo' : ''}" data-act="next" data-key="next" aria-describedby="step-hint" ${d.check.ok ? '' : 'disabled'}>${s.step === 4 ? 'Confirm and hold card' : 'Continue'}</button>`;
}

function summary(d) {
  const show = (l, fallback) => {
    if (l.state === 'none') return '—';
    if (l.state === 'included') return 'Included';
    if (l.state === 'onConfirm') return 'On confirmation';
    if (l.state === 'tbd') return tbd(fallback);
    return money(l.amount);
  };
  const line = Object.fromEntries(d.price.lines.map((l) => [l.key, l]));
  const pl = P.partLoad;
  const tr = d.price.trucks;
  const plLabel = line.partLoad.state === 'priced'
    ? `Part load (${line.partLoad.shortM3.toFixed(1)} m³ short of ${tr > 1 ? tr + ' × ' : ''}${pl.underM3} m³)`
    : `Part load (under ${orTbd(pl.underM3, 'x')} m³ per truck)`;
  const rows = [
    [`${esc(d.mixLabel)} · ${m3(s.volume)}`, show(line.concrete)],
    ['Stone size', show(line.stone)],
    ['Fibres', show(line.fibres, 'fibre price')],
    ['Pump', show(line.pump)],
    ['Saturday delivery', show(line.saturday, 'surcharge')],
    [plLabel, show(line.partLoad, 'to agree')],
    [`Delivery (${tr} truck${tr > 1 ? 's' : ''})`, show(line.delivery, 'rule to agree')],
  ];
  return `
    <h3>Your price</h3>
    <dl class="price-lines">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <div class="total-row"><span>Estimated total, ${VAT}</span><strong>${money(d.price.total)}</strong></div>
    ${tr > 1 ? `<p class="small-grey">${m3(s.volume)} goes as ${tr} trucks of ${m3(d.price.perTruck)}.</p>` : ''}
    <p class="small-grey">Delivered from our Zaandam plant. BTW added at checkout. Preview prices: fibres, part-load and delivery charges are suggestions for the team to agree.</p>
    <div class="help-box"><strong style="font-size:15px">Need help?</strong><a href="${C.orderPhoneHref}">Call ${esc(C.orderPhone)}</a><span class="small-grey">${esc(C.hours)}</span></div>`;
}

// One reassurance line per step: strong, lasting, certified (James, 9 Nov).
const TRUST = {
  1: ['pour', 'Every mix meets exactly the same certified standards as traditional concrete.'],
  2: ['truck', 'Certified for high-rise, tunnels and bridges, so it is more than ready for your job.'],
  3: ['engineer', 'Just as strong and built to last. Our technical team checks every order.'],
  4: ['pour', 'No compromise on strength, and 63–80% less CO₂ than reference concrete.'],
};
const trustLine = (step) => {
  const [img, text] = TRUST[step];
  return `<p class="trust-line"><img src="img/${img}.jpg" alt="" width="56" height="56" loading="lazy"><span>${text}</span></p>`;
};

function buyView(d) {
  if (s.done) {
    return `<div class="card done" role="status">
      <div class="tick"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></div>
      <h3 id="step-title" tabindex="-1">Order received</h3>
      <p>Thanks, ${esc(s.name.trim().split(' ')[0] || 'there')}. A planner will call you to confirm the mix, volume and your ${esc(d.slotLabel)} slot. Only the confirmed amount is charged.</p>
      <p style="font-size:15px;color:var(--grey-text)">${esc(d.mixLabel)} · ${m3(s.volume)} · estimate ${money(d.price.total)} ${VAT}</p>
      <p class="trust-line" style="text-align:left"><img src="img/truck.jpg" alt="" width="56" height="56" loading="lazy"><span>You're getting certified concrete, made to the same standards as traditional concrete, from a local Amsterdam business.</span></p>
      <p class="preview-note">Preview only: no card was charged. The request is saved in this browser and shows in the <a href="planner.html">planner inbox</a>.</p>
      <button type="button" class="btn btn-outline btn-sm" data-act="reset" data-key="reset">Start a new order</button>
    </div>`;
  }
  const labels = ['Concrete', 'Delivery', 'Date & details', 'Confirm'];
  const body = { 1: step1, 2: step2, 3: step3, 4: step4 }[s.step](d);
  return `<div class="tool-grid">
    <div class="card wizard" id="wizard">
      <div class="row-between">
        <ol class="steps" style="flex:1 1 100%">${labels.map((l, i) => `<li data-on="${s.step >= i + 1}" ${s.step === i + 1 ? 'aria-current="step"' : ''}>${l}</li>`).join('')}</ol>
        <span class="step-count">Step ${s.step} of 4</span>
      </div>
      ${body}
      ${trustLine(s.step)}
      <div class="stepbar" id="stepbar">${stepbar(d)}</div>
    </div>
    <aside class="summary on-dark" id="summary" aria-label="Price summary">${summary(d)}</aside>
  </div>`;
}

// ---------- Quote and call ----------

function quoteView() {
  if (s.quoteSent) {
    return `<div class="card form-card" role="status"><h3 class="step-title" id="step-title" tabindex="-1">Quote request received</h3>
      <p style="color:#444">Our team will get back to you within ${orTbd(CONFIG.responseTimes.quote, 'response time')}.</p>
      <p class="preview-note">Preview only: nothing was sent.</p></div>`;
  }
  return `<form class="card form-card" data-form="quote">
    <h3 class="step-title">Tell us about your project</h3>
    <p class="hint" style="font-size:15px">For larger pours, special mixes or anything the online tool doesn't cover.</p>
    <div class="fields fields-2">
      ${field('qn', 'Full name', 'name="name" autocomplete="name" required')}
      ${field('qp', 'Phone number', 'name="phone" type="tel" autocomplete="tel" required')}
      ${field('qe', 'Email', 'name="email" type="email" autocomplete="email" required')}
      ${field('qpc', 'Site postcode', 'name="postcode" autocomplete="postal-code"')}
    </div>
    <div class="field"><label class="label" for="qt">Project type</label>
      <select id="qt" name="type" class="input"><option value="">Select project type…</option>${QUOTE_PROJECT_TYPES.map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
    <div class="field"><label class="label" for="qd">Project details</label>
      <textarea id="qd" name="details" class="input" rows="4" placeholder="Mix spec, volume, dates, access"></textarea></div>
    <button type="submit" class="btn btn-green" style="align-self:flex-start">Submit quote request</button>
  </form>`;
}

function callView() {
  const form = s.callbackSent
    ? `<div class="card form-card" role="status"><h3 class="step-title" id="step-title" tabindex="-1">We'll call you back shortly</h3><p class="preview-note">Preview only: nothing was sent.</p></div>`
    : `<form class="card form-card" data-form="callback">
        <h3 class="step-title">Request a callback</h3>
        <p class="hint" style="font-size:15px">Leave your number and a planner will ring you back within ${orTbd(CONFIG.responseTimes.callback, 'callback time')} in working hours.</p>
        ${field('cn', 'Name', 'name="name" autocomplete="name" required')}
        ${field('cp', 'Phone number', 'name="phone" type="tel" autocomplete="tel" required')}
        <button type="submit" class="btn btn-green" style="align-self:flex-start">Request callback</button>
      </form>`;
  return `<div class="panel-pair">
    <div class="dark-panel on-dark photo-panel">
      <h3 class="step-title">Speak to our planners</h3>
      <a class="big-phone" href="${C.orderPhoneHref}">${esc(C.orderPhone)}</a>
      <p>Monday–Friday 7:00–16:00 · Saturday ${orTbd(C.saturdayHours, 'hours')} · Sunday closed</p>
      <p>WhatsApp: ${orTbd(C.whatsapp, 'WhatsApp number')}</p>
      <p>Email: <a href="mailto:${C.orderEmail}" style="color:var(--green)">${esc(C.orderEmail)}</a></p>
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
  if (document.activeElement?.dataset?.key !== 'barrowOk') set('off-note', offloadNote(d));
  const vol = document.getElementById('vol');
  if (vol) vol.setAttribute('aria-valuetext', m3(s.volume));
  const use = document.getElementById('use-calc');
  if (use) use.disabled = !d.calc.ok || d.calc.tooBig;
}

// Local preview: hand the order to the planner inbox (planner.html) in this browser.
function sendToPlanners(d) {
  const at = new Date().toISOString();
  addOrder(orderFromShop({
    id: 'web-' + Date.now().toString(36),
    at,
    slot: { key: d.dayObj.key, dow: d.dayObj.dow, dm: d.dayObj.dm, time: s.time },
    name: s.name.trim(), phone: s.phone.trim(), email: s.email.trim(), notes: s.notes.trim(),
    postcode: d.pc.formatted,
    job: d.isProject ? d.proj.label : 'Chosen by mix code',
    mix: d.isProject && !d.proj.mix ? 'Advise' : d.mixLabel,
    volume: s.volume, offload: OFFLOADS.find((o) => o.id === s.offload)?.short || d.offloadLabel, stone: d.stoneLabel, consistency: s.slump, fibres: s.fibres,
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
      else { sendToPlanners(d); s.done = true; }
      return render({ focusTitle: true });
    case 'reset': s = fresh('buy'); return render({ focusTitle: true });
    case 'to-quote': e.preventDefault(); s.tab = 'quote'; render(); document.getElementById('tab-quote').focus(); return;
  }
});

function onField(e) {
  const el = e.target;
  const key = el.dataset.field;
  if (!key) return;
  if (el.type === 'checkbox') s[key] = el.checked;
  if (key === 'barrowOk') return render();
  else if (el.type === 'range') s[key] = L.clampVolume(parseFloat(el.value), VOL);
  else s[key] = el.value;
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

fillPage();
render();
