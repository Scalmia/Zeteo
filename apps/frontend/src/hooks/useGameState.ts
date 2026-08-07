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

  // 설문 제출 등 게임이 완전히 끝난 뒤 랜딩 화면으로 되돌아갈 때 사용.
  // 서버가 설문 제출 시점에 이미 방에서 제거해주므로, 프론트는 소켓을 새로
  // 잡고 로컬 state만 비우면 된다 — leaveRoom류 이벤트 불필요.
  const leaveToLanding = useCallback(() => {
    socket.disconnect();
    setState(null);
    setError(null);
    socket.connect();
  }, []);

  return { state, onEvent, connected, error, leaveToLanding };
}
