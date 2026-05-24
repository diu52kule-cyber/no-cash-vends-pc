'use client';
import { useEffect } from 'react';
import { supabaseBrowser } from './supabase-browser';

/**
 * Subscribe to postgres_changes on a single table and dispatch INSERT/UPDATE/DELETE
 * into a React state setter. Outlet-scoped via the optional filter.
 *
 * Example:
 *   useRealtimeTable<MenuItem>('menu_items', setItems, `outlet_id=eq.${outletId}`);
 */
export function useRealtimeTable<T extends { id: string }>(
  table: string,
  setRows: React.Dispatch<React.SetStateAction<T[]>>,
  filter?: string,
  channelKey?: string,
) {
  useEffect(() => {
    const supa = supabaseBrowser();
    const ch = supa.channel(channelKey ?? `rt-${table}-${filter ?? 'all'}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload) => {
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
      .subscribe();
    return () => { supa.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, channelKey]);
}

/** Subscribe to a single row (by id). Calls onChange when it updates. */
export function useRealtimeRow<T extends { id: string }>(
  table: string,
  id: string,
  onChange: (row: T) => void,
) {
  useEffect(() => {
    const supa = supabaseBrowser();
    const ch = supa.channel(`rt-row-${table}-${id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table, filter: `id=eq.${id}` },
        (payload) => onChange(payload.new as T))
      .subscribe();
    return () => { supa.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, id]);
}
