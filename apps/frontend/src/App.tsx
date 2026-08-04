import { useState } from "react";
import VoteScreen from "./VoteScreen";
import ResultScreen from "./ResultScreen";
import LandingScreen from "./LandingScreen";
import LobbyScreen from "./LobbyScreen";
import { GameScreen } from "./screens/GameScreen";
import { MOCK_STATES } from "./mock/states";
import type { ClientEvent } from "@zeteo/shared-types";
import type { VoteScreenState, ResultScreenState, LobbyScreenState } from "./types";

/**
 * 랜딩 → 대기실 → 게임 진행 → 봇지목 → 결과 전체 흐름을 확인하기 위한
 * 대표 mock 경로 하나. 파트 A의 실제 상태머신(투표 집계·동점 재투표 등)은
 * 아직 없으므로, 각 단계는 "다음 단계" 버튼으로 수동 전환한다.
 * 라이어가 잡히는 경로가 아니라서 guessWord는 거치지 않는다.
 */
const PLAYTHROUGH_SEQUENCE = [
  "roleReveal-citizen",
  "describe-myturn",
  "debate-voted",
  "finalDefense-other",
  "lifeVote-voter",
  "reveal-citizen",
] as const;

/**
 * 파트 D 소유 — 박진
 *
 * 여기서 할 일:
 *   1. A의 net/socket.ts 로 서버에 연결하고 GameState 를 받는다 (아직 미완 — 지금은 mock)
 *   2. phase 에 따라 화면을 고른다
 *        landing / lobby / botVote / result  → D가 직접 그린다
 *        그 외 게임 페이즈                    → <GameScreen state={state} onEvent={onEvent} />
 *          (아래 "game" phase 분기에서 연결됨)
 *
 * 파트 C의 화면 6개를 알 필요가 없다. GameScreen 하나만 마운트하면 된다.
 *
 * 화면을 확인하려면 서버 없이도 된다 —  /?mock=  로 접속하면 파트 C 화면만 따로도 확인 가능.
 *
 * botVote/result는 아직 A의 소켓 연결도, GameState에 필요한 필드(votedCount,
 * reveals 등)도 없어서 실제 서버 데이터로 못 그린다. 확인용으로 아래 mock 값을
 * 임시로 붙여둠 — 진짜 연결은 GameState 확장 논의 이후 교체 필요.
 */
/**
 * "나" 슬롯은 항상 p3 — mock/states.ts의 게임 6단계 mock 상태들이
 * 전부 myId: 'p3'(ME)로 고정되어있어서 대기실도 여기에 맞춘다.
 * 이름을 바꿔 끼우지 말 것 — 파트 C 화면 16개가 p3를 참조 중이다.
 */
const MY_ID = "p3";

const mockLobbyState: LobbyScreenState = {
  roomId: "AB12",
  players: [
    { id: "p1", name: "김정현", isReady: true },
    { id: "p2", name: "박진", isReady: false },
    { id: "p3", name: "이현우", isReady: true },
  ],
  myId: MY_ID,
};

const mockVoteState: VoteScreenState = {
  timerSeconds: 45,
  candidates: [
    { id: "p1", name: "김정현" },
    { id: "p2", name: "박진" },
    { id: "p3", name: "이현우" },
    { id: "p4", name: "유민성" },
    { id: "p5", name: "최서연" },
  ],
  myVote: null,
  votedCount: 3,
  totalCount: 5,
};

const mockResultState: ResultScreenState = {
  winner: "시민 승리",
  botDetectSummary: "5명 중 3명이 봇을 정확히 지목했습니다",
  reveals: [
    { id: "p1", name: "김정현", isMatch: false, roleLabel: "시민" },
    { id: "p2", name: "박진", isMatch: false, roleLabel: "시민" },
    { id: "p3", name: "이현우", isMatch: false, roleLabel: "시민" },
    { id: "p4", name: "유민성", isMatch: false, roleLabel: "시민" },
    { id: "p5", name: "최서연", isMatch: true, roleLabel: "봇" },
  ],
  reasons: [
    { id: 1, label: "발언이 부자연스러웠다" },
    { id: 2, label: "반응 속도가 일정했다" },
  ],
  checkedReasonIds: [],
  freeText: "",
};

type MockPhase = "landing" | "lobby" | "game" | "botVote" | "result";

export function App() {
  const [phase, setPhase] = useState<MockPhase>("landing");
  const [myReady, setMyReady] = useState(false);
  const [joinInfo, setJoinInfo] = useState({ name: "", roomId: "" });
  const [gameStep, setGameStep] = useState(0);

  const withMyName = <T extends { id: string; name: string }>(list: T[]): T[] =>
    joinInfo.name
      ? list.map((p) => (p.id === MY_ID ? { ...p, name: joinInfo.name } : p))
      : list;

  if (phase === "landing") {
    return (
      <LandingScreen
        onJoin={(name, roomId) => {
          setJoinInfo({ name, roomId });
          setPhase("lobby");
        }}
      />
    );
  }

  if (phase === "lobby") {
    const players = mockLobbyState.players.map((p) =>
      p.id === mockLobbyState.myId
        ? { ...p, name: joinInfo.name || p.name, isReady: myReady }
        : p
    );
    return (
      <div>
        <LobbyScreen
          {...mockLobbyState}
          roomId={joinInfo.roomId || mockLobbyState.roomId}
          players={players}
          myReady={myReady}
          onToggleReady={() => setMyReady((r) => !r)}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingBottom: 16 }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              setGameStep(0);
              setPhase("game");
            }}
          >
            게임 시작 (mock)
          </button>
          <button className="btn btn-secondary" onClick={() => setPhase("botVote")}>
            botVote 미리보기
          </button>
          <button className="btn btn-secondary" onClick={() => setPhase("result")}>
            result 미리보기
          </button>
        </div>
      </div>
    );
  }

  if (phase === "game") {
    const stateKey = PLAYTHROUGH_SEQUENCE[gameStep];
    const gameState = {
      ...MOCK_STATES[stateKey],
      players: withMyName(MOCK_STATES[stateKey].players),
    };
    const onEvent = (e: ClientEvent) => console.log("[mock] game event", e);
    const isLastStep = gameStep === PLAYTHROUGH_SEQUENCE.length - 1;

    return (
      <div>
        <GameScreen state={gameState} onEvent={onEvent} />
        <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: 16 }}>
          <span className="text-muted" style={{ fontSize: 12, alignSelf: "center" }}>
            {gameStep + 1} / {PLAYTHROUGH_SEQUENCE.length} · {stateKey}
          </span>
          <button
            className="btn btn-primary"
            onClick={() =>
              isLastStep ? setPhase("botVote") : setGameStep((s) => s + 1)
            }
          >
            {isLastStep ? "봇 지목으로 →" : "다음 단계 →"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "botVote") {
    return (
      <VoteScreen
        {...mockVoteState}
        candidates={withMyName(mockVoteState.candidates)}
        onConfirm={(votedId) => {
          console.log("[mock] botVote", votedId);
          setPhase("result");
        }}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        {...mockResultState}
        reveals={withMyName(mockResultState.reveals)}
        onSubmit={(checkedReasonIds, freeText) =>
          console.log("[mock] result submit", checkedReasonIds, freeText)
        }
      />
    );
  }
}
