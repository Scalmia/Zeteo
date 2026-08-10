import type { ReactNode } from 'react';
import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { Modal } from '../components/Modal';
import { LifeVote } from './LifeVote';
import { MainScreen } from './MainScreen';
import { Reveal } from './Reveal';
import { RoleReveal } from './RoleReveal';
import './game.css';

/**
 * 파트 C의 단일 진입점.
 * D(App.tsx)는 게임 페이즈일 때 이 컴포넌트 하나만 마운트하면 되고,
 * C의 내부 구성을 알 필요가 없다.
 *
 * 화면 구성은 두 겹이다.
 *   · MainScreen  — 게임 페이즈 내내 항상 떠 있는 채팅+투표 화면
 *   · Modal       — 아래 네 페이즈에서만 그 위에 얹히는 팝업
 * 팝업이 떠 있는 동안에는 blocked=true 로 뒤쪽 채팅 입력이 잠긴다.
 *
 * lobby / botVote / result / survey 는 파트 D 소유이므로 여기서 다루지 않는다.
 */
export function GameScreen({
  state,
  onEvent,
}: {
  state: GameState;
  onEvent: (e: ClientEvent) => void;
}) {
  const modal = modalFor(state, onEvent);

  return (
    <>
      <MainScreen state={state} onEvent={onEvent} blocked={modal !== null} />
      {modal && (
        <Modal title={modal.title} deadlineAt={state.deadlineAt}>
          {modal.body}
        </Modal>
      )}
    </>
  );
}

/** 팝업이 뜨는 페이즈 목록. "모달을 그린다"와 "채팅을 잠근다"의 단일 기준이다 —
 *  두 곳에서 따로 판단하면 한쪽만 고쳐지는 구멍이 생긴다. */
function modalFor(
  state: GameState,
  onEvent: (e: ClientEvent) => void,
): { title: string; body: ReactNode } | null {
  switch (state.phase) {
    case 'roleReveal':
      return { title: '역할 배정', body: <RoleReveal state={state} /> };
    case 'lifeVote':
      return { title: '생사 투표', body: <LifeVote state={state} onEvent={onEvent} /> };
    // reveal → guessWord 는 연속 흐름이라 같은 컴포넌트가 이어받는다 (설계 결정 5).
    // Modal 껍데기가 마운트된 채로 안쪽만 바뀌므로 전환이 끊겨 보이지 않는다.
    case 'reveal':
      return { title: '결과', body: <Reveal state={state} onEvent={onEvent} /> };
    case 'guessWord':
      return { title: '제시어 추측', body: <Reveal state={state} onEvent={onEvent} /> };
    default:
      return null;
  }
}
