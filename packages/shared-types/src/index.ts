export type Phase =
  | 'lobby' // 방 대기
  | 'roleReveal' // S0 역할 배정
  | 'describe' // S1 묘사 (턴제, 1바퀴)
  | 'debate' // S2 토론 + 투표 (동시)
  | 'finalDefense' // S3 최후 변론
  | 'lifeVote' // S4 생사 투표
  | 'reveal' // S5 정체 공개
  | 'guessWord' // S5-a 제시어 추측 (라이어 적발 시에만)
  | 'botVote' // S6 봇 지목 (익명)
  | 'result' // S7 최종 결과
  | 'survey';

export type Role = 'citizen' | 'liar';

/** 서버 내부 전용 — 클라이언트로 절대 나가면 안 된다 */
export interface InternalPlayer {
  id: string;
  name: string;
  isAlive: boolean;
  isBot: boolean; // 유출 금지
  role: Role; // 유출 금지
  label: string; // ★ 추가 — 클라이언트에 노출되는 익명 표시용 라벨 (예: "참가자 3")
}

/** 클라이언트가 받는 플레이어 정보 */
export interface PublicPlayer {
  id: string;
  label: string;
  isAlive: boolean;
  isReady: boolean; // 대기실에서 준비 완료 여부. 서버 room.readyIds 기준
}

export interface Message {
  id: string;
  speakerId: string; // 시스템 메시지는 'system' 사용
  text: string;
  phase: Phase; // 발언이 속한 단계
  at: number; // epoch ms
}
/** S7 설문 — "왜 봇이라 생각했나" 선택지 1개 */
export interface SurveyReason {
  id: number;
  label: string;
}

// ★ 추가 (방 목록 기능) ─────────────────────────────────────────────
// 방 정원(MIN_PLAYERS·MAX_PLAYERS)은 여기 두지 않는다. 이 패키지는 package.json 의
// main 이 src/index.ts 를 그대로 가리키는 타입 전용 패키지라, 오가는 게 타입뿐일 때만
// 성립한다 — 타입 import 는 컴파일 때 통째로 사라지지만, 런타임 값(const)을 넣으면
// 빌드된 apps/backend/dist 가 실행 중 require('@zeteo/shared-types') 를 시도하고
// Node 가 .ts 를 못 읽어 그 자리에서 죽는다(실측). 정원 값은 서버는 room.ts,
// 프론트는 roomConfig.ts 에 각각 두고 주석으로 서로를 가리킨다.

/** 방 목록 화면이 방 하나를 그리는 데 필요한 것만 담는다 (listRooms 응답).
 *  status는 서버가 phase·인원으로 계산해서 내려준다 — 클라이언트가 판단하지 않는다. */
export interface RoomSummary {
  roomId: string;
  title: string;
  hostName: string;
  count: number; // 봇 포함 현재 인원
  status: 'open' | 'full' | 'playing';
}

/** 서버가 각 플레이어에게 개별 생성해 보내는 상태 */
export interface GameState {
  roomId: string;
  phase: Phase;
  players: PublicPlayer[];
  category: string; // 주제 — 전원 공개
  word: string | null; // 제시어 — 라이어에겐 null
  myRole: Role; // 본인 역할만
  turnOrder: string[]; // S1 발언 순서 (플레이어 id 배열)
  currentTurn: string | null; // 현재 발언 차례인 플레이어 id
  deadlineAt: number | null; // 타이머 마감 절대 시각 (epoch ms)
  messages: Message[];
  voteCounts: Record<string, number>; // 득표 수만 공개
  myVote: string | null; // S2 내 지목 선택
  accused: string | null; // 최후 변론 대상
  myId: string; // 자기 자신의 플레이어 id
  round: number; // 동점 재투표·복귀 시 phase 유지로 구분
  myLifeVote: boolean | null; // S4 내 kill/spare 선택
  lifeVoteCounts: { kill: number; spare: number }; // S4 생사 투표 집계
  revealedRole: Role | null; // S5 처형자 역할 공개
  liarGameResult: 'liarWin' | 'citizenWin' | null; // S5 라이어 게임 승패
  guessWord: string | null; // S7 라이어가 제출한 제시어
  botVoteCounts: { voted: number; total: number }; // S6 익명 투표 진행도
  botVoteCorrectCount: number; // S7 봇을 맞힌 인원 수 (result 이전엔 0)
  revealedBotId: string | null; // S7 봇이었던 사람 (result 이전엔 null)
  revealedLiarId: string | null; // S7 라이어였던 사람 (result 이전엔 null)
  revealedNames: Record<string, string> | null; // S7 playerId → 실명 (result 이전엔 null)
  botVoteResults: Record<string, string> | null; // S7 투표자 → 지목 대상 (result 이전엔 null)
  reasons: SurveyReason[]; // S7 "왜 봇이라 생각했나" 설문 선택지
  // ★ 추가 (방 목록 기능) — 이 방을 만든 사람인지. 대기실 게임시작 버튼 노출 기준이다.
  // 클라이언트가 "내가 방을 만들었다"고 기억하는 값은 새로고침하면 날아가고 위조도
  // 되므로, 판단 근거는 서버가 쥔 room.hostId 하나로 통일한다.
  isHost: boolean;
}

