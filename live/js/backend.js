// Connection to Supabase: where orders are stored, planner logins, and alert sign-up.
// The key below is the public ("publishable") key. It is safe in the page: the database
// rules only let visitors add an order, and only signed-in planners can read or change them.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const URL = 'https://jeojeuqaduwefgsjyygu.supabase.co';
const KEY = 'sb_publishable_4WyF_zZ6YvdrVFbuX37Mjg_jRG1j710';
// Public half of the push key pair (the private half is a secret in Supabase).
const VAPID_PUBLIC = 'BKb4QZaN_CbGpDktgpi-bauaFDG10XSZklbQJpBFFygPzcSPrdf9vooW8ihHEadSgFtzwV5qYWhTICGYkIGQ3fM';

export const db = createClient(URL, KEY);

// ---- Orders ----

// From the shop. Visitors cannot read orders back, so nothing is returned.
export async function submitOrder(order) {
  const { error } = await db.from('orders').insert({ id: order.id, status: 'waiting', data: order });
  if (error) throw error;
}

// Fill in anything missing, so one incomplete order can never stop the list from showing.
const fromRow = (r) => {
  const d = r.data || {};
  return {
    ...d,
    id: r.id,
    status: r.status,
    who: d.who || d.name || 'Customer',
    pc: d.pc || '',
    job: d.job || '',
    mix: d.mix || '?',
    offload: d.offload || '',
    volume: Number(d.volume) || 0,
    estimate: Number(d.estimate) || 0,
    hold: Number(d.hold) || 0,
    extras: Array.isArray(d.extras) ? d.extras : [],
  };
};

export async function fetchOrders() {
  const { data, error } = await db.from('orders').select('id, status, data').order('created_at');
  if (error) throw error;
  return data.map(fromRow);
}

export async function saveOrder(order) {
  const { error } = await db.from('orders')
    .update({ status: order.status, data: order, updated_at: new Date().toISOString() })
    .eq('id', order.id);
  if (error) throw error;
}

// Calls back with (order, isNew) whenever an order is added or changed by anyone.
export function watchOrders(cb) {
  return db.channel('orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (p) => {
      if (p.new?.id) cb(fromRow(p.new), p.eventType === 'INSERT');
    })
    .subscribe();
}

// ---- Planner login ----

export const signIn = (email, password) => db.auth.signInWithPassword({ email, password });
export const signOut = () => db.auth.signOut();
export const setPassword = (password) => db.auth.updateUser({ password });
export const sendReset = (email) => db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
export const getSession = async () => (await db.auth.getSession()).data.session;
export const onAuth = (cb) => db.auth.onAuthStateChange((event, session) => cb(event, session));

// ---- Push alerts on this device ----

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
// iPhone/iPad only allow web push once the page is added to the Home Screen.
export const needsHomeScreen = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone;

function keyBytes(b64) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration('sw.js');
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

export async function enablePush() {
  const reg = await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;
  if ((await Notification.requestPermission()) !== 'granted') return 'blocked';
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
  const json = sub.toJSON();
  const { error } = await db.from('push_subscriptions').upsert({ endpoint: json.endpoint, subscription: json });
  if (error) throw error;
  return 'on';
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('sw.js');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  return 'off';
}
