// Order requests shared by the shop and the planner inbox.
// For now they live in this browser only (localStorage), so the team can try the
// whole flow locally. A real backend replaces load/save later; the rest stays.

import { CONFIG } from './config.js?v=202611121210';
import { nextDeliveryDays, formatEUR, round2, priceOrder, withVat } from './logic.js?v=202611121210';

const KEY = 'sl-shop-orders-v2'; // v2: prices from the 9 Nov review

export const STATUSES = {
  waiting: { label: 'Waiting' },
  confirmed: { label: 'Confirmed' },
  offered: { label: 'New time offered' },
  declined: { label: 'Declined' },
};

// Dutch customers use the 24-hour clock.
export const TIMES = { am: '7:00–12:00', pm: '12:00–16:00', any: 'any time' };

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
  const name = (order.name || '').trim() || 'customer';
  const sign = `SL Materials Planning, ${CONFIG.contact.orderPhone}`;
  // estimate is stored excl. BTW; customers are told the price incl. BTW.
  const price = formatEUR(withVat(order.estimate, CONFIG.pricing.vatPct), CONFIG.locale);
  if (order.status === 'confirmed') {
    return `Dear ${name}, your concrete delivery is confirmed for ${slotText(order.slot)}: ${order.mix}, ${order.volume.toFixed(1)} m³. Final price ${price} incl. BTW. Please complete payment here: [payment link]. ${sign}`;
  }
  if (order.status === 'offered') {
    return `Dear ${name}, unfortunately we are unable to deliver on ${slotText(order.slot)}. We can offer ${slotText(order.offeredSlot)} instead. Please confirm this new time here: [link], or call us to discuss. ${sign}`;
  }
  if (order.status === 'declined') {
    return `Dear ${name}, we are unable to accept this order online. A planner will call you to discuss the options. The hold on your card has been released. ${sign}`;
  }
  return '';
}

// Wheelbarrow orders over this size get a "check on the call" flag for planners.
export const needsBarrowCheck = (order) => /wheelbarrow/i.test(order.offload || '') && order.volume > CONFIG.barrowWarnM3;

// Orders where the customer asked SL to arrange the pump.
export const needsSLPump = (order) => /pump \(sl\)/i.test(order.offload || '');

// Planner notes on the pump booking: status 'todo' or 'booked', plus free text.
export function setPump(order, { status, note } = {}, at = new Date().toISOString()) {
  const pump = { status: 'todo', note: '', ...(order.pump || {}) };
  if (status) pump.status = status;
  if (note != null) pump.note = note;
  return { ...order, pump, updatedAt: at };
}

// Date key (YYYY-MM-DD) for the day after `today`, in local time.
export function tomorrowKey(today = new Date()) {
  const d = new Date(today);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- Building an order from the shop ----

export function orderFromShop({ id, at, slot, name, phone, email, notes, postcode, job, mix, volume, offload, stone, consistency, fibres, extras = [], estimate, hold }) {
  return {
    id, createdAt: at, updatedAt: at, source: 'shop', status: 'waiting', offeredSlot: null,
    slot, who: name, name, phone, email, contact: 'Phone', pc: postcode,
    job, note: notes || '', mix, volume, offload, stone, consistency, fibres: !!fibres, extras,
    estimate: round2(estimate), hold: round2(hold),
  };
}

// ---- Sample data, dated from today so it always looks current ----

export function sampleOrders(today = new Date()) {
  const d = nextDeliveryDays(today, 6, CONFIG.locale).filter((x) => !x.saturday);
  const at = new Date(today).toISOString();
  const slot = (i, time) => ({ key: d[i].key, dow: d[i].dow, dm: d[i].dm, time });
  // Same price the shop would show: concrete, stone, part load and delivery.
  const est = (volume, stone = 'std', offload = null) => priceOrder({ volume, stone, offload }, CONFIG.pricing).total;
  const mk = (id, s, who, name, pc, contact, job, note, mix, volume, offload, estimate) => ({
    id, createdAt: at, updatedAt: at, source: 'sample', status: 'waiting', offeredSlot: null,
    slot: s, who, name, phone: '', email: '', contact, pc, job, note, mix, volume, offload,
    stone: id === 'sample-d' ? '2–8 mm' : '4–32 mm', consistency: id === 'sample-d' ? 'S4' : 'S3', fibres: false, estimate, hold: round2(withVat(estimate, CONFIG.pricing.vatPct) * (1 + CONFIG.pricing.contingencyPct / 100)),
  });
  return [
    { ...mk('sample-a', slot(0, 'am'), 'Homeowner', 'Anna', '1013', 'WhatsApp', 'Rough concrete floor', 'Gate 1.2 m wide', 'C20/25', 2.5, 'Wheelbarrow', est(2.5)), phone: '+31 6 12 34 56 78' },
    mk('sample-b', slot(1, 'am'), 'Small builder', 'Joost', '1503', 'Phone', 'Foundations', 'Extension, 2 pours', 'C20/25', 6, 'Chute', est(6)),
    mk('sample-c', slot(1, 'pm'), 'Homeowner', 'Fatima', '2011', 'Email', 'Not sure', 'Garden room, 4 × 3 m', 'Advise', 1.5, 'Chute', est(1.5)),
    mk('sample-d', slot(2, 'am'), 'Landscaper', 'Pieter', '1441', 'Phone', 'Power-floated floor', 'Fine finish wanted', 'C25/30', 3, 'Pump (SL)', est(3, 'fine', 'pumpsl')),
    mk('sample-e', slot(3, 'pm'), 'Homeowner', 'Eva', '1072', 'WhatsApp', 'Agricultural', 'Narrow street, canal side', 'C30/37', 4.5, 'Chute', est(4.5)),
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
