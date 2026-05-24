'use client';
import { useEffect, useRef } from 'react';
import { supabaseBrowser } from './supabase-browser';

/**
 * Subscribe to a table and reactively patch rows into the React state.
 * Includes:
 *  - logging of channel status so you can confirm realtime is connected in DevTools
 *  - a window-focus refetch hook (fires `onRefetch` when the tab regains focus)
 *  - a polling fallback that fires `onRefetch` every `pollMs` if realtime can't connect
 */
export function useRealtimeTable<T extends { id: string }>(
  table: string,
  setRows: React.Dispatch<React.SetStateAction<T[]>>,
  filter?: string,
  opts?: { onRefetch?: () => void; pollMs?: number; debug?: boolean },
) {
  const connectedRef = useRef(false);
  const onRefetch = opts?.onRefetch;
  const pollMs = opts?.pollMs ?? 15000;

  useEffect(() => {
    const supa = supabaseBrowser();
    const ch = supa.channel(`rt-${table}-${filter ?? 'all'}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload) => {
          if (opts?.debug) console.log(`[rt:${table}]`, payload.eventType, payload.new ?? payload.old);
          const n = payload.new as T;
          const o = payload.old as T;
          if (payload.eventType === 'INSERT') {
            setRows(r => r.some(x => x.id === n.id) ? r : [...r, n]);
          } else if (payload.eventType === 'UPDATE') {
            setRows(r => r.map(x => x.id === n.id ? n : x));
          } else if (payload.eventType === 'DELETE') {
            setRows(r => r.filter(x => x.id !== o.id));
          }
        })
      .subscribe((status) => {
        if (opts?.debug) console.log(`[rt:${table}] status:`, status);
        connectedRef.current = status === 'SUBSCRIBED';
      });

    // Refetch on focus — cheap correctness backstop
    const onFocus = () => { if (document.visibilityState === 'visible') onRefetch?.(); };
    document.addEventListener('visibilitychange', onFocus);

    // Polling fallback when realtime isn't connected (network, RLS, etc.)
    const poll = setInterval(() => { if (!connectedRef.current) onRefetch?.(); }, pollMs);

    return () => {
      supa.removeChannel(ch);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter]);
}

/** Single-row variant for pages like Settings. */
export function useRealtimeRow<T extends { id: string }>(
  table: string,
  id: string,
  onChange: (row: T) => void,
  opts?: { debug?: boolean },
) {
  useEffect(() => {
    const supa = supabaseBrowser();
    const ch = supa.channel(`rt-row-${table}-${id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table, filter: `id=eq.${id}` },
        (payload) => {
          if (opts?.debug) console.log(`[rt:row:${table}]`, payload.new);
          onChange(payload.new as T);
        })
      .subscribe((status) => { if (opts?.debug) console.log(`[rt:row:${table}] status:`, status); });
    return () => { supa.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, id]);
}
