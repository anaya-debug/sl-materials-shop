// Order requests shared by the shop and the planner inbox.
// For now they live in this browser only (localStorage), so the team can try the
// whole flow locally. A real backend replaces load/save later; the rest stays.

import { CONFIG } from './config.js';
import { nextDeliveryDays, formatEUR, round2 } from './logic.js';

const KEY = 'sl-shop-orders-v1';

export const STATUSES = {
  waiting: { label: 'Waiting' },
  confirmed: { label: 'Confirmed' },
  offered: { label: 'New time offered' },
  declined: { label: 'Declined' },
};

export const TIMES = { am: 'AM', pm: 'PM', any: 'Any time' };

export const slotText = (slot) => (slot ? `${slot.dow} ${slot.dm} · ${TIMES[slot.time] ?? ''}` : '—');

// Sort key: date, then morning before afternoon before any time.
export const slotSortKey = (slot) => `${slot?.key ?? '9999'}-${{ am: 0, pm: 1, any: 2 }[slot?.time] ?? 3}`;

// ---- Status changes (pure) ----

export function applyAction(order, action, payload = {}) {
  const at = payload.at ?? new Date().toISOString();
  switch (action) {
    case 'confirm':
      return { ...order, status: 'confirmed', offeredSlot: null, updatedAt: at };
    case 'offer':
      if (!payload.slot) throw new Error('offer needs a slot');
      return { ...order, status: 'offered', offeredSlot: payload.slot, updatedAt: at };
    case 'decline':
      return { ...order, status: 'declined', offeredSlot: null, updatedAt: at };
    case 'undo':
      return { ...order, status: 'waiting', offeredSlot: null, updatedAt: at };
    default:
      throw new Error('unknown action ' + action);
  }
}

export function counts(orders) {
  const c = { all: orders.length, waiting: 0, confirmed: 0, offered: 0, declined: 0 };
  orders.forEach((o) => { c[o.status] += 1; });
  return c;
}

// What the customer would be sent. Planners never set prices: the estimate comes from the shop.
export function customerMessage(order) {
  const first = (order.name || '').trim().split(' ')[0] || 'there';
  const price = formatEUR(order.estimate, CONFIG.locale);
  if (order.status === 'confirmed') {
    return `Hi ${first}, your SL Materials delivery is confirmed for ${slotText(order.slot)}: ${order.mix}, ${order.volume.toFixed(1)} m³. Final price ${price} ex VAT. Pay here: [payment link]`;
  }
  if (order.status === 'offered') {
    return `Hi ${first}, we can't make ${slotText(order.slot)}. Can we deliver ${slotText(order.offeredSlot)} instead? Tap to accept: [link]`;
  }
  if (order.status === 'declined') {
    return `Hi ${first}, sorry, we can't take this order online. A planner will call you to talk it through. Your card hold has been released.`;
  }
  return '';
}

// ---- Building an order from the shop ----

export function orderFromShop({ id, at, slot, name, phone, email, notes, postcode, job, mix, volume, offload, stone, consistency, fibres, estimate, hold }) {
  return {
    id, createdAt: at, updatedAt: at, source: 'shop', status: 'waiting', offeredSlot: null,
    slot, who: name, name, phone, email, contact: 'Phone', pc: postcode,
    job, note: notes || '', mix, volume, offload, stone, consistency, fibres: !!fibres,
    estimate: round2(estimate), hold: round2(hold),
  };
}

// ---- Sample data, dated from today so it always looks current ----

export function sampleOrders(today = new Date()) {
  const d = nextDeliveryDays(today, 6, CONFIG.locale).filter((x) => !x.saturday);
  const at = new Date(today).toISOString();
  const slot = (i, time) => ({ key: d[i].key, dow: d[i].dow, dm: d[i].dm, time });
  const base = CONFIG.pricing.basePerM3;
  const est = (v, add = 0) => round2((base + add) * v);
  const mk = (id, s, who, name, pc, contact, job, note, mix, volume, offload, estimate) => ({
    id, createdAt: at, updatedAt: at, source: 'sample', status: 'waiting', offeredSlot: null,
    slot: s, who, name, phone: '', email: '', contact, pc, job, note, mix, volume, offload,
    stone: '4–32 mm', consistency: 'S3', fibres: false, estimate, hold: round2(estimate * (1 + CONFIG.pricing.contingencyPct / 100)),
  });
  return [
    mk('sample-a', slot(0, 'am'), 'Homeowner', 'Anna', '1013', 'WhatsApp', 'Shed base', 'Gate 1.2 m wide', 'C20/25', 2.5, 'Wheelbarrow', est(2.5)),
    mk('sample-b', slot(1, 'am'), 'Small builder', 'Joost', '1503', 'Phone', 'Strip foundations', 'Extension, 2 pours', 'C20/25', 6, 'Chute', est(6)),
    mk('sample-c', slot(1, 'pm'), 'Homeowner', 'Fatima', '2011', 'Email', 'Not sure', 'Garden room, 4 × 3 m', 'Advise', 1.5, 'Chute', est(1.5)),
    mk('sample-d', slot(2, 'am'), 'Landscaper', 'Pieter', '1441', 'Phone', 'Patio', 'Fine finish wanted', 'C25/30', 3, 'Pump', est(3, 14)),
    mk('sample-e', slot(3, 'pm'), 'Homeowner', 'Eva', '1072', 'WhatsApp', 'Driveway', 'Narrow street, canal side', 'C30/37', 4.5, 'Chute', est(4.5)),
  ];
}

// ---- Storage (browser only) ----

export function loadOrders(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch { /* private mode or bad data: fall back to samples */ }
  return sampleOrders();
}

export function saveOrders(list, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}

export function addOrder(order, storage = globalThis.localStorage) {
  const list = loadOrders(storage);
  list.push(order);
  return saveOrders(list, storage);
}

export function resetOrders(storage = globalThis.localStorage) {
  try { storage?.removeItem(KEY); } catch { /* ignore */ }
  return sampleOrders();
}
