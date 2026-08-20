/**
 * 한 판이 도는 동안 방 하나가 기억해야 할 것 전부와, 그것을 만들고 지우는 일.
 *
 * 방 상태는 이 파일의 rooms 맵, 즉 서버 메모리에만 산다. DB는 끝난 판을 받아
 * 적기만 하고 진행 중인 게임은 거치지 않는다 — 그래서 서버가 재시작되면 진행
 * 중이던 판은 사라진다. 한 판이 짧아 그 편이 낫다고 본 선택이다.
 *
 * 구역
 *   1. 방이 기억하는 것          RoomInternalState · rooms
 *   2. 방이 생기고 사람이 모인다   createRoom · getRoom · joinRoom · 준비 확인
 *   3. 판이 시작된다             역할 배정 · 라벨 배정
 *   4. 판이 도는 동안            pushSystemMessage
 *   5. 방이 정리된다             removePlayerFromLobby · deleteRoom
 */
import { InternalPlayer, Phase, Message, Role } from '@zeteo/shared-types';
import { logMessage } from './db/log';
import { randomUUID } from 'crypto';

// ── 1. 방이 기억하는 것 ──────────────────────────────────────────────

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
  /**
   * 확정된 승패를 result 진입 전까지 숨겨두는 내부 버퍼.
   * 승패는 정체 공개 시점에 이미 정해지지만, 그때 내보내면 아직 남은
   * 제시어 추측·봇 지목의 긴장이 통째로 사라진다. 그래서 서버는 알고
   * 있으면서도 result 로 넘어갈 때까지 liarGameResult 에 옮기지 않는다.
   *
   * ※ 숨기는 이유는 코드에서 읽어낸 추정 — 소유자 확인 필요
   */
  pendingLiarGameResult: 'liarWin' | 'citizenWin' | null;
  guessWord: string | null;   // ← 추가: 라이어가 제출한 제시어 추측값
  lifeVoteDecided: boolean; // 생사투표 결과가 이미 확정돼서 3초 타이머가 걸린 상태인지
  createdAt: number;
  readyIds: Set<string>;
  dbGameId: string | null;
  lobbyTokens: Map<string, string>;
  surveyedIds: Set<string>;
  submittedSurveyIds: Set<string>;
}

/** 살아 있는 방 전부. 이 맵이 서버가 가진 유일한 게임 상태다. */
const rooms = new Map<string, RoomInternalState>();

// ── 2. 방이 생기고 사람이 모인다 ─────────────────────────────────────

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
  };
  rooms.set(roomId, room);
  return room;
}

export function getRoom(roomId: string): RoomInternalState | undefined {
  return rooms.get(roomId);
}

/**
 * 플레이어 id 는 프로세스 전역에서 하나씩 올라간다 (p1, p2, …).
 * 방마다 세면 다른 방에 같은 id 가 생겨, 소켓 하나가 여러 방에 걸칠 때
 * 누구인지 가릴 수 없다.
 *
 * ※ 전역으로 둔 이유는 추정 — 소유자 확인 필요
 */
let idCounter = 0;

// A-1: 봇이 항상 입장 순서(=배열 0번)에 고정되던 문제 수정.
// view.ts의 publicPlayers가 room.players 순서를 그대로 따라가므로, 이 배열을
// 섞으면 클라이언트에 보이는 목록 순서도 같이 섞인다. joinRoom에서 매 입장마다
// 호출되어, 대기실 단계부터 순서가 입장 순서와 무관해지도록 한다.
export function shufflePlayers(room: RoomInternalState) {
  for (let i = room.players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [room.players[i], room.players[j]] = [room.players[j]!, room.players[i]!];
  }
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
  room.lobbyTokens.set(player.id, randomUUID()); // ← 추가
  shufflePlayers(room);
  return player;
}

export function markReady(room: RoomInternalState, playerId: string) {
  room.readyIds.add(playerId);
}

export function isEveryoneReady(room: RoomInternalState): boolean {
  return room.players.length > 0 && room.players.every((p) => room.readyIds.has(p.id));
}

// ── 3. 판이 시작된다 ─────────────────────────────────────────────────

/**
 * 라이어 한 명을 뽑는다. 봇을 빼지 않고 전체에서 뽑으므로 봇이 라이어가
 * 되는 판도 실제로 나온다 — 봇이 늘 시민이면 그 규칙성 자체가 봇을
 * 찾는 단서가 되기 때문이다.
 */
export function assignRoles(room: RoomInternalState) {
  const shuffled = [...room.players].sort(() => Math.random() - 0.5);
  const liar = shuffled[0];
  if (!liar) return; // 참가자가 없으면 아무것도 안 함
  room.players.forEach((p) => (p.role = 'citizen'));
  liar.role = 'liar';
}

/**
 * 화면에 보이는 이름은 실명이 아니라 이 라벨이다 (A, B, C …).
 * 남는 것 중 무작위로 뽑는다 — 앞에서부터 순서대로 주면 라벨이 곧 입장
 * 순서가 되어, 먼저 들어온 사람이 누구인지 라벨만 보고 알 수 있게 된다.
 * (같은 이유로 shufflePlayers 가 배열 자체도 섞는다 — 아래 A-1 주석 참고)
 */
const LABEL_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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

// ── 5. 방이 정리된다 ─────────────────────────────────────────────────

/**
 * 대기실에서 나갈 때. 방이 사라지는 경로는 둘이고 이게 그중 하나다.
 *   · 여기 — 마지막 한 명까지 나가서 자동으로 정리되는 경우
 *   · deleteRoom — 설문까지 전원 마쳐서 판이 확실히 끝난 경우
 * 둘을 합치지 않는 이유는 "아무도 없어서 지운다"와 "끝나서 지운다"가
 * 최종 로그를 보낼지 말지에서 갈리기 때문이다.
 */
export function removePlayerFromLobby(roomId: string, playerId: string): boolean {
  const room = getRoom(roomId);
  if (!room) return false;
  room.players = room.players.filter((p) => p.id !== playerId);
  room.readyIds.delete(playerId);
  if (room.players.length === 0) {
    rooms.delete(roomId); // 아무도 안 남으면 방 자체도 정리
    return true; // 방이 실제로 정리됐음 — 최종 로그 전송 트리거용
  }
  return false;
}

/** 인원 전체가 확실히 끝났다고 확정된 순간(설문 전원 제출)에만 호출 — 방을 통째로 정리한다. */
export function deleteRoom(roomId: string) {
  rooms.delete(roomId);
}
