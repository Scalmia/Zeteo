/**
 * 한 판이 도는 동안 방 하나가 기억해야 할 것 전부와, 그것을 만들고 지우는 일.
 * 상태는 이 파일의 rooms 맵, 즉 서버 메모리에만 산다 — 진행 중인 게임은 DB를 거치지 않는다.
 *
 * 구역
 *   1. 방이 기억하는 것          RoomInternalState · rooms
 *   2. 방이 생기고 사람이 모인다   createRoom · getRoom · joinRoom · ready 토글
 *   3. 판이 시작된다             역할 배정 · 라벨 배정
 *   4. 판이 도는 동안            pushSystemMessage
 *   5. 방이 정리된다             removePlayerFromLobby · deleteRoom
 */
import { InternalPlayer, Phase, Message, Role } from '@zeteo/shared-types';
import { logMessage } from './db/log';
import { randomUUID } from 'crypto';
import { clearPhaseTimer } from './timer';

// ── 1. 방이 기억하는 것 ──────────────────────────────────────────────

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
  // 정체 공개 시점엔 승패가 아직 스포일러라 이 필드에만 예약해둔다.
  // (자세한 이유는 stateMachine.ts 의 reveal/botVote 참고)
  pendingLiarGameResult: 'liarWin' | 'citizenWin' | null; // 승패 관련
  guessWord: string | null; // 추측값
  lifeVoteDecided: boolean; // 상태 플래그
  createdAt: number;
  readyIds: Set<string>;
  dbGameId: string | null;
  lobbyTokens: Map<string, string>;
  surveyedIds: Set<string>;
  submittedSurveyIds: Set<string>;
  // 설문까지 왔다가 제출 없이 나간 사람. room.players 에서는 안 지운다 —
  // 최종 리포트가 이 사람의 과거 발언을 이름으로 풀려면 끝까지 남아있어야 한다.
  // (index.ts finalizeSurveyIfDone 참고)
  abandonedSurveyIds: Set<string>; // 설문 관련
  // 마지막 인원 판정이 두 경로(제출 / 접속 종료)에서 레이스로 겹쳐 불리는 걸 막는 잠금.
  // (index.ts finalizeSurveyIfDone 참고)
  finalized: boolean; // 완료 플래그
}

const rooms = new Map<string, RoomInternalState>();

// ── 2. 방이 생기고 사람이 모인다 ─────────────────────────────────────

let idCounter = 0;

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

// add/delete 로 나뉜 건 index.ts 의 case 'ready' 가 같은 액션을 토글로 쓰기 때문이다
// (재클릭하면 준비 해제, index.ts:508-512).
export function markReady(room: RoomInternalState, playerId: string) {
  room.readyIds.add(playerId);
}

export function unmarkReady(room: RoomInternalState, playerId: string) {
  room.readyIds.delete(playerId);
}

// players.length > 0 체크가 없으면, 인원 0명인 방에서도 every() 가 빈 배열에서
// 항상 true 를 반환해 "전원 준비완료"로 오판한다.
// 전원 확인
export function isEveryoneReady(room: RoomInternalState): boolean {
  return room.players.length > 0 && room.players.every((p) => room.readyIds.has(p.id));
}

// ── 3. 판이 시작된다 ─────────────────────────────────────────────────

export function assignRoles(room: RoomInternalState) {
  const shuffled = [...room.players].sort(() => Math.random() - 0.5);
  const liar = shuffled[0];
  if (!liar) return;
  room.players.forEach((p) => (p.role = 'citizen'));
  liar.role = 'liar';
}

const LABEL_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// 봇이 방 생성과 동시에 가장 먼저 참가한다(index.ts case 'join') — players[0]은
// 언제나 봇이다. 순서대로 라벨을 주면 첫 라벨이 항상 봇 것이 되므로, 남은 알파벳
// 중 무작위로 뽑는다.
// 라벨 뽑기
function assignLabel(room: RoomInternalState): string {
  const used = new Set(room.players.map((p) => p.label));
  const available = LABEL_POOL.filter((l) => !used.has(l));
  if (available.length === 0) throw new Error('label pool exhausted');
  return available[Math.floor(Math.random() * available.length)]!;
}

export function assignLabels(room: RoomInternalState) {
  room.players.forEach((p) => {
    p.label = assignLabel(room);
  });
}

// ── 4. 판이 도는 동안 ────────────────────────────────────────────────

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

// ── 5. 방이 정리된다 ─────────────────────────────────────────────────

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

// 방 삭제
export function deleteRoom(roomId: string) {
  clearPhaseTimer(roomId);
  rooms.delete(roomId);
}
