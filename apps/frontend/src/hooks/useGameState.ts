import { useEffect, useState, useCallback } from 'react';
import type { ClientEvent, GameState, ServerEvent } from '@zeteo/shared-types';
import { socket, sendAction, onServerEvent } from '../net/socket';

export function useGameState() {
  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const offEvent = onServerEvent((e: ServerEvent) => {
      if (e.t === 'state') {
        setState(e.state);
        setError(null);
      } else if (e.t === 'error') {
        setError(e.reason);
      }
    });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      offEvent();
      socket.disconnect();
    };
  }, []);

  const onEvent = useCallback((action: ClientEvent) => {
    sendAction(action);
  }, []);

  return { state, onEvent, connected, error };
}