// 클라이언트 → 서버
export type ClientEvent =
  // title은 ★ 추가 (방 목록 기능) — 방을 새로 만들 때만 보낸다. 이미 있는 방에
  // 들어갈 땐 생략하며 서버도 무시한다. 방 만들기를 별도 이벤트로 안 쪼갠 건,
  // 프론트가 "방 만들기"와 "방 클릭 입장"을 둘 다 join 하나로 보내고 있어서다.
  | { t: 'join'; roomId: string; name: string; title?: string }
  // 새로고침 복귀 전용. join과 달리 새 플레이어를 만들지 않고, 그 playerId가 아직
  // room.players에 남아 있으면(게임 중 disconnect는 안 지움) 소켓만 다시 연결한다.
  | { t: 'rejoin'; roomId: string; playerId: string }
  | { t: 'ready' }
  | { t: 'listRooms' } // ★ 추가 (방 목록 기능) — 응답은 ServerEvent 'roomList'
  // ★ 추가 (방 목록 기능) — 방장이 누르는 게임시작. 방장 여부·최소 인원은 서버가
  // 다시 검증한다(클라이언트의 버튼 비활성화는 UI 편의일 뿐 방어 수단이 아니다).
  | { t: 'startGame' }
  | { t: 'describe'; text: string }
  | { t: 'chat'; text: string }
  | { t: 'vote'; targetId: string | null } // null = 기권
  | { t: 'lifeVote'; kill: boolean }
  | { t: 'guessWord'; word: string }
  | { t: 'botVote'; targetId: string }
  // pickedMessageId: "가장 봇 같았던 발언"으로 고른 Message.id(런타임 id 그대로).
  // 안 고르고 낼 수 있어서 optional 이다 — 필수로 만들면 이 하나 때문에 설문 전체가
  // 안 들어오는 길이 생긴다. 시스템 메시지는 고를 대상이 아니라 서버가 걸러낸다.
  | { t: 'survey'; reasonIds: number[]; freeText: string; pickedMessageId?: string };

// 서버 → 클라이언트
export type ServerEvent =
  | { t: 'state'; state: GameState } // 변화 시마다 전체 전송
  | { t: 'error'; reason: string }
  // ★ 추가 (방 목록 기능) — listRooms 요청에 대한 응답. state와 달리 아직 방에
  // 안 들어간 사람에게도 보내야 해서 별도 이벤트다.
  | { t: 'roomList'; rooms: RoomSummary[] };

// 파트 A ↔ 파트 B 계약 (파트 C는 사용하지 않음)

export interface BotContext {
  phase: Phase;
  myRole: Role;
  category: string;
  word: string | null; // 라이어면 null
  selfId: string;
  players: PublicPlayer[];
  transcript: Message[]; // 지금까지의 전체 발언
  voteCounts: Record<string, number>;
  accusedId: string | null; // 현재 최후 변론 대상 (없으면 null)
  myVote: string | null; // S2에서 내가 이미 투표했는지 / 누구에게
}

// 사람의 ClientEvent와 대칭을 이룬다 — describe/chat 구분이 없으면
// 서버가 봇의 모든 발언을 묘사로 간주해 턴 카운터를 올린다.
export type BotAction =
  | { t: 'describe'; text: string; delayMs: number } // S1 묘사 턴 발언
  | { t: 'chat'; text: string; delayMs: number } // S2·S3 자유 채팅
  | { t: 'vote'; targetId: string | null }
  | { t: 'lifeVote'; kill: boolean }
  | { t: 'guessWord'; word: string }
  | { t: 'silent'; delayMs: number }; // 지금은 발언 없음. delayMs 뒤 재판단

export type DecideBotAction = (ctx: BotContext) => Promise<BotAction>;
// 파트 B 봇 구현체가 export해야 하는 함수 타입
