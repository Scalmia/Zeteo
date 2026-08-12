import { useState } from "react";
import type { Reason, SurveyScreenState } from "./types";
import Button from "./components/Button";
import "./styles/tokens.css";

interface SurveyScreenProps extends SurveyScreenState {
  onSubmit: (checkedReasonIds: number[], freeText: string) => void;
}

export default function SurveyScreen({
  reasons,
  checkedReasonIds: initialChecked,
  freeText: initialFreeText,
  onSubmit
}: SurveyScreenProps) {
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
        alignItems: "center",
        padding: "var(--space-4)"
      }}
    >
      <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius)", background: "var(--color-surface)", padding: "var(--space-4)" }}>
          <h4 style={{ marginBottom: "var(--space-2)" }}>왜 봇이라고 생각했나요?</h4>
          <div className="text-muted" style={{ fontSize: "var(--text-label)", fontWeight: 600, marginBottom: "var(--space-4)" }}>
            적중자 대상 · 해당하는 이유 선택 (복수)
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            {reasons.map((reason: Reason) => {
              const isChecked = checked.includes(reason.id);
              return (
                <label
                  key={reason.id}
                  className="radio"
                  onClick={() => toggle(reason.id)}
                  style={{
                    justifyContent: "flex-start",
                    padding: "var(--space-2) var(--space-4)",
                    border: `1px solid ${isChecked ? "var(--color-accent)" : "var(--color-line)"}`,
                    borderRadius: "var(--radius)",
                    cursor: "pointer"
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      flex: "none",
                      borderRadius: 3,
                      border: `1.5px solid ${isChecked ? "var(--color-accent)" : "var(--color-line)"}`,
                      background: isChecked ? "var(--color-accent)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 17,
                      color: "white"
                    }}
                  >
                    {isChecked ? "✓" : ""}
                  </span>
                  <span style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>{reason.label}</span>
                </label>
              );
            })}
          </div>

          <div className="field" style={{ marginBottom: "var(--space-4)" }}>
            <label style={{ fontSize: "var(--text-label)", fontWeight: 600 }}>기타 (자유 서술)</label>
            <textarea
              className="input"
              style={{ fontSize: "var(--text-body)" }}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="직접 입력해주세요"
            />
          </div>

          <Button block style={{ fontSize: "var(--text-button)" }} onClick={() => onSubmit(checked, freeText)}>
            제출
          </Button>
        </div>
      </div>
    </div>
  );
}
