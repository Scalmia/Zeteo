import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { Chat } from '../components/Chat';
import { Timer } from '../components/Timer';
import { VotePanel } from '../components/VotePanel';

/** S2 토론 + 투표 (동시 진행). 게임의 본체.
 *  묘사 기록이 토론의 근거이므로 messages를 필터하지 않고 전부 보여준다. */
export function Debate({
  state,
  onEvent,
}: {
  state: GameState;
  onEvent: (e: ClientEvent) => void;
}) {
  return (
    <div className="zt-screen">
      <header className="zt-head">
        <span className="zt-sub">
          {/* round는 "지금 몇 번째 루프인가"라는 상태. 왜 돌아왔는지(사건)는 시스템 메시지가 맡는다 */}
          <span className="zt-round">{state.round}라운드</span>
          토론 · 투표 진행 중
        </span>
        <Timer deadlineAt={state.deadlineAt} />
      </header>

      <div className="zt-body">
        <main className="zt-main">
          <h3 className="zt-section">채팅 (자유)</h3>
          <Chat
            messages={state.messages}
            players={state.players}
            locked={false}
            onSend={(text) => onEvent({ t: 'chat', text })}
          />
        </main>

        <aside className="zt-side zt-side-wide">
          <VotePanel
            players={state.players}
            voteCounts={state.voteCounts}
            myVote={state.myVote}
            myId={state.myId}
            onVote={(targetId) => onEvent({ t: 'vote', targetId })}
          />
        </aside>
      </div>
    </div>
  );
}
