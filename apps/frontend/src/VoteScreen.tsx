import { useEffect, useState } from "react";
import type { PublicPlayer } from "@zeteo/shared-types";
import type { PlayerId, VoteScreenState } from "./types";
import "./styles/tokens.css";

interface VoteScreenProps extends VoteScreenState {
  onConfirm: (votedId: PlayerId) => void;
}

export default function VoteScreen({
  deadlineAt,
  candidates,
  myVote: initialVote,
  botVoteCounts,
  onConfirm
}: VoteScreenProps) {
  const [myVote, setMyVote] = useState<PlayerId | null>(initialVote);

  // Timer.tsx와 동일한 패턴: deadlineAt - now를 매 틱 새로 계산해야
  // 백그라운드 탭에서 setInterval이 throttle 돼도 시간이 밀리지 않는다.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadlineAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadlineAt]);

  const timerSeconds = deadlineAt === null ? 0 : Math.max(0, Math.round((deadlineAt - now) / 1000));
  const mm = Math.floor(timerSeconds / 60);
  const ss = String(timerSeconds % 60).padStart(2, "0");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        display: "flex",
        justifyContent: "center",
        padding: "var(--space-4)"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius)",
          background: "var(--color-surface)",
          padding: "var(--space-4)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
          <div className="text-muted" style={{ fontSize: 13, marginBottom: "var(--space-2)" }}>
            그런데, 이 중 한 명은 사람이 아니었습니다
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 38,
              color: "var(--color-accent)",
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {mm}:{ss}
          </div>
        </div>

        <div className="hr" />

        <h3 style={{ textAlign: "center", marginBottom: "var(--space-2)" }}>누가 봇이었을까요?</h3>
        <div
          className="tag tag-outline"
          style={{ display: "block", textAlign: "center", margin: "0 auto var(--space-4)", width: "fit-content" }}
        >
          익명 투표
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
          {candidates.map((c: PublicPlayer) => {
            const selected = myVote === c.id;
            return (
              <label
                key={c.id}
                className="radio"
                onClick={() => setMyVote(c.id)}
                style={{
                  justifyContent: "space-between",
                  padding: "var(--space-4)",
                  border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-line)"}`,
                  borderRadius: "var(--radius)",
                  cursor: "pointer"
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      flex: "none",
                      borderRadius: "50%",
                      border: `1.5px solid ${selected ? "var(--color-accent)" : "var(--color-line)"}`,
                      background: selected ? "var(--color-accent)" : "transparent"
                    }}
                  />
                  <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 16 }}>{c.label}</span>
                </span>
                {selected && <span style={{ color: "var(--color-accent)", fontSize: 13 }}>✓</span>}
              </label>
            );
          })}
        </div>

        <div className="text-muted" style={{ fontSize: 12, textAlign: "center", marginBottom: "var(--space-4)" }}>
          투표 현황 · {botVoteCounts.voted} / {botVoteCounts.total}명 완료
        </div>

        <button
          className="btn btn-primary btn-block"
          disabled={myVote === null}
          onClick={() => myVote !== null && onConfirm(myVote)}
        >
          확정
        </button>
      </div>
    </div>
  );
}
