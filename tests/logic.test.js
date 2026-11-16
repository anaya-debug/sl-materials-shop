import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import { CONFIG } from '../js/config.js';

const VOL = CONFIG.volume;
const RANGES = CONFIG.delivery.postcodeRanges;
const P = CONFIG.pricing;

// Prices (16 Nov 2026, ~5% under ikwilbetonbestellen.nl): €119.50/m³ + €213 delivery under 10 m³,
// €143.50/m³ all-in from 10 m³.
const total = (o, p = P) => L.priceOrder(o, p).total;
const line = (o, key, p = P) => L.priceOrder(o, p).lines.find((l) => l.key === key);

test('price: matches the agreed table (about 5% under the competitor)', () => {
  assert.equal(total({ volume: 1 }), 332.5);     // them 351
  assert.equal(total({ volume: 3 }), 571.5);     // them 603
  assert.equal(total({ volume: 6 }), 930);       // them 981
  assert.equal(total({ volume: 8 }), 1169);      // them 1233
  assert.equal(total({ volume: 9.5 }), 1348.25);
  assert.equal(total({ volume: 10 }), 1435);     // them 1510
  assert.equal(total({ volume: 12 }), 1722);     // them 1812
});

test('price: about 5% under the competitor at every size', () => {
  const theirs = (v) => (v < 10 ? 126 * v + 225 : 151 * v);
  for (const v of [1, 2, 3, 4.5, 6, 8, 9, 10, 12, 16, 24]) {
    const ratio = total({ volume: v }) / theirs(v);
    assert.ok(ratio > 0.94 && ratio < 0.96, `${v} m³: ${ratio}`);
  }
});

test('price: delivery is one charge under 10 m³ and included from 10 m³', () => {
  assert.equal(line({ volume: 3 }, 'delivery').amount, 213);
  assert.equal(line({ volume: 9.5 }, 'delivery').state, 'priced');
  assert.equal(line({ volume: 10 }, 'delivery').state, 'included');
  assert.equal(line({ volume: 3 }, 'partLoad').state, 'none');
});

test('price: big orders split evenly over trucks', () => {
  assert.deepEqual(L.splitTrucks(12, 12), { trucks: 1, perTruck: 12 });
  assert.deepEqual(L.splitTrucks(14, 12), { trucks: 2, perTruck: 7 });
  assert.deepEqual(L.splitTrucks(48, 12), { trucks: 4, perTruck: 12 });
  assert.equal(line({ volume: 14 }, 'delivery').trucks, 2);
  assert.equal(total({ volume: 14 }), 14 * 143.5);
});

test('price: stone size and fibres per m³', () => {
  const base = total({ volume: 2 });
  assert.equal(total({ volume: 2, stone: 'fine' }), base + 15.2);
  assert.equal(line({ volume: 2 }, 'stone').state, 'included');
  assert.equal(total({ volume: 2, fibres: true }), base + 16);
});

test('price: extras per m³', () => {
  const base = total({ volume: 2 });
  assert.equal(total({ volume: 2, addOns: ['highStrength'] }), base + 20.9);
  assert.equal(total({ volume: 2, addOns: ['highStrength', 'fastSetting'] }), base + 30.4);
  assert.equal(total({ volume: 2, consistency: 'S4' }), base + 8.56);
  assert.equal(line({ volume: 2 }, 'extras').state, 'none');
});

test('price: pump arranged by SL is €560 per order, any volume', () => {
  assert.equal(line({ volume: 3, offload: 'pumpsl' }, 'pump').amount, 560);
  assert.equal(line({ volume: 12, offload: 'pumpsl' }, 'pump').amount, 560);
  assert.equal(total({ volume: 3, offload: 'pumpsl' }), 571.5 + 560);
});

test('price: BTW and the hold (always incl. BTW, plus the 15% allowance)', () => {
  const p = L.priceOrder({ volume: 2 }, P);
  assert.equal(p.total, 452);          // excl. BTW
  assert.equal(p.vat, 94.92);          // 21%
  assert.equal(p.totalIncl, 546.92);
  assert.equal(p.contingency, 82.04);
  assert.equal(p.hold, 628.96);
  assert.equal(L.withVat(120, 21), 145.2);
});

test('price: unagreed extras are flagged, not counted', () => {
  const p = L.priceOrder({ volume: 2, offload: 'pumpsl', saturday: true }, { ...P, pumpBySL: null });
  const st = Object.fromEntries(p.lines.map((l) => [l.key, l.state]));
  assert.equal(st.pump, 'onConfirm');
  assert.equal(st.saturday, 'tbd');
  assert.equal(p.total, 452);
});

test('price: older model (part load + per-truck delivery) still works if switched back', () => {
  const old = { ...P, bulk: null, deliveryUnderBulk: null, basePerM3: 120, partLoad: { underM3: 8, perM3Short: 35 }, deliveryPerTruck: 95 };
  assert.equal(total({ volume: 1 }, old), 120 + 7 * 35 + 95);
  assert.equal(total({ volume: 2, saturday: true }, { ...old, saturdaySurcharge: 75 }), 240 + 6 * 35 + 95 + 75);
});

test('pumping: only fluid mixes, wheelbarrow loads, cut-off', () => {
  assert.equal(L.canPump('S4'), true);
  assert.equal(L.canPump('S3'), true);
  assert.equal(L.canPump('S2'), false);
  assert.equal(L.canPump('S1'), false);
  assert.equal(L.isPump('pumpsl') && L.isPump('pumpown') && !L.isPump('barrow'), true);
  assert.equal(L.barrowLoads(1), 17);
  assert.equal(L.pastCutoff(new Date(2026, 10, 9, 10, 59), '11:00'), false);
  assert.equal(L.pastCutoff(new Date(2026, 10, 9, 11, 0), '11:00'), true);
  assert.equal(L.pastCutoff(new Date(), null), false);
});

