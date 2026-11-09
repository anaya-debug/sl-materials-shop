import { CONFIG } from './config.js';
import { formatEUR, nextDeliveryDays } from './logic.js';
import { STATUSES, applyAction, counts, customerMessage, loadOrders, saveOrders, resetOrders, slotText, slotSortKey, needsSLPump, needsBarrowCheck, setPump, tomorrowKey } from './orders.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => formatEUR(n, CONFIG.locale);
const $ = (id) => document.getElementById(id);

let orders = loadOrders();
let filter = 'all';
const FILTER_LABELS = { all: 'All', waiting: 'Waiting', confirmed: 'Confirmed', offered: 'New time offered', declined: 'Declined' };

// ---------- Rendering ----------

function barrowCheck(o) {
  if (!needsBarrowCheck(o)) return '';
  return `<p class="barrow-check"><strong>Wheelbarrow, ${o.volume.toFixed(1)} m³:</strong> check on the call that they have enough people to unload within 30 minutes.</p>`;
}

function pumpBox(o) {
  if (!needsSLPump(o)) return '';
  const p = o.pump || { status: 'todo', note: '' };
  return `<div class="pump-box ${p.status === 'booked' ? 'is-booked' : ''}">
    <span class="pump-head">${p.status === 'booked' ? 'Pump booked' : 'SL to arrange pump'}</span>
    <label class="sr-only" for="pump-st-${esc(o.id)}">Pump status</label>
    <select id="pump-st-${esc(o.id)}" class="input pump-select" data-pump="status" data-id="${esc(o.id)}" data-key="pump-st:${esc(o.id)}">
      <option value="todo" ${p.status !== 'booked' ? 'selected' : ''}>To arrange</option>
      <option value="booked" ${p.status === 'booked' ? 'selected' : ''}>Booked</option>
    </select>
    <label class="sr-only" for="pump-nt-${esc(o.id)}">Pump details</label>
    <input id="pump-nt-${esc(o.id)}" class="input pump-note" data-pump="note" data-id="${esc(o.id)}" data-key="pump-nt:${esc(o.id)}" placeholder="Pump company, time, price agreed" value="${esc(p.note)}">
  </div>`;
}

function row(o) {
  const st = STATUSES[o.status];
  const isNew = o.source === 'shop' && o.status === 'waiting';
  const isTomorrow = o.slot?.key === tomorrowKey() && o.status !== 'declined';
  const tel = o.phone ? `<a href="tel:${esc(o.phone.replace(/[^\d+]/g, ''))}">${esc(o.phone)}</a>` : '';
  const callNote = isTomorrow && o.status === 'waiting'
    ? `<p class="call-note">Delivery is tomorrow: phone ${esc(o.name || o.who)}${tel ? ' on ' + tel : ''} to agree any change.</p>` : '';
  const contact = o.phone
    ? `<a href="tel:${esc(o.phone.replace(/[^\d+]/g, ''))}">${esc(o.phone)}</a>`
    : esc(o.contact);
  const extras = [o.consistency, o.stone, o.fibres ? 'fibres' : '', ...(o.extras || [])].filter(Boolean).join(' · ');
  const offered = o.status === 'offered' && o.offeredSlot ? `<span class="p-sub-line">Offered: ${esc(slotText(o.offeredSlot))}</span>` : '';
  const actions = o.status === 'waiting'
    ? `<div class="p-actions">
        <button type="button" class="btn btn-green" data-act="confirm" data-id="${esc(o.id)}" data-key="confirm:${esc(o.id)}">Confirm</button>
        <button type="button" class="btn btn-outline" data-act="offer" data-id="${esc(o.id)}" data-key="offer:${esc(o.id)}">Offer other time</button>
        <button type="button" class="btn btn-outline btn-decline" data-act="decline" data-id="${esc(o.id)}" data-key="decline:${esc(o.id)}" aria-label="Decline request from ${esc(o.who)}">Decline</button>
      </div>`
    : `<div class="p-done">
        <button type="button" class="link-btn" data-act="message" data-id="${esc(o.id)}" data-key="message:${esc(o.id)}">Show customer message</button>
        <button type="button" class="link-btn" data-act="undo" data-id="${esc(o.id)}" data-key="undo:${esc(o.id)}">Undo</button>
      </div>`;
  return `<tr class="${isNew ? 'is-new' : ''} ${isTomorrow ? 'is-tomorrow' : ''}">
    <td data-col="slot">${isTomorrow ? '<span class="tomorrow-tag">Tomorrow</span>' : ''}${esc(slotText(o.slot))}${offered}</td>
    <td data-col="customer"><span class="p-strong">${esc(o.who)}</span>${isNew ? '<span class="new-tag">New</span>' : ''}<span class="p-sub-line">${esc(o.pc)} · ${contact}</span></td>
    <td data-col="job"><span>${esc(o.job)}</span>${o.note ? `<span class="p-sub-line">${esc(o.note)}</span>` : ''}${barrowCheck(o)}${pumpBox(o)}</td>
    <td class="desk p-strong" data-col="mix">${esc(o.mix)}${extras ? `<span class="p-sub-line" style="font-weight:400">${esc(extras)}</span>` : ''}</td>
    <td class="desk num" data-col="vol">${o.volume.toFixed(1)} m³</td>
    <td class="desk" data-col="offload">${needsSLPump(o) || needsBarrowCheck(o) ? `<span class="pump-flag">${esc(o.offload)}</span>` : esc(o.offload)}</td>
    <td class="desk num" data-col="est">${money(o.estimate)}</td>
    <td data-col="status"><span class="badge badge-${o.status}">${st.label}</span></td>
    <td data-col="facts"><span class="p-strong">${esc(o.mix)}</span><span>${o.volume.toFixed(1)} m³</span><span class="${needsSLPump(o) || needsBarrowCheck(o) ? 'pump-flag' : ''}">${esc(o.offload)}</span><span>${money(o.estimate)} excl. BTW</span>${extras ? `<span class="p-sub-line" style="flex-basis:100%">${esc(extras)}</span>` : ''}</td>
    <td data-col="actions">${callNote}${actions}</td>
  </tr>`;
}

