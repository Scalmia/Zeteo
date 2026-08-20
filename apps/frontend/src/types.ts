import type { Message, PublicPlayer } from "@zeteo/shared-types";

export type PlayerId = string;

export interface Reason {
  id: number;
  label: string;
}

export interface ResultPlayer {
  id: PlayerId;
  label: string;
  name: string | null;
  tag: "시민" | "라이어" | "봇";
  votedFor: string | null; // 이 사람이 봇지목 투표에서 찍은 대상의 label
}

export interface ResultScreenState {
  winner: string;
  totalVoters: number;
  botVoteCorrectCount: number;
  category: string;
  word: string | null;
  /** 라이어가 제출한 추측 단어. 라이어가 안 잡혔거나 시간 초과로 못 냈으면 null */
  guessWord: string | null;
  players: ResultPlayer[];
}

/** 기획서 v4.0 리플레이 통합(2026-08-20) — 설문 화면이 플레이 화면과 같은 레이아웃(헤더+
 * 채팅로그+우측 패널)을 쓰면서, 게임이 끝난 뒤 대화를 다시 보고 결과를 참고하며 설문에
 * 답할 수 있게 됐다. reasons/checkedReasonIds/freeText(기존 설문 항목) 외에 채팅 리플레이용
 * 필드와 ResultScreenState 서브셋(카테고리/제시어는 헤더에 이미 있어 제외)이 추가됐다. */
export interface SurveyScreenState {
  reasons: Reason[];
  checkedReasonIds: number[];
  freeText: string;

  // 채팅 리플레이
  messages: Message[];
  /** ChatLog가 발언자 라벨 조회에 쓰는 원본 참가자 목록(GameState.players 그대로). */
  chatPlayers: PublicPlayer[];
  myId: PlayerId;
  category: string;
  word: string | null;
  /** 랜딩에서 입력한 닉네임(playerId → 닉네임). 게임이 끝난 뒤에만 공개된다(revealedNames). */
  nicknames: Record<string, string> | null;

  // ResultScreenState 서브셋
  winner: string;
  totalVoters: number;
  botVoteCorrectCount: number;
  guessWord: string | null;
  resultPlayers: ResultPlayer[];

  /** 봇 지목 현황바 표시용. 내가 봇으로 지목한 대상(익명 투표라 결과 공개 후에만 알 수
   *  있음, 기권/미투표면 null)과 실제 봇이었던 대상. */
  myBotVoteTargetId: string | null;
  revealedBotId: string | null;
}

export interface LobbyPlayer {
  id: PlayerId;
  label: string;
  isReady: boolean;
}

export interface LobbyScreenState {
  roomId: string;
  players: LobbyPlayer[];
  myId: PlayerId;
}
