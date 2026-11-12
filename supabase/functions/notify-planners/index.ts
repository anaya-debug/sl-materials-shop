// Alerts every planner about a new order: a push notification on each device that
// turned alerts on, plus an email to every planner (once a RESEND_API_KEY is set).
// Called by the database when an order is added. It alerts once per order only,
// so a repeated or outside call does nothing.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const SITE = Deno.env.get('SITE_URL') ?? 'https://sl-materials-webshop.com/live';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

webpush.setVapidDetails(
  'mailto:' + (Deno.env.get('VAPID_CONTACT') ?? 'betonplanning@sl-materials.nl'),
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

const TIMES: Record<string, string> = { am: '7:00–12:00', pm: '12:00–16:00', any: 'any time' };
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

Deno.serve(async (req) => {
  let id = '';
  try { id = String((await req.json()).id ?? ''); } catch { /* bad body */ }
  if (!id) return new Response('missing id', { status: 400 });

  // Claim the order: only the first call for an order gets a row back.
  const { data: claimed, error } = await db.from('orders')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', id).is('notified_at', null)
    .select('data').maybeSingle();
  if (error) return new Response(error.message, { status: 500 });
  if (!claimed) return new Response('already sent', { status: 200 });

  const o = claimed.data as Record<string, any>;
  const slot = o.slot ? `${o.slot.dow} ${o.slot.dm}, ${TIMES[o.slot.time] ?? ''}` : 'no slot';
  const title = `New order · ${slot}`;
  const body = `${o.name || o.who || 'Customer'}, ${o.pc ?? ''}: ${Number(o.volume ?? 0).toFixed(1)} m³ ${o.mix ?? ''}, ${o.offload ?? ''}`;
  const url = `${SITE}/planner.html`;

  // Push to every planner device. Remove devices that have been switched off or uninstalled.
  const { data: subs } = await db.from('push_subscriptions').select('endpoint, subscription');
  let pushed = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify({ title, body, url, tag: id }), { TTL: 86400, urgency: 'high' });
      pushed++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    }
  }));

  // Email every planner, as a backup to push. Needs a Resend account (resend.com).
  let emailed = 0;
  const info: Record<string, unknown> = {};
  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  info.emailKey = !!resendKey;
  if (resendKey) {
    const { data: users, error: usersError } = await db.auth.admin.listUsers({ perPage: 200 });
    if (usersError) info.usersError = usersError.message;
    const to = (users?.users ?? []).map((u) => u.email).filter(Boolean) as string[];
    info.planners = to.length;
    if (to.length) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: Deno.env.get('EMAIL_FROM') ?? 'SL Materials Shop <onboarding@resend.dev>',
          to,
          subject: title,
          html: `<p><strong>${esc(title)}</strong></p><p>${esc(body)}</p>${o.note ? `<p>Note: ${esc(o.note)}</p>` : ''}<p><a href="${url}">Open the planner inbox</a></p>`,
        }),
      });
      if (res.ok) emailed = to.length;
      else info.emailError = `${res.status} ${(await res.text()).slice(0, 300)}`;
    }
  }

  // The reply is kept by the database (net._http_response), which helps when checking a missed alert.
  return Response.json({ pushed, emailed, ...info });
});
