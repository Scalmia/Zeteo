import type { ResultPlayer, ResultScreenState } from "./types";
import "./styles/tokens.css";

interface ResultScreenProps extends ResultScreenState {
  onNext: () => void;
}

const TAG_CLASS: Record<ResultPlayer["tag"], string> = {
  봇: "tag-accent",
  라이어: "tag-neutral",
  시민: "tag-outline"
};

export default function ResultScreen({
  winner,
  totalVoters,
  botVoteCorrectCount,
  category,
  word,
  players,
  onNext
}: ResultScreenProps) {
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
      <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div
          style={{
            textAlign: "center",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius)",
            background: "var(--color-surface)",
            padding: "var(--space-4)"
          }}
        >
          <div
            className="text-muted"
            style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "var(--space-2)" }}
          >
            GAME OVER
          </div>
          <h1 style={{ marginBottom: "var(--space-4)" }}>라이어 게임</h1>
          <div className="tag tag-accent" style={{ fontSize: 14, padding: "6px 16px", marginBottom: "var(--space-4)" }}>
            {winner}
          </div>
          <div className="hr" />
          <div style={{ marginTop: "var(--space-4)" }}>
            <div className="card-title" style={{ fontSize: 20 }}>봇 색출</div>
            <div className="text-muted" style={{ fontSize: 13 }}>
              {totalVoters}명 중 {botVoteCorrectCount}명이 봇을 정확히 지목했습니다
            </div>
          </div>
          <div style={{ marginTop: "var(--space-4)" }}>
            <div className="card-title" style={{ fontSize: 20 }}>제시어</div>
            <div className="text-muted" style={{ fontSize: 13 }}>
              {category} — {word ?? "—"}
            </div>
          </div>
        </div>

        <div style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: "var(--space-4)" }}>
          <h4 style={{ marginBottom: "var(--space-4)" }}>정체 공개</h4>
          <div>
            {players.map((player, i) => (
              <div
                key={player.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-2) 0",
                  borderBottom: i < players.length - 1 ? "1px solid var(--color-line)" : "none"
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
                    <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 16 }}>
                      {player.label}
                    </span>
                    {player.name && (
                      <span className="text-muted" style={{ fontSize: 13 }}>
                        {player.name}
                      </span>
                    )}
                  </span>
                  {player.votedFor && (
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      → {player.votedFor} 지목
                    </span>
                  )}
                </span>
                <span className={`tag ${TAG_CLASS[player.tag]}`}>{player.tag}</span>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-block" onClick={onNext}>
          다음
        </button>
      </div>
    </div>
  );
}
