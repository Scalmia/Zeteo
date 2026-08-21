import { useCallback, useEffect, useState } from 'react';
import { socket, sendAction, onServerEvent } from '../net/socket';
import type { ClientEvent, GameState, RoomSummary } from '@zeteo/shared-types';

// 화면(App.tsx)이 소켓을 직접 만지지 않아도 되게 감싸주는 훅.
// state는 검증 없이 서버가 보낸 그대로 저장한다 — 필드 누락 방어는
// 이 값을 실제로 쓰는 App.tsx의 renderScreen()에서 한다.
export function useGameState() {
  const [state, setState] = useState<GameState | null>(null); // null = 아직 방에 안 들어감(랜딩 화면)
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);
  // ★ 추가 (방 목록 기능) — 방 목록은 아직 방에 안 들어간 상태에서 받는 값이라
  // GameState 안에 못 넣는다(그건 방 참가자에게만 오는 것). 그래서 따로 들고 있는다.
  const [rooms, setRooms] = useState<RoomSummary[]>([]);

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // 서버 → 클라이언트 이벤트 구독. 'state'는 변화가 있을 때마다 전체 GameState를
    // 통째로 다시 보내온다(증분 아님) — 그래서 그냥 덮어쓰기만 하면 된다.
    const off = onServerEvent((e) => {
      if (e.t === 'state') {
        setState(e.state);
        setError(null);
      } else if (e.t === 'error') {
        setError(e.reason);
      } else if (e.t === 'roomList') {
        setRooms(e.rooms); // ★ 추가 (방 목록 기능) — listRooms 요청에 대한 응답
      }
    });

    // socket.ts에서 autoConnect: false로 만들어져 있어서 여기서 명시적으로 연결.
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      off();
      socket.disconnect();
    };
  }, []);

  // 화면이 사용자 행동(투표, 채팅 등)을 서버로 올려보낼 때 쓰는 유일한 통로.
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

  return { state, rooms, onEvent, connected, error, leaveToLanding };
}
