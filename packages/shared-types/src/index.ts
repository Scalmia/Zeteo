export type Phase =
  | 'lobby'        // 방 대기
  | 'roleReveal'   // S0 역할 배정
  | 'describe'     // S1 묘사 (턴제, 1바퀴)
  | 'debate'       // S2 토론 + 투표 (동시)
  | 'finalDefense' // S3 최후 변론
  | 'lifeVote'     // S4 생사 투표
  | 'reveal'       // S5 정체 공개
  | 'guessWord'    // S5-a 제시어 추측 (라이어 적발 시에만)
  | 'botVote'      // S6 봇 지목 (익명)
  | 'result'      // S7 최종 결과
  | 'survey';

export type Role = 'citizen' | 'liar';

/** 서버 내부 전용 — 클라이언트로 절대 나가면 안 된다 */
export interface InternalPlayer {
  id: string;
  name: string;
  isAlive: boolean;
  isBot: boolean; // 유출 금지
  role: Role;     // 유출 금지
}

/** 클라이언트가 받는 플레이어 정보 */
export interface PublicPlayer {
  id: string;
  name: string;
  isAlive: boolean;
}

export interface Message {
  id: string;
  speakerId: string; // 시스템 메시지는 'system' 사용
  text: string;
  phase: Phase; // 발언이 속한 단계
  at: number;   // epoch ms
}

/** 서버가 각 플레이어에게 개별 생성해 보내는 상태 */
export interface GameState {
  roomId: string;
  phase: Phase;
  players: PublicPlayer[];
  category: string;           // 주제 — 전원 공개
  word: string | null;        // 제시어 — 라이어에겐 null
  myRole: Role;               // 본인 역할만
  turnOrder: string[];        // S1 발언 순서 (플레이어 id 배열)
  currentTurn: string | null; // 현재 발언 차례인 플레이어 id
  deadlineAt: number | null;  // 타이머 마감 절대 시각 (epoch ms)
  messages: Message[];
  voteCounts: Record<string, number>; // 득표 수만 공개
  myVote: string | null;      // S2 내 지목 선택
  accused: string | null;     // 최후 변론 대상

  myId: string;               // 자기 자신의 플레이어 id
  round: number;              // 동점 재투표·복귀 시 phase 유지로 구분
  myLifeVote: boolean | null;                      // S4 내 kill/spare 선택
  lifeVoteCounts: { kill: number; spare: number }; // S4 생사 투표 집계
  revealedRole: Role | null;                       // S5 처형자 역할 공개
  liarGameResult: 'liarWin' | 'citizenWin' | null; // S5 라이어 게임 승패
  revealedBotId: string | null;
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
  | { t: 'survey'; resonIds: number[]; freeText: string};
  

// 서버 → 클라이언트
export type ServerEvent =
  | { t: 'state'; state: GameState } // 변화 시마다 전체 전송
  | { t: 'error'; reason: string };

// 파트 A ↔ 파트 B 계약 (파트 C는 사용하지 않음)

export interface BotContext {
  phase: Phase;
  myRole: Role;
  category: string;
  word: string | null;   // 라이어면 null
  selfId: string;
  players: PublicPlayer[];
  transcript: Message[]; // 지금까지의 전체 발언
  voteCounts: Record<string, number>;
}

export type BotAction =
  | { t: 'speak'; text: string; delayMs: number }
  | { t: 'vote'; targetId: string | null }
  | { t: 'lifeVote'; kill: boolean }
  | { t: 'guessWord'; word: string }
  | { t: 'silent' }; // 이번 턴 발언 없음

export type DecideBotAction = (ctx: BotContext) => Promise<BotAction>; 
// 파트 B 봇 구현체가 export해야 하는 함수 타입
