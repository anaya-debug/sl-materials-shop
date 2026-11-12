import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as O from '../live/js/orders.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const slot = (key, time) => ({ key, dow: 'Wed', dm: '11 Nov', time });

test('samples: five waiting orders, dated after today, no Sundays or Saturdays', () => {
  const today = new Date(2026, 10, 13); // Fri
  const list = O.sampleOrders(today);
  assert.equal(list.length, 5);
  assert.ok(list.every((o) => o.status === 'waiting'));
  for (const o of list) {
    const d = new Date(o.slot.key + 'T12:00:00');
    assert.ok(d > today, o.slot.key);
    assert.ok(![0, 6].includes(d.getDay()), o.slot.key);
  }
});

test('samples: estimates use the full shop price (part load and delivery included)', () => {
  const est = Object.fromEntries(O.sampleOrders().map((o) => [o.id, o.estimate]));
  assert.equal(est['sample-a'], 587.5);  // 2.5 m³: 300 + 5.5 × 35 + 95
  assert.equal(est['sample-b'], 885);    // 6 m³: 720 + 2 × 35 + 95
  assert.equal(est['sample-c'], 502.5);
  assert.equal(est['sample-d'], 672);    // 3 m³ fine stone, pump priced later
  assert.equal(est['sample-e'], 757.5);
});

test('SL pump requests: flagged and editable by the planner', () => {
  const d = O.sampleOrders().find((o) => o.id === 'sample-d');
  assert.equal(O.needsSLPump(d), true);
  assert.equal(O.needsSLPump(O.sampleOrders()[0]), false);
  const booked = O.setPump(d, { status: 'booked', note: 'Pompverhuur NH, 7:30' });
  assert.deepEqual(booked.pump, { status: 'booked', note: 'Pompverhuur NH, 7:30' });
  assert.equal(O.setPump(booked, { note: 'changed' }).pump.status, 'booked');
  assert.equal(d.pump, undefined, 'original is not changed');
});

test('big wheelbarrow orders are flagged for a check on the call', () => {
  const a = O.sampleOrders()[0]; // 2.5 m³ by wheelbarrow
  assert.equal(O.needsBarrowCheck(a), true);
  assert.equal(O.needsBarrowCheck({ ...a, volume: 2 }), false);
  assert.equal(O.needsBarrowCheck({ ...a, offload: 'Chute' }), false);
});

test('tomorrow key', () => {
  assert.equal(O.tomorrowKey(new Date(2026, 10, 30)), '2026-12-01');
});

test('actions: confirm, offer, decline and undo', () => {
  const o = O.sampleOrders()[0];
  const at = '2026-11-09T10:00:00.000Z';
  assert.equal(O.applyAction(o, 'confirm', { at }).status, 'confirmed');
  const offered = O.applyAction(o, 'offer', { at, slot: slot('2026-11-12', 'pm') });
  assert.equal(offered.status, 'offered');
  assert.equal(offered.offeredSlot.time, 'pm');
  assert.equal(O.applyAction(offered, 'decline', { at }).offeredSlot, null);
  const undone = O.applyAction(offered, 'undo', { at });
  assert.equal(undone.status, 'waiting');
  assert.equal(undone.offeredSlot, null);
  assert.equal(o.status, 'waiting', 'original is not changed');
  assert.throws(() => O.applyAction(o, 'offer', {}));
  assert.throws(() => O.applyAction(o, 'refund', {}));
});

test('counts per status', () => {
  const [a, b, c] = O.sampleOrders();
  const list = [O.applyAction(a, 'confirm'), O.applyAction(b, 'decline'), c];
  assert.deepEqual(O.counts(list), { all: 3, waiting: 1, confirmed: 1, offered: 0, declined: 1 });
});

test('customer messages carry the shop price, never a planner price', () => {
  const o = { ...O.sampleOrders()[1], name: 'Joost Bakker' };
  assert.equal(O.customerMessage(o), '');
  const conf = O.customerMessage(O.applyAction(o, 'confirm'));
  assert.match(conf, /^Dear Joost Bakker,/);
  assert.match(conf, /€1,070\.85 incl\. BTW/); // 885 + 21%
  const off = O.customerMessage(O.applyAction(o, 'offer', { slot: slot('2026-11-12', 'pm') }));
  assert.match(off, /offer Wed 11 Nov · 12:00–16:00 instead/);
  assert.doesNotMatch(off, /\b(AM|PM)\b/);
  assert.match(O.customerMessage(O.applyAction(o, 'decline')), /hold on your card has been released/);
});

test('slots sort by date, then morning before afternoon', () => {
  const keys = [slot('2026-11-12', 'pm'), slot('2026-11-11', 'any'), slot('2026-11-12', 'am'), slot('2026-11-11', 'am')].map(O.slotSortKey).sort();
  assert.deepEqual(keys, ['2026-11-11-0', '2026-11-11-2', '2026-11-12-0', '2026-11-12-1']);
});

test('storage: starts with samples, keeps shop orders, resets', () => {
  const st = memoryStorage();
  assert.equal(O.loadOrders(st).length, 5);
  const web = O.orderFromShop({ id: 'web-1', at: 'now', slot: slot('2026-11-11', 'am'), name: 'Sam', phone: '0612345678', postcode: '1013 AB', job: 'Driveway', mix: 'C30/37', volume: 2, offload: 'Chute', estimate: 270.5, hold: 311.075 });
  assert.equal(web.status, 'waiting');
  assert.equal(web.hold, 311.08);
  O.addOrder(web, st);
  const list = O.loadOrders(st);
  assert.equal(list.length, 6);
  assert.equal(list.at(-1).id, 'web-1');
  assert.equal(O.resetOrders(st).length, 5);
  assert.equal(O.loadOrders(st).length, 5);
});

test('storage: bad or blocked storage falls back to samples', () => {
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
  assert.equal(O.loadOrders(broken).length, 5);
  assert.equal(O.saveOrders([], broken), false);
  const junk = memoryStorage(); junk.setItem('sl-shop-orders-v2', '{oops');
  assert.equal(O.loadOrders(junk).length, 5);
});
