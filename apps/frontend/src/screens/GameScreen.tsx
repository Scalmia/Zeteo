import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { Debate } from './Debate';
import { Describe } from './Describe';
import { FinalDefense } from './FinalDefense';
import { LifeVote } from './LifeVote';
import { Reveal } from './Reveal';
import { RoleReveal } from './RoleReveal';
import './game.css';

/**
 * 파트 C의 단일 진입점.
 * D(App.tsx)는 게임 페이즈일 때 이 컴포넌트 하나만 마운트하면 되고,
 * C의 화면 6개를 알 필요가 없다.
 *
 * lobby / botVote / result 는 파트 D 소유이므로 여기서 다루지 않는다.
 */
export function GameScreen({
  state,
  onEvent,
}: {
  state: GameState;
  onEvent: (e: ClientEvent) => void;
}) {
  switch (state.phase) {
    case 'roleReveal':
      return <RoleReveal state={state} onEvent={onEvent} />;
    case 'describe':
      return <Describe state={state} onEvent={onEvent} />;
    case 'debate':
      return <Debate state={state} onEvent={onEvent} />;
    case 'finalDefense':
      return <FinalDefense state={state} onEvent={onEvent} />;
    case 'lifeVote':
      return <LifeVote state={state} onEvent={onEvent} />;
    case 'reveal':
    case 'guessWord':
      return <Reveal state={state} onEvent={onEvent} />;
    default:
      return null; // 파트 D 담당 페이즈
  }
}