function render() {
  const activeKey = document.activeElement?.dataset?.key;
  const c = counts(orders);
  $('c-waiting').innerHTML = `<strong>${c.waiting}</strong> waiting`;
  $('c-confirmed').innerHTML = `<strong>${c.confirmed}</strong> confirmed`;
  document.title = (c.waiting ? `(${c.waiting}) ` : '') + 'Planner inbox | SL Materials';
  document.querySelectorAll('[data-filter]').forEach((b) => {
    const f = b.dataset.filter;
    b.innerHTML = `${FILTER_LABELS[f]}<span class="n">${c[f]}</span>`;
    b.setAttribute('aria-pressed', String(f === filter));
  });
  const list = orders
    .filter((o) => filter === 'all' || o.status === filter)
    .sort((a, b) => slotSortKey(a.slot).localeCompare(slotSortKey(b.slot)));
  $('rows').innerHTML = list.map(row).join('');
  $('empty').hidden = list.length > 0;
  if (activeKey) document.querySelector(`[data-key="${CSS.escape(activeKey)}"]`)?.focus({ preventScroll: true });
}

// ---------- Toast: what the customer would receive ----------

let toastTimer;
function showMessage(o) {
  const msg = customerMessage(o);
  if (!msg) return;
  const t = $('toast');
  t.innerHTML = `<div class="t-head"><strong>Message to ${esc(o.name || o.who)} · preview, not sent</strong><button type="button" id="toast-close">Close</button></div><div class="t-msg">${esc(msg)}</div>`;
  t.hidden = false;
  $('toast-close').addEventListener('click', () => { t.hidden = true; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 12000);
}

// ---------- Actions ----------

function update(id, action, payload, focusKey) {
  const i = orders.findIndex((o) => o.id === id);
  if (i < 0) return;
  orders[i] = applyAction(orders[i], action, payload);
  saveOrders(orders);
  render();
  if (focusKey) document.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.focus();
  if (action !== 'undo') showMessage(orders[i]);
}

$('rows').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const { act, id } = b.dataset;
  const o = orders.find((x) => x.id === id);
  if (!o) return;
  if (act === 'offer') return openOffer(o, b);
  if (act === 'message') return showMessage(o);
  // After confirm or decline the action buttons go, so move focus to that row's Undo.
  const focusKey = act === 'undo' ? `confirm:${id}` : `undo:${id}`;
  update(id, act, {}, focusKey);
});

