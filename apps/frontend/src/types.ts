export type PlayerId = string;

export interface Candidate {
  id: PlayerId;
  name: string;
}

export interface VoteScreenState {
  timerSeconds: number;
  candidates: Candidate[];
  myVote: PlayerId | null;
  votedCount: number;
  totalCount: number;
}

export interface Reveal {
  id: PlayerId;
  name: string;
  isMatch: boolean;
  roleLabel: string;
}

export interface Reason {
  id: number;
  label: string;
}

export interface ResultScreenState {
  winner: string;
  botDetectSummary: string;
  reveals: Reveal[];
  reasons: Reason[];
  checkedReasonIds: number[];
  freeText: string;
}
