import { InternalPlayer, Phase, Message, Role } from '@zeteo/shared-types';
import { logMessage } from './db/log';
import { randomUUID } from 'crypto';
import { clearPhaseTimer } from './timer';

export interface RoomInternalState {
  roomId: string;
  phase: Phase;
  round: number; // 라운드
  players: InternalPlayer[];
  category: string;
  word: string;
  turnOrder: string[];
  currentTurnIndex: number;
  deadlineAt: number | null;
  messages: Message[];
  votes: Record<string, string | null>; // 투표
  lifeVotes: Record<string, boolean>; // 생사투표
  botVotes: Record<string, string>; // 봇투표
  accusedId: string | null;
  revealedRole: Role | null; // 역할
  liarGameResult: 'liarWin' | 'citizenWin' | null; // 결과
  pendingLiarGameResult: 'liarWin' | 'citizenWin' | null; // 승패 관련
  guessWord: string | null; // 추측값
  lifeVoteDecided: boolean; // 상태 플래그
  createdAt: number;
  readyIds: Set<string>;
  dbGameId: string | null;
  lobbyTokens: Map<string, string>;
  surveyedIds: Set<string>;
  submittedSurveyIds: Set<string>;
  abandonedSurveyIds: Set<string>; // 설문 관련
  finalized: boolean; // 완료 플래그
}

const rooms = new Map<string, RoomInternalState>();
let idCounter = 0;

export function joinRoom(roomId: string, name: string, isBot = false): InternalPlayer {
  const room = getRoom(roomId);
  if (!room) throw new Error(`room ${roomId} not found`);
  const player: InternalPlayer = {
    id: `p${++idCounter}`,
    name,
    isAlive: true,
    isBot,
    role: 'citizen',
    label: '',
  };
  room.players.push(player);
  // 토큰 저장
  room.lobbyTokens.set(player.id, randomUUID());
  return player;
}

const LABEL_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// 라벨 뽑기
function assignLabel(room: RoomInternalState): string {
  const used = new Set(room.players.map((p) => p.label));
  const available = LABEL_POOL.filter((l) => !used.has(l));
  if (available.length === 0) throw new Error('label pool exhausted');
  return available[Math.floor(Math.random() * available.length)]!;
}

// 방 삭제
export function deleteRoom(roomId: string) {
  clearPhaseTimer(roomId);
  rooms.delete(roomId);
}

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
    guessWord: null,
    createdAt: Date.now(),
    readyIds: new Set(),
    lifeVoteDecided: false,
    dbGameId: null,
    lobbyTokens: new Map(),
    surveyedIds: new Set(),
    submittedSurveyIds: new Set(),
    abandonedSurveyIds: new Set(),
    finalized: false,
  };
  rooms.set(roomId, room);
  return room;
}

export function getRoom(roomId: string): RoomInternalState | undefined {
  return rooms.get(roomId);
}

export function unmarkReady(room: RoomInternalState, playerId: string) {
  room.readyIds.delete(playerId);
}

// 전원 확인
export function isEveryoneReady(room: RoomInternalState): boolean {
  return room.players.length > 0 && room.players.every((p) => room.readyIds.has(p.id));
}

let systemMsgCounter = 0;
// 메시지 추가
export function pushSystemMessage(room: RoomInternalState, text: string) {
  room.messages.push({
    id: `sys${Date.now()}_${++systemMsgCounter}`,
    speakerId: 'system',
    text,
    phase: room.phase,
    at: Date.now(),
  });
  void logMessage(room, null, 'system', null, text);
}

export function markReady(room: RoomInternalState, playerId: string) {
  room.readyIds.add(playerId);
}

export function assignRoles(room: RoomInternalState) {
  const shuffled = [...room.players].sort(() => Math.random() - 0.5);
  const liar = shuffled[0];
  if (!liar) return;
  room.players.forEach((p) => (p.role = 'citizen'));
  liar.role = 'liar';
}

export function assignLabels(room: RoomInternalState) {
  room.players.forEach((p) => {
    p.label = assignLabel(room);
  });
}

export function removePlayerFromLobby(roomId: string, playerId: string): boolean {
  const room = getRoom(roomId);
  if (!room) return false;
  room.players = room.players.filter((p) => p.id !== playerId);
  room.readyIds.delete(playerId);
  if (room.players.length === 0) {
    clearPhaseTimer(roomId);
    rooms.delete(roomId); // 정리
    return true;
  }
  return false;
}
