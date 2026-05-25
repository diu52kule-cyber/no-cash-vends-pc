'use client';
import { useState } from 'react';

type Ctx = {
  outletName: string; currency: string;
  headline: { revenue: number; covers: number; avgSpend: number; itemsServed: number };
  range: string;
  topItems: { name: string; rev: number; qty: number }[];
};

const SUGGESTIONS = [
  "What's driving my revenue this week?",
  "Which items should I push to increase margin?",
  "When are my slowest hours and what can I do?",
  "Compare my menu mix to last month",
];

// Dummy AI — generates a templated insight based on the actual data.
// In Phase 5 we'd hit Claude API server-side here.
function dummyAnswer(q: string, c: Ctx): string {
  const top = c.topItems[0]?.name ?? 'your bestseller';
  const totalRev = `${c.currency}${c.headline.revenue.toLocaleString('en-IN')}`;
  const avg = `${c.currency}${c.headline.avgSpend.toLocaleString('en-IN')}`;
  const q_ = q.toLowerCase();

  if (q_.includes('revenue') || q_.includes('driving')) {
    return `Over the ${c.range === '7d' ? 'last 7 days' : 'last 30 days'} ${c.outletName} did ${totalRev} across ${c.headline.covers} bills (avg ${avg}). Your top earner is **${top}** — about ${Math.round((c.topItems[0]?.rev ?? 0) / (c.headline.revenue || 1) * 100)}% of revenue. If you can nudge the avg-bill up by ${c.currency}50 you'd add ~${c.currency}${(50 * c.headline.covers).toLocaleString('en-IN')} for the same footfall.`;
  }
  if (q_.includes('margin') || q_.includes('push')) {
    return `Cocktails and Caribbean Specials typically carry the fattest margins. Right now they're underweight in your mix — consider a "Reggae Hour" 6-8pm with 1+1 cocktails to pull customers in earlier. Your bestselling Mains drag the most labor cost; bundle them with a ${c.currency}80 mocktail for higher ticket without slowing the kitchen.`;
  }
  if (q_.includes('slow') || q_.includes('hour')) {
    return `Your quiet windows look like weekday afternoons (3-6pm). Two cheap experiments: (a) a "Sundowner" menu — 3 small plates + 1 cocktail at ${c.currency}499, posted on Insta stories at 2pm daily; (b) corporate happy-hour QR cards dropped at offices in Dharampeth.`;
  }
  if (q_.includes('mix') || q_.includes('compare') || q_.includes('menu')) {
    return `Compared to last month, your category mix has shifted ~6pp toward Mains and away from Small Plates. That usually means dine-in groups are larger but lingering less. Quick fix: add a "Snack Hour" 5-7pm with 25% off Small Plates to bring back drinks-and-bites traffic.`;
  }
  return `Quick take on ${c.outletName} (${c.range === '7d' ? '7d' : '30d'}): revenue ${totalRev}, ${c.headline.covers} tables, avg ${avg}. ${top} is your hero — protect its margin, don't discount it. Connect a real AI key in Phase 5 for deeper analysis.`;
}

export function AskAIModal({ onClose, context }: { onClose: () => void; context: Ctx }) {
  const [q, setQ] = useState('');
  const [thread, setThread] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: `Hi! I can answer questions about your ${context.outletName} performance. (Demo mode — real Claude integration in Phase 5.)` },
  ]);
  const [thinking, setThinking] = useState(false);

  function send(text: string) {
    if (!text.trim()) return;
    setThread(t => [...t, { role: 'user', text }]);
    setQ(''); setThinking(true);
    setTimeout(() => {
      setThread(t => [...t, { role: 'ai', text: dummyAnswer(text, context) }]);
      setThinking(false);
    }, 600 + Math.random() * 600);
  }

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 540, maxWidth: '95vw', display: 'flex', flexDirection: 'column', maxHeight: '85dvh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <h2 style={{ marginBottom: 0 }}>Ask AI <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'var(--brand-dim)', color: 'var(--brand)', marginLeft: 6, verticalAlign: 'middle' }}>demo</span></h2>
          <button onClick={onClose} style={{ color: 'var(--text3)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>
          Connect a Claude API key in Phase 5 to swap dummy answers with real insights.
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
          {thread.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? 'var(--brand-dim)' : 'var(--bg3)',
              color: m.role === 'user' ? 'var(--brand)' : 'var(--text1)',
              padding: '10px 14px', borderRadius: 14,
              maxWidth: '85%', fontSize: 13, lineHeight: 1.55,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              animation: 'fadeUp 0.25s ease',
            }}>{m.text}</div>
          ))}
          {thinking && (
            <div style={{ alignSelf: 'flex-start', background: 'var(--bg3)', padding: '12px 14px', borderRadius: 14, fontSize: 13, color: 'var(--text3)' }}>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text3)', animation: 'pulseDot 1.4s ease-in-out infinite' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text3)', animation: 'pulseDot 1.4s ease-in-out 0.2s infinite' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text3)', animation: 'pulseDot 1.4s ease-in-out 0.4s infinite' }} />
              </span>
            </div>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          {thread.length <= 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--bg3)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text2)' }}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(q); } }}
              placeholder="Ask anything about your numbers…"
              style={{ flex: 1 }} autoFocus
            />
            <button className="btn btn-primary" onClick={() => send(q)} disabled={!q.trim() || thinking}>Send</button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes pulseDot { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
