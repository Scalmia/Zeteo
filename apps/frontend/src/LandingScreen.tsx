import { useState } from "react";
import Button from "./components/Button";
import FullscreenButton from "./components/FullscreenButton";
// 서버 room.ts 의 NAME_MAX_LENGTH 와 짝인 값 — 그 파일 주석 참고.
import { NAME_MAX_LENGTH } from "./roomConfig";
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
          // position: "relative" — FullscreenButton.tsx의 position:absolute가
          // 이 카드 기준으로 앉는다(그 파일 헤더 주석: "쓰는 쪽 카드에 반드시
          // 있어야 한다"). 지우면 버튼이 뷰포트 기준으로 튀어 오른다.
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
            // ※ 21은 var(--text-button)의 현재 값과 같다(tokens.css) — 토큰을 안 쓰고
            // 리터럴로 적은 게 의도인지 그냥 값이 같아서 우연인지는 불명. 토큰이
            // 바뀌면 이 입력창 글자 크기만 안 따라간다 — 소유자 확인 필요.
            style={{ fontSize: 21 }}
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder={`닉네임 (최대 ${NAME_MAX_LENGTH}글자)`}
          />
        </div>

        <Button block disabled={!canNext} style={{ fontSize: "var(--text-button)" }} onClick={() => canNext && onNext(name.trim())}>
          시작
        </Button>

        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
          <a href="/about.html" style={{ color: "var(--color-muted)", fontSize: 12 }}>소개 및 이용방법</a>
          <a href="/privacy.html" style={{ color: "var(--color-muted)", fontSize: 12 }}>개인정보처리방침</a>
        </div>
      </div>
    </div>
  );
}