test('volume: dimensions add 10% and round up to 0.5 m³', () => {
  const c = L.calcVolume('4', '3', '100', VOL); // 1.2 m³ → 1.32 → 1.5
  assert.equal(c.ok, true);
  assert.ok(Math.abs(c.raw - 1.2) < 1e-9);
  assert.ok(Math.abs(c.withWaste - 1.32) < 1e-9);
  assert.equal(c.recommended, 1.5);
});

test('volume: accepts Dutch decimal commas', () => {
  assert.equal(L.calcVolume('2,5', '2', '150', VOL).recommended, 1); // 0.75 → 0.825 → min 1
});

test('volume: exact half steps are not bumped up by float error', () => {
  // 10 × 1 × 100 mm = 1.0 m³, + 10% = 1.1 → 1.5 (not 2.0)
  assert.equal(L.calcVolume('10', '1', '100', VOL).recommended, 1.5);
  // 2.5 / 1.1 m³ raw → exactly 2.5 after wastage
  assert.equal(L.calcVolume(String(25 / 11), '1', '1000', VOL).recommended, 2.5);
});

test('volume: over 48 m³ is sent to a quote', () => {
  const c = L.calcVolume('20', '20', '120', VOL); // 48 → 52.8 → 53
  assert.equal(c.tooBig, true);
  assert.equal(L.calcVolume('20', '20', '100', VOL).tooBig, false); // 40 → 44
});

test('volume: missing or zero dimensions are not ok', () => {
  assert.equal(L.calcVolume('', '3', '100', VOL).ok, false);
  assert.equal(L.calcVolume('4', '0', '100', VOL).ok, false);
  assert.equal(L.calcVolume('abc', '3', '100', VOL).ok, false);
});

test('volume: stepper and slider stay within 1–48 in 0.5 steps', () => {
  assert.equal(L.stepVolume(1, -1, VOL), 1);
  assert.equal(L.stepVolume(48, 1, VOL), 48);
  assert.equal(L.stepVolume(2, 1, VOL), 2.5);
  assert.equal(L.clampVolume(3.3, VOL), 3.5);
  assert.equal(L.clampVolume(60, VOL), 48);
});

test('postcode: inside and outside the delivery area', () => {
  for (const pc of ['1013 AB', '1013AB', '1013', '1505 hs', '2011', '1999 ZZ', '2199']) {
    assert.equal(L.checkPostcode(pc, RANGES).inArea, true, pc);
  }
  for (const pc of ['1200 AA', '1299', '2200', '3011 AB', '9999']) {
    const r = L.checkPostcode(pc, RANGES);
    assert.equal(r.valid, true, pc);
    assert.equal(r.inArea, false, pc);
  }
});

test('postcode: format checks and tidy output', () => {
  assert.equal(L.checkPostcode('0123 AB', RANGES).valid, false);
  assert.equal(L.checkPostcode('1013 A', RANGES).badFormat, false); // still typing
  assert.equal(L.checkPostcode('1013 A1', RANGES).badFormat, true);
  assert.equal(L.checkPostcode('101', RANGES).entered, false);
  assert.equal(L.checkPostcode(' 1013ab ', RANGES).formatted, '1013 AB');
});

test('delivery days: next six, no Sundays, Saturdays flagged', () => {
  const fri = new Date(2026, 10, 13); // Fri 13 Nov 2026
  const days = L.nextDeliveryDays(fri, 6);
  assert.deepEqual(days.map((d) => d.key), ['2026-11-14', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
  assert.equal(days[0].saturday, true);
  assert.equal(days.filter((d) => d.saturday).length, 1);
});

test('steps: Continue stays off until each step is complete', () => {
  const base = { offload: null, name: '', phone: '', email: '', terms: false };
  assert.equal(L.checkStep(1, base, { hasMix: false }).ok, false);
  assert.equal(L.checkStep(1, base, { hasMix: true }).ok, true);
  assert.equal(L.checkStep(2, base, { inArea: true }).hint, 'Choose an offloading method.');
  assert.equal(L.checkStep(2, { ...base, offload: 'chute' }, { inArea: false }).ok, false);
  assert.equal(L.checkStep(2, { ...base, offload: 'chute' }, { inArea: true }).ok, true);
  assert.equal(L.checkStep(2, { ...base, offload: 'barrow' }, { inArea: true }).hint, 'Confirm you can unload within 30 minutes.');
  assert.equal(L.checkStep(2, { ...base, offload: 'barrow', barrowOk: true }, { inArea: true }).ok, true);
  assert.equal(L.checkStep(2, { ...base, offload: 'pumpsl' }, { inArea: true, pumpOk: false }).ok, false);
  assert.equal(L.checkStep(2, { ...base, offload: 'pumpsl' }, { inArea: true, pumpOk: true }).ok, true);
  const filled = { ...base, name: 'Sam de Vries', phone: '06 12345678', email: 'sam@example.nl', terms: true };
  assert.equal(L.checkStep(3, filled, { dayChosen: false }).hint, 'Pick a delivery date.');
  assert.equal(L.checkStep(3, { ...filled, email: 'sam@' }, { dayChosen: true }).ok, false);
  assert.equal(L.checkStep(3, { ...filled, terms: false }, { dayChosen: true }).hint, 'Please accept the terms.');
  assert.equal(L.checkStep(3, filled, { dayChosen: true }).ok, true);
});
