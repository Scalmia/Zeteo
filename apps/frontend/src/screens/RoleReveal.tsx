import type { GameState } from '@zeteo/shared-types';
import { avatarInitial } from '../components/avatarInitial';

/** S0 역할 배정 — 시민 뷰 / 라이어 뷰 분기.
 *  분기의 유일한 기준은 word === null 이다 (서버가 라이어에게만 null을 보낸다).
 *
 *  GameScreen 이 Modal 로 감싸 메인화면 위에 띄운다 — 제목과 타이머는 Modal 이 그리므로
 *  여기서는 카드 내용만 만든다.
 *
 *  준비 버튼은 없다. roleReveal 은 서버 타이머(PHASE_DURATIONS.roleReveal)로만 넘어가고
 *  'ready' 는 lobby 단계에서만 의미가 있어 이 단계에선 서버가 무시한다. */
export function RoleReveal({ state }: { state: GameState }) {
  const isLiar = state.myRole === 'liar';
  // 8/13: 역할 옆에 "(참가자 라벨)" 표기 추가 — 다른 참가자 목록·투표창과 같은
  // 이니셜 규칙(avatarInitial)을 그대로 써서 "시민 (A)"처럼 보이게 한다.
  const myLabel = state.players.find((p) => p.id === state.myId)?.label ?? '';

  return (
    <>
      <p className="zt-label">당신의 역할</p>
      <p className={isLiar ? 'zt-role is-liar' : 'zt-role'}>
        {isLiar ? '라이어' : '시민'} ({avatarInitial(myLabel)})
      </p>

      <dl className="zt-kv">
        <dt>주제</dt>
        <dd>{state.category}</dd>
        <dt>제시어</dt>
        <dd className={state.word === null ? 'is-hidden' : ''}>{state.word ?? '? ? ?'}</dd>
      </dl>

      {/* 인원은 항상 players.length 에서 계산. 하드코딩 금지 */}
      <p className="zt-muted">{state.players.length}인 · 라이어 1</p>
    </>
  );
}
