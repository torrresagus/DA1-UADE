/**
 * Live auction WebSocket hook.
 *
 * Opens a WS to `/ws/subastas/{subastaId}` and, on each broadcast bid, refreshes
 * the affected item's best-offer + history queries so the live room updates in
 * real time (no polling). The backend enforces a single live connection per
 * user; if the user is already connected elsewhere it sends an `error` frame,
 * surfaced here via `rejected`.
 */

import { useEffect, useRef, useState } from 'react';

import { API_BASE_URL } from '@/api/client';
import { queryClient, queryKeys } from '@/api/query-client';

function wsUrl(subastaId: number, usuarioId: number | null): string {
  const base = API_BASE_URL.replace(/^http/, 'ws');
  const q = usuarioId != null ? `?usuario_id=${usuarioId}` : '';
  return `${base}/ws/subastas/${subastaId}${q}`;
}

type LiveState = { connected: boolean; rejected: boolean };

export function useLiveSubasta(subastaId: number | null, usuarioId: number | null): LiveState {
  const [state, setState] = useState<LiveState>({ connected: false, rejected: false });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (subastaId == null || !Number.isFinite(subastaId) || subastaId <= 0) return;

    let closed = false;
    const ws = new WebSocket(wsUrl(subastaId, usuarioId));
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (msg.type === 'connected') {
        setState({ connected: true, rejected: false });
      } else if (msg.type === 'error') {
        setState({ connected: false, rejected: true });
      } else if (msg.type === 'puja' && typeof msg.catalogo_item_id === 'number') {
        // A new bid landed — refresh this item's best offer + history.
        queryClient.invalidateQueries({ queryKey: queryKeys.mejor(msg.catalogo_item_id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.pujasItem(msg.catalogo_item_id) });
      }
    };
    ws.onclose = () => {
      if (!closed) setState((s) => ({ ...s, connected: false }));
    };
    ws.onerror = () => {
      if (!closed) setState((s) => ({ ...s, connected: false }));
    };

    return () => {
      closed = true;
      wsRef.current = null;
      // Closing frees the user's live session on the backend.
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
  }, [subastaId, usuarioId]);

  return state;
}
