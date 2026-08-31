import { io, Socket } from 'socket.io-client';
import type { ClientEvent, ServerEvent } from '@zeteo/shared-types';

// URL을 안 넘기면 페이지와 같은 origin으로 연결됨
// → dev: vite.config.ts의 /socket.io 프록시(localhost:3000)를 그대로 타고
// → prod: 백엔드가 프론트 정적 파일까지 같이 서빙하므로 자동으로 같은 서버로 붙음
// 즉 환경변수로 서버 주소를 따로 관리할 필요가 없음
export const socket: Socket = io({ autoConnect: false });

// 화면 → 서버. 'action'이라는 이벤트 이름 하나에 ClientEvent(join/vote/chat 등)를
// t 필드로 구분해서 실어 보낸다 — 이벤트 이름을 여러 개 안 쓰고 하나로 통일.
export function sendAction(action: ClientEvent) {
  socket.emit('action', action);
}

// 서버 → 화면. 'event'로 오는 ServerEvent(state/error)를 구독한다.
// 반환값은 구독 해제 함수 — useGameState.ts의 useEffect cleanup에서 호출된다.
export function onServerEvent(handler: (e: ServerEvent) => void) {
  socket.on('event', handler);
  return () => socket.off('event', handler);
}
