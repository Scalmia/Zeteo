import type { GameState, Message, PublicPlayer } from '@zeteo/shared-types';

// ⚠️ 이 파일은 파트 C·D 공동 소유. 변경 시 상대에게 알린다.
//    키 네이밍 규칙: <phase>-<변형>

/** 5인 = 사람 4 + 봇 1. 룰북 캡션의 "4인 게임이면 3표"는 MVP 기준과 맞지 않으므로 쓰지 않는다.
 *
 *  게임 중에는 실명이 아니라 서버가 방마다 무작위 배정하는 label("참가자 X")만 보인다.
 *  실명은 S7의 revealedNames 로만 공개된다 — 참고용 대응은 아래와 같다.
 *    p1 봇담당 · p2 레이아웃담당 · p3 화면담당(=나) · p4 서버담당 · p5 최서연(봇)
 *
 *  ⚠️ 8/11: label을 "참가자 1" 같은 숫자에서 "참가자 A" 같은 영문 한 글자로 바꿨다 —
 *  시안 1(Zeteo_와이어프레임_시안.html)이 참가자를 A~E로 표기하고, 2026-08-06 실 서버
 *  스모크 테스트에서도 실제 label이 "B"·"U"·"K" 같은 영문 한 글자로 옴을 확인했다
 *  (숫자 규칙은 이 mock이 실 서버 검증 이전에 먼저 만들어지며 남은 추정값이었다).
 *
 *  p1~p5 순서와 A~E 글자를 일부러 안 맞춘 것(p1=C, p2=A, p3=D, p4=B, p5=E)은 서버가
 *  label을 무작위 배정하기 때문이다. 화면이 "label = 입장 순서"를 가정하고 있으면
 *  여기서 드러난다. */
const players: PublicPlayer[] = [
  { id: 'p1', label: '참가자 C', isAlive: true, isReady: true },
  { id: 'p2', label: '참가자 A', isAlive: true, isReady: true },
  { id: 'p3', label: '참가자 D', isAlive: true, isReady: true },
  { id: 'p4', label: '참가자 B', isAlive: true, isReady: true },
  { id: 'p5', label: '참가자 E', isAlive: true, isReady: true }, // 실제로는 봇. 클라이언트는 알 수 없어야 한다.
];

/** 대기실 전용. 준비 상태가 섞여 있어야 "준비완료 / 대기" 배지 양쪽이 다 보인다.
 *  나(p3)는 아직 준비 전이라 버튼이 "준비완료"로 뜬다. 봇(p5)은 서버가 입장과 동시에
 *  자동 ready 처리한다 (index.ts 의 join 핸들러). */
const lobbyPlayers: PublicPlayer[] = [
  { id: 'p1', label: '참가자 C', isAlive: true, isReady: true },
  { id: 'p2', label: '참가자 A', isAlive: true, isReady: true },
  { id: 'p3', label: '참가자 D', isAlive: true, isReady: false },
  { id: 'p4', label: '참가자 B', isAlive: true, isReady: false },
  { id: 'p5', label: '참가자 E', isAlive: true, isReady: true },
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
  msg('p1', '참가자 A님 묘사가 너무 두루뭉술한데요', 'debate'),
  msg('p2', '아 진짜 아니라니까', 'debate'),
  msg('p4', '저도 참가자 A님 좀 이상했어요', 'debate'),
];

/** S3까지 진행된 로그. 지목 대상이 p2(참가자 A)이므로 accused: 'p2' 인 mock에만 쓴다 —
 *  accused 가 다른 mock에 붙이면 시스템 메시지와 화면이 서로 다른 사람을 가리키게 된다. */
const finalDefenseLog: Message[] = [
  ...debateLog,
  msg('system', '참가자 A님이 최다 득표로 지목되었습니다.', 'finalDefense'),
  msg('p2', '아니 저 진짜 시민이에요 제시어 알아요', 'finalDefense'),
  msg('p1', '그럼 말해보세요', 'finalDefense'),
];

/** 2라운드 진입("살린다" 복귀). 로그는 지우지 않고 누적한다 —
 *  룰북 S4의 "매 라운드 정보가 누적되어 자연히 수렴한다"가 설계 전제이므로
 *  로그를 비우면 그 전제가 깨진다. 라운드 경계는 시스템 메시지가 만든다. */
