import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import { CONFIG } from '../js/config.js';

const VOL = CONFIG.volume;
const RANGES = CONFIG.delivery.postcodeRanges;
const P = CONFIG.pricing;

test('price: concrete only, matches the planner mock-up samples', () => {
  assert.equal(L.priceOrder({ volume: 2.5 }, P).total, 338.13);
  assert.equal(L.priceOrder({ volume: 6 }, P).total, 811.5);
  assert.equal(L.priceOrder({ volume: 1.5 }, P).total, 202.88);
});

test('price: stone size surcharge per m³', () => {
  assert.equal(L.priceOrder({ volume: 2, stone: 'mid' }, P).total, 2 * 135.25 + 2 * 8.5);
  assert.equal(L.priceOrder({ volume: 2, stone: 'fine' }, P).total, 2 * 135.25 + 2 * 14);
  const std = L.priceOrder({ volume: 2, stone: 'std' }, P).lines.find((l) => l.key === 'stone');
  assert.equal(std.state, 'included');
});

test('price: hold adds the contingency allowance', () => {
  const p = L.priceOrder({ volume: 2 }, P);
  assert.equal(p.total, 270.5);
  assert.equal(p.contingency, 40.58);
  assert.equal(p.hold, 311.08);
});

test('price: unagreed extras are flagged, not counted', () => {
  const p = L.priceOrder({ volume: 2, fibres: true, offload: 'pumpsl', saturday: true }, P);
  const st = Object.fromEntries(p.lines.map((l) => [l.key, l.state]));
  assert.equal(st.fibres, 'tbd');
  assert.equal(st.pump, 'onConfirm');
  assert.equal(st.saturday, 'tbd');
  assert.equal(st.partLoad, 'tbd');
  assert.equal(st.delivery, 'tbd');
  assert.equal(p.total, 270.5);
});

test('price: agreed extras are counted once set in config', () => {
  const agreed = { ...P, fibresPerM3: 10, pumpBySL: 250, saturdaySurcharge: 75, partLoad: { underM3: 4, charge: 60 }, deliveryCharge: 0 };
  const small = L.priceOrder({ volume: 2, fibres: true, offload: 'pumpsl', saturday: true }, agreed);
  assert.equal(small.total, 270.5 + 20 + 250 + 75 + 60);
  const big = L.priceOrder({ volume: 6 }, agreed);
  assert.equal(big.lines.find((l) => l.key === 'partLoad').state, 'none');
  assert.equal(big.total, 811.5);
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

test('volume: over 16 m³ is sent to a quote', () => {
  const c = L.calcVolume('20', '8', '100', VOL); // 16 → 17.6 → 18
  assert.equal(c.tooBig, true);
  assert.equal(L.calcVolume('10', '10', '100', VOL).tooBig, false); // 10 → 11
});

test('volume: missing or zero dimensions are not ok', () => {
  assert.equal(L.calcVolume('', '3', '100', VOL).ok, false);
  assert.equal(L.calcVolume('4', '0', '100', VOL).ok, false);
  assert.equal(L.calcVolume('abc', '3', '100', VOL).ok, false);
});

test('volume: stepper and slider stay within 1–16 in 0.5 steps', () => {
  assert.equal(L.stepVolume(1, -1, VOL), 1);
  assert.equal(L.stepVolume(16, 1, VOL), 16);
  assert.equal(L.stepVolume(2, 1, VOL), 2.5);
  assert.equal(L.clampVolume(3.3, VOL), 3.5);
  assert.equal(L.clampVolume(40, VOL), 16);
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
  const filled = { ...base, name: 'Sam de Vries', phone: '06 12345678', email: 'sam@example.nl', terms: true };
  assert.equal(L.checkStep(3, filled, { dayChosen: false }).hint, 'Pick a delivery date.');
  assert.equal(L.checkStep(3, { ...filled, email: 'sam@' }, { dayChosen: true }).ok, false);
  assert.equal(L.checkStep(3, { ...filled, terms: false }, { dayChosen: true }).hint, 'Please accept the terms.');
  assert.equal(L.checkStep(3, filled, { dayChosen: true }).ok, true);
});
