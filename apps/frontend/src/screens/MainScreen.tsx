import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { Chat } from '../components/Chat';
import { Timer } from '../components/Timer';
import { VotePanel } from '../components/VotePanel';

/** 게임 페이즈 내내 항상 떠 있는 단일 화면 — 채팅 + 투표.
 *
 *  기존 Describe(S1)·Debate(S2)·FinalDefense(S3) 세 화면을 하나로 합친 것이다.
 *  세 화면이 실제로 달랐던 건 아래 네 가지뿐이라 조건 몇 개로 흡수된다.
 *    · 채팅 잠금 여부와 전송 이벤트 (describe 만 't: describe')
 *    · 투표 패널 노출 (debate 만)
 *    · 지목 배너 (finalDefense 만)
 *    · 헤더 문구
 *
 *  roleReveal·lifeVote·reveal·guessWord 는 이 화면 위에 팝업으로 뜨고,
 *  그동안 blocked=true 로 채팅이 잠긴다. */
export function MainScreen({
  state,
  onEvent,
  blocked,
}: {
  state: GameState;
  onEvent: (e: ClientEvent) => void;
  /** 팝업이 떠 있는 동안 true. 잠금 규칙을 컴포넌트가 스스로 알지 않게 위에서 내려준다 */
  blocked: boolean;
}) {
  const isDescribe = state.phase === 'describe';
  const isDebate = state.phase === 'debate';
  const isFinalDefense = state.phase === 'finalDefense';

  const isMyTurn = state.currentTurn === state.myId;
  const turnName = state.players.find((p) => p.id === state.currentTurn)?.label ?? '';
  // 진행도: turnOrder 안에서 현재 차례가 몇 번째인가. 계약에 currentTurnIndex 는 없지만
  // turnOrder + currentTurn 으로 구할 수 있어 필드를 새로 요구하지 않는다.
  const turnIndex = state.currentTurn ? state.turnOrder.indexOf(state.currentTurn) : -1;

  const accused = state.players.find((p) => p.id === state.accused);
  const accusedVotes = state.accused ? (state.voteCounts[state.accused] ?? 0) : 0;

  // 잠금 규칙은 여기 한 곳에서만 정한다. Chat 은 prop 으로 받기만 한다 (설계 결정 6).
  const locked = blocked || (isDescribe && !isMyTurn);
  const lockedLabel = blocked ? '지금은 발언할 수 없습니다' : `${turnName}님의 차례입니다`;

  return (
    <div className="zt-screen">
      <header className="zt-head">
        <span className="zt-sub">
          {/* round 는 "지금 몇 번째 루프인가"라는 상태. 왜 돌아왔는지(사건)는
              시스템 메시지가 맡는다 — 대체 관계가 아니다 (설계 결정 10) */}
          <span className="zt-round">{state.round}라운드</span>
          {phaseLabel(state.phase)}
        </span>

        {/* category는 항상 공개, word는 라이어에게 null이라 자연히 숨는다 */}
        <span className="zt-word">
          {state.category}
          {state.word && ` / ${state.word}`}
        </span>

        {/* 좌측 참가자 목록을 없애면서 발언 순서·진행도가 갈 곳이 여기 하나뿐이다 */}
        {isDescribe && turnIndex >= 0 && (
          <span className="zt-turn">
            묘사 {turnIndex + 1}/{state.turnOrder.length}
            <span className="zt-turn-mark">▶</span>
            {turnName}
          </span>
        )}

        <Timer deadlineAt={state.deadlineAt} />
      </header>

      <div className="zt-players">
        {state.players.map((p) => (
          <span
            key={p.id}
            className={[
              'zt-player',
              p.isAlive && 'is-alive',
              p.id === state.myId && 'is-me',
              !p.isAlive && 'is-dead',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {p.isAlive ? '✓' : '-'} {p.label}
            {p.id === state.myId && ' (나)'}
          </span>
        ))}
      </div>

      {isFinalDefense && (
        <div className="zt-accused">
          <span className="zt-badge">지목됨</span>
          <strong>{accused?.label}</strong>
          <span className="zt-vote-count">{accusedVotes}표</span>
        </div>
      )}

      <div className="zt-body">
        <main className="zt-main">
          <Chat
            messages={state.messages}
            players={state.players}
            myId={state.myId}
            locked={locked}
            lockedLabel={lockedLabel}
            placeholder={isDescribe ? '묘사를 입력하세요…' : '메시지 입력…'}
            onSend={(text) => onEvent(isDescribe ? { t: 'describe', text } : { t: 'chat', text })}
          />
        </main>

        {isDebate && (
          <aside className="zt-side zt-side-wide">
            <VotePanel
              players={state.players}
              voteCounts={state.voteCounts}
              myVote={state.myVote}
              myId={state.myId}
              onVote={(targetId) => onEvent({ t: 'vote', targetId })}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function phaseLabel(phase: GameState['phase']): string {
  switch (phase) {
    case 'describe':
      return '묘사';
    case 'debate':
      return '토론 · 투표 진행 중';
    case 'finalDefense':
      return '최후 변론';
    case 'roleReveal':
      return '역할 배정';
    case 'lifeVote':
      return '생사 투표';
    case 'reveal':
      return '결과';
    case 'guessWord':
      return '제시어 추측';
    default:
      return ''; // lobby·botVote·result·survey 는 파트 D 담당이라 여기 오지 않는다
  }
}
