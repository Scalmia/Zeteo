/**
 * 파트 D 소유 — 박진
 *
 * 여기서 할 일:
 *   1. A의 net/socket.ts 로 서버에 연결하고 GameState 를 받는다
 *   2. phase 에 따라 화면을 고른다
 *        lobby / botVote / result  → D가 직접 그린다
 *        그 외 게임 페이즈          → <GameScreen state={state} onEvent={onEvent} />
 *
 * 파트 C의 화면 6개를 알 필요가 없다. GameScreen 하나만 마운트하면 된다.
 *
 * 화면을 확인하려면 서버 없이도 된다 —  /?mock=  로 접속.
 */
export function App() {
  return (
    <div className="zt-screen zt-center">
      <div className="zt-card">
        <p className="zt-label">Zeteo</p>
        <p className="zt-role">파트 D 작업 예정</p>
        <p className="zt-muted">
          랜딩 · 방 입장 · 봇 지목 · 최종 결과
          <br />
          게임 화면은 <a href="?mock=">?mock=</a> 에서 확인
        </p>
      </div>
    </div>
  );
}
