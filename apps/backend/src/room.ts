/**
 * 한 판이 도는 동안 방 하나가 기억해야 할 것 전부와, 그것을 만들고 지우는 일.
 * 상태는 이 파일의 rooms 맵, 즉 서버 메모리에만 산다 — 진행 중인 게임은 DB를 거치지 않는다.
 *
 * 구역
 *   1. 방이 기억하는 것          RoomInternalState · rooms
 *   2. 방이 생기고 사람이 모인다   createRoom · getRoom · listRoomSummaries · joinRoom · ready 토글
 *   3. 판이 시작된다             역할 배정 · 라벨 배정
 *   4. 판이 도는 동안            pushSystemMessage
 *   5. 방이 정리된다             removePlayerFromLobby · deleteRoom
 */
import { InternalPlayer, Phase, Message, Role, RoomSummary } from '@zeteo/shared-types';
import { logMessage } from './db/log';
import { randomUUID } from 'crypto';
import { clearPhaseTimer } from './timer';

// ── 1. 방이 기억하는 것 ──────────────────────────────────────────────

// ★ 추가 (방 목록 기능)
// 방 정원. 프론트 apps/frontend/src/roomConfig.ts 와 반드시 같은 값이어야 한다 —
// 어긋나면 "목록에선 들어갈 수 있어 보이는데 서버가 거절"하는, 화면에 원인이 안
// 드러나는 상태가 된다. 공유하려고 shared-types 에 뒀다가 되돌렸다: 그 패키지는
// 타입 전용이라 런타임 값을 넣으면 빌드된 dist 가 실행 중 죽는다(그 파일 주석 참고).
export const MIN_PLAYERS = 4; // 봇 포함. 방장이 게임시작을 누를 수 있는 최소 인원
export const MAX_PLAYERS = 8; // 봇 포함. 방 정원 고정값 (방장이 개별 설정하지 않음)

// 닉네임 최대 글자수. 위 정원 값들과 같은 규칙으로 프론트 roomConfig.ts 와 짝을 맞춘다.
// 화면(LandingScreen 입력창 maxLength)에서도 막지만 그건 편의일 뿐이라 — 소켓으로 직접
// 보내면 그대로 통과한다 — index.ts 의 join 핸들러가 여기서 다시 본다.
// 이 값이 곧 결과 화면에 뜨는 이름의 상한이라, 설문화면 우측 패널(260px)처럼 폭이 좁은
// 자리가 이 길이를 최악의 경우로 잡고 있다. 늘리면 그쪽 줄바꿈부터 확인할 것.
export const NAME_MAX_LENGTH = 6;

export interface RoomInternalState {
  roomId: string;
  // ★ 추가 (방 목록 기능) — 방 목록에 보여줄 제목. 방을 만들 때 받는다.
  title: string;
  // ★ 추가 (방 목록 기능) — 방을 만든 사람의 playerId. 게임시작 권한 판정의 유일한
  // 근거다. 방이 만들어지는 시점엔 아직 아무도 join 하기 전이라 빈 문자열로 두고,
  // 첫 사람이 들어올 때 index.ts case 'join' 이 채운다.
  hostId: string;
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

// title 은 ★ 추가 (방 목록 기능) — 안 넘기면 방 목록에서 구분이 안 되므로 방번호로
// 대신 채운다(방번호 직접입력으로 들어와 방이 새로 생기는 경로가 있어 필요하다).
export function createRoom(roomId: string, title?: string): RoomInternalState {
  const room: RoomInternalState = {
    roomId,
    title: title ?? `${roomId}번 방`,
    hostId: '',
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

// ★ 추가 (방 목록 기능)
// 방 목록 화면에 뿌릴 요약. rooms 맵은 이 파일 밖으로 안 내보내므로(외부에서 통째로
// 만지면 생성·삭제 경로가 흩어진다) 요약본만 만들어 준다.
// 사람 없이 봇만 남은 방은 거른다 — 방을 만든 사람이 로비에서 나가면 removePlayerFromLobby
// 가 방을 지우지만, 그 전까지 잠깐 봇만 있는 상태가 목록에 뜨는 걸 막는다.
export function listRoomSummaries(): RoomSummary[] {
  return [...rooms.values()]
    .filter((room) => room.players.some((p) => !p.isBot))
    .map((room) => ({
      roomId: room.roomId,
      title: room.title,
      hostName: room.players.find((p) => p.id === room.hostId)?.name ?? '?',
      count: room.players.length,
      // 진행 중인 방은 애초에 못 들어가므로 정원보다 phase 를 먼저 본다.
      status:
        room.phase !== 'lobby'
          ? 'playing'
          : room.players.length >= MAX_PLAYERS
            ? 'full'
            : 'open',
    }));
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
  // id 를 변수로 빼는 이유: 같은 값을 화면(room.messages)과 DB(logMessage) 양쪽에 넣어야
  // 나중에 "이 발언"으로 서로를 찾을 수 있다.
  const id = `sys${Date.now()}_${++systemMsgCounter}`;
  room.messages.push({
    id,
    speakerId: 'system',
    text,
    phase: room.phase,
    at: Date.now(),
  });
  void logMessage(room, id, null, 'system', null, text);
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
