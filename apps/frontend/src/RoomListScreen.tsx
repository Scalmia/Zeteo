import { useEffect, useState } from "react";
import type { RoomSummary } from "@zeteo/shared-types";
import Button from "./components/Button";
import FullscreenButton from "./components/FullscreenButton";
import { MAX_PLAYERS } from "./roomConfig";
import "./styles/tokens.css";
import "./styles/roomList.css";

// ★ RoomStatus·RoomSummary 를 여기서 선언하지 않고 shared-types 에서 가져온다
// (방 목록 서버 연결) — 목록을 서버가 내려주므로 모양이 어긋나면 안 된다.
type RoomStatus = RoomSummary["status"];

interface RoomListScreenProps {
  // ★ nickname 을 받지 않는다 (방 목록 서버 연결) — 방장 이름은 서버가 목록에 담아
  // 내려주고, join 에 실어보낼 닉네임은 App.tsx 가 쥐고 있어서 이 화면엔 쓸 데가 없다.
  onBack: () => void;
  /** title 은 방을 새로 만들 때만 — 기존 방에 들어갈 땐 생략한다. */
  onJoinRoom: (roomId: string, title?: string) => void;
  // ★ 추가 (방 목록 서버 연결) — 목록의 출처는 서버다. 이 화면은 받아서 그리기만 한다.
  rooms: RoomSummary[];
  onRefresh: () => void;
  // ★ 추가 (없는 방 안내) — 서버가 join 을 거절한 사유. 방번호 직접입력에 없는 번호를
  // 넣으면 서버가 '없는 방입니다'를 보내는데, App.tsx 상단 빨간 배너는 입력칸에서
  // 화면 높이만큼 떨어져 있어 눈에 안 들어왔다. 그래서 이 화면이 팝업으로 받는다.
  error: string | null;
}

const TITLE_MAX_LENGTH = 20;

const STATUS_TAG: Record<RoomStatus, { label: string; className: string }> = {
  open: { label: "대기중", className: "tag-ok" },
  playing: { label: "진행중", className: "tag-accent" },
  full: { label: "정원마감", className: "tag-neutral" }
};

/** 방 목록 화면 — 닉네임 입력 뒤, 대기실(LobbyScreen) 입장 전 단계.
 *  시안(Zeteo_방목록_시안.html 옵션 A3 "필터·정렬이 있는 리스트") 기반 — 필터탭·정렬·
 *  정원 진행바·방번호 직접입력 토글은 시안 그대로 옮기고, 방 만들기 버튼만 새로 추가했다
 *  (시안엔 없던 기능).
 *
 *  ★ 목록을 서버(listRooms)에 연결했다 — 예전엔 이 화면이 만든 방만 로컬 상태로 들고
 *  있어서 다른 사람 브라우저에는 안 보였다. 이제 rooms 는 props 로 받고, 이 화면은
 *  요청(onRefresh)과 렌더만 한다. status·count 도 서버가 계산해 내려준다.
 *
 *  ⚠️ 다만 목록은 자동으로 갱신되지 않는다 — 서버가 방 변화를 밀어주는(push) 구조가
 *  아니라 요청할 때만 오므로, 진입 시 한 번과 새로고침 버튼을 누를 때만 최신이다. */
