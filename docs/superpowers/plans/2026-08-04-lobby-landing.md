# 랜딩·대기실 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 파트 D 소유 화면 중 남은 Landing(랜딩)·Lobby(대기실)를 mock 데이터로 구현하고 App.tsx에 배선한다.

**Architecture:** BotVote/Result와 동일한 패턴 — `types.ts`에 props 타입 정의, 화면 컴포넌트는 순수 프레젠테이션(콜백으로 이벤트를 위로 전달), `App.tsx`가 로컬 `useState`로 phase 전환과 mock 데이터를 관리한다. 실제 소켓 연결은 범위 밖.

**Tech Stack:** React 19, TypeScript, Vite. 테스트 러너 없음(리포지토리 전역 관례) — 검증은 `npx tsc -b --noEmit` + Vite dev 서버 브라우저 확인으로 대체한다.

## Global Constraints

- 토큰 이름은 `apps/frontend/src/styles/tokens.css`의 11개(`--color-bg/surface/line/text/muted/accent/danger`, `--space-2/4`, `--radius`, `--font-body`)만 사용한다. 새 토큰 이름 추가 금지.
- 로그인/비밀번호 입력 없음 (기획서 §7 D5, 오늘 확정).
- 실제 방 생성·소켓 연결 로직은 만들지 않는다. 콜백은 `console.log`로 mock 처리.

---

### Task 1: types.ts에 Lobby 타입 추가

**Files:**
- Modify: `apps/frontend/src/types.ts`

**Interfaces:**
- Produces: `LobbyPlayer { id: PlayerId; name: string; isReady: boolean }`, `LobbyScreenState { roomId: string; players: LobbyPlayer[]; myId: PlayerId }`

- [ ] **Step 1: 타입 추가**

`apps/frontend/src/types.ts` 파일 끝에 추가:

```ts
export interface LobbyPlayer {
  id: PlayerId;
  name: string;
  isReady: boolean;
}

export interface LobbyScreenState {
  roomId: string;
  players: LobbyPlayer[];
  myId: PlayerId;
}
```

- [ ] **Step 2: 타입체크**

Run: `cd apps/frontend && npx tsc -b --noEmit`
Expected: 에러 없음 (신규 타입만 추가, 기존 코드 미사용이라 unused 경고도 없음)

- [ ] **Step 3: Commit은 Task 4 완료 후 한 번에 진행** (아래 참고)

---

### Task 2: LandingScreen.tsx 작성

**Files:**
- Create: `apps/frontend/src/LandingScreen.tsx`

