import type { PublicPlayer } from '@zeteo/shared-types';

interface Props {
  players: PublicPlayer[];
  myId: string;
  /** S1에서만 전달. 있으면 이 순서대로 정렬한다 */
  turnOrder?: string[];
  /** S1 순서 표시자 ▶ — 전원에게 동일하게 보인다 */
  currentTurn?: string | null;
  /** S3·S4 지목 대상 */
  accused?: string | null;
}

export function PlayerList({ players, myId, turnOrder, currentTurn, accused }: Props) {
  const ordered = turnOrder
    ? turnOrder.map((id) => players.find((p) => p.id === id)!).filter(Boolean)
    : players;

  return (
    <ul className="zt-players">
      {ordered.map((p) => (
        <li
          key={p.id}
          className={[
            'zt-player',
            p.id === currentTurn ? 'is-turn' : '',
            p.id === accused ? 'is-accused' : '',
            p.isAlive ? '' : 'is-dead',
          ]
            .join(' ')
            .trim()}
        >
          <span className="zt-player-marker">{p.id === currentTurn ? '▶' : ''}</span>
          <span className="zt-player-name">{p.name}</span>
          {p.id === myId && <span className="zt-player-me">나</span>}
        </li>
      ))}
    </ul>
  );
}