export default function RoomListScreen({ onBack, onJoinRoom, rooms, onRefresh, error }: RoomListScreenProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<"all" | "joinable">("all");
  const [sortKey, setSortKey] = useState<"countAsc" | "countDesc" | "roomIdDesc" | "roomIdAsc">("countAsc");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualRoomId, setManualRoomId] = useState("");
  // ★ 추가 (없는 방 안내) — error 자체는 App 이 쥐고 있어 이 화면이 지울 수 없다.
  // 그래서 "이 사유를 닫았다"는 것만 여기서 따로 기억하고, 새 사유가 오면 다시 연다.
  // 렌더 중 이전 값과 비교하는 패턴은 components/Modal.tsx 와 같다(useEffect 로 하면
  // 리렌더가 한 번 더 끼어든다).
  const [prevError, setPrevError] = useState(error);
  const [errorOpen, setErrorOpen] = useState(error !== null);
  if (error !== prevError) {
    setPrevError(error);
    setErrorOpen(error !== null);
  }

  // ★ 화면에 들어오면 한 번 목록을 받아온다 (방 목록 서버 연결).
  // onRefresh 는 App.tsx 가 매 렌더 새로 만드는 함수라 의존성에 넣으면 매번 다시 도므로
  // 진입 시 1회만 돌린다 — 이후 갱신은 사용자가 새로고침 버튼으로 한다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onRefresh(), []);

  const createRoom = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    // 방번호는 아직 서버가 발급하지 않아 클라이언트가 정한다. 목록에 이미 있는 번호를
    // 고르면 남이 만든 방에 그대로 합류해버리므로(서버 join 은 방이 있으면 들어간다),
    // 목록에 없는 번호를 뽑는다. 서버가 발급하게 되면 이 로직은 통째로 사라진다.
    const taken = new Set(rooms.map((r) => r.roomId));
    let roomId = "";
    do {
      roomId = String(Math.floor(1000 + Math.random() * 9000));
    } while (taken.has(roomId));
    setShowCreate(false);
    setTitle("");
    onJoinRoom(roomId, trimmed); // 제목을 같이 보내야 서버가 방 제목으로 저장한다
  };

  const filteredRooms = rooms
    .filter((r) => {
      if (filter === "joinable") return r.status === "open";
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "countAsc") return a.count - b.count;
      if (sortKey === "countDesc") return b.count - a.count;
      if (sortKey === "roomIdDesc") return Number(b.roomId) - Number(a.roomId);
      return Number(a.roomId) - Number(b.roomId);
    });

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
          minHeight: 640,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
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

        <div style={{ textAlign: "center", marginTop: 40, marginBottom: "var(--space-4)" }}>
          <p className="text-muted" style={{ fontSize: "var(--text-caption)", fontWeight: 600, marginBottom: 0 }}>방목록</p>
        </div>

        <Button style={{ fontSize: "var(--text-button)", marginBottom: "var(--space-4)" }} block onClick={() => setShowCreate(true)}>
          방 만들기
        </Button>

        <div className="zt-filter-tabs">
          <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            전체
          </button>
          <button type="button" className={filter === "joinable" ? "active" : ""} onClick={() => setFilter("joinable")}>
            참여 가능
          </button>
        </div>

        <div className="zt-sort-row">
          <span>
            총 {filteredRooms.length}개 방
            <button type="button" className="zt-refresh-icon" onClick={onRefresh} aria-label="새로고침" title="새로고침">
              ↻
            </button>
          </span>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)}>
            <option value="countAsc">인원 적은순</option>
            <option value="countDesc">인원 많은순</option>
            <option value="roomIdDesc">최신순</option>
            <option value="roomIdAsc">과거순</option>
          </select>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {filteredRooms.length === 0 && (
            <p className="text-muted" style={{ textAlign: "center", fontSize: "var(--text-label)" }}>
              해당하는 방이 없습니다
            </p>
          )}
          {filteredRooms.map((room) => {
            const tag = STATUS_TAG[room.status];
            const ratio = Math.min(100, Math.round((room.count / MAX_PLAYERS) * 100));
            return (
              <button
                key={room.roomId}
                type="button"
                className="zt-room-row"
                disabled={room.status !== "open"}
                onClick={() => onJoinRoom(room.roomId)}
              >
                <div className="zt-top-line">
                  <span className="zt-rid">
                    #{room.roomId} {room.title}
                  </span>
                  <span className={`tag ${tag.className}`}>{tag.label}</span>
                </div>
                <div className="zt-cap-bar">
                  <span style={{ width: `${ratio}%` }} />
                </div>
                <div className="zt-top-line">
                  <span className="text-muted" style={{ fontSize: "var(--text-label)" }}>
                    {room.hostName}
                  </span>
                  <span className="zt-count">
                    {room.count}/{MAX_PLAYERS}명
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {!showManualEntry ? (
          <button type="button" className="zt-manual-toggle" onClick={() => setShowManualEntry(true)}>
            방번호를 알고 있어요
          </button>
        ) : (
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
            {/* 방번호는 항상 숫자다(위 createRoom 이 1000~9999 에서 뽑는다). 글자가 섞이면
                맞는 방이 있을 수 없어 서버까지 갔다가 "없는 방입니다" 로만 돌아오므로
                입력 단계에서 떨군다. onChange 에서 거르면 붙여넣기도 같이 걸린다.
                inputMode 는 폰에서 숫자 키패드가 바로 뜨게 하는 힌트다. */}
            <input
              className="input"
              style={{ flex: 1 }}
              value={manualRoomId}
              inputMode="numeric"
              onChange={(e) => setManualRoomId(e.target.value.replace(/\D/g, ""))}
              placeholder="방번호 입력"
            />
            <Button disabled={!manualRoomId.trim()} onClick={() => onJoinRoom(manualRoomId.trim())}>
              입장
            </Button>
          </div>
        )}
      </div>

      {showCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)"
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 320,
              border: "1px solid var(--color-line)",
              borderRadius: "var(--radius)",
              background: "var(--color-surface)",
              padding: "var(--space-4)"
            }}
          >
            <h4 style={{ marginBottom: "var(--space-2)" }}>방 만들기</h4>
            <div className="field" style={{ marginBottom: "var(--space-4)" }}>
              <label style={{ fontSize: "var(--text-label)", fontWeight: 600 }}>방 제목</label>
              <input
                className="input"
                value={title}
                maxLength={TITLE_MAX_LENGTH}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="방 제목을 입력해주세요"
              />
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button variant="secondary" block onClick={() => setShowCreate(false)}>
                취소
              </Button>
              <Button block disabled={!title.trim()} onClick={createRoom}>
                만들기
              </Button>
            </div>
          </div>
        </div>
      )}

      {errorOpen && error && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)"
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: "100%",
              maxWidth: 320,
              border: "1px solid var(--color-line)",
              borderRadius: "var(--radius)",
              background: "var(--color-surface)",
              padding: "var(--space-4)",
              textAlign: "center"
            }}
          >
            <p style={{ fontSize: "var(--text-body)", marginBottom: "var(--space-4)" }}>{error}</p>
            <Button block onClick={() => setErrorOpen(false)}>
              확인
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
