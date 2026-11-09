import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as O from '../js/orders.js';

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

test('samples: estimates match the mock-up', () => {
  const est = Object.fromEntries(O.sampleOrders().map((o) => [o.id, o.estimate]));
  assert.equal(est['sample-a'], 338.13);
  assert.equal(est['sample-b'], 811.5);
  assert.equal(est['sample-c'], 202.88);
  assert.equal(est['sample-d'], 447.75);
  assert.equal(est['sample-e'], 608.63);
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
  assert.match(conf, /^Hi Joost,/);
  assert.match(conf, /€811\.50 ex VAT/);
  const off = O.customerMessage(O.applyAction(o, 'offer', { slot: slot('2026-11-12', 'pm') }));
  assert.match(off, /Wed 11 Nov · PM instead/);
  assert.match(O.customerMessage(O.applyAction(o, 'decline')), /hold has been released/);
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
  const junk = memoryStorage(); junk.setItem('sl-shop-orders-v1', '{oops');
  assert.equal(O.loadOrders(junk).length, 5);
});
