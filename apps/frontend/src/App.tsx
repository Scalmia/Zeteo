import VoteScreen from "./VoteScreen";
import ResultScreen from "./ResultScreen";
import LandingScreen from "./LandingScreen";
import LobbyScreen from "./LobbyScreen";
import { GameScreen } from "./screens/GameScreen";
import { useGameState } from "./hooks/useGameState";

/**
 * 파트 D 소유 — 박진
 *
 * phase 에 따라 화면을 고른다
 *   lobby / botVote / result / survey → D가 직접 그린다
 *   그 외 게임 페이즈                 → <GameScreen state={state} onEvent={onEvent} />
 *
 * 파트 C의 화면 6개를 알 필요가 없다. GameScreen 하나만 마운트하면 된다.
 */

// 이 페이즈들은 파트 C의 GameScreen이 그린다. 나머지(lobby/botVote/result/survey)는 D가 직접.
const GAME_SCREEN_PHASES = new Set([
  "roleReveal",
  "describe",
  "debate",
  "finalDefense",
  "lifeVote",
  "reveal",
  "guessWord",
]);

export function App() {
  const { state, onEvent, error } = useGameState();

  if (!state) {
    return (
      <div>
        {error && (
          <div className="text-danger" style={{ textAlign: "center", padding: 8 }}>
            {error}
          </div>
        )}
        <LandingScreen
          onJoin={(name, roomId) => onEvent({ t: "join", roomId, name })}
        />
      </div>
    );
  }

  if (state.phase === "lobby") {
    const me = state.players.find((p) => p.id === state.myId);
    return (
      <LobbyScreen
        roomId={state.roomId}
        players={state.players}
        myId={state.myId}
        myReady={me?.isReady ?? false}
        onToggleReady={() => onEvent({ t: "ready" })}
      />
    );
  }

  if (GAME_SCREEN_PHASES.has(state.phase)) {
    return <GameScreen state={state} onEvent={onEvent} />;
  }

  if (state.phase === "botVote") {
    const timerSeconds = state.deadlineAt
      ? Math.max(0, Math.round((state.deadlineAt - Date.now()) / 1000))
      : 0;
    return (
      <VoteScreen
        timerSeconds={timerSeconds}
        candidates={state.players}
        myVote={state.myVote}
        botVoteCounts={state.botVoteCounts}
        onConfirm={(votedId) => onEvent({ t: "botVote", targetId: votedId })}
      />
    );
  }

  if (state.phase === "result") {
    const nameOf = (id: string | null) =>
      id ? (state.revealedNames?.[id] ?? state.players.find((p) => p.id === id)?.label ?? null) : null;
    const winner =
      state.liarGameResult === "liarWin"
        ? "라이어 승리"
        : state.liarGameResult === "citizenWin"
          ? "시민 승리"
          : "";

    return (
      <ResultScreen
        winner={winner}
        totalVoters={state.botVoteCounts.total}
        botVoteCorrectCount={state.botVoteCorrectCount}
        revealedBotName={nameOf(state.revealedBotId)}
        revealedLiarName={nameOf(state.revealedLiarId)}
        reasons={state.reasons}
        checkedReasonIds={[]}
        freeText=""
        onSubmit={(checkedReasonIds, freeText) =>
          onEvent({ t: "survey", reasonIds: checkedReasonIds, freeText })
        }
      />
    );
  }

  // survey 등 아직 전용 화면이 없는 페이즈
  return <div className="text-muted" style={{ textAlign: "center", padding: 32 }}>다음 단계 준비 중…</div>;
}
