import ResultScreen from "./ResultScreen";
import SurveyScreen from "./SurveyScreen";
import LandingScreen from "./LandingScreen";
import LobbyScreen from "./LobbyScreen";
import { GameScreen } from "./screens/GameScreen";
import { useGameState } from "./hooks/useGameState";
import { Ambience } from "./components/Ambience";
import { ParticleTrail } from "./components/ParticleTrail";
import type { ClientEvent, GameState } from "@zeteo/shared-types";

/**
 * 파트 D 소유 — 박진
 *
 * phase 에 따라 화면을 고른다
 *   lobby / result / survey → D가 직접 그린다
 *   그 외 게임 페이즈        → <GameScreen state={state} onEvent={onEvent} />
 *
 * botVote는 기획서 v3.0로 파트 C(GameScreen 팝업)로 이관됐다(8/11) — 예전엔 여기서
 * VoteScreen을 직접 그렸지만, 이제 GAME_SCREEN_PHASES에 포함되어 C쪽에서 처리한다.
 *
 * 파트 C의 화면들을 알 필요가 없다. GameScreen 하나만 마운트하면 된다.
 */

// 이 페이즈들은 파트 C의 GameScreen이 그린다. 나머지(lobby/result/survey)는 D가 직접.
const GAME_SCREEN_PHASES = new Set([
  "roleReveal",
  "describe",
  "debate",
  "finalDefense",
  "lifeVote",
  "reveal",
  "guessWord",
  "botVote",
]);

// 서버가 이 필드들을 빠뜨리고 보내면 하위 화면(state.players.find 등)이 그대로 크래시한다.
// 각 phase로 넘어가기 직전, 그 phase가 실제로 쓰는 필드만 여기서 한 번에 확인한다 —
// 통과하면 그 아래로는 필드가 있다고 안심하고 그대로 써도 된다.
function MissingData({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", padding: 32, color: "var(--color-danger)" }}>
      {label} 정보를 받지 못했습니다. 잠시 후 다시 시도해주세요.
    </div>
  );
}

function renderScreen(state: GameState | null, onEvent: (e: ClientEvent) => void, onLeave: () => void) {
  if (!state) {
    return (
      <LandingScreen
        onJoin={(name, roomId) => onEvent({ t: "join", roomId, name })}
      />
    );
  }

  if (state.phase === "lobby") {
    if (!state.players) return <MissingData label="플레이어" />;
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
    if (!state.players || !state.messages || !state.voteCounts || !state.lifeVoteCounts || !state.botVoteCounts) {
      return <MissingData label="게임" />;
    }
    return <GameScreen state={state} onEvent={onEvent} />;
  }

  if (state.phase === "result") {
    if (!state.players || !state.botVoteCounts) {
      return <MissingData label="결과" />;
    }
    const winner =
      state.liarGameResult === "liarWin"
        ? "라이어 승리"
        : state.liarGameResult === "citizenWin"
          ? "시민 승리"
          : "";
    const labelOf = (id: string) => state.players.find((pl) => pl.id === id)?.label ?? id;
    const resultPlayers = state.players.map((p) => ({
      id: p.id,
      label: p.label,
      name: state.revealedNames?.[p.id] ?? null,
      tag: p.id === state.revealedBotId ? ("봇" as const) : p.id === state.revealedLiarId ? ("라이어" as const) : ("시민" as const),
      votedFor: state.botVoteResults?.[p.id] ? labelOf(state.botVoteResults[p.id]!) : null
    }));

    return (
      <ResultScreen
        winner={winner}
        totalVoters={state.botVoteCounts.total}
        botVoteCorrectCount={state.botVoteCorrectCount}
        category={state.category}
        word={state.word}
        guessWord={state.guessWord}
        players={resultPlayers}
        onNext={() => onEvent({ t: "ready" })}
      />
    );
  }

  if (state.phase === "survey") {
    return (
      <SurveyScreen
        reasons={state.reasons}
        checkedReasonIds={[]}
        freeText=""
        onSubmit={(checkedReasonIds, freeText) => {
          onEvent({ t: "survey", reasonIds: checkedReasonIds, freeText });
          onLeave();
        }}
      />
    );
  }

  return <div className="text-muted" style={{ textAlign: "center", padding: 32 }}>다음 단계 준비 중…</div>;
}

export function App() {
  const { state, onEvent, connected, error, leaveToLanding } = useGameState();

  return (
    <div>
      <Ambience />
      <ParticleTrail />
      {!connected && (
        <div style={{ textAlign: "center", padding: 8, color: "var(--color-danger)" }}>
          서버와 연결이 끊겼습니다. 재연결 시도 중…
        </div>
      )}
      {error && (
        <div style={{ textAlign: "center", padding: 8, color: "var(--color-danger)" }}>
          {error}
        </div>
      )}
      {renderScreen(state, onEvent, leaveToLanding)}
    </div>
  );
}
