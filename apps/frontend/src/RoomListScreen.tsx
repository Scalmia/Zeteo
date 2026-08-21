import { useState } from "react";
import Button from "./components/Button";
import FullscreenButton from "./components/FullscreenButton";
import { MAX_PLAYERS } from "./roomConfig";
import "./styles/tokens.css";
import "./styles/roomList.css";

type RoomStatus = "open" | "full" | "playing";

interface RoomSummary {
  roomId: string;
  title: string;
  hostName: string;
  count: number;
  status: RoomStatus;
}

interface RoomListScreenProps {
  nickname: string;
  onBack: () => void;
  onJoinRoom: (roomId: string, isHost: boolean) => void;
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
 *  ⚠️ 지금은 서버에 방 목록 조회 API(listRooms)가 없어서, 이 화면이 만든 방 목록을
 *  로컬 상태로만 들고 있다 — 새로고침하거나 다른 사람 브라우저에서는 안 보인다.
 *  같은 이유로 status·count도 실시간 갱신이 안 되고 생성 시점 값(open, 1명)에 고정된다.
 *  방 클릭/생성 시 보내는 join 이벤트는 서버에 이미 있는 것(roomId 없으면 자동 생성)이라
 *  실제 대기실까지는 정상 동작한다. 방 목록을 여러 클라이언트가 공유하려면 서버에
 *  listRooms/createRoom 이벤트와 방장·정원·상태 필드가 먼저 필요하다(합의된 방향:
 *  apps/backend/src/room.ts, index.ts, view.ts, packages/shared-types 쪽 작업). */
export default function RoomListScreen({ nickname, onBack, onJoinRoom }: RoomListScreenProps) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<"all" | "joinable">("all");
  const [sortKey, setSortKey] = useState<"countAsc" | "countDesc" | "roomIdDesc" | "roomIdAsc">("countAsc");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualRoomId, setManualRoomId] = useState("");

  const refresh = () => {
    // TODO(backend): 서버에 listRooms 이벤트가 생기면 여기서 요청하고 응답으로 rooms를 채운다.
  };

  const createRoom = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const roomId = String(rooms.length + 1); // 방 만든 순서대로 순번 — 서버 발급 전까지 임시
    setRooms((prev) => [...prev, { roomId, title: trimmed, hostName: nickname, count: 1, status: "open" }]);
    setShowCreate(false);
    setTitle("");
    onJoinRoom(roomId, true);
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
            <button type="button" className="zt-refresh-icon" onClick={refresh} aria-label="새로고침" title="새로고침">
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
                onClick={() => onJoinRoom(room.roomId, false)}
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
            <input
              className="input"
              style={{ flex: 1 }}
              value={manualRoomId}
              onChange={(e) => setManualRoomId(e.target.value)}
              placeholder="방번호 입력"
            />
            <Button disabled={!manualRoomId.trim()} onClick={() => onJoinRoom(manualRoomId.trim(), false)}>
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
    </div>
  );
}
