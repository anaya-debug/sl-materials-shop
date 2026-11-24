// Stripe tells us when an invoice is paid (or fails, or is cancelled), so the planner page can show it.
// Set up in Stripe: Developers > Webhooks > Add endpoint
//   URL:    https://jeojeuqaduwefgsjyygu.supabase.co/functions/v1/stripe-webhook
//   Events: invoice.paid, invoice.payment_failed, invoice.voided, invoice.marked_uncollectible
// Secrets: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (whsec_..., shown once the endpoint exists).
// Deploy with --no-verify-jwt: Stripe has no Supabase login, it proves itself with its signature instead.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import Stripe from 'npm:stripe@17.7.0';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const STATUS: Record<string, string> = {
  'invoice.paid': 'paid',
  'invoice.payment_failed': 'failed',
  'invoice.voided': 'cancelled',
  'invoice.marked_uncollectible': 'unpaid',
};

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!sig || !secret || !key) return new Response('not set up', { status: 400 });
  const stripe = new Stripe(key);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), sig, secret);
  } catch {
    return new Response('bad signature', { status: 400 });
  }

  const status = STATUS[event.type];
  if (!status) return new Response('ignored', { status: 200 });
  const inv = event.data.object as Stripe.Invoice;
  const id = inv.metadata?.order_id;
  if (!id) return new Response('not a shop invoice', { status: 200 });

  const { data: row } = await db.from('orders').select('data').eq('id', id).maybeSingle();
  if (!row) return new Response('order not found', { status: 200 });
  const o = row.data as Record<string, any>;
  // Only update the invoice this order actually has (an old voided one must not overwrite a newer one).
  if (o.invoice?.id && o.invoice.id !== inv.id) return new Response('older invoice', { status: 200 });

  const invoice = { ...(o.invoice ?? {}), id: inv.id, number: inv.number, url: inv.hosted_invoice_url, status,
    ...(status === 'paid' ? { paidAt: new Date(event.created * 1000).toISOString() } : {}) };
  const { error } = await db.from('orders').update({ data: { ...o, invoice }, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return new Response(error.message, { status: 500 }); // Stripe retries
  return new Response('ok', { status: 200 });
});
