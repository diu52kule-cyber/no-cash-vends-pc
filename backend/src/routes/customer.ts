import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supa } from '../lib/supabase';

const r = Router();

// ── helper ─────────────────────────────────────────────────────────
const ah = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

const httpErr = (status: number, message: string) => Object.assign(new Error(message), { status });

async function getOutletBySlug(slug: string) {
  const { data, error } = await supa.from('outlets').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!data) throw httpErr(404, 'Outlet not found');
  return data;
}

// ── GET /api/c/outlets/:slug ───────────────────────────────────────
r.get('/outlets/:slug', ah(async (req, res) => {
  const outlet = await getOutletBySlug(req.params.slug);
  // strip anything sensitive (none right now, but future-proof)
  res.json({
    id: outlet.id,
    slug: outlet.slug,
    name: outlet.name,
    tagline: outlet.tagline,
    theme: outlet.theme,
    features: outlet.features,
    currency: outlet.currency,
  });
}));

// ── GET /api/c/outlets/:slug/tables/:qrUid ─────────────────────────
r.get('/outlets/:slug/tables/:qrUid', ah(async (req, res) => {
  const outlet = await getOutletBySlug(req.params.slug);
  const { data, error } = await supa.from('tables')
    .select('id, number, capacity, zone, qr_uid')
    .eq('outlet_id', outlet.id).eq('qr_uid', req.params.qrUid).maybeSingle();
  if (error) throw error;
  if (!data) throw httpErr(404, 'Table not found');
  res.json(data);
}));

// ── GET /api/c/outlets/:slug/menu ──────────────────────────────────
r.get('/outlets/:slug/menu', ah(async (req, res) => {
  const outlet = await getOutletBySlug(req.params.slug);
  const [cats, items] = await Promise.all([
    supa.from('menu_categories').select('id, name, sort').eq('outlet_id', outlet.id).order('sort'),
    supa.from('menu_items')
      .select('id, category_id, name, description, price, serving, emoji, image_url, prep_time, is_veg, available, sort')
      .eq('outlet_id', outlet.id).eq('available', true).order('sort'),
  ]);
  if (cats.error) throw cats.error;
  if (items.error) throw items.error;
  res.json({ categories: cats.data, items: items.data });
}));

// ── POST /api/c/customers ──────────────────────────────────────────
const customerSchema = z.object({
  outletSlug: z.string(),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(5).max(20),
});
r.post('/customers', ah(async (req, res) => {
  const { outletSlug, name, phone } = customerSchema.parse(req.body);
  const outlet = await getOutletBySlug(outletSlug);
  // upsert on (outlet_id, phone)
  const { data, error } = await supa.from('customers')
    .upsert({ outlet_id: outlet.id, name, phone }, { onConflict: 'outlet_id,phone' })
    .select('id, name, phone').single();
  if (error) throw error;
  res.json(data);
}));

// ── GET /api/c/orders/active?tableId=... ──────────────────────────
r.get('/orders/active', ah(async (req, res) => {
  const tableId = String(req.query.tableId ?? '');
  if (!tableId) throw httpErr(400, 'tableId required');
  const { data: order, error } = await supa.from('orders')
    .select('id, bill_no, status, opened_at')
    .eq('table_id', tableId).eq('status', 'open').maybeSingle();
  if (error) throw error;
  if (!order) return res.json(null);
  const { data: items, error: e2 } = await supa.from('order_items')
    .select('id, name_snapshot, price_at_order, qty, status, remark, added_by, created_at')
    .eq('order_id', order.id).order('created_at');
  if (e2) throw e2;
  res.json({ ...order, items });
}));

// ── POST /api/c/orders ─────────────────────────────────────────────
// Body: { outletSlug, tableId, customerId, items: [{ menuItemId, qty, remark? }] }
// Creates an open order if none exists, then appends items.
const orderSchema = z.object({
  outletSlug: z.string(),
  tableId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    qty: z.number().int().positive().max(50),
    remark: z.string().max(200).optional(),
  })).min(1),
});
r.post('/orders', ah(async (req, res) => {
  const body = orderSchema.parse(req.body);
  const outlet = await getOutletBySlug(body.outletSlug);

  // fetch menu items first so we can drop anything unavailable BEFORE touching an order
  const ids = body.items.map(i => i.menuItemId);
  const { data: menu, error: mErr } = await supa.from('menu_items')
    .select('id, name, price, available')
    .eq('outlet_id', outlet.id).in('id', ids);
  if (mErr) throw mErr;
  const byId = new Map(menu!.map(m => [m.id, m]));

  // Skip (don't reject) items that are unavailable or no longer on the menu.
  const skipped: string[] = [];
  const rows = body.items.flatMap(i => {
    const m = byId.get(i.menuItemId);
    if (!m || !m.available) {
      if (m) skipped.push(m.name);
      return [];
    }
    return [{
      menu_item_id: m.id,
      name_snapshot: m.name,
      price_at_order: m.price,
      qty: i.qty,
      remark: i.remark ?? null,
      added_by: 'customer' as const,
    }];
  });

  // Nothing orderable — don't open/append an order; tell the client what was dropped.
  if (rows.length === 0) {
    return res.json({ orderId: null, billNo: null, addedItems: [], skipped });
  }

  // find or create open order for this table
  let { data: order, error: oErr } = await supa.from('orders')
    .select('*').eq('table_id', body.tableId).eq('status', 'open').maybeSingle();
  if (oErr) throw oErr;
  if (!order) {
    const ins = await supa.from('orders').insert({
      outlet_id: outlet.id,
      table_id: body.tableId,
      customer_id: body.customerId ?? null,
    }).select('*').single();
    if (ins.error) throw ins.error;
    order = ins.data;
  } else if (body.customerId && !order.customer_id) {
    await supa.from('orders').update({ customer_id: body.customerId }).eq('id', order.id);
  }

  const { data: inserted, error: iErr } = await supa.from('order_items')
    .insert(rows.map(row => ({ ...row, order_id: order!.id }))).select('*');
  if (iErr) throw iErr;

  res.json({ orderId: order.id, billNo: order.bill_no, addedItems: inserted, skipped });
}));

// ── POST /api/c/waiter-calls ───────────────────────────────────────
const callSchema = z.object({
  outletSlug: z.string(),
  tableId: z.string().uuid(),
  reason: z.string().max(120).optional(),
});
r.post('/waiter-calls', ah(async (req, res) => {
  const { outletSlug, tableId, reason } = callSchema.parse(req.body);
  const outlet = await getOutletBySlug(outletSlug);
  // dedupe: if there's already an open call for this table in last 2 mins, return it
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: existing } = await supa.from('waiter_calls')
    .select('id').eq('table_id', tableId).eq('status', 'open').gte('created_at', since).maybeSingle();
  if (existing) return res.json({ id: existing.id, deduped: true });

  const { data, error } = await supa.from('waiter_calls')
    .insert({ outlet_id: outlet.id, table_id: tableId, reason: reason ?? null })
    .select('id').single();
  if (error) throw error;
  res.json({ id: data.id });
}));

export default r;
