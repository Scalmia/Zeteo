import { io, Socket } from 'socket.io-client';
import type { ClientEvent, ServerEvent } from '@zeteo/shared-types';

// URL을 안 넘기면 페이지와 같은 origin으로 연결됨
// → dev: vite.config.ts의 /socket.io 프록시(localhost:3000)를 그대로 타고
// → prod: 백엔드가 프론트 정적 파일까지 같이 서빙하므로 자동으로 같은 서버로 붙음
// 즉 환경변수로 서버 주소를 따로 관리할 필요가 없음
export const socket: Socket = io({ autoConnect: false });

export function sendAction(action: ClientEvent) {
  socket.emit('action', action);
}

export function onServerEvent(handler: (e: ServerEvent) => void) {
  socket.on('event', handler);
  return () => socket.off('event', handler);
}
