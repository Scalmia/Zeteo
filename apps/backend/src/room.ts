import { InternalPlayer, Phase, Message, Role } from '@zeteo/shared-types';
import { logMessage } from './db/log';
import { randomUUID } from 'crypto';
import { clearPhaseTimer } from './timer';

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
  guessWord: string | null;   // ← 추가: 라이어가 제출한 제시어 추측값
  lifeVoteDecided: boolean; // 생사투표 결과가 이미 확정돼서 3초 타이머가 걸린 상태인지
  createdAt: number;
  readyIds: Set<string>;
  dbGameId: string | null;
  lobbyTokens: Map<string, string>;
  surveyedIds: Set<string>;
  submittedSurveyIds: Set<string>;
  // 설문 화면까지 왔다가 제출 없이 나간 사람. room.players에서는 안 지운다 —
  // 최종 리포트가 describePlayer로 그 사람의 과거 발언을 이름+라벨로 풀려면
  // 끝까지 room.players에 남아있어야 한다. 대신 이 Set으로 "포기"를 따로 기록해서
  // allDone 판정(case 'survey')이 이 사람 때문에 영원히 안 끝나는 걸 막는다.
  abandonedSurveyIds: Set<string>;
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
    guessWord: null,
    createdAt: Date.now(),
    readyIds: new Set(),
    lifeVoteDecided: false,
    dbGameId: null,
    lobbyTokens: new Map(),
    surveyedIds: new Set(),
    submittedSurveyIds: new Set(),
    abandonedSurveyIds: new Set(),
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
  void logMessage(room, null, 'system', null, text);
}

let idCounter = 0;

const LABEL_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// 라벨을 참가 순서(A, B, C...)가 아니라 남은 알파벳 중 무작위로 뽑는다. 순서대로
// 주면 라벨만 보고도 누가 먼저 들어왔는지(=누가 자동 참가 봇인지) 역산할 수 있어서다.
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
    label: '',
  };
  room.players.push(player);
  // player.id는 원래 클라이언트에 노출할 값이 아니다 — name(로비)/label(게임 중)이
  // 화면 표시를 맡고, id는 순전히 서버 내부에서 이 사람을 가리키는 키다(name은 중복
  // 가능하고, label은 로비 단계엔 아직 배정 전이라 둘 다 키로 못 쓴다). 그런데
  // view.ts가 로비 단계 GameState의 id/myId엔 id를 그대로 흘려보내고 있어서, 대신
  // 참가마다 무작위 토큰을 하나씩 발급해 로비 동안만 그 자리를 채운다.
  room.lobbyTokens.set(player.id, randomUUID());
  return player;
}

export function assignRoles(room: RoomInternalState) {
  const shuffled = [...room.players].sort(() => Math.random() - 0.5);
  const liar = shuffled[0];
  if (!liar) return; // 참가자가 없으면 아무것도 안 함
  room.players.forEach((p) => (p.role = 'citizen'));
  liar.role = 'liar';
}
export function assignLabels(room: RoomInternalState) {
  room.players.forEach((p) => {
    p.label = assignLabel(room);
  });
}

// add/delete로 나뉜 건 index.ts의 case 'ready'가 같은 액션을 토글로 쓰기 때문이다
// (재클릭하면 준비 해제) — 하나로 합쳐 불리언 인자로 받으면 호출부에서 매번
// room.readyIds.has(...)로 현재 상태를 먼저 물어야 해서 오히려 더 번거로워진다.
export function markReady(room: RoomInternalState, playerId: string) {
  room.readyIds.add(playerId);
}

export function unmarkReady(room: RoomInternalState, playerId: string) {
  room.readyIds.delete(playerId);
}

// players.length > 0 체크가 없으면, 인원이 0명인 방에서도 every()가 빈 배열에
// 대해 항상 true를 반환해 "전원 준비완료"로 오판한다.
export function isEveryoneReady(room: RoomInternalState): boolean {
  return room.players.length > 0 && room.players.every((p) => room.readyIds.has(p.id));
}

export function removePlayerFromLobby(roomId: string, playerId: string): boolean {
  const room = getRoom(roomId);
  if (!room) return false;
  room.players = room.players.filter((p) => p.id !== playerId);
  room.readyIds.delete(playerId);
  if (room.players.length === 0) {
    clearPhaseTimer(roomId);
    rooms.delete(roomId); // 아무도 안 남으면 방 자체도 정리
    return true; // 방이 실제로 정리됐음 — 최종 로그 전송 트리거용
  }
  return false;
}
/** 인원 전체가 확실히 끝났다고 확정된 순간(설문 전원 제출)에만 호출 — 방을 통째로 정리한다. */
export function deleteRoom(roomId: string) {
  clearPhaseTimer(roomId);
  rooms.delete(roomId);
}
