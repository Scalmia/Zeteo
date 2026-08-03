import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { Chat } from '../components/Chat';
import { PlayerList } from '../components/PlayerList';
import { Timer } from '../components/Timer';

/** S3 최후 변론 — 지목자·나머지 모두 발언 가능.
 *  잠금이 없는 유일한 채팅 구간이라 분기가 없다. */
export function FinalDefense({
  state,
  onEvent,
}: {
  state: GameState;
  onEvent: (e: ClientEvent) => void;
}) {
  const accused = state.players.find((p) => p.id === state.accused);
  const votes = state.accused ? (state.voteCounts[state.accused] ?? 0) : 0;

  return (
    <div className="zt-screen">
      <header className="zt-head">
        <span className="zt-sub">최후 변론</span>
        <Timer deadlineAt={state.deadlineAt} />
      </header>

      <div className="zt-accused">
        <span className="zt-badge">지목됨</span>
        <strong>{accused?.name}</strong>
        <span className="zt-vote-count">{votes}표</span>
      </div>

      <div className="zt-body">
        <aside className="zt-side">
          <PlayerList players={state.players} myId={state.myId} accused={state.accused} />
        </aside>

        <main className="zt-main">
          <h3 className="zt-section">변론 &amp; 질의</h3>
          <Chat
            messages={state.messages}
            players={state.players}
            locked={false}
            placeholder="질문하거나 해명하세요…"
            onSend={(text) => onEvent({ t: 'chat', text })}
          />
        </main>
      </div>
    </div>
  );
}
