import type { GameState, Message, PublicPlayer } from '@zeteo/shared-types';

// ⚠️ 이 파일은 파트 C·D 공동 소유. 변경 시 상대에게 알린다.
//    키 네이밍 규칙: <phase>-<변형>

/** 5인 = 사람 4 + 봇 1. 룰북 캡션의 "4인 게임이면 3표"는 MVP 기준과 맞지 않으므로 쓰지 않는다.
 *
 *  게임 중에는 실명이 아니라 서버가 방마다 무작위 배정하는 label("참가자 N")만 보인다.
 *  실명은 S7의 revealedNames 로만 공개된다 — 참고용 대응은 아래와 같다.
 *    p1 봇담당 · p2 레이아웃담당 · p3 화면담당(=나) · p4 서버담당 · p5 최서연(봇)
 *
 *  label 값을 일부러 비순차로 둔 것은 서버 assignLabel 이 1~20 중 무작위로 뽑기 때문이다.
 *  화면이 "label 번호 = 입장 순서"를 가정하고 있으면 여기서 드러난다. */
const players: PublicPlayer[] = [
  { id: 'p1', label: '참가자 4', isAlive: true, isReady: true },
  { id: 'p2', label: '참가자 1', isAlive: true, isReady: true },
  { id: 'p3', label: '참가자 7', isAlive: true, isReady: true },
  { id: 'p4', label: '참가자 3', isAlive: true, isReady: true },
  { id: 'p5', label: '참가자 9', isAlive: true, isReady: true }, // 실제로는 봇. 클라이언트는 알 수 없어야 한다.
];

const ME = 'p3';
const inSec = (n: number) => Date.now() + n * 1000;

let seq = 0;
const msg = (speakerId: string, text: string, phase: Message['phase']): Message => ({
  id: `m${++seq}`,
  speakerId,
  text,
  phase,
  at: Date.now() - (100 - seq) * 1000,
});

const describeLog: Message[] = [
  msg('p1', '줄무늬가 있어요', 'describe'),
  msg('p2', '음… 산에 살아요', 'describe'),
  msg('p3', '어릴 때 동화책에서 자주 봤어요', 'describe'),
  msg('p4', '고양잇과입니다', 'describe'),
  msg('p5', '한국 옛날 이야기에 많이 나오죠', 'describe'),
];

const debateLog: Message[] = [
  ...describeLog,
  msg('system', '묘사가 한 바퀴 끝났습니다. 토론을 시작합니다.', 'debate'),
  msg('p1', '참가자 1님 묘사가 너무 두루뭉술한데요', 'debate'),
  msg('p2', '아 진짜 아니라니까', 'debate'),
  msg('p4', '저도 참가자 1님 좀 이상했어요', 'debate'),
];

/** 2라운드 진입 경로 2종. 로그는 지우지 않고 누적한다 —
 *  룰북 S4의 "매 라운드 정보가 누적되어 자연히 수렴한다"가 설계 전제이므로
 *  로그를 비우면 그 전제가 깨진다. 라운드 경계는 시스템 메시지가 만든다. */
const revoteLog: Message[] = [
  ...debateLog,
  msg('p3', '저는 참가자 3님이요', 'debate'),
  msg('system', '동점입니다. 재투표를 시작합니다.', 'debate'),
];

const sparedLog: Message[] = [
  ...debateLog,
  msg('system', '참가자 1님이 최다 득표로 지목되었습니다.', 'finalDefense'),
  msg('p2', '아니 저 진짜 시민이에요 제시어 알아요', 'finalDefense'),
  msg('p1', '그럼 말해보세요', 'finalDefense'),
  msg('system', '참가자 1님이 살아남았습니다. 토론을 재개합니다.', 'debate'),
];

const base: GameState = {
  roomId: 'MOCK',
  phase: 'roleReveal',
  players,
  category: '동물',
  word: '호랑이',
  myRole: 'citizen',
  turnOrder: ['p1', 'p2', 'p3', 'p4', 'p5'],
  currentTurn: null,
  deadlineAt: null,
  messages: [],
  voteCounts: {},
  myVote: null,
  accused: null,
  // ★ 제안 필드
  myId: ME,
  round: 1,
  myLifeVote: null,
  lifeVoteCounts: { kill: 0, spare: 0 },
  revealedRole: null,
  liarGameResult: null,

  // S6·S7 (파트 D). 서버가 result 진입 직전에만 채우므로,
  // 파트 C mock 은 전부 result 이전 페이즈라 항상 기본값이다.
  botVoteCounts: { voted: 0, total: 0 },
  botVoteCorrectCount: 0,
  revealedBotId: null,
  revealedLiarId: null,
  revealedNames: null,
  botVoteResults: null,
  reasons: [],
};

