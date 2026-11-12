// Pure order logic: no DOM, so it can be unit tested with `npm test`.

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Add BTW to an amount excl. BTW.
export const withVat = (n, pct) => round2(n * (1 + pct / 100));

export function parseNum(v) {
  const n = parseFloat(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export function formatEUR(n, locale = 'en-GB') {
  return '€' + n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- Volume ----

export function clampVolume(v, { min, max, step }) {
  const snapped = Math.round(v / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export function stepVolume(v, dir, cfg) {
  return clampVolume(v + dir * cfg.step, cfg);
}

// Length and width in metres, depth in millimetres.
export function calcVolume(len, wid, depthMm, { min, max, step, wastagePct }) {
  const L = parseNum(len), W = parseNum(wid), D = parseNum(depthMm);
  const ok = L > 0 && W > 0 && D > 0;
  if (!ok) return { ok: false, raw: 0, withWaste: 0, recommended: 0, tooBig: false };
  const raw = (L * W * D) / 1000;
  const withWaste = raw * (1 + wastagePct / 100);
  // Round up to the next step; the tiny offset stops 2.0000000001 becoming 2.5.
  const recommended = Math.max(min, Math.ceil(withWaste / step - 1e-9) * step);
  return { ok, raw, withWaste, recommended, tooBig: recommended > max };
}

// ---- Postcode ----

export function checkPostcode(input, ranges) {
  const pc = String(input ?? '').replace(/\s+/g, '').toUpperCase();
  const entered = /^\d{4}/.test(pc);
  const valid = /^[1-9]\d{3}([A-Z]{2})?$/.test(pc);
  const num = entered ? parseInt(pc.slice(0, 4), 10) : NaN;
  const inArea = valid && ranges.some(([lo, hi]) => num >= lo && num <= hi);
  const formatted = valid ? (pc.length > 4 ? pc.slice(0, 4) + ' ' + pc.slice(4) : pc) : pc;
  // Only call it badly formed once it is long enough to judge.
  const badFormat = !valid && pc.length >= 6;
  return { entered, valid, inArea, badFormat, formatted };
}

// ---- Delivery days ----

// The next `count` delivery days after `from`: no Sundays, Saturdays flagged.
export function nextDeliveryDays(from, count, locale = 'en-GB') {
  const days = [];
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  while (days.length < count) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd === 0) continue;
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    days.push({
      key: `${y}-${m}-${dd}`,
      saturday: wd === 6,
      dow: d.toLocaleDateString(locale, { weekday: 'short' }),
      dm: d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
    });
  }
  return days;
}

// ---- Price ----

// Split an order evenly over the fewest trucks: 14 m³ with 12 m³ trucks is 2 × 7 m³.
export function splitTrucks(volume, truckM3) {
  const trucks = Math.max(1, Math.ceil(volume / truckM3 - 1e-9));
  return { trucks, perTruck: volume / trucks };
}

// Each line has a state:
//   none       not part of this order
//   included   part of it at no extra cost
//   priced     amount is counted in the total
//   tbd        applies, but the price is still to agree (not counted)
//   onConfirm  applies, priced by the planner on confirmation (not counted)
export function priceOrder({ volume, stone = 'std', fibres = false, offload = null, saturday = false, addOns = [], consistency = 'S3' }, p) {
  const lines = [];
  const add = (key, state, amount = null, extra = {}) => lines.push({ key, state, amount: amount == null ? null : round2(amount), ...extra });
  const { trucks, perTruck } = splitTrucks(volume, p.truckM3 || Infinity);

  add('concrete', 'priced', p.basePerM3 * volume);

  const stoneAdd = p.stoneAddPerM3[stone] ?? 0;
  add('stone', stoneAdd ? 'priced' : 'included', stoneAdd ? stoneAdd * volume : null);

  // Extras (old shop prices): chosen add-ons plus the highly fluid S4 mix.
  const addPerM3 = addOns.reduce((sum, id) => sum + (p.addOnsPerM3?.[id] ?? 0), 0) + (p.consistencyAddPerM3?.[consistency] ?? 0);
  add('extras', addPerM3 ? 'priced' : 'none', addPerM3 ? addPerM3 * volume : null);

  if (!fibres) add('fibres', 'none');
  else if (p.fibresPerM3 == null) add('fibres', 'tbd');
  else add('fibres', 'priced', p.fibresPerM3 * volume);

  if (offload !== 'pumpsl') add('pump', 'none');
  else if (p.pumpBySL == null) add('pump', 'onConfirm');
  else add('pump', 'priced', p.pumpBySL);

  if (!saturday) add('saturday', 'none');
  else if (p.saturdaySurcharge == null) add('saturday', 'tbd');
  else add('saturday', 'priced', p.saturdaySurcharge);

  // Part load: each truck pays for every m³ it is short of `underM3`.
  const pl = p.partLoad || {};
  const shortPerTruck = pl.underM3 == null ? 0 : Math.max(0, pl.underM3 - perTruck);
  if (pl.underM3 == null || pl.perM3Short == null) add('partLoad', 'tbd');
  else if (shortPerTruck > 0) add('partLoad', 'priced', trucks * shortPerTruck * pl.perM3Short, { shortM3: round2(trucks * shortPerTruck) });
  else add('partLoad', 'none');

  if (p.deliveryPerTruck == null) add('delivery', 'tbd', null, { trucks });
  else add('delivery', 'priced', p.deliveryPerTruck * trucks, { trucks });

  // total is excl. BTW. The card is always charged incl. BTW, so the hold is worked out on totalIncl.
  const total = round2(lines.reduce((sum, l) => sum + (l.state === 'priced' ? l.amount : 0), 0));
  const vat = round2(total * (p.vatPct ?? 0) / 100);
  const totalIncl = round2(total + vat);
  const contingency = round2(totalIncl * p.contingencyPct / 100);
  return { lines, total, vat, totalIncl, contingency, hold: round2(totalIncl + contingency), trucks, perTruck };
}

// ---- Delivery rules ----

export const isPump = (offload) => offload === 'pumpown' || offload === 'pumpsl';

// Stiff mixes (S1, S2) can't go through a pump.
export const canPump = (consistency, pumpable = ['S3', 'S4']) => pumpable.includes(consistency);

// Wheelbarrow loads per m³: a builder's barrow takes about 60 litres of concrete.
export const barrowLoads = (volume) => Math.ceil(volume / 0.06);

// Is it already past today's next-day cut-off ('11:00')?
export function pastCutoff(now, cutoff) {
  if (!cutoff) return false;
  const [h, m] = cutoff.split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}

// ---- Step checks ----

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? '').trim());

// state: the wizard state; ctx: { hasMix, inArea, dayChosen, pumpOk }
export function checkStep(step, state, ctx) {
  if (step === 1) {
    return ctx.hasMix ? { ok: true, hint: 'Next: delivery and volume.' } : { ok: false, hint: 'Choose a project or a mix code.' };
  }
  if (step === 2) {
    if (!ctx.inArea) return { ok: false, hint: 'Enter a postcode in our delivery area.' };
    if (!state.offload) return { ok: false, hint: 'Choose an offloading method.' };
    if (isPump(state.offload) && ctx.pumpOk === false) return { ok: false, hint: 'S1 and S2 can\'t be pumped. Choose S3 or S4.' };
    if (state.offload === 'barrow' && !state.barrowOk) return { ok: false, hint: 'Confirm you can unload within 30 minutes.' };
    return { ok: true, hint: 'Next: date and your details.' };
  }
  if (step === 3) {
    if (!ctx.dayChosen) return { ok: false, hint: 'Pick a delivery date.' };
    const nameOk = state.name.trim().length > 1;
    const phoneOk = state.phone.replace(/\D/g, '').length >= 9;
    if (!nameOk || !phoneOk || !isEmail(state.email)) return { ok: false, hint: 'Fill in your name, phone and email.' };
    if (!state.terms) return { ok: false, hint: 'Please accept the terms.' };
    return { ok: true, hint: 'Next: check and confirm.' };
  }
  return { ok: true, hint: 'Nothing is charged until a planner confirms.' };
}
