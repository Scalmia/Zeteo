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
  players: ResultPlayer[];
}

export interface SurveyScreenState {
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
