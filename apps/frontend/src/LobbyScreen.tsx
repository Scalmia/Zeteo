import type { LobbyPlayer, LobbyScreenState } from "./types";
import Avatar from "./components/Avatar";
import Button from "./components/Button";
import FullscreenButton from "./components/FullscreenButton";
import { MAX_PLAYERS, MIN_PLAYERS } from "./roomConfig";
import "./styles/tokens.css";

interface LobbyScreenProps extends LobbyScreenState {
  myReady: boolean;
  onToggleReady: () => void;
  onBack: () => void;
  /** 이 방을 만든 사람인지 — 방장만 게임시작 버튼을 본다. */
  isHost: boolean;
  readyCount: number;
  /** TODO(backend): 방장 전용 게임시작 이벤트가 서버에 생기면 연결한다. */
  onStartGame: () => void;
}

export default function LobbyScreen({
  roomId,
  players,
  myId,
  myReady,
  onToggleReady,
  onBack,
  isHost,
  readyCount,
  onStartGame
}: LobbyScreenProps) {
  const slots: (LobbyPlayer | null)[] = Array.from({ length: MAX_PLAYERS }, (_, i) => players[i] ?? null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "var(--space-4)"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius)",
          background: "var(--color-surface)",
          padding: "var(--space-4)",
          position: "relative"
        }}
      >
        <FullscreenButton />
        <Button
          variant="secondary"
          style={{ position: "absolute", top: "var(--space-2)", left: "var(--space-2)", fontSize: "var(--text-label)", padding: "4px 10px" }}
          onClick={onBack}
        >
          뒤로
        </Button>
        <div style={{ textAlign: "center", marginTop: 24, marginBottom: "var(--space-4)" }}>
          <p className="text-muted" style={{ fontSize: "var(--text-caption)", fontWeight: 600, marginBottom: "var(--space-2)" }}>대기실</p>
          <div className="tag tag-outline" style={{ display: "inline-block" }}>방번호 {roomId}</div>
        </div>

        <div className="hr" />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
          {slots.map((p, i) => (
            <div
              key={p ? p.id : `empty-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-4)",
                border: "1px solid var(--color-line)",
                borderRadius: "var(--radius)"
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Avatar label={p ? p.label : "–"} variant={p && p.id === myId ? "mine" : "default"} />
                <span style={{ fontSize: "var(--text-body)", fontWeight: p ? 600 : 400, color: p ? "var(--color-text)" : "var(--color-muted)" }}>
                  {p ? p.label : "대기중"}
                  {p && p.id === myId ? " (나)" : ""}
                </span>
              </span>
              {p && (
                <span className={`tag ${p.isReady ? "tag-accent" : "tag-neutral"}`} style={{ fontSize: "var(--text-label)", fontWeight: 600 }}>
                  {p.isReady ? "준비완료" : "대기"}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="text-muted" style={{ fontSize: "var(--text-label)", fontWeight: 600, textAlign: "center", marginBottom: "var(--space-4)" }}>
          {players.filter((p) => p.isReady).length} / {players.length}명 준비완료
        </div>

        <Button block style={{ fontSize: "var(--text-button)" }} onClick={onToggleReady}>
          {myReady ? "준비 취소" : "준비완료"}
        </Button>

        {isHost && (
          <Button
            block
            disabled={readyCount < MIN_PLAYERS}
            style={{ fontSize: "var(--text-button)", marginTop: "var(--space-2)" }}
            onClick={onStartGame}
          >
            게임시작
          </Button>
        )}
      </div>
    </div>
  );
}
