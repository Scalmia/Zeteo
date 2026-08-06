import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { Timer } from '../components/Timer';

/** S0 역할 배정 — 시민 뷰 / 라이어 뷰 분기.
 *  분기의 유일한 기준은 word === null 이다 (서버가 라이어에게만 null을 보낸다).
 *
 *  roleReveal은 준비 버튼이 아니라 서버 타이머(PHASE_DURATIONS.roleReveal)로만
 *  넘어간다 — 'ready' 이벤트는 lobby 단계에서만 의미가 있고 이 단계에선 서버가
 *  무시하므로, 누를 게 없는 버튼 대신 남은 시간만 보여준다. */
export function RoleReveal({
  state,
}: {
  state: GameState;
  onEvent: (e: ClientEvent) => void;
}) {
  const isLiar = state.myRole === 'liar';

  return (
    <div className="zt-screen zt-center">
      <header className="zt-head">
        <span className="zt-logo">Zeteo</span>
        {/* 인원은 항상 players.length 에서 계산. 하드코딩 금지 */}
        <span className="zt-sub">{state.players.length}인 · 라이어 1</span>
      </header>

      <div className="zt-card">
        <p className="zt-label">당신의 역할</p>
        <p className={isLiar ? 'zt-role is-liar' : 'zt-role'}>{isLiar ? '라이어' : '시민'}</p>

        <dl className="zt-kv">
          <dt>주제</dt>
          <dd>{state.category}</dd>
          <dt>제시어</dt>
          <dd className={state.word === null ? 'is-hidden' : ''}>{state.word ?? '? ? ?'}</dd>
        </dl>

        <Timer deadlineAt={state.deadlineAt} />
      </div>
    </div>
  );
}
