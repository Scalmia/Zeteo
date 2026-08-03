import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { Timer } from '../components/Timer';

/** S4 생사 투표 — 투표자 뷰 / 지목자 뷰 분기.
 *  지목자 본인은 투표에서 제외되므로 버튼 자체를 렌더하지 않는다. */
export function LifeVote({
  state,
  onEvent,
}: {
  state: GameState;
  onEvent: (e: ClientEvent) => void;
}) {
  const isAccused = state.accused === state.myId;
  const target = state.players.find((p) => p.id === state.accused);

  // 인원수에서 계산한다. 하드코딩 금지 (기획서 1절: 투표자 = 참가자 − 1, 과반 = ⌊투표자/2⌋ + 1)
  const voters = state.players.length - 1;
  const majority = Math.floor(voters / 2) + 1;

  if (isAccused) {
    return (
      <div className="zt-screen zt-center">
        <header className="zt-head">
          <span className="zt-sub">생사 투표</span>
          <Timer deadlineAt={state.deadlineAt} />
        </header>
        <div className="zt-card">
          <p className="zt-label">당신에 대한 투표가</p>
          <p className="zt-role">진행 중입니다</p>
          <p className="zt-muted">투표 불가</p>
        </div>
      </div>
    );
  }

  return (
    <div className="zt-screen zt-center">
      <header className="zt-head">
        <span className="zt-sub">생사 투표</span>
        <Timer deadlineAt={state.deadlineAt} />
      </header>

      <div className="zt-card">
        <p className="zt-label">대상</p>
        <p className="zt-role">{target?.name}</p>

        <div className="zt-choices">
          <button
            className={state.myLifeVote === true ? 'zt-choice is-mine' : 'zt-choice'}
            onClick={() => onEvent({ t: 'lifeVote', kill: true })}
          >
            죽인다
          </button>
          <button
            className={state.myLifeVote === false ? 'zt-choice is-mine' : 'zt-choice'}
            onClick={() => onEvent({ t: 'lifeVote', kill: false })}
          >
            살린다
          </button>
        </div>

        <p className="zt-muted">
          진행 · 죽인다 {state.lifeVoteCounts.kill} / 살린다 {state.lifeVoteCounts.spare}
          <br />
          {voters}명 중 {majority}표 = 처형
        </p>
      </div>
    </div>
  );
}