**Interfaces:**
- Consumes: 없음 (props로 `onJoin`만 받음)
- Produces: `export default function LandingScreen({ onJoin }: { onJoin: (name: string, roomId: string) => void })`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
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
```

- [ ] **Step 2: 타입체크**

Run: `cd apps/frontend && npx tsc -b --noEmit`
Expected: 에러 없음

---

### Task 3: LobbyScreen.tsx 작성

**Files:**
- Create: `apps/frontend/src/LobbyScreen.tsx`

**Interfaces:**
- Consumes: `LobbyScreenState`, `LobbyPlayer` from `./types` (Task 1에서 정의)
- Produces: `export default function LobbyScreen(props: LobbyScreenState & { myReady: boolean; onToggleReady: () => void })`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import type { LobbyPlayer, LobbyScreenState } from "./types";
import "./styles/tokens.css";

interface LobbyScreenProps extends LobbyScreenState {
  myReady: boolean;
  onToggleReady: () => void;
}

const MAX_SLOTS = 5;

export default function LobbyScreen({ roomId, players, myId, myReady, onToggleReady }: LobbyScreenProps) {
  const slots: (LobbyPlayer | null)[] = Array.from({ length: MAX_SLOTS }, (_, i) => players[i] ?? null);

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
          <p className="text-muted" style={{ fontSize: 13, marginBottom: "var(--space-2)" }}>대기실</p>
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
              <span style={{ fontWeight: p ? 600 : 400, color: p ? "var(--color-text)" : "var(--color-muted)" }}>
                {p ? p.name : "대기중"}
                {p && p.id === myId ? " (나)" : ""}
              </span>
              {p && (
                <span className={`tag ${p.isReady ? "tag-accent" : "tag-neutral"}`}>
                  {p.isReady ? "준비완료" : "대기"}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="text-muted" style={{ fontSize: 12, textAlign: "center", marginBottom: "var(--space-4)" }}>
          {players.filter((p) => p.isReady).length} / {players.length}명 준비완료
        </div>

        <button className="btn btn-primary btn-block" onClick={onToggleReady}>
          {myReady ? "준비 취소" : "준비완료"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `cd apps/frontend && npx tsc -b --noEmit`
Expected: 에러 없음

---

### Task 4: App.tsx 배선

**Files:**
- Modify: `apps/frontend/src/App.tsx`

**Interfaces:**
- Consumes: `LandingScreen` (Task 2), `LobbyScreen` (Task 3), `LobbyScreenState`/`LobbyPlayer` (Task 1)
- Produces: 없음 (최상위 컴포넌트)

- [ ] **Step 1: import 및 mock 데이터 추가**

`App.tsx` 상단 import 블록에 추가:

```tsx
import LandingScreen from "./LandingScreen";
import LobbyScreen from "./LobbyScreen";
import type { LobbyPlayer, LobbyScreenState } from "./types";
```

기존 `mockVoteState` 선언 바로 위에 추가:

```tsx
const mockLobbyState: LobbyScreenState = {
  roomId: "AB12",
  players: [
    { id: "p1", name: "김정현", isReady: true },
    { id: "p2", name: "박진", isReady: false },
    { id: "p3", name: "이현우", isReady: true },
  ],
  myId: "p2",
};
```

- [ ] **Step 2: MockPhase 타입 확장 및 기본값 변경**

```tsx
type MockPhase = "landing" | "lobby" | "botVote" | "result";
```

기존 `type MockPhase = "lobby" | "botVote" | "result";` 줄을 위 코드로 교체하고,
`const [phase, setPhase] = useState<MockPhase>("lobby");` 를 `useState<MockPhase>("landing")` 으로 변경한다.

- [ ] **Step 3: landing/lobby 분기 추가, myReady 로컬 상태 추가**

`phase === "botVote"` 분기 위에 추가:

```tsx
const [myReady, setMyReady] = useState(false);

if (phase === "landing") {
  return (
    <LandingScreen
      onJoin={(name, roomId) => {
        console.log("[mock] join", name, roomId);
        setPhase("lobby");
      }}
    />
  );
}

if (phase === "lobby") {
  return (
    <div>
      <LobbyScreen
        {...mockLobbyState}
        myReady={myReady}
        onToggleReady={() => setMyReady((r) => !r)}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingBottom: 16 }}>
        <button className="btn btn-secondary" onClick={() => setPhase("botVote")}>
          botVote 미리보기
        </button>
        <button className="btn btn-secondary" onClick={() => setPhase("result")}>
          result 미리보기
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 기존 placeholder("파트 D 작업 예정") 카드와 미리보기 버튼 2개 제거**

이전에 `phase === "lobby"`(또는 fallback)로 렌더되던 placeholder 카드 블록 전체를 삭제한다 — landing/lobby가 그 역할을 대신하므로 이제 도달 불가능한 코드가 된다.

- [ ] **Step 5: 타입체크**

Run: `cd apps/frontend && npx tsc -b --noEmit`
Expected: 에러 없음

- [ ] **Step 6: 브라우저 수동 확인**

Run: `cd apps/frontend && npm run dev` (이미 실행 중이면 생략, HMR로 자동 반영됨)
확인: `http://localhost:5173` 접속 → 랜딩 화면 뜨는지, 닉네임+방번호 입력 후 "입장하기" 눌러 대기실로 넘어가는지, 대기실에서 "준비완료" 토글되는지, botVote/result 미리보기 버튼도 여전히 동작하는지.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/types.ts apps/frontend/src/LandingScreen.tsx apps/frontend/src/LobbyScreen.tsx apps/frontend/src/App.tsx docs/superpowers/specs/2026-08-04-lobby-landing-design.md docs/superpowers/plans/2026-08-04-lobby-landing.md
git commit -m "랜딩·대기실 화면 추가"
```
