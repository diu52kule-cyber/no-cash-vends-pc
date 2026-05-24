'use client';
import { useEffect, useRef } from 'react';
import { supabaseBrowser } from './supabase-browser';

/**
 * Subscribe to a table and reactively patch rows into React state.
 *
 * Critical: awaits the session JWT BEFORE channel.subscribe(). If we don't,
 * Supabase Realtime treats the connection as anonymous, RLS denies SELECT,
 * and zero postgres_changes events are delivered (silently).
 */
export function useRealtimeTable<T extends { id: string }>(
  table: string,
  setRows: React.Dispatch<React.SetStateAction<T[]>>,
  filter?: string,
  opts?: { onRefetch?: () => void | Promise<void>; pollMs?: number; debug?: boolean },
) {
  const connectedRef = useRef(false);
  const onRefetch = opts?.onRefetch;
  const pollMs = opts?.pollMs ?? 15000;
  const debug = opts?.debug ?? true; // default ON until live updates are verified

  useEffect(() => {
    const supa = supabaseBrowser();
    let cancelled = false;
    let channel: ReturnType<typeof supa.channel> | null = null;

    (async () => {
      // 1. Ensure realtime has the user's JWT before subscribing
      const { data: { session } } = await supa.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supa.realtime.setAuth(session.access_token);
        if (debug) console.log(`[rt:${table}] auth set, len=${session.access_token.length}`);
      } else if (debug) {
        console.warn(`[rt:${table}] NO SESSION — realtime will be anonymous and RLS-blocked`);
      }

      // 2. Subscribe
      channel = supa.channel(`rt-${table}-${filter ?? 'all'}-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
          (payload) => {
            if (debug) console.log(`[rt:${table}]`, payload.eventType, payload.new ?? payload.old);
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
        .subscribe((status, err) => {
          if (debug) console.log(`[rt:${table}] status:`, status, err ?? '');
          connectedRef.current = status === 'SUBSCRIBED';
          if (status === 'SUBSCRIBED' && onRefetch) onRefetch();
        });
    })();

    const onFocus = () => { if (document.visibilityState === 'visible') onRefetch?.(); };
    document.addEventListener('visibilitychange', onFocus);
    const poll = setInterval(() => { if (!connectedRef.current) onRefetch?.(); }, pollMs);

    return () => {
      cancelled = true;
      if (channel) supa.removeChannel(channel);
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
  const debug = opts?.debug ?? true;
  useEffect(() => {
    const supa = supabaseBrowser();
    let cancelled = false;
    let channel: ReturnType<typeof supa.channel> | null = null;

    (async () => {
      const { data: { session } } = await supa.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) await supa.realtime.setAuth(session.access_token);

      channel = supa.channel(`rt-row-${table}-${id}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table, filter: `id=eq.${id}` },
          (payload) => {
            if (debug) console.log(`[rt:row:${table}]`, payload.new);
            onChange(payload.new as T);
          })
        .subscribe((status) => { if (debug) console.log(`[rt:row:${table}] status:`, status); });
    })();

    return () => { cancelled = true; if (channel) supa.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, id]);
}
