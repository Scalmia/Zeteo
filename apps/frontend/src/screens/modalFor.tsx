import type { ReactNode } from 'react';
import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { BotVote } from './BotVote';
import { LifeVote } from './LifeVote';
import { Reveal } from './Reveal';
import { RoleReveal } from './RoleReveal';

/** 팝업이 뜨는 페이즈 목록. "모달을 그린다"와 "채팅을 잠근다"의 단일 기준이다 —
 *  두 곳에서 따로 판단하면 한쪽만 고쳐지는 구멍이 생긴다.
 *
 *  mock/GameScreenTest.tsx가 이 함수를 그대로 재사용한다(8/11) — 그 화면은 실제
 *  팝업 위에 mock 전용 칩 바를 같이 띄워야 해서 GameScreen을 통째로 쓰지 못하고
 *  MainScreen을 직접 조립하는데, 이때도 "어느 phase에 어떤 팝업"이라는 판단은 여기
 *  하나에만 있어야 한다(그래야 이 스위치가 나중에 바뀌어도 mock이 따로 안 어긋난다).
 *
 *  GameScreen.tsx가 아니라 별도 파일에 둔 이유: GameScreen.tsx는 컴포넌트만
 *  export해야 react-refresh(fast refresh)가 정상 동작한다 — 함수를 같이 export하면
 *  eslint react-refresh/only-export-components 규칙에 걸린다. */
export function modalFor(
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
    case 'botVote':
      return { title: '봇 지목', body: <BotVote state={state} onEvent={onEvent} /> };
    default:
      return null;
  }
}
