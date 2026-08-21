import { useState } from "react";
import Button from "./components/Button";
import FullscreenButton from "./components/FullscreenButton";
import "./styles/tokens.css";

interface LandingScreenProps {
  onNext: (name: string) => void;
}

export default function LandingScreen({ onNext }: LandingScreenProps) {
  const [name, setName] = useState("");

  const canNext = name.trim().length > 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "var(--space-4)"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          minHeight: 640,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius)",
          background: "var(--color-surface)",
          padding: "var(--space-4)",
          position: "relative"
        }}
      >
        <FullscreenButton />
        <div style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
          <img src="/zeteo-logo.png" alt="Zeteo" style={{ width: 400, maxWidth: "100%", marginBottom: "var(--space-2)" }} />
          <h2>라이어 게임</h2>
        </div>

        <div className="field" style={{ marginTop: 48, marginBottom: "var(--space-4)" }}>
          <label style={{ fontSize: "var(--text-label)", fontWeight: 600 }}>닉네임</label>
          <input
            className="input"
            style={{ fontSize: 21 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="닉네임을 입력해주세요"
          />
        </div>

        <Button block disabled={!canNext} style={{ fontSize: "var(--text-button)" }} onClick={() => canNext && onNext(name.trim())}>
          시작
        </Button>
      </div>
    </div>
  );
}