const sparedLog: Message[] = [
  ...finalDefenseLog,
  msg('system', '참가자 A님이 살아남았습니다. 토론을 재개합니다.', 'debate'),
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
  // S5-a 라이어가 제출한 제시어. liarGameResult 와 같은 시점(result 진입)에만 채워진다.
  guessWord: null,

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
  // ── 대기실 (파트 D · LobbyScreen) ───────────────────
  lobby: {
    ...base,
    phase: 'lobby',
    players: lobbyPlayers,
  },

  // ── S0 ─────────────────────────────────────────────
  // deadlineAt: 실제 서버의 roleReveal 페이즈 제한시간(10초, apps/backend/src/index.ts
  // PHASE_DURATIONS)과 맞춰 mock에서도 타이머가 실제처럼 카운트다운되게 함.
  // 기획서 v3.0 §6-2에서 실측 확정된 값 — 준비 버튼을 없애고 타이머만 남긴 결과다.
  'roleReveal-citizen': { ...base, deadlineAt: inSec(10) },
  'roleReveal-liar': { ...base, myRole: 'liar', word: null, deadlineAt: inSec(10) },

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
  'debate-voted': {
    ...base,
    phase: 'debate',
    deadlineAt: inSec(161),
    messages: debateLog,
    voteCounts: { p2: 2, p3: 1 },
    myVote: 'p2',
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
  'finalDefense-accused': {
    ...base,
    phase: 'finalDefense',
    deadlineAt: inSec(60),
    messages: debateLog,
    voteCounts: { p3: 3 },
    accused: ME, // 내가 지목당한 경우
  },

  // ── S4 ─────────────────────────────────────────────
  // 이 아래 mock 들은 팝업으로 뜬다. messages 를 채워두는 건 팝업 뒤에 깔리는
  // 메인화면(채팅)이 실제 게임처럼 보여야 배치를 확인할 수 있기 때문이다.
  'lifeVote-voter': {
    ...base,
    phase: 'lifeVote',
    deadlineAt: inSec(20),
    messages: finalDefenseLog,
    accused: 'p2',
    myLifeVote: null,
    lifeVoteCounts: { kill: 1, spare: 0 },
  },
  'lifeVote-accused': {
    ...base,
    phase: 'lifeVote',
    deadlineAt: inSec(20),
    messages: debateLog, // accused 가 나(p3)라 finalDefenseLog(p2 지목)를 쓰면 어긋난다
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
    messages: finalDefenseLog,
    accused: 'p2',
    revealedRole: 'citizen',
    liarGameResult: null,
  },
  /** 라이어 적발 — 게임의 클라이맥스. 승패는 아직 미정이므로 liarGameResult는 null.
   *  제시어 추측(S5-a) 결과가 나와야 확정된다. */
  'reveal-liar': {
    ...base,
    phase: 'reveal',
    messages: finalDefenseLog,
    accused: 'p2',
    revealedRole: 'liar',
    liarGameResult: null,
  },
  'guessWord-liar': {
    ...base,
    phase: 'guessWord',
    myRole: 'liar',
    word: null,
    messages: debateLog, // accused 가 나(p3)라 finalDefenseLog(p2 지목)를 쓰면 어긋난다
    accused: ME, // 내가 처형된 라이어
    revealedRole: 'liar',
    deadlineAt: inSec(30),
  },
  'guessWord-watcher': {
    ...base,
    phase: 'guessWord',
    messages: finalDefenseLog,
    accused: 'p2',
    revealedRole: 'liar',
    deadlineAt: inSec(30),
  },

  // ── S6 봇 지목 (파트 D · VoteScreen) ─────────────────
  botVote: {
    ...base,
    phase: 'botVote',
    deadlineAt: inSec(30),
    messages: finalDefenseLog,
    myVote: null,
    // 진행도는 스포일러가 아니라 언제나 실제 값이다. total 은 봇을 뺀 사람 수(4).
    botVoteCounts: { voted: 2, total: 4 },
  },

  // ── S7 결과 (파트 D · ResultScreen) ──────────────────
  /** 정답 공개 화면. 여기서만 서버가 게이팅을 풀기 때문에(view.ts) revealed* 계열이
   *  전부 실제 값으로 채워지는 유일한 mock 이다. p5=봇, p2=라이어로 앞선 로그와 맞춘다. */
  result: {
    ...base,
    phase: 'result',
    messages: finalDefenseLog,
    accused: 'p2',
    revealedRole: 'liar',
    liarGameResult: 'citizenWin',
    // 라이어가 잡힌 뒤 제시어를 틀린 경우(citizenWin). 정답이면 '호랑이' 로 바꿔 확인한다.
    guessWord: '사자',
    botVoteCounts: { voted: 4, total: 4 },
    botVoteCorrectCount: 3, // 아래 botVoteResults 에서 p5(봇)를 맞힌 사람 수와 일치시킨다
    revealedBotId: 'p5',
    revealedLiarId: 'p2',
    // 실명 자리. 저장소가 public 이라 팀원 실명 대신 역할 라벨을 쓴다(위 헤더 주석과 동일 규칙).
    revealedNames: {
      p1: '봇담당',
      p2: '레이아웃담당',
      p3: '화면담당',
      p4: '서버담당',
      p5: '최서연',
    },
    // 누가 누구를 봇으로 지목했는지. result 이전엔 null 이어야 하는 익명 투표 원본이다.
    botVoteResults: { p1: 'p5', p2: 'p5', p3: 'p5', p4: 'p1' },
  },

  // ── S7-a 설문 (파트 D · SurveyScreen) ────────────────
  /** reasons 는 서버 view.ts 의 SURVEY_REASONS placeholder 와 같은 값이다.
   *  실제 문안은 설문 기획이 확정되면 서버 쪽에서 바뀐다(D2·D3와 같은 미정 항목). */
  survey: {
    ...base,
    phase: 'survey',
    messages: finalDefenseLog,
    reasons: [
      { id: 1, label: '말이 어색했다' },
      { id: 2, label: '반응이 느렸다' },
      { id: 3, label: '다른 사람들과 다른 정보를 아는 것 같았다' },
      { id: 4, label: '그냥 감이었다' },
    ],
  },
};

/** 랜딩만 GameState 로 표현할 수 없다 — App.tsx 는 state === null 일 때 LandingScreen 을
 *  띄우기 때문이다. MockHarness 가 이 키만 따로 처리한다. */
export const LANDING_KEY = 'landing';

/** 실제 GameScreen(채팅+투표+팝업)을 mock 칩으로 훑어보는 테스트 화면 — 정적 상태
 *  하나가 아니라 자체 상호작용을 갖고 있어 다른 키들처럼 MOCK_STATES에 못 넣는다.
 *  MockHarness가 LANDING_KEY와 같은 방식으로 따로 처리한다. */
export const GAME_TEST_KEY = 'game-test';

export const MOCK_KEYS = [GAME_TEST_KEY, LANDING_KEY, ...Object.keys(MOCK_STATES)];