export const MOCK_STATES: Record<string, GameState> = {
  // ── S0 ─────────────────────────────────────────────
  'roleReveal-citizen': { ...base },
  'roleReveal-liar': { ...base, myRole: 'liar', word: null },

  // ── S1 ─────────────────────────────────────────────
  'describe-myturn': {
    ...base,
    phase: 'describe',
    currentTurn: ME,
    deadlineAt: inSec(30),
    messages: describeLog.slice(0, 2),
  },
  'describe-waiting': {
    ...base,
    phase: 'describe',
    currentTurn: 'p2',
    deadlineAt: inSec(18),
    messages: describeLog.slice(0, 1),
  },

  // ── S2 ─────────────────────────────────────────────
  'debate-novote': {
    ...base,
    phase: 'debate',
    deadlineAt: inSec(161),
    messages: debateLog,
    voteCounts: { p2: 2, p3: 1 },
    myVote: null,
  },
  'debate-voted': {
    ...base,
    phase: 'debate',
    deadlineAt: inSec(161),
    messages: debateLog,
    voteCounts: { p2: 2, p3: 1 },
    myVote: 'p2',
  },
  /** 동점 → 재투표. 표는 리셋되고 로그는 남는다 */
  'debate-round2-revote': {
    ...base,
    phase: 'debate',
    round: 2,
    deadlineAt: inSec(161),
    messages: revoteLog,
    voteCounts: {},
    myVote: null,
  },
  /** "살린다" → S2 복귀. accused도 함께 풀린다 */
  'debate-round2-spared': {
    ...base,
    phase: 'debate',
    round: 2,
    deadlineAt: inSec(161),
    messages: sparedLog,
    voteCounts: {},
    myVote: null,
    accused: null,
  },

  // ── S3 ─────────────────────────────────────────────
  'finalDefense-other': {
    ...base,
    phase: 'finalDefense',
    deadlineAt: inSec(60),
    messages: debateLog,
    voteCounts: { p2: 2, p3: 1 },
    accused: 'p2',
  },
  'finalDefense-accused': {
    ...base,
    phase: 'finalDefense',
    deadlineAt: inSec(60),
    messages: debateLog,
    voteCounts: { p3: 3 },
    accused: ME, // 내가 지목당한 경우
  },

  // ── S4 ─────────────────────────────────────────────
  'lifeVote-voter': {
    ...base,
    phase: 'lifeVote',
    deadlineAt: inSec(20),
    accused: 'p2',
    myLifeVote: null,
    lifeVoteCounts: { kill: 1, spare: 0 },
  },
  'lifeVote-accused': {
    ...base,
    phase: 'lifeVote',
    deadlineAt: inSec(20),
    accused: ME,
    lifeVoteCounts: { kill: 2, spare: 1 },
  },

  // ── S5 ─────────────────────────────────────────────
  /** 시민을 잘못 죽인 경우. 이 시점에 라이어 승이 확정되지만 화면에는 띄우지 않는다 —
   *  라이어 적발 때만 결과를 숨기면 "결과가 안 뜬다" 자체가 스포일러가 되므로,
   *  두 경우를 화면에서 구분할 수 없게 둘 다 S7까지 미룬다. (기획서 v2.0 §4) */
  'reveal-citizen': {
    ...base,
    phase: 'reveal',
    accused: 'p2',
    revealedRole: 'citizen',
    liarGameResult: null,
  },
  /** 라이어 적발 — 게임의 클라이맥스. 승패는 아직 미정이므로 liarGameResult는 null.
   *  제시어 추측(S5-a) 결과가 나와야 확정된다. */
  'reveal-liar': {
    ...base,
    phase: 'reveal',
    accused: 'p2',
    revealedRole: 'liar',
    liarGameResult: null,
  },
  'guessWord-liar': {
    ...base,
    phase: 'guessWord',
    myRole: 'liar',
    word: null,
    accused: ME, // 내가 처형된 라이어
    revealedRole: 'liar',
    deadlineAt: inSec(30),
  },
  'guessWord-watcher': {
    ...base,
    phase: 'guessWord',
    accused: 'p2',
    revealedRole: 'liar',
    deadlineAt: inSec(30),
  },
};

export const MOCK_KEYS = Object.keys(MOCK_STATES);
