'use client';
import { useMemo, useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { AskAIModal } from './AskAIModal';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

type Order = { id: string; opened_at: string; closed_at: string | null; status: string; table_id: string };
type Item = { order_id: string; name_snapshot: string; price_at_order: number; qty: number; status: string; created_at: string; menu_item_id: string | null };
type MenuItem = { id: string; name: string; category_id: string | null };
type Category = { id: string; name: string };

type Range = '7d' | '30d';

export function AnalyticsClient({
  outletName, currency, orders, items, menuItems, categories,
}: {
  outletName: string; currency: string;
  orders: Order[]; items: Item[]; menuItems: MenuItem[]; categories: Category[];
}) {
  const [range, setRange] = useState<Range>('30d');
  const [askOpen, setAskOpen] = useState(false);

  const filtered = useMemo(() => {
    const days = range === '7d' ? 7 : 30;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const ords = orders.filter(o => new Date(o.opened_at).getTime() >= since);
    const oset = new Set(ords.map(o => o.id));
    const its = items.filter(i => oset.has(i.order_id) && i.status !== 'cancelled');
    return { ords, its };
  }, [orders, items, range]);

  // Headline stats
  const headline = useMemo(() => {
    const revenue = filtered.its.reduce((s, i) => s + i.price_at_order * i.qty, 0);
    const covers = filtered.ords.length;
    const avgSpend = covers ? Math.round(revenue / covers) : 0;
    const itemsServed = filtered.its.reduce((s, i) => s + i.qty, 0);
    return { revenue, covers, avgSpend, itemsServed };
  }, [filtered]);

  // Revenue trend (daily)
  const trend = useMemo(() => {
    const days = range === '7d' ? 7 : 30;
    const labels: string[] = []; const values: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const start = d.getTime(); const end = start + 24 * 60 * 60 * 1000;
      const day = filtered.its.filter(it => {
        const t = new Date(it.created_at).getTime();
        return t >= start && t < end;
      });
      labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
      values.push(day.reduce((s, i) => s + i.price_at_order * i.qty, 0));
    }
    return { labels, values };
  }, [filtered, range]);

  // Top items
  const topItems = useMemo(() => {
    const map = new Map<string, { qty: number; rev: number; name: string }>();
    filtered.its.forEach(i => {
      const cur = map.get(i.name_snapshot) ?? { qty: 0, rev: 0, name: i.name_snapshot };
      cur.qty += i.qty; cur.rev += i.price_at_order * i.qty;
      map.set(i.name_snapshot, cur);
    });
    return [...map.values()].sort((a, b) => b.rev - a.rev).slice(0, 8);
  }, [filtered]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const menuById = new Map(menuItems.map(m => [m.id, m]));
    const catById = new Map(categories.map(c => [c.id, c.name]));
    const sums = new Map<string, number>();
    filtered.its.forEach(i => {
      const mi = i.menu_item_id ? menuById.get(i.menu_item_id) : null;
      const cat = mi?.category_id ? (catById.get(mi.category_id) ?? 'Other') : 'Other';
      sums.set(cat, (sums.get(cat) ?? 0) + i.price_at_order * i.qty);
    });
    const labels = [...sums.keys()];
    const values = labels.map(l => sums.get(l)!);
    return { labels, values };
  }, [filtered, menuItems, categories]);

  // Hourly heatmap (day of week × hour of day)
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    filtered.its.forEach(i => {
      const d = new Date(i.created_at);
      grid[d.getDay()][d.getHours()] += 1;
    });
    let max = 0; grid.forEach(r => r.forEach(v => { if (v > max) max = v; }));
    return { grid, max };
  }, [filtered]);

  // Peak hours (top 5)
  const peakHours = useMemo(() => {
    const hourly = Array(24).fill(0);
    filtered.its.forEach(i => { hourly[new Date(i.created_at).getHours()] += i.qty; });
    return hourly.map((v, h) => ({ hour: h, v })).sort((a, b) => b.v - a.v).slice(0, 5);
  }, [filtered]);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const chartCommon = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#17171b', borderColor: '#26262d', borderWidth: 1, padding: 10, titleColor: '#f5f5f7', bodyColor: '#b5b5be' },
    },
    scales: {
      x: { ticks: { color: '#7a7a85', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#7a7a85', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
    },
  } as const;

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Analytics</h1>
          <p>{outletName} · last {range === '7d' ? '7 days' : '30 days'}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg2)', border: '1px solid var(--border)', padding: 4, borderRadius: 10 }}>
            {(['7d', '30d'] as Range[]).map(r => (
              <button key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12,
                  background: range === r ? 'var(--brand-dim)' : 'transparent',
                  color: range === r ? 'var(--brand)' : 'var(--text3)',
                }}>{r === '7d' ? '7 days' : '30 days'}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setAskOpen(true)}>✨ Ask AI</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="lbl">Total revenue</div><div className="val gold">{currency}{headline.revenue.toLocaleString('en-IN')}</div></div>
        <div className="stat"><div className="lbl">Tables served</div><div className="val">{headline.covers}</div></div>
        <div className="stat"><div className="lbl">Avg / bill</div><div className="val">{currency}{headline.avgSpend.toLocaleString('en-IN')}</div></div>
        <div className="stat"><div className="lbl">Items served</div><div className="val">{headline.itemsServed.toLocaleString('en-IN')}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Revenue trend</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>{trend.values.reduce((a, b) => a + b, 0) === 0 ? 'No data yet — place orders to see trend' : 'Daily, last ' + (range === '7d' ? 7 : 30) + ' days'}</div>
          <div style={{ height: 220 }}>
            <Line data={{
              labels: trend.labels,
              datasets: [{
                data: trend.values,
                borderColor: '#c8a96e', backgroundColor: 'rgba(200,169,110,0.12)',
                fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2,
              }],
            }} options={chartCommon as any} />
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Category mix</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>Revenue split</div>
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {categoryBreakdown.labels.length ? (
              <Doughnut data={{
                labels: categoryBreakdown.labels,
                datasets: [{
                  data: categoryBreakdown.values,
                  backgroundColor: ['#c8a96e', '#5b8def', '#4caf7d', '#e8a030', '#e85a5a', '#9070d0', '#54c7ec', '#b5b5be'],
                  borderColor: '#17171b', borderWidth: 2,
                }],
              }} options={{ ...chartCommon, scales: undefined, plugins: { ...chartCommon.plugins, legend: { display: true, position: 'bottom', labels: { color: '#b5b5be', font: { size: 11 }, boxWidth: 10 } } } } as any} />
            ) : <div style={{ color: 'var(--text3)', fontSize: 12 }}>No data</div>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Top selling items</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>By revenue</div>
          {topItems.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 12 }}>No data</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topItems.map(it => {
                const max = topItems[0].rev || 1;
                return (
                  <div key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 130, fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(it.rev / max) * 100}%`, background: 'linear-gradient(90deg, var(--brand), var(--brand2))', borderRadius: 4, transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ width: 70, textAlign: 'right', fontSize: 12, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{currency}{it.rev.toLocaleString('en-IN')}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Peak hours</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>Busiest slots</div>
          {peakHours.every(p => p.v === 0) ? <div style={{ color: 'var(--text3)', fontSize: 12 }}>No data</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {peakHours.map(p => (
                <div key={p.hour} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg3)', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--text2)' }}>{String(p.hour).padStart(2, '0')}:00 – {String((p.hour + 1) % 24).padStart(2, '0')}:00</span>
                  <span style={{ color: 'var(--brand)' }}>{p.v} items</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Hourly heatmap</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>Items ordered by day × hour</div>
        <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: 2 }}>
          <div></div>
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} style={{ fontSize: 9, color: 'var(--text4)', textAlign: 'center' }}>{h % 6 === 0 ? h : ''}</div>
          ))}
          {dayNames.map((day, d) => (
            <>
              <div key={`l-${d}`} style={{ fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', paddingRight: 6 }}>{day}</div>
              {Array.from({ length: 24 }).map((_, h) => {
                const v = heatmap.grid[d][h];
                const intensity = heatmap.max ? v / heatmap.max : 0;
                return <div key={`${d}-${h}`} style={{
                  aspectRatio: '1', borderRadius: 2,
                  background: intensity ? `rgba(200,169,110,${0.15 + intensity * 0.75})` : 'var(--bg3)',
                }} title={`${day} ${h}:00 — ${v} items`} />;
              })}
            </>
          ))}
        </div>
      </div>

      {askOpen && (
        <AskAIModal
          onClose={() => setAskOpen(false)}
          context={{ outletName, currency, headline, range, topItems: topItems.slice(0, 5) }}
        />
      )}
    </>
  );
}