document.querySelector('.filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  filter = b.dataset.filter;
  render();
});

$('reset').addEventListener('click', () => {
  if (!confirm('Replace every order on this page with the sample data?')) return;
  orders = resetOrders();
  render();
});

// Pump status and notes: saved on change, without redrawing while typing.
$('rows').addEventListener('change', (e) => {
  const el = e.target.closest('[data-pump]');
  if (!el) return;
  const i = orders.findIndex((o) => o.id === el.dataset.id);
  if (i < 0) return;
  orders[i] = setPump(orders[i], { [el.dataset.pump]: el.value });
  saveOrders(orders);
  if (el.dataset.pump === 'status') render();
});

// New orders placed in the shop in another tab: refresh and show an alert.
// (Live version: email or push notification to the planners.)
function alertNew(o) {
  const t = $('toast');
  t.innerHTML = `<div class="t-head"><strong>New order · ${esc(slotText(o.slot))}</strong><button type="button" id="toast-close">Close</button></div><div class="t-msg">${esc(o.who)}, ${esc(o.pc)}: ${o.volume.toFixed(1)} m³ ${esc(o.mix)}, ${esc(o.offload)}.</div>`;
  t.hidden = false;
  $('toast-close').addEventListener('click', () => { t.hidden = true; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 12000);
}
window.addEventListener('storage', () => {
  const known = new Set(orders.map((o) => o.id));
  orders = loadOrders();
  render();
  const fresh = orders.filter((o) => !known.has(o.id));
  if (fresh.length && !dialog.open) alertNew(fresh[fresh.length - 1]);
});

// ---------- Offer another time ----------

const dialog = $('offer');
const offerDays = nextDeliveryDays(new Date(), 6, CONFIG.locale);
let offering = null;
let pick = { day: null, time: 'am' };
let returnFocus = null;

function renderOffer() {
  const o = offering;
  $('offer-days').innerHTML = offerDays.map((d) => {
    const same = o.slot?.key === d.key;
    return `<button type="button" class="opt opt-day" data-day="${d.key}" aria-pressed="${pick.day === d.key}">
      <span class="dow">${esc(d.dow)}</span><span class="dm">${esc(d.dm)}</span><span class="extra">${same ? 'Requested' : d.saturday ? 'Saturday' : ''}</span></button>`;
  }).join('');
  $('offer-times').querySelectorAll('[data-time]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.time === pick.time)));
  const sameSlot = pick.day === o.slot?.key && pick.time === o.slot?.time;
  $('offer-send').disabled = !pick.day || sameSlot;
  $('offer-send').textContent = sameSlot ? 'Choose a different slot' : 'Send offer';
}

function openOffer(o, trigger) {
  offering = o;
  returnFocus = trigger;
  $('toast').hidden = true;
  pick = { day: null, time: o.slot?.time === 'pm' ? 'am' : 'pm' };
  $('offer-for').textContent = `${o.who}, ${o.pc} · requested ${slotText(o.slot)} · ${o.volume.toFixed(1)} m³ ${o.mix}`;
  renderOffer();
  dialog.showModal();
}

$('offer-days').addEventListener('click', (e) => {
  const b = e.target.closest('[data-day]');
  if (!b) return;
  pick.day = b.dataset.day;
  renderOffer();
  $('offer-days').querySelector(`[data-day="${pick.day}"]`)?.focus();
});
$('offer-times').addEventListener('click', (e) => {
  const b = e.target.closest('[data-time]');
  if (!b) return;
  pick.time = b.dataset.time;
  renderOffer();
  b.focus();
});
$('offer-cancel').addEventListener('click', () => dialog.close());
$('offer-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const d = offerDays.find((x) => x.key === pick.day);
  if (!d || !offering) return;
  const id = offering.id;
  dialog.close();
  update(id, 'offer', { slot: { key: d.key, dow: d.dow, dm: d.dm, time: pick.time } }, `undo:${id}`);
});
dialog.addEventListener('close', () => {
  if (offering && document.activeElement === document.body) returnFocus?.focus();
  offering = null;
});

render();
