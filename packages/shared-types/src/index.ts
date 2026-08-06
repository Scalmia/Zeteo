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
  isReady : boolean;
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
  botVoteCounts: { voted: number; total: number }; // S6 익명 투표 진행도
  botVoteCorrectCount: number; // S7 봇을 맞힌 인원 수 (result 이전엔 0)
  revealedBotId: string | null; // S7 봇이었던 사람 (result 이전엔 null)
  revealedLiarId: string | null; // S7 라이어였던 사람 (result 이전엔 null)
  revealedNames: Record<string, string> | null; // S7 playerId → 실명 (result 이전엔 null)
  reasons: SurveyReason[]; // S7 "왜 봇이라 생각했나" 설문 선택지
}

// 클라이언트 → 서버
export type ClientEvent =
  | { t: 'join'; roomId: string; name: string }
  | { t: 'ready' }
  | { t: 'describe'; text: string }
  | { t: 'chat'; text: string }
  | { t: 'vote'; targetId: string | null } // null = 기권
  | { t: 'lifeVote'; kill: boolean }
  | { t: 'guessWord'; word: string }
  | { t: 'botVote'; targetId: string }
  | { t: 'survey'; reasonIds: number[]; freeText: string };

// 서버 → 클라이언트
export type ServerEvent =
  | { t: 'state'; state: GameState } // 변화 시마다 전체 전송
  | { t: 'error'; reason: string };

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
