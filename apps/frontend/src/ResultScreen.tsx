import type { ResultPlayer, ResultScreenState } from "./types";
import Button from "./components/Button";
import FullscreenButton from "./components/FullscreenButton";
import "./styles/tokens.css";

interface ResultScreenProps extends ResultScreenState {
  onNext: () => void;
}

const TAG_CLASS: Record<ResultPlayer["tag"], string> = {
  봇: "tag-accent",
  라이어: "tag-outline",
  시민: "tag-neutral"
};

export default function ResultScreen({
  winner,
  totalVoters,
  botVoteCorrectCount,
  category,
  word,
  guessWord,
  players,
  onNext
}: ResultScreenProps) {
  // 라이어가 안 잡혔거나 시간 초과로 못 냈으면 guessWord 가 null 이라 이 줄 자체를 숨긴다.
  // 맞았는지는 화면에서 직접 비교한다 — 서버가 승패(winner)로만 알려주는데,
  // 봇 지목 결과까지 섞인 문구라 제시어 정답 여부를 따로 읽어낼 수 없다.
  const guessedRight = guessWord !== null && word !== null && guessWord.trim() === word.trim();

  return (
    <div
      style={{
        height: "100dvh",
        overflow: "hidden",
        background: "var(--color-bg)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "var(--space-2)",
        lineHeight: 1.3
      }}
    >
      <div style={{ width: "100%", maxWidth: 520, maxHeight: "100%", overflow: "hidden", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <div
          style={{
            textAlign: "center",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius)",
            background: "var(--color-surface)",
            padding: "var(--space-2)",
            flex: "none",
            position: "relative"
          }}
        >
          <FullscreenButton />
          <div
            className="text-muted"
            style={{ fontSize: "var(--text-caption)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "var(--space-2)" }}
          >
            GAME OVER
          </div>
          <h1 style={{ marginBottom: "var(--space-2)" }}>라이어 게임</h1>
          <div className="tag tag-accent" style={{ fontSize: "var(--text-emphasis)", fontWeight: 700, padding: "4px 16px", marginBottom: "var(--space-2)" }}>
            {winner}
          </div>
          {guessWord !== null && (
            <div style={{ marginBottom: "var(--space-2)" }}>
              <div className="card-title" style={{ fontSize: 20 }}>라이어의 추측</div>
              <div
                className="text-muted"
                style={{
                  fontSize: "var(--text-label)",
                  fontWeight: 600,
                  color: guessedRight ? "var(--color-accent)" : undefined
                }}
              >
                {guessWord} · {guessedRight ? "정답" : "오답"}
              </div>
            </div>
          )}
          <div className="hr" style={{ margin: "var(--space-2) 0" }} />
          <div style={{ marginTop: "var(--space-2)" }}>
            <div className="card-title" style={{ fontSize: 20 }}>봇 색출</div>
            <div className="text-muted" style={{ fontSize: "var(--text-label)", fontWeight: 600 }}>
              {totalVoters}명 중 {botVoteCorrectCount}명이 봇을 정확히 지목했습니다
            </div>
          </div>
          <div style={{ marginTop: "var(--space-2)" }}>
            <div className="card-title" style={{ fontSize: 20 }}>제시어</div>
            <div className="text-muted" style={{ fontSize: "var(--text-label)", fontWeight: 600 }}>
              {category} — {word ?? "—"}
            </div>
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius)",
            background: "var(--color-surface)",
            padding: "var(--space-2)",
            flex: "1",
            minHeight: 0,
            display: "flex",
            flexDirection: "column"
          }}
        >
          <h4 style={{ marginBottom: "var(--space-2)", flex: "none" }}>정체 공개</h4>
          {/* 뷰포트가 너무 낮으면(짧은 창) 이 목록만 내부 스크롤한다 — 페이지 전체
              스크롤바는 안 뜨게 하면서도(요청사항), 정체 공개 같은 핵심 정보가
              화면 밖으로 잘려서 아예 안 보이는 일은 없게 하기 위함. */}
          <div style={{ flex: "1", minHeight: 0, overflowY: "auto" }}>
            {players.map((player, i) => (
              <div
                key={player.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 0",
                  borderBottom: i < players.length - 1 ? "1px solid var(--color-line)" : "none"
                }}
              >
                <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
                  <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "var(--text-body)" }}>
                    {player.label}
                  </span>
                  {player.name && (
                    <span className="text-muted" style={{ fontSize: "var(--text-label)", fontWeight: 600 }}>
                      {player.name}
                    </span>
                  )}
                </span>
                {player.votedFor && (
                  <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "var(--text-body)", marginLeft: "var(--space-2)" }}>
                    → {player.votedFor} 지목
                  </span>
                )}
                <span className={`tag ${TAG_CLASS[player.tag]}`} style={{ fontSize: "var(--text-label)", fontWeight: 600, marginLeft: "auto" }}>{player.tag}</span>
              </div>
            ))}
          </div>
        </div>

        <Button block style={{ fontSize: "var(--text-button)", flex: "none" }} onClick={onNext}>
          다음
        </Button>
      </div>
    </div>
  );
}
