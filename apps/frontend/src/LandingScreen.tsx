import { useState } from "react";
import "./styles/tokens.css";

interface LandingScreenProps {
  onJoin: (name: string, roomId: string) => void;
}

export default function LandingScreen({ onJoin }: LandingScreenProps) {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");

  const canJoin = name.trim().length > 0 && roomId.trim().length > 0;

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
          maxWidth: 360,
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius)",
          background: "var(--color-surface)",
          padding: "var(--space-4)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: "var(--space-2)" }}>Zeteo</p>
          <h2>라이어 게임</h2>
        </div>

        <div className="field" style={{ marginBottom: "var(--space-4)" }}>
          <label>닉네임</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="닉네임을 입력해주세요"
          />
        </div>

        <div className="field" style={{ marginBottom: "var(--space-4)" }}>
          <label>방번호</label>
          <input
            className="input"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="방번호를 입력해주세요"
          />
        </div>

        <button
          className="btn btn-primary btn-block"
          disabled={!canJoin}
          onClick={() => canJoin && onJoin(name.trim(), roomId.trim())}
        >
          입장하기
        </button>
      </div>
    </div>
  );
}
