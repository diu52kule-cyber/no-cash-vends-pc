// k6 load test for the DINER path (customer-site → backend API).
// Simulates real diners: arrival burst (outlet+table+menu), then polling the
// active order every ~12s like the app does, with an optional throttled order.
//
//   k6 run -e BASE_URL=https://YOUR-BACKEND.up.railway.app -e VUS=200 loadtest/customer-load.js
//   add -e DO_ORDERS=1 to also place orders (writes real rows — see cleanup.sql)
//
import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE = __ENV.BASE_URL;
const SLUG = __ENV.OUTLET || 'raasta';
const QR = __ENV.QR || 'tbl-001';
const VUS = Number(__ENV.VUS || 100);
const DO_ORDERS = __ENV.DO_ORDERS === '1';

export const options = {
  scenarios: {
    diners: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: VUS },   // ramp up
        { duration: '4m', target: VUS },   // hold (this is your real reading)
        { duration: '30s', target: 0 },    // ramp down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],        // <1% errors
    http_req_duration: ['p(95)<800'],      // 95% under 800ms
  },
};

const json = (r) => { try { return r.json(); } catch { return null; } };

export default function () {
  let tableId = null, itemIds = [];

  group('arrival', () => {
    http.get(`${BASE}/api/c/outlets/${SLUG}`);
    const t = http.get(`${BASE}/api/c/outlets/${SLUG}/tables/${QR}`);
    check(t, { 'table 200': (r) => r.status === 200 });
    const tj = json(t); tableId = tj && tj.id;
    const m = http.get(`${BASE}/api/c/outlets/${SLUG}/menu`);
    const mj = json(m); if (mj && mj.items) itemIds = mj.items.map((i) => i.id);
  });

  // browse + poll the active order a handful of times, like a seated diner
  for (let k = 0; k < 5; k++) {
    if (tableId) http.get(`${BASE}/api/c/orders/active?tableId=${tableId}`);
    sleep(12);
  }

  if (DO_ORDERS && tableId && itemIds.length) {
    const body = JSON.stringify({
      outletSlug: SLUG, tableId, customerId: null,
      items: [{ menuItemId: itemIds[Math.floor(Math.random() * itemIds.length)], qty: 1 }],
    });
    const r = http.post(`${BASE}/api/c/orders`, body, { headers: { 'Content-Type': 'application/json' } });
    check(r, { 'order ok': (x) => x.status === 200 });
  }
}
