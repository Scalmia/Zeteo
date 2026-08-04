import { useState } from "react";
import VoteScreen from "./VoteScreen";
import ResultScreen from "./ResultScreen";
import type { VoteScreenState, ResultScreenState } from "./types";

/**
 * 파트 D 소유 — 박진
 *
 * 여기서 할 일:
 *   1. A의 net/socket.ts 로 서버에 연결하고 GameState 를 받는다
 *   2. phase 에 따라 화면을 고른다
 *        lobby / botVote / result  → D가 직접 그린다
 *        그 외 게임 페이즈          → <GameScreen state={state} onEvent={onEvent} />
 *
 * 파트 C의 화면 6개를 알 필요가 없다. GameScreen 하나만 마운트하면 된다.
 *
 * 화면을 확인하려면 서버 없이도 된다 —  /?mock=  로 접속.
 *
 * botVote/result는 아직 A의 소켓 연결도, GameState에 필요한 필드(votedCount,
 * reveals 등)도 없어서 실제 서버 데이터로 못 그린다. 확인용으로 아래 mock 값을
 * 임시로 붙여둠 — 진짜 연결은 GameState 확장 논의 이후 교체 필요.
 */
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

type MockPhase = "lobby" | "botVote" | "result";

export function App() {
  const [phase, setPhase] = useState<MockPhase>("lobby");

  if (phase === "botVote") {
    return (
      <VoteScreen
        {...mockVoteState}
        onConfirm={(votedId) => console.log("[mock] botVote", votedId)}
      />
    );
  }

  if (phase === "result") {
    return (
      <ResultScreen
        {...mockResultState}
        onSubmit={(checkedReasonIds, freeText) =>
          console.log("[mock] result submit", checkedReasonIds, freeText)
        }
      />
    );
  }

  return (
    <div className="zt-screen zt-center">
      <div className="zt-card">
        <p className="zt-label">Zeteo</p>
        <p className="zt-role">파트 D 작업 예정</p>
        <p className="zt-muted">
          랜딩 · 방 입장 · 봇 지목 · 최종 결과
          <br />
          게임 화면은 <a href="?mock=">?mock=</a> 에서 확인
        </p>
        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
          <button className="btn btn-secondary" onClick={() => setPhase("botVote")}>
            botVote 미리보기
          </button>
          <button className="btn btn-secondary" onClick={() => setPhase("result")}>
            result 미리보기
          </button>
        </div>
      </div>
    </div>
  );
}
