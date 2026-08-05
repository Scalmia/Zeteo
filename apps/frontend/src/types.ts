import type { PublicPlayer } from "@zeteo/shared-types";

export type PlayerId = string;

export interface VoteScreenState {
  deadlineAt: number | null;
  candidates: PublicPlayer[];
  myVote: PlayerId | null;
  botVoteCounts: { voted: number; total: number };
}

export interface Reason {
  id: number;
  label: string;
}

export interface ResultScreenState {
  winner: string;
  totalVoters: number;
  botVoteCorrectCount: number;
  revealedBotName: string | null;
  revealedLiarName: string | null;
  reasons: Reason[];
  checkedReasonIds: number[];
  freeText: string;
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
