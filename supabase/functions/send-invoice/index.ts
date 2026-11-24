// Sends the customer a Stripe invoice once a planner has confirmed their order.
// Called from the planner page with { id }. Only signed-in planners can call it.
// The price always comes from the order (planners never set prices). Stripe Tax adds the BTW.
// Calling it twice for the same order returns the invoice already sent; it never sends a second one.
//
// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   STRIPE_SECRET_KEY  sk_test_... while testing. A live key (sk_live_) is refused unless STRIPE_LIVE=on.
//   INVOICE_DAYS_DUE   optional, days the customer has to pay (default 7).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import Stripe from 'npm:stripe@17.7.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const TIMES: Record<string, string> = { am: '7:00–12:00', pm: '12:00–16:00', any: 'any time' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405);

  const key = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!key) return reply({ error: 'Stripe is not set up yet (no STRIPE_SECRET_KEY).' }, 503);
  if (key.startsWith('sk_live_') && Deno.env.get('STRIPE_LIVE') !== 'on') {
    return reply({ error: 'Live Stripe key refused: set STRIPE_LIVE=on when SL Materials is ready to go live.' }, 503);
  }
  const stripe = new Stripe(key);

  // Must be a signed-in planner.
  const auth = req.headers.get('Authorization') ?? '';
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return reply({ error: 'Please sign in again.' }, 401);

  let id = '';
  try { id = String((await req.json()).id ?? ''); } catch { /* bad body */ }
  if (!id) return reply({ error: 'missing id' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: row, error } = await db.from('orders').select('status, data').eq('id', id).maybeSingle();
  if (error) return reply({ error: error.message }, 500);
  if (!row) return reply({ error: 'Order not found.' }, 404);
  const o = row.data as Record<string, any>;

  if (o.invoice?.id) return reply({ invoice: o.invoice, already: true });
  if (row.status !== 'confirmed') return reply({ error: 'Confirm the order first.' }, 409);
  if (!o.email) return reply({ error: 'This order has no email address, so an invoice cannot be sent. Phone the customer.' }, 422);
  const cents = Math.round(Number(o.estimate) * 100); // estimate is stored excl. BTW
  if (!(cents > 0)) return reply({ error: 'This order has no price.' }, 422);

  const postcode = String(o.pc ?? '').trim();
  const slot = o.slot ? `${o.slot.dow} ${o.slot.dm}, ${TIMES[o.slot.time] ?? ''}` : '';
  const extras = [o.consistency, o.stone, o.fibres ? 'fibres' : '', ...(o.extras ?? [])].filter(Boolean).join(', ');
  const description = `Liberated Concrete ${o.mix ?? ''}, ${Number(o.volume ?? 0).toFixed(1)} m³` +
    (extras ? ` (${extras})` : '') + (slot ? `. Delivery ${slot}` : '') + (o.offload ? `, ${o.offload}` : '');

  // Idempotency keys stop a double click or retry from making two invoices.
  const idem = (step: string) => ({ idempotencyKey: `sl-${id}-${step}` });
  try {
    const customer = await stripe.customers.create({
      name: o.name || o.who || undefined,
      email: o.email,
      phone: o.phone || undefined,
      address: { country: 'NL', postal_code: postcode || undefined },
      preferred_locales: ['nl', 'en'],
      metadata: { order_id: id },
    }, idem('customer'));

    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: Number(Deno.env.get('INVOICE_DAYS_DUE') ?? 7),
      automatic_tax: { enabled: true },
      // Always offer iDEAL (most Dutch customers pay this way) and card, wherever the customer opens it.
      payment_settings: { payment_method_types: ['ideal', 'card'] },
      currency: 'eur',
      description: 'Thank you for your order. / Bedankt voor je bestelling.',
      metadata: { order_id: id },
      pending_invoice_items_behavior: 'exclude',
    }, idem('invoice'));

    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      currency: 'eur',
      amount: cents,
      tax_behavior: 'exclusive',
      description,
      metadata: { order_id: id },
    }, idem('item'));

    const final = await stripe.invoices.finalizeInvoice(invoice.id, {}, idem('finalize'));
    await stripe.invoices.sendInvoice(final.id, {}, idem('send'));

    const saved = {
      id: final.id,
      number: final.number,
      url: final.hosted_invoice_url,
      total: (final.total ?? 0) / 100,
      status: 'sent',
      sentAt: new Date().toISOString(),
      test: !final.livemode,
    };
    await db.from('orders').update({ data: { ...o, invoice: saved }, updated_at: new Date().toISOString() }).eq('id', id);
    return reply({ invoice: saved });
  } catch (e: any) {
    return reply({ error: `Stripe: ${e?.message ?? e}` }, 502);
  }
});
