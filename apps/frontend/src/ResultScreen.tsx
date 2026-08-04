import { useState } from "react";
import type { Reason, Reveal, ResultScreenState } from "./types";
import "./tokens.css";

interface ResultScreenProps extends ResultScreenState {
  onSubmit: (checkedReasonIds: number[], freeText: string) => void;
}

export default function ResultScreen({
  winner,
  botDetectSummary,
  reveals,
  reasons,
  checkedReasonIds: initialChecked,
  freeText: initialFreeText,
  onSubmit
}: ResultScreenProps) {
  const [checked, setChecked] = useState<number[]>(initialChecked);
  const [freeText, setFreeText] = useState(initialFreeText);

  const toggle = (id: number) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        display: "flex",
        justifyContent: "center",
        padding: "var(--space-8) var(--space-4)"
      }}
    >
      <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div
          style={{
            textAlign: "center",
            border: "1px solid var(--color-divider)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-surface)",
            padding: "var(--space-6)",
            boxShadow: "var(--shadow-md)"
          }}
        >
          <div
            className="text-muted"
            style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "var(--space-2)" }}
          >
            GAME OVER
          </div>
          <h1 style={{ marginBottom: "var(--space-3)" }}>라이어 게임</h1>
          <div className="tag tag-accent" style={{ fontSize: 14, padding: "6px 16px", marginBottom: "var(--space-4)" }}>
            {winner}
          </div>
          <div className="hr" />
          <div style={{ marginTop: "var(--space-3)" }}>
            <div className="card-title" style={{ fontSize: 20 }}>봇 색출</div>
            <div className="text-muted" style={{ fontSize: 13 }}>{botDetectSummary}</div>
          </div>
        </div>

        <div style={{ border: "1px solid var(--color-divider)", borderRadius: "var(--radius-lg)", background: "var(--color-surface)", padding: "var(--space-4)" }}>
          <h4 style={{ marginBottom: "var(--space-3)" }}>정체 공개</h4>
          <div>
            {reveals.map((r: Reveal) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-2) 0",
                  borderBottom: "1px solid var(--color-divider)"
                }}
              >
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 16 }}>{r.name}</span>
                <span className={`tag ${r.isMatch ? "tag-accent" : "tag-neutral"}`}>{r.roleLabel}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid var(--color-divider)", borderRadius: "var(--radius-lg)", background: "var(--color-surface)", padding: "var(--space-4)" }}>
          <h4 style={{ marginBottom: "var(--space-1)" }}>왜 봇이라고 생각했나요?</h4>
          <div className="text-muted" style={{ fontSize: 12, marginBottom: "var(--space-3)" }}>
            적중자 대상 · 해당하는 이유 선택 (복수)
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            {reasons.map((reason: Reason) => {
              const isChecked = checked.includes(reason.id);
              return (
                <label
                  key={reason.id}
                  className="radio"
                  onClick={() => toggle(reason.id)}
                  style={{
                    justifyContent: "flex-start",
                    padding: "var(--space-2) var(--space-3)",
                    border: `1px solid ${isChecked ? "var(--color-accent)" : "var(--color-divider)"}`,
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer"
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      flex: "none",
                      borderRadius: 3,
                      border: `1.5px solid ${isChecked ? "var(--color-accent)" : "var(--color-divider)"}`,
                      background: isChecked ? "var(--color-accent)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      color: "white"
                    }}
                  >
                    {isChecked ? "✓" : ""}
                  </span>
                  <span style={{ fontSize: 14 }}>{reason.label}</span>
                </label>
              );
            })}
          </div>

          <div className="field" style={{ marginBottom: "var(--space-3)" }}>
            <label>기타 (자유 서술)</label>
            <textarea
              className="input"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="직접 입력해주세요"
            />
          </div>

          <button className="btn btn-primary btn-block" onClick={() => onSubmit(checked, freeText)}>
            제출
          </button>
        </div>
      </div>
    </div>
  );
}
