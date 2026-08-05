import { useCallback, useEffect, useState } from 'react';
import { socket, sendAction, onServerEvent } from '../net/socket';
import type { ClientEvent, GameState } from '@zeteo/shared-types';

export function useGameState() {
  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    const off = onServerEvent((e) => {
      if (e.t === 'state') {
        setState(e.state);
        setError(null);
      } else if (e.t === 'error') {
        setError(e.reason);
      }
    });

    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      off();
      socket.disconnect();
    };
  }, []);

  const onEvent = useCallback((e: ClientEvent) => sendAction(e), []);

  return { state, onEvent, connected, error };
}
