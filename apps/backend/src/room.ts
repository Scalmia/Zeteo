import { InternalPlayer, Phase, Message, Role } from '@zeteo/shared-types';

export interface RoomInternalState {
  roomId: string;
  phase: Phase;
  round: number; // 동점 재투표 등으로 같은 phase 반복 시 구분
  players: InternalPlayer[];
  category: string;
  word: string;
  turnOrder: string[];
  currentTurnIndex: number;
  deadlineAt: number | null;
  messages: Message[];
  votes: Record<string, string | null>; // S2 토론 투표 (voterId → targetId)
  lifeVotes: Record<string, boolean>; // S4 생사 투표 (true=kill, false=spare)
  botVotes: Record<string, string>; // S6 봇 지목 투표
  accusedId: string | null;
  revealedRole: Role | null; // S5 처형자 역할 공개
  liarGameResult: 'liarWin' | 'citizenWin' | null; // S5 라이어게임 승패
  pendingLiarGameResult: 'liarWin' | 'citizenWin' | null; // 확정된 승패를 result 진입 전까지 숨겨두는 내부 버퍼
  createdAt: number;
  readyIds: Set<string>;
}

const rooms = new Map<string, RoomInternalState>();

export function createRoom(roomId: string): RoomInternalState {
  const room: RoomInternalState = {
    roomId,
    phase: 'lobby',
    round: 1,
    players: [],
    category: '',
    word: '',
    turnOrder: [],
    currentTurnIndex: 0,
    deadlineAt: null,
    messages: [],
    votes: {},
    lifeVotes: {},
    botVotes: {},
    accusedId: null,
    revealedRole: null,
    liarGameResult: null,
    pendingLiarGameResult: null,
    createdAt: Date.now(),
    readyIds: new Set(),
  };
  rooms.set(roomId, room);
  return room;
}

export function getRoom(roomId: string): RoomInternalState | undefined {
  return rooms.get(roomId);
}

let systemMsgCounter = 0;
/**
 * 필드가 아니라 문장으로 사건을 남긴다 (speakerId: 'system').
 * round 같은 상태 필드와 역할이 다르다 — 이건 "왜 돌아왔는가"를 기록하는 사건 로그다.
 * 라운드가 넘어가도 지우지 않는다 (누적 전제가 룰북/봇 판별 로직의 기반).
 */
export function pushSystemMessage(room: RoomInternalState, text: string) {
  room.messages.push({
    id: `sys${Date.now()}_${++systemMsgCounter}`,
    speakerId: 'system',
    text,
    phase: room.phase,
    at: Date.now(),
  });
}

let idCounter = 0;

const LABEL_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function assignLabel(room: RoomInternalState): string {
  const used = new Set(room.players.map((p) => p.label));
  const available = LABEL_POOL.filter((l) => !used.has(l));
  if (available.length === 0) throw new Error('label pool exhausted');
  return available[Math.floor(Math.random() * available.length)]!;
}

export function joinRoom(roomId: string, name: string, isBot = false): InternalPlayer {
  const room = getRoom(roomId);
  if (!room) throw new Error(`room ${roomId} not found`);
  const player: InternalPlayer = {
    id: `p${++idCounter}`,
    name,
    isAlive: true,
    isBot,
    role: 'citizen',
    label: assignLabel(room),
  };
  room.players.push(player);
  shufflePlayers(room);
  return player;
}

export function assignRoles(room: RoomInternalState) {
  const shuffled = [...room.players].sort(() => Math.random() - 0.5);
  const liar = shuffled[0];
  if (!liar) return; // 참가자가 없으면 아무것도 안 함
  room.players.forEach((p) => (p.role = 'citizen'));
  liar.role = 'liar';
}

// A-1: 봇이 항상 입장 순서(=배열 0번)에 고정되던 문제 수정.
// view.ts의 publicPlayers가 room.players 순서를 그대로 따라가므로, 게임 시작
// 시점(roleReveal 진입 직전)에 이 배열 자체를 한 번 섞어 순서를 고정한다.
// 그 뒤로는 이 순서를 그대로 유지 — 매 브로드캐스트마다 다시 섞으면 화면이
// 흔들려 보이므로 여기서 딱 한 번만 섞는다.
export function shufflePlayers(room: RoomInternalState) {
  for (let i = room.players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [room.players[i], room.players[j]] = [room.players[j]!, room.players[i]!];
  }
}
export function markReady(room: RoomInternalState, playerId: string) {
  room.readyIds.add(playerId);
}

export function isEveryoneReady(room: RoomInternalState): boolean {
  return room.players.length > 0 && room.players.every((p) => room.readyIds.has(p.id));
}

export function removePlayerFromLobby(roomId: string, playerId: string) {
  const room = getRoom(roomId);
  if (!room) return;
  room.players = room.players.filter((p) => p.id !== playerId);
  room.readyIds.delete(playerId);
  if (room.players.length === 0) {
    rooms.delete(roomId); // 아무도 안 남으면 방 자체도 정리
  }
}
