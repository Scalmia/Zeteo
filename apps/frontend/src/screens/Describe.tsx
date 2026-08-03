import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { Chat } from '../components/Chat';
import { PlayerList } from '../components/PlayerList';
import { Timer } from '../components/Timer';

/** S1 묘사 — 턴제, 게임당 1바퀴. 자유 채팅 완전 차단.
 *  입력 활성 조건은 currentTurn === myId 하나뿐이다. 여기가 새면 룰이 깨진다. */
export function Describe({
  state,
  onEvent,
}: {
  state: GameState;
  onEvent: (e: ClientEvent) => void;
}) {
  const isMyTurn = state.currentTurn === state.myId;
  const turnName = state.players.find((p) => p.id === state.currentTurn)?.name ?? '';

  return (
    <div className="zt-screen">
      <header className="zt-head">
        <span className="zt-sub">
          {state.category}
          {state.word && ` · ${state.word}`} {/* 라이어는 word가 null이라 주제만 보인다 */}
        </span>
        <Timer deadlineAt={state.deadlineAt} />
      </header>

      <div className="zt-body">
        <aside className="zt-side">
          <PlayerList
            players={state.players}
            myId={state.myId}
            turnOrder={state.turnOrder}
            currentTurn={state.currentTurn}
          />
        </aside>

        <main className="zt-main">
          <h3 className="zt-section">발언 기록</h3>
          <Chat
            messages={state.messages}
            players={state.players}
            locked={!isMyTurn}
            lockedLabel={`${turnName}님의 차례입니다`}
            placeholder="묘사를 입력하세요…"
            onSend={(text) => onEvent({ t: 'describe', text })}
          />
        </main>
      </div>
    </div>
  );
}
