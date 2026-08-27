import { useCallback, useEffect, useRef, useState } from 'react';
import { socket, sendAction, onServerEvent } from '../net/socket';
import type { ClientEvent, GameState, RoomSummary } from '@zeteo/shared-types';

// 새로고침 복귀용 세션. sessionStorage라 탭을 닫으면 사라지고(브라우저 종료·새 탭엔
// 안 남음), 새로고침에는 살아남는다 — "재접속"이 필요한 딱 그 상황에만 쓰려는 것.
const SESSION_KEY = 'zeteo_session';

function loadSession(): { roomId: string; playerId: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: { roomId: string; playerId: string }) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // 프라이빗 모드 등으로 저장이 막혀도 게임 진행 자체는 지장 없어야 하므로 무시.
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // 위와 동일한 이유로 무시.
  }
}

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
  // rejoin 요청이 실패했을 때만 세션을 지우려고 "지금 rejoin 응답을 기다리는 중"을 표시한다.
  const pendingRejoinRef = useRef(false);

  useEffect(() => {
    const handleConnect = () => {
      setConnected(true);
      // 새로고침으로 소켓이 새로 열린 경우, 직전에 있던 방이 있으면 그 자리로 돌아간다.
      const saved = loadSession();
      if (saved) {
        pendingRejoinRef.current = true;
        sendAction({ t: 'rejoin', roomId: saved.roomId, playerId: saved.playerId });
      }
    };
    const handleDisconnect = () => setConnected(false);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // 서버 → 클라이언트 이벤트 구독. 'state'는 변화가 있을 때마다 전체 GameState를
    // 통째로 다시 보내온다(증분 아님) — 그래서 그냥 덮어쓰기만 하면 된다.
    const off = onServerEvent((e) => {
      if (e.t === 'state') {
        pendingRejoinRef.current = false;
        setState(e.state);
        setError(null);
        saveSession({ roomId: e.state.roomId, playerId: e.state.myId });
      } else if (e.t === 'error') {
        // rejoin이 실패한 경우(방이 사라졌거나 playerId가 더 이상 없음) 같은 세션으로
        // 계속 재시도하지 않도록 지운다 — 그 외의 실패(예: 잘못된 방번호 join)엔 손대지 않는다.
        if (pendingRejoinRef.current) {
          pendingRejoinRef.current = false;
          clearSession();
        }
        setError(e.reason);
      } else if (e.t === 'roomList') {
        setRooms(e.rooms); // ★ 추가 (방 목록 기능) — listRooms 요청에 대한 응답
        // join 실패('없는 방입니다' 등)는 방에 못 들어간 것이라 state 가 영영 안 오고,
        // 그러면 위 분기로는 error 가 안 지워져 빨간 배너가 화면에 계속 남는다. 목록이
        // 새로 왔다는 건 사용자가 이 화면에서 다시 움직였다는 뜻이라 여기서 같이 지운다.
        setError(null);
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
    clearSession();
    socket.connect();
  }, []);

  return { state, rooms, onEvent, connected, error, leaveToLanding };
}
