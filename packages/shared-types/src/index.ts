// packages/shared-types/src/index.ts
export type GamePhase = "waiting" | "playing" | "voting" | "reveal" | "ended";

export interface GameState {
  currentPhase: GamePhase;
  topic: string;
  // ... 이후 기획서 v6 데이터 구조대로 채움
}